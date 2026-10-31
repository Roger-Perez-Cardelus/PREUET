#!/usr/bin/env python3
"""Weekly price and offer update for Preuet (data/preuet-data.json).

    python3 tools/update_data.py worklist [--out FILE]
        Pages to re-read, grouped by chain, each with the product names Preuet tracks there.

    python3 tools/update_data.py apply-prices CAPTURES.json [--date YYYY-MM-DD] [--accept-big] [--dry-run]
        CAPTURES.json = {"<page url>": [{"name": "...", "price": 1.23, "promo": "..."}, ...], ...}
        A page that is not in the source list (found again through a web search) is accepted when its site
        identifies the chain, or written as {"<page url>": {"chain": "<chain id>", "items": [...]}}.
        Matches each captured product to a tracked one of the same chain by name, then updates its price,
        unit price, promotion and date. Products not seen keep their old price and date (the app marks
        prices older than 30 days). A unit-price change above 50 % is held back unless --accept-big.

    python3 tools/update_data.py apply-offers OFFERS.json [--date YYYY-MM-DD] [--dry-run]
        OFFERS.json = [{"c": "bonpreu", "title": "...", "price": 2.5, "was": 3.1, "mech": "-20 %",
                        "frm": "2026-10-19", "to": "2026-10-25", "src": "https://...", "p": "llet-sencera"|null}, ...]
        Becomes the new offer list (current and upcoming); ended offers are dropped.

    python3 tools/update_data.py check [--fix] [--date YYYY-MM-DD]
        Validates the file. With --fix it also recomputes counts, ranks, the source list and the data date.
        Warns (does not fail) when the data is more than 8 days old.

    python3 tools/update_data.py history [--date YYYY-MM-DD]
        Adds this week's prices to data/history.json (apply-prices does it too). Safe to run twice.

Everything writes data/preuet-data.json in place (keep it under version control) and prints a short report.
"""
import argparse
import collections
import datetime as dt
import difflib
import json
import os
import pathlib
import re
import sys
import unicodedata

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "preuet-data.json"
HISTORY = ROOT / "data" / "history.json"
FRESH_DAYS = 30
STALE_DAYS = 8
BIG_CHANGE = 0.5
CHAIN_IDS = None


# ---------------------------------------------------------------- helpers
def load():
    return json.loads(DATA.read_text(encoding="utf-8"))


def save(d):
    txt = json.dumps(d, ensure_ascii=False, separators=(",", ":"))
    if "</" in txt:
        raise SystemExit("refusing to write: data contains '</'")
    DATA.write_text(txt, encoding="utf-8")


def today_iso(arg):
    if arg:
        dt.date.fromisoformat(arg)
        return arg
    return dt.date.today().isoformat()


