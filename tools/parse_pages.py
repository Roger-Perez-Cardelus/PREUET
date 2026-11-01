#!/usr/bin/env python3
"""Turns the source pages saved by `tools/fetch_prices.py pages` (tmp-raw/pages.json.gz) into captures.json for
`tools/update_data.py apply-prices` (the weekly procedure's own matcher and checks then decide what changes).

    python3 tools/parse_pages.py [OUT.json]

Readers: Ametller Origen (schema.org JSON-LD), Bonpreu (the shop's page state), bonÀrea (HTML), supersupers.com
(Mercadona packs the shop's own catalogue no longer lists under the same name) and radarsuper.com (only prices it marks
as current; "Último precio conocido" ones are old and left out). Carrefour and Dia refuse automated reads (403).
"""
import gzip
import html
import json
import pathlib
import re
import sys

RAW = pathlib.Path(__file__).resolve().parent.parent / "tmp-raw" / "pages.json.gz"


def num(s):
    return float(str(s).replace(".", "").replace(",", ".")) if "," in str(s) else float(s)


def ametller(body):
    out = []
    for m in re.finditer(r'<script[^>]*application/ld\+json[^>]*>(.*?)</script>', body, re.S):
        try:
            j = json.loads(m.group(1))
        except ValueError:
            continue
        for el in j.get("itemListElement", []) if isinstance(j, dict) else []:
            it = el.get("item") if isinstance(el, dict) else None
            if not isinstance(it, dict):
                continue
            offer = it.get("offers") if isinstance(it.get("offers"), dict) else {}
            if it.get("name") and offer.get("price") is not None:
                out.append({"name": html.unescape(it["name"]), "price": float(offer["price"]), "promo": ""})
    return out


def bonpreu(body):
    out = []
    for m in re.finditer(r'"name":"((?:[^"\\]|\\.)*)","price":\{"current":\{"amount":"([\d.]+)"', body):
        name = json.loads('"' + m.group(1) + '"')
        out.append({"name": name, "price": float(m.group(2)), "promo": ""})
    return out


def bonarea(body):
    out = []
    for m in re.finditer(r'<div class=text><p>(.*?)<div class=weight>(.*?)</div>.*?<div class=price><span>([\d.,]+)\s*€', body, re.S):
        name = html.unescape(re.sub(r"<[^>]+>", "", m.group(1))).strip()
        out.append({"name": name, "price": num(m.group(3)), "promo": ""})
    return out


def supersupers(body):
    out = []
    for m in re.finditer(r'<h2[^>]*>(.*?)</h2>.*?desde\s*<span[^>]*>\s*([\d.,]+)\s*€', body, re.S):
        name = html.unescape(re.sub(r"<[^>]+>|\s+", " ", m.group(1))).strip()
        out.append({"name": name, "price": num(m.group(2)), "promo": ""})
    return out


def radarsuper(body):
    out = []
    for card in body.split('data-slot="card"')[1:]:
        t = re.search(r'data-slot="card-title"[^>]*>\s*<a[^>]*>(.*?)</a>', card, re.S)
        p = re.search(r'text-base font-semibold">\s*([\d.,]+)\s*€', card)
        if not t or not p or "ltimo precio conocido" in card:
            continue  # no price, or an old one
        out.append({"name": html.unescape(re.sub(r"<[^>]+>", "", t.group(1))).strip(), "price": num(p.group(1)), "promo": ""})
    return out


READERS = {"ametllerorigen.com": ametller, "bonpreuesclat.cat": bonpreu, "bonarea-online.com": bonarea,
           "supersupers.com": supersupers, "radarsuper.com": radarsuper}


def main():
    pages = json.loads(gzip.decompress(RAW.read_bytes()))
    caps, report = {}, {}
    for url, page in pages.items():
        reader = next((f for host, f in READERS.items() if host in url), None)
        host = re.sub(r"https://(www\.)?", "", url).split("/")[0]
        if not reader or page["status"] != 200:
            report.setdefault(host, [0, 0, 0])[2] += 1
            continue
        items = [x for x in reader(page["body"]) if 0 < x["price"] < 500]
        report.setdefault(host, [0, 0, 0])
        report[host][0] += 1
        report[host][1] += len(items)
        if items:
            caps[url] = items
    out = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "captures.json")
    out.write_text(json.dumps(caps, ensure_ascii=False, indent=1), encoding="utf-8")
    for host, (ok, n, bad) in sorted(report.items()):
        print(f"{host:34s} pages read {ok:3d} · shelf items {n:5d} · unreadable {bad}")
    print(f"written {out}")


if __name__ == "__main__":
    main()
