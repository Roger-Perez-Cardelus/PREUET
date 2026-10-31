#!/usr/bin/env python3
"""Read real shelf prices for new Preuet products from the supermarkets' own online shops (run from GitHub Actions).

    python3 tools/fetch_prices.py probe            which shop endpoints answer from here, with a sample
    python3 tools/fetch_prices.py collect          saves what the shops list (Mercadona's whole catalogue, Consum's search
                                                   for each new product) to tmp-raw/, to build and check offerings by hand
    python3 tools/fetch_prices.py build            turns tmp-raw/ into products and offerings in data/preuet-data.json
                                                   (tools/new_products.py: which shelf items count as each product)

Only Mercadona (tienda.mercadona.es, its shop's public JSON) and Consum (tienda.consum.es) answer from GitHub's runners;
Dia and Carrefour refuse automated reads (403). The tool waits between calls.
"""
import gzip
import json
import pathlib
import sys
import time
import urllib.parse
import urllib.request

UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36 Preuet/1.0 (EETAC-UPC student project)"
PROBES = {
    "mercadona-categories": "https://tienda.mercadona.es/api/categories/?lang=es&wh=bcn1",
    "mercadona-category-112": "https://tienda.mercadona.es/api/categories/112/?lang=es&wh=bcn1",
    "consum": "https://tienda.consum.es/api/rest/V1.0/catalog/product?limit=3&offset=0&q=leche",
    "dia": "https://www.dia.es/api/v1/search-back/search/reduced?q=leche&page=1",
    "carrefour": "https://www.carrefour.es/search-api/query/v1/search?query=leche&scope=desktop&lang=es&rows=3&start=0&origin=default&f.op=OR",
    "bonpreu": "https://www.compraonline.bonpreuesclat.cat/api/v5/products/search?term=llet&limit=3",
    "bonarea": "https://www.bonarea-online.com/ca/shop/search?query=llet",
    "openprices": "https://prices.openfoodfacts.org/api/v1/prices?size=3&location_osm_address_country=Espa%C3%B1a&order_by=-date",
}


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json, text/html;q=0.8", "Accept-Language": "es-ES,es;q=0.9,ca;q=0.8"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, r.headers.get("content-type", ""), r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.headers.get("content-type", ""), e.read()[:300]
    except Exception as e:  # noqa: BLE001
        return 0, "", str(e).encode()


RAW = pathlib.Path(__file__).resolve().parent.parent / "tmp-raw"


def get_json(url, pause=1.0):
    time.sleep(pause)
    st, ct, body = fetch(url)
    if st != 200:
        print("  !", st, url)
        return None
    try:
        return json.loads(body)
    except ValueError:
        return None


def cmd_collect():
    sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
    from new_products import PRODUCTS
    RAW.mkdir(exist_ok=True)
    merc = []
    top = get_json("https://tienda.mercadona.es/api/categories/?lang=es&wh=bcn1") or {"results": []}
    for group in top["results"]:
        for c in group.get("categories", []):
            d = get_json(f"https://tienda.mercadona.es/api/categories/{c['id']}/?lang=es&wh=bcn1")
            for sub in (d or {}).get("categories", []):
                for p in sub.get("products", []):
                    merc.append({"id": p.get("id"), "name": p.get("display_name"), "packaging": p.get("packaging"), "url": p.get("share_url"),
                                 "cat": group["name"] + " / " + c["name"] + " / " + sub.get("name", ""), "pi": p.get("price_instructions")})
            print(f"mercadona {c['name']}: {len(merc)}", flush=True)
    (RAW / "mercadona.json.gz").write_bytes(gzip.compress(json.dumps(merc, ensure_ascii=False).encode()))
    consum = {}
    for p in PRODUCTS:
        items = []
        for off in (0, 40):
            d = get_json("https://tienda.consum.es/api/rest/V1.0/catalog/product?" + urllib.parse.urlencode({"limit": 40, "offset": off, "q": p["q"]}))
            items += (d or {}).get("products", [])
            if not d or not d.get("hasMore"):
                break
        consum[p["id"]] = items
        print(f"consum {p['id']}: {len(items)}", flush=True)
    (RAW / "consum.json.gz").write_bytes(gzip.compress(json.dumps(consum, ensure_ascii=False).encode()))
    # more shops to try next time
    for name, url in {"bonpreu-ocado": "https://www.compraonline.bonpreuesclat.cat/api/webproductpagews/v5/product-pages/search?includeAdditionalPageInfo=true&maxPageSize=3&q=llet",
                      "bonpreu-v6": "https://www.compraonline.bonpreuesclat.cat/api/v6/products/search?term=llet&limit=3",
                      "ametller": "https://www.ametllerorigen.com/ca/catalogsearch/result/?q=llet"}.items():
        st, ct, body = fetch(url)
        print(f"== {name}: {st} {ct} {len(body)}: {body[:300]!r}")


