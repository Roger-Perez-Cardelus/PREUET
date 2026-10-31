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


def cmd_probe():
    for name, url in PROBES.items():
        st, ct, body = fetch(url)
        print(f"== {name}: {st} {ct} {len(body)} bytes")
        print(body[:900].decode("utf-8", "replace").replace("\n", " "))
        time.sleep(1.5)


if __name__ == "__main__":
    {"probe": cmd_probe, "collect": cmd_collect}[sys.argv[1]]()