def norm(s):
    s = unicodedata.normalize("NFD", str(s or "").lower())
    s = "".join(ch for ch in s if unicodedata.category(ch) != "Mn")
    s = s.replace("·", "").replace(",", ".")
    s = re.sub(r"[^a-z0-9. ]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def numbers(s):
    """Numbers in a product name ("6x1L", "500 g", "1,5 l") must match exactly: they decide the pack."""
    return sorted(re.findall(r"\d+(?:\.\d+)?", norm(s)))


def days(a, b):
    return (dt.date.fromisoformat(b) - dt.date.fromisoformat(a)).days


def chain_of_url(d, url):
    """Chain of a page: exact match in the source list, else by site (a page found again through a web search)."""
    for s in d["sources"]:
        if s["url"] == url:
            return s["c"]
    for o in d["offerings"]:
        if o.get("src") == url:
            return o["c"]
    m = re.match(r"^https://([^/]+)(/[^?#]*)?", url or "")
    if not m:
        return None
    host, path = m.group(1).lower(), (m.group(2) or "").lower()
    if host.endswith("radarsuper.com") or host.endswith("leaflets.schwarz"):
        for c in ("lidl", "aldi"):
            if ("/" + c in path) or (host.endswith("leaflets.schwarz") and c == "lidl"):
                return c
        return None
    hosts = collections.defaultdict(set)
    for s in d["sources"]:
        hm = re.match(r"^https://([^/]+)", s["url"])
        if hm:
            hosts[hm.group(1).lower()].add(s["c"])
    for c in d["chains"]:
        for key in ("site", "shop"):
            hm = re.match(r"^https://([^/]+)", c.get(key) or "")
            if hm:
                hosts[hm.group(1).lower()].add(c["id"])
    found = hosts.get(host, set())
    return next(iter(found)) if len(found) == 1 else None


# ---------------------------------------------------------------- worklist
def cmd_worklist(args):
    d = load()
    by_url = collections.OrderedDict()
    for s in d["sources"]:
        by_url.setdefault(s["url"], {"chain": s["c"], "type": s["type"], "names": []})
    for o in d["offerings"]:
        by_url.setdefault(o["src"], {"chain": o["c"], "type": o["st"], "names": []})["names"].append(o["name"])
    chains = collections.OrderedDict()
    for url, w in by_url.items():
        chains.setdefault(w["chain"], []).append({"url": url, "type": w["type"], "track": sorted(set(w["names"]))})
    out = {"data_date": d["meta"]["updated"], "pages": sum(len(v) for v in chains.values()), "chains": chains}
    txt = json.dumps(out, ensure_ascii=False, indent=1)
    if args.out:
        pathlib.Path(args.out).write_text(txt, encoding="utf-8")
        print(f"worklist: {out['pages']} pages in {len(chains)} chains -> {args.out}")
    else:
        print(txt)


# ---------------------------------------------------------------- prices
def best_match(name, candidates):
    n, nums = norm(name), numbers(name)
    exact = [o for o in candidates if norm(o["name"]) == n]
    if exact:
        return exact, 1.0
    best, score = [], 0.0
    for o in candidates:
        if numbers(o["name"]) != nums:
            continue
        r = difflib.SequenceMatcher(None, n, norm(o["name"])).ratio()
        if r > score + 1e-9:
            best, score = [o], r
        elif abs(r - score) <= 1e-9:
            best.append(o)
    return (best, score) if score >= 0.9 else ([], score)


def cmd_apply_prices(args):
    d = load()
    day = today_iso(args.date)
    caps = json.loads(pathlib.Path(args.captures).read_text(encoding="utf-8"))
    rep = collections.defaultdict(collections.Counter)
    held, unmatched, seen = [], [], set()
    for url, entry in caps.items():
        items = entry.get("items", []) if isinstance(entry, dict) else entry
        chain = entry.get("chain") if isinstance(entry, dict) and entry.get("chain") else chain_of_url(d, url)
        if chain not in {c["id"] for c in d["chains"]}:
            unmatched.append((url, "unknown chain: give it as {\"chain\": \"<id>\", \"items\": [...]}"))
            continue
        if not str(url).startswith("https://"):
            unmatched.append((url, "not an https page"))
            continue
        same_page = [o for o in d["offerings"] if o["c"] == chain and o["src"] == url]
        same_chain = [o for o in d["offerings"] if o["c"] == chain]
        for it in items or []:
            try:
                price = round(float(str(it.get("price")).replace(",", ".")), 2)
            except (TypeError, ValueError):
                rep[chain]["bad price"] += 1
                continue
            if not (0 < price < 500):
                rep[chain]["bad price"] += 1
                continue
            hits, _ = best_match(it.get("name", ""), same_page)
            if not hits:
                hits, _ = best_match(it.get("name", ""), same_chain)
            if not hits:
                unmatched.append((chain, it.get("name", "")))
                continue
            for o in hits:
                key = id(o)
                if key in seen:
                    continue
                seen.add(key)
                new_up = round(price / o["size"], 2) if o.get("size") else o["up"]
                change = abs(new_up - o["up"]) / o["up"] if o.get("up") else 0
                if change > BIG_CHANGE and not args.accept_big:
                    held.append((chain, o["name"], o["price"], price))
                    continue
                promo = str(it.get("promo") or "").strip()[:120]
                if price != o["price"]:
                    rep[chain]["price changed"] += 1
                else:
                    rep[chain]["same price"] += 1
                if o["src"] != url:
                    rep[chain]["read on a new page"] += 1
                o["price"], o["up"], o["promo"], o["date"], o["src"] = price, new_up, promo, day, url
    stale = collections.Counter(o["c"] for o in d["offerings"] if days(o["date"], day) > FRESH_DAYS)
    print(f"prices for {day}")
    for c in sorted(set(rep) | set(stale)):
        r = rep.get(c, {})
        moved = f" · from a new page {r.get('read on a new page')}" if r.get("read on a new page") else ""
        print(f"  {c:10s} changed {r.get('price changed', 0):3d} · same {r.get('same price', 0):3d} · bad {r.get('bad price', 0)} · older than {FRESH_DAYS} days {stale.get(c, 0)}{moved}")
    if held:
        print(f"held back ({len(held)} unit-price changes over {int(BIG_CHANGE * 100)} %; re-check the page, then rerun with --accept-big):")
        for h in held[:40]:
            print("   ", h)
    if unmatched:
        print(f"not matched ({len(unmatched)}): new products or names that changed; ignored")
        for u in unmatched[:40]:
            print("   ", u)
    fix(d, day)
    if args.dry_run:
        print("dry run: nothing written")
    else:
        save(d)
        print(f"written {DATA.relative_to(ROOT)}")
        n = record_history(d, day)
        print(f"history: {n} prices for {day} in {HISTORY.relative_to(ROOT)}")


# ---------------------------------------------------------------- history
def snapshot(d, day, window=1):
    """Cheapest unit price per product and chain among the prices read on `day` (prices not re-read keep their old date)."""
    best = {}
    for o in d["offerings"]:
        if o.get("st") == "comunitat" or not (0 <= days(o["date"], day) < window):
            continue
        k = o["p"] + "|" + o["c"]
        if k not in best or o["up"] < best[k]:
            best[k] = o["up"]
    return best


def record_history(d, day, path=None):
    path = path or HISTORY
    h = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {"v": 1, "dates": [], "s": {}}
    snap = snapshot(d, day)
    if not snap:
        return 0
    if day not in h["dates"]:
        h["dates"] = sorted(h["dates"] + [day])
    for k, up in snap.items():
        rows = [r for r in h["s"].get(k, []) if r[0] != day]
        rows.append([day, round(up, 4)])
        h["s"][k] = sorted(rows)
    path.write_text(json.dumps(h, ensure_ascii=False, separators=(",", ":"), sort_keys=True), encoding="utf-8")
    return len(snap)


def cmd_history(args):
    d = load()
    day = args.date or d["meta"]["updated"]
    n = record_history(d, day)
    print(f"history: {n} prices for {day} in {HISTORY.relative_to(ROOT)}")


# ---------------------------------------------------------------- offers
OFFER_KEYS = ("c", "title", "price", "was", "mech", "frm", "to", "src", "p")


def clean_offer(o, d):
    chains = {c["id"] for c in d["chains"]}
    prods = {p["id"] for p in d["products"]}
    if o.get("c") not in chains or not str(o.get("title") or "").strip():
        return None
    out = {k: o.get(k) for k in OFFER_KEYS}
    out["title"] = str(out["title"]).strip()[:140]
    out["mech"] = (str(out["mech"]).strip()[:80] or None) if out["mech"] else None
    for k in ("price", "was"):
        if out[k] is not None:
            out[k] = round(float(str(out[k]).replace(",", ".")), 2)
            if not (0 < out[k] < 500):
                out[k] = None
    for k in ("frm", "to"):
        if out[k]:
            dt.date.fromisoformat(out[k])
    if out["frm"] and out["to"] and out["frm"] > out["to"]:
        return None
    if out["p"] not in prods:
        out["p"] = None
    if not str(out["src"] or "").startswith("https://"):
        return None
    return out


def cmd_apply_offers(args):
    d = load()
    day = today_iso(args.date)
    raw = json.loads(pathlib.Path(args.offers).read_text(encoding="utf-8"))
    new, dropped = [], 0
    seen = set()
    for o in raw:
        c = clean_offer(o, d)
        if not c or (c["to"] and c["to"] < day):
            dropped += 1
            continue
        k = (c["c"], norm(c["title"]), c["frm"], c["to"])
        if k in seen:
            continue
        seen.add(k)
        new.append(c)
    now = sum(1 for o in new if not (o["frm"] and o["frm"] > day))
    print(f"offers for {day}: {len(new)} kept ({now} current, {len(new) - now} upcoming), {dropped} dropped (ended or invalid)")
    print("  by chain:", dict(collections.Counter(o["c"] for o in new)))
    d["offers"] = new
    fix(d, day)
    if args.dry_run:
        print("dry run: nothing written")
    else:
        save(d)
        print(f"written {DATA.relative_to(ROOT)}")


# ---------------------------------------------------------------- check / fix
def fix(d, day):
    groups = collections.defaultdict(list)
    for o in d["offerings"]:
        groups[(o["p"], o["c"])].append(o)
    for g in groups.values():
        g.sort(key=lambda o: (o["up"], o["price"]))
        for i, o in enumerate(g):
            o["rank"] = i
    per = collections.defaultdict(set)
    for o in d["offerings"]:
        per[o["c"]].add(o["p"])
    for c in d["chains"]:
        c["n_products"] = len(per[c["id"]])
    known = {s["url"] for s in d["sources"]}
    for o in d["offerings"]:
        if o["src"] not in known:
            d["sources"].append({"c": o["c"], "url": o["src"], "type": o["st"]})
            known.add(o["src"])
    d["meta"].update({"version": day, "updated": day, "n_prices": len(d["offerings"]), "n_products": len(d["products"]),
                      "n_chains": len(d["chains"])})


def problems(d, day):
    out = []
    P = {p["id"] for p in d["products"]}
    C = {c["id"] for c in d["chains"]}
    R = {r["id"] for r in d["recipes"]}
    for o in d["offerings"]:
        if o["p"] not in P or o["c"] not in C:
            out.append(f"offering refers to unknown product/chain: {o['p']}/{o['c']}")
        if not (0 < o["price"] < 500) or not (o["size"] > 0) or not (o["up"] > 0):
            out.append(f"bad price/size: {o['c']} {o['name']}")
        if not str(o.get("src", "")).startswith("https://"):
            out.append(f"offering without https source: {o['name']}")
        if o["date"] > day:
            out.append(f"price dated in the future: {o['name']} {o['date']}")
    for o in d["offers"]:
        if o["c"] not in C:
            out.append(f"offer with unknown chain: {o['title']}")
        if o.get("frm") and o.get("to") and o["frm"] > o["to"]:
            out.append(f"offer ends before it starts: {o['title']}")
    for r in d["recipes"]:
        for pid, q in r["ing"]:
            if pid not in P or not q > 0:
                out.append(f"recipe {r['id']} has a bad ingredient {pid}")
    for t in d["templates"]:
        for pid, n in t["items"]:
            if pid not in P or not n > 0:
                out.append(f"template {t['id']} has a bad item {pid}")
    if len(R) != len(d["recipes"]):
        out.append("duplicate recipe ids")
    m = d["meta"]
    if m.get("n_prices") != len(d["offerings"]):
        out.append("meta.n_prices is out of date (run check --fix)")
    txt = json.dumps(d, ensure_ascii=False)
    if "</" in txt:
        out.append("data contains '</'")
    return out


def cmd_check(args):
    d = load()
    day = today_iso(args.date)
    if args.fix:
        fix(d, day)
    probs = problems(d, day)
    fresh = sum(1 for o in d["offerings"] if days(o["date"], day) <= FRESH_DAYS)
    print(f"data {d['meta']['updated']}: {len(d['offerings'])} prices ({fresh} from the last {FRESH_DAYS} days), "
          f"{len(d['products'])} products, {len(d['offers'])} offers, {len(d['recipes'])} recipes")
    for c in d["chains"]:
        mine = [o for o in d["offerings"] if o["c"] == c["id"]]
        newest = max((o["date"] for o in mine), default=None)
        flag = ""
        if newest and days(newest, day) > FRESH_DAYS and c["status"] not in ("antic", "sense", "ofertes"):
            flag = "  <- newest price is old: set status 'antic' or re-read its pages"
        print(f"  {c['id']:10s} {c['status']:8s} {c['n_products']:3d} products · newest {newest or '—'}{flag}")
    age = days(d["meta"]["updated"], day)
    if age > STALE_DAYS:
        msg = f"the data is {age} days old (updated {d['meta']['updated']}): run the weekly update (tools/UPDATE.md)"
        print("warning:", msg)
        if os.environ.get("GITHUB_ACTIONS"):
            print(f"::warning title=Dades velles::Les dades són de fa {age} dies ({d['meta']['updated']}). Cal fer l'actualització setmanal.")
    if probs:
        print(f"{len(probs)} problem(s):")
        for p in probs[:60]:
            print("   ", p)
    if args.fix and not probs:
        save(d)
        print(f"written {DATA.relative_to(ROOT)}")
    sys.exit(1 if probs else 0)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    w = sub.add_parser("worklist"); w.add_argument("--out")
    p = sub.add_parser("apply-prices"); p.add_argument("captures"); p.add_argument("--date"); p.add_argument("--accept-big", action="store_true"); p.add_argument("--dry-run", action="store_true")
    o = sub.add_parser("apply-offers"); o.add_argument("offers"); o.add_argument("--date"); o.add_argument("--dry-run", action="store_true")
    c = sub.add_parser("check"); c.add_argument("--fix", action="store_true"); c.add_argument("--date")
    hs = sub.add_parser("history"); hs.add_argument("--date")
    a = ap.parse_args()
    {"worklist": cmd_worklist, "apply-prices": cmd_apply_prices, "apply-offers": cmd_apply_offers, "check": cmd_check, "history": cmd_history}[a.cmd](a)


if __name__ == "__main__":
    main()