# ---------------------------------------------------------------- build
import re  # noqa: E402
import statistics  # noqa: E402
import unicodedata  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "preuet-data.json"
OWN_BRANDS = re.compile(r"\b(hacendado|bosque verde|deliplus|compy|consum|mascoteros|steinburg|adlerbrau)\b")
COUNT = re.compile(r"(\d+)\s*(?:x\s*)?(?:u|ud|uds|unidades|unid|bolsitas|bolsas|pastillas|capsulas|tabletas|toallitas|lavados|dosis)\b")


def norm(s):
    s = unicodedata.normalize("NFD", str(s or "").lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return " " + re.sub(r"\s+", " ", re.sub(r"[^a-z0-9,. ]", " ", s)).strip() + " "


def matches(p, text):
    t = norm(text)
    for group in p["must"]:
        if not any(re.search(r"\b" + re.escape(norm(w).strip()), t) for w in group):
            return False
    return not any(norm(w).strip() in t for w in p.get("avoid", []))


def mercadona_items(raw, p, day):
    out = []
    for it in raw:
        pi = it.get("pi") or {}
        text = (it.get("name") or "") + " " + (it.get("packaging") or "")
        if not matches(p, text):
            continue
        try:
            price = float(pi.get("unit_price"))
            bulk = float(pi.get("bulk_price") or 0)
        except (TypeError, ValueError):
            continue
        ref = str(pi.get("reference_format") or "").lower().strip()
        if p["unit"] in ("kg", "l"):
            per = {"kg": ("kg", 1), "l": ("l", 1), "100 ml": ("l", 0.1), "100 g": ("kg", 0.1)}.get(ref)
            if not per or per[0] != p["unit"] or not bulk:
                continue
            size = round(price / bulk * per[1], 3)
        elif p["unit"] == "rentat":
            if ref != "lv" or not str(pi.get("total_units") or "").isdigit():
                continue
            size = int(pi["total_units"])  # washes per bottle
        elif p["unit"] == "ud" and p["ref"] == 1:
            size = 1
        else:  # counted things: units, bags, tablets
            m = COUNT.search(norm(text))
            if m:
                size = int(m.group(1))
            elif str(pi.get("total_units") or "").isdigit():
                size = int(pi["total_units"])
            elif str(pi.get("size_format")) == "ud" and pi.get("unit_size"):
                size = int(float(pi["unit_size"]))
            else:
                continue
        out.append({"c": "mercadona", "name": (it["name"] + " " + (it.get("packaging") or "")).strip(), "price": round(price, 2), "size": size,
                    "src": it.get("url"), "own": bool(OWN_BRANDS.search(norm(text)))})
    return out


def consum_items(raw, p, day):
    out = []
    for it in raw.get(p["id"], []):
        pd = it.get("productData") or {}
        text = (pd.get("description") or pd.get("name") or "")
        brand = (pd.get("brand") or {}).get("name") or ""
        if not matches(p, text + " " + brand):
            continue
        prices = (it.get("priceData") or {}).get("prices") or []
        reg = next((x for x in prices if x.get("id") == "PRICE"), prices[0] if prices else None)
        if not reg:
            continue
        price, unit_price = reg["value"].get("centAmount"), reg["value"].get("centUnitAmount")
        upt = norm((it.get("priceData") or {}).get("unitPriceUnitType")).strip()
        if p["unit"] in ("kg", "l"):
            per = {"1 kg": ("kg", 1), "1 l": ("l", 1), "100 ml": ("l", 0.1), "100 g": ("kg", 0.1), "100 gr": ("kg", 0.1)}.get(upt)
            if not unit_price or not per or per[0] != p["unit"]:
                continue
            size = round(price / unit_price * per[1], 3)
        elif p["unit"] == "rentat":
            m = re.search(r"(\d+)\s*lv", norm(text))
            if not m:
                continue
            size = int(m.group(1))
        elif p["unit"] == "ud" and p["ref"] == 1:
            size = 1
        else:
            m = COUNT.search(norm(text)) or re.search(r"(\d+)\s*u\b", norm(text))
            if not m:
                continue
            size = int(m.group(1))
        offer = next((x for x in prices if x.get("id") != "PRICE"), None)
        promo = ("Oferta: " + str(offer["value"].get("centAmount")).replace(".", ",") + " €")[:60] if offer else ""
        out.append({"c": "consum", "name": (brand + " " + text).strip() if brand and brand.upper() not in text.upper() else text, "price": round(price, 2),
                    "size": size, "src": pd.get("url"), "own": brand.upper() == "CONSUM", "promo": promo, "ean": it.get("ean")})
    return out


def cmd_build():
    sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
    from new_products import PRODUCTS
    day = sys.argv[2] if len(sys.argv) > 2 else time.strftime("%Y-%m-%d")
    merc = json.loads(gzip.decompress((RAW / "mercadona.json.gz").read_bytes()))
    cons = json.loads(gzip.decompress((RAW / "consum.json.gz").read_bytes()))
    d = json.loads(DATA.read_text(encoding="utf-8"))
    have = {p["id"] for p in d["products"]}
    report = []
    for p in PRODUCTS:
        found = [x for x in mercadona_items(merc, p, day) + consum_items(cons, p, day) if p["size"][0] <= x["size"] <= p["size"][1] and x["price"] > 0]
        for x in found:
            x["up"] = round(x["price"] / x["size"], 4)
        if found:  # drop unit prices far from the rest (a wrong size read from the name)
            med = statistics.median(x["up"] for x in found)
            found = [x for x in found if med / 3 <= x["up"] <= med * 3]
        keep = []
        for c in ("mercadona", "consum"):
            mine = sorted((x for x in found if x["c"] == c), key=lambda x: x["up"])
            seen, uniq = set(), []
            for x in mine:  # the same pack in another scent or colour: once is enough
                if (x["price"], x["size"]) not in seen:
                    seen.add((x["price"], x["size"]))
                    uniq.append(x)
            own = [x for x in uniq if x["own"]][:2]
            other = [x for x in uniq if not x["own"]][:2]
            keep += own + other
        report.append((p["id"], keep))
        if not keep:
            continue
        prod = {k: p[k] for k in ("id", "ca", "es", "cat", "unit", "ref", "ref_ca", "ref_es")}
        prod.update(kind="equivalent", tags=p.get("tags", []), allergens=p.get("allergens", []), traces=p.get("traces", []), nut=p.get("nut"))
        d["products"] = [x for x in d["products"] if x["id"] != p["id"]] + [prod]
        d["offerings"] = [o for o in d["offerings"] if o["p"] != p["id"]]
        fresh = p["cat"] == "fruita"
        for x in keep:
            o = {"p": p["id"], "c": x["c"], "name": x["name"][:120], "price": x["price"], "size": x["size"], "up": x["up"], "promo": x.get("promo", ""),
                 "src": x["src"], "date": day, "st": "web", "desde": False, "bk": "fresc" if fresh and not x["own"] else ("mb" if x["own"] else "fab"), "rank": 0}
            if x.get("ean"):
                o["ean"] = x["ean"]
            d["offerings"].append(o)
    sys.path.insert(0, str(ROOT / "tools"))
    import update_data
    update_data.fix(d, d["meta"]["updated"])
    update_data.save(d)
    for pid, keep in report:
        print(f"{pid:22s} {'NEW' if pid not in have else '   '} " + (" | ".join(f"{x['c'][:4]} {x['name'][:42]} {x['price']}€/{x['size']}" for x in keep) or "— nothing found"))


def cmd_probe():
    for name, url in PROBES.items():
        st, ct, body = fetch(url)
        print(f"== {name}: {st} {ct} {len(body)} bytes")
        print(body[:900].decode("utf-8", "replace").replace("\n", " "))
        time.sleep(1.5)


if __name__ == "__main__":
    {"probe": cmd_probe, "collect": cmd_collect, "build": cmd_build}[sys.argv[1]]()
