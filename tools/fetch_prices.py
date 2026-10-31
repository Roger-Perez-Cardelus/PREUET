#!/usr/bin/env python3
"""Read real shelf prices for new Preuet products from the supermarkets' own online shops (run from GitHub Actions).

    python3 tools/fetch_prices.py probe            which shop endpoints answer from here, with a sample
"""
import json
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


def cmd_probe():
    for name, url in PROBES.items():
        st, ct, body = fetch(url)
        print(f"== {name}: {st} {ct} {len(body)} bytes")
        print(body[:900].decode("utf-8", "replace").replace("\n", " "))
        time.sleep(1.5)


if __name__ == "__main__":
    {"probe": cmd_probe}[sys.argv[1]]()
