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
import collections
import json
import os
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
    "openprices-es-count": "https://prices.openfoodfacts.org/api/v1/prices?size=1&location_osm_address_country=Espa%C3%B1a&date__gte=2026-09-01",
    "openprices-locations-es": "https://prices.openfoodfacts.org/api/v1/locations?size=20&osm_address_country=Espa%C3%B1a&order_by=-price_count",
    "caprabo": "https://www.capraboacasa.com/",
    "condis": "https://www.condisline.com/",
    "lidl": "https://www.lidl.es/q/search?q=leche",
    "aldi": "https://www.aldi.es/",
    "ametller-search": "https://www.ametllerorigen.com/ca/cerca?q=llet",
    "bonpreu-page": "https://www.compraonline.bonpreuesclat.cat/products/search?q=llet",
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
    from existing_rules import RULES
    consum = {}
    for p in PRODUCTS + [{"id": k, "q": v[0]} for k, v in RULES.items()]:
        items = []
        for off in (0, 40):
            d = get_json("https://tienda.consum.es/api/rest/V1.0/catalog/product?" + urllib.parse.urlencode({"limit": 40, "offset": off, "q": p["q"]}))
            items += (d or {}).get("products", [])
            if not d or not d.get("hasMore"):
                break
        consum[p["id"]] = items
        print(f"consum {p['id']}: {len(items)}", flush=True)
    (RAW / "consum.json.gz").write_bytes(gzip.compress(json.dumps(consum, ensure_ascii=False).encode()))
    if os.environ.get("PREUET_BONPREU") != "1":  # Bonpreu answers 202 (its bot check) to automated searches: not asked by default
        return
    d = json.loads(DATA.read_text(encoding="utf-8"))
    bonpreu = {}
    for pid, qca in bonpreu_queries(d).items():
        items = bonpreu_search(qca)
        bonpreu[pid] = items
        print(f"bonpreu {pid}: {len(items)}", flush=True)
    (RAW / "bonpreu.json.gz").write_bytes(gzip.compress(json.dumps(bonpreu, ensure_ascii=False).encode()))
    # more shops to try next time
    for name, url in {"bonpreu-ocado": "https://www.compraonline.bonpreuesclat.cat/api/webproductpagews/v5/product-pages/search?includeAdditionalPageInfo=true&maxPageSize=3&q=llet",
                      "bonpreu-v6": "https://www.compraonline.bonpreuesclat.cat/api/v6/products/search?term=llet&limit=3",
                      "ametller": "https://www.ametllerorigen.com/ca/catalogsearch/result/?q=llet"}.items():
        st, ct, body = fetch(url)
        print(f"== {name}: {st} {ct} {len(body)}: {body[:300]!r}")


# ---------------------------------------------------------------- Bonpreu (its own search page, read like Consum's)
BONPREU = "https://www.compraonline.bonpreuesclat.cat"
CA_STOP = {"de", "del", "d", "la", "el", "les", "els", "l", "a", "al", "amb", "en", "per", "i", "o", "tipus", "u", "pack", "llauna", "pot", "bossa", "bossetes"}


def ca_query(name):
    """Catalan search words from a product's Catalan name, without what is in brackets."""
    return re.sub(r"\s+", " ", re.sub(r"\([^)]*\)", " ", name)).strip().lower()


def bonpreu_queries(d):
    sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
    from new_products import PRODUCTS
    q = {p["id"]: ca_query(p["ca"]) for p in d["products"]}
    for p in PRODUCTS:
        q[p["id"]] = p.get("qca") or ca_query(p["ca"])
    return q


def bonpreu_search(qca):
    """Every product on Bonpreu's search page for these words: name, brand, price and price per kg/L/unit."""
    time.sleep(1.5)
    st, ct, body = fetch(BONPREU + "/products/search?" + urllib.parse.urlencode({"q": qca}))
    if st != 200:
        print("  !", st, qca)
        return []
    t = body.decode("utf-8", "replace")
    i = t.find('"productEntities":')
    if i < 0:
        return []
    try:
        ents, _ = json.JSONDecoder().raw_decode(t, i + len('"productEntities":'))
    except ValueError:
        return []
    out = []
    for e in ents.values():
        pr = e.get("price") or {}
        unit = pr.get("unit") or {}
        try:
            price = float((pr.get("current") or {}).get("amount"))
        except (TypeError, ValueError):
            continue
        try:
            per = float((unit.get("current") or {}).get("amount"))
        except (TypeError, ValueError):
            per = None
        out.append({"id": e.get("retailerProductId"), "name": e.get("name") or "", "brand": e.get("brand") or "", "price": price,
                    "per": per, "label": unit.get("label") or "", "cat": " / ".join(e.get("categoryPath") or []),
                    "ok": e.get("available", True)})
    return out


CA_WORDS = {  # the usual exclusions, in Catalan too
    "chocolate": "xocolata", "fresa": "maduixa", "limon": "llimona", "platano": "platan", "melocoton": "pressec", "frutas": "fruites",
    "cacao": "cacau", "canela": "canyella", "miel": "mel", "sin lactosa": "sense lactosa", "sin gluten": "sense gluten",
    "sin azucar": "sense sucre", "griego": "grec", "proteina": "proteina", "congelad": "congelat", "ultracongelad": "congelat",
    "lonchas": "llesques", "loncha": "llesca", "rallado": "ratllat", "rallada": "ratllada", "jamon": "pernil", "pollo": "pollastre",
    "pavo": "gall dindi", "cerdo": "porc", "atun": "tonyina", "tomate": "tomaquet", "picante": "picant", "cebolla": "ceba",
    "vegano": "vega", "ecologico": "ecologic", "semillas": "llavors", "avena": "civada", "arroz": "arros", "lata": "llauna",
    "polvo": "pols", "bebida": "beguda", "zumo": "suc", "yogur": "iogurt", "galleta": "galeta", "galletas": "galetes",
    "helado": "gelat", "queso": "formatge", "huevo": "ou", "nata": "nata", "relleno": "farcit", "rellenos": "farcits",
    "rellenas": "farcides", "salsa": "salsa", "desnatado": "desnatat", "almendra": "ametlla", "nueces": "nous",
    "cabra": "cabra", "oveja": "ovella", "ahumado": "fumat", "ahumada": "fumada", "cocido": "cuit", "cocida": "cuita",
    "cocidos": "cuits", "frito": "fregit", "fritos": "fregits", "asado": "rostit", "adobad": "adobat", "rebozad": "arrebossat",
    "empanad": "arrebossat", "barbacoa": "barbacoa", "hierbas": "herbes", "ajo": "all", "setas": "bolets", "espinacas": "espinacs",
    "verduras": "verdures", "pescado": "peix", "bacalao": "bacalla", "salmon": "salmo", "gambas": "gambes", "conserva": "conserva",
    "frasco": "flascó", "bote": "pot", "integral": "integral", "light": "light", "mini": "mini", "sobres": "sobres", "capsulas": "capsules",
}


def ca_rules(p):
    """must: every Catalan search word (stemmed: "galetes" finds "galeta"); avoid: the Spanish ones and their Catalan words."""
    words = [w for w in norm(p.get("qca") or ca_query(p["ca"])).split() if w not in CA_STOP]
    must = [[(w[:max(3, len(w) - 2)] if len(w) >= 6 else w if len(w) > 2 else " " + w + " ")] for w in words]
    avoid = list(p.get("avoid", []))
    avoid += [CA_WORDS[norm(a).strip()] for a in p.get("avoid", []) if norm(a).strip() in CA_WORDS and norm(CA_WORDS[norm(a).strip()]).strip() not in words]
    return must, avoid


def bonpreu_items(raw, p, ref_up=None):
    """Bonpreu's packs for a product: the shelf name (without the brand) must begin with the product, and when the other
    shops give a price per kg or litre, Bonpreu's must be within 0.4–2.5 times it (a wrong match is usually far off)."""
    must, avoid = ca_rules(p)
    rule = {"must": must, "avoid": avoid}
    out = []
    for it in raw:
        name, brand = it["name"], it.get("brand") or ""
        bare = name[len(brand):].strip() if brand and name.upper().startswith(brand.upper()) else name
        if not it.get("ok", True) or not matches(rule, bare) or not starts_with_product(rule, bare):
            continue
        label, per, price = it.get("label", ""), it.get("per"), it["price"]
        if p["unit"] in ("kg", "l"):
            lab = label.lower()
            is_kg = "kilo" in lab or lab.endswith(".kg") or lab.endswith("per.kg")
            is_l = "litre" in lab or "liter" in lab or lab.endswith(".l") or lab.endswith(".ltr")
            if not per or not (is_kg if p["unit"] == "kg" else is_l):
                continue
            size = round(price / per, 3)
        elif p["unit"] == "ud" and p["ref"] == 1:
            size = 1
        else:
            m = COUNT.search(norm(name)) or re.search(r"(\d+)\s*(?:u|ud|unitats|bossetes|rotlles|capsules|pastilles|rentats)\b", norm(name))
            if m:
                size = int(m.group(1))
            elif per and "each" in label and per > 0:
                size = round(price / per)
            else:
                continue
            if p["unit"] == "dotzena":
                size = round(size / 12, 3)
        if not size:
            continue
        up = price / size
        if ref_up and not (ref_up * 0.4 <= up <= ref_up * 2.5):
            continue
        slug = re.sub(r"[^a-z0-9]+", "-", norm(name).strip()).strip("-")
        out.append({"c": "bonpreu", "name": name, "price": round(price, 2), "size": size, "src": f"{BONPREU}/products/{slug}/{it['id']}",
                    "own": brand.upper() in ("BONPREU", "ESCLAT", "BONPREU ESCLAT")})
    return out


# ---------------------------------------------------------------- build
import re  # noqa: E402
import statistics  # noqa: E402
import unicodedata  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "preuet-data.json"
OWN_BRANDS = re.compile(r"\b(hacendado|bosque verde|deliplus|compy|consum|mascoteros|steinburg|adlerbrau)\b")
COUNT = re.compile(r"(\d+)\s*(?:x\s*)?(?:u|ud|uds|unidades|unid|bolsitas|bolsas|pastillas|capsulas|tabletas|toallitas|lavados|dosis|rollos|panales)\b")


def norm(s):
    s = unicodedata.normalize("NFD", str(s or "").lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return " " + re.sub(r"\s+", " ", re.sub(r"[^a-z0-9,. ]", " ", s)).strip() + " "


def has(t, w):
    """w with a space before or after is a whole word ("con ", " m "); otherwise a word that starts with w."""
    n = norm(w).strip()
    if not n:
        return False
    if w != w.strip():
        return re.search(r"(?<![a-z0-9])" + re.escape(n) + r"(?![a-z0-9])", t) is not None
    return re.search(r"(?<![a-z0-9])" + re.escape(n), t) is not None


def matches(p, text):
    t = norm(text)
    return all(any(has(t, w) for w in group) for group in p["must"]) and not any(has(t, w) for w in p.get("avoid", []))


def mercadona_items(raw, p, day):
    out = []
    for it in raw:
        pi = it.get("pi") or {}
        text = (it.get("name") or "") + " " + (it.get("packaging") or "")
        if not matches(p, text) or (p.get("start") and not starts_with_product(p, it.get("name") or "")):
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


def consum_pool(raw):
    """Every item any search returned, once: a product often shows up in another product's search."""
    seen, out = set(), []
    for items in raw.values():
        for it in items:
            if it.get("id") not in seen:
                seen.add(it.get("id"))
                out.append(it)
    return out


CROSS_KG_L = {"maionesa"}
LEAD = {"porciones", "porcion", "lomito", "lomitos", "lomo", "lomos", "filete", "filetes", "rodaja", "rodajas", "suprema", "supremas",
        "cereales", "de", "del", "la", "el", "pack", "bolsa", "malla", "bandeja", "medio", "media", "preparado", "maxi"}


def starts_with_product(p, text):
    """The shelf name (without the brand) must begin with the product itself: "Mantequilla ..." yes, "Croissants de mantequilla" no."""
    words = norm(text).split()
    while words and words[0] in LEAD:
        words = words[1:]
    head = " " + " ".join(words) + " "
    return any(head.startswith(" " + norm(w).strip() + " ") or head.startswith(" " + norm(w).strip()) and not w.endswith(" ")
               for group in p["must"] for w in group)  # sold by the litre at Consum, by the kilo at Preuet: about 1 kg per litre


def consum_items(raw, p, day):
    out = []
    pool = raw if isinstance(raw, list) else consum_pool(raw)
    for it in pool:
        pd = it.get("productData") or {}
        text = (pd.get("description") or pd.get("name") or "")
        brand = (pd.get("brand") or {}).get("name") or ""
        if not matches(p, text + " " + brand):
            continue
        if p.get("start") and not starts_with_product(p, text):
            continue
        prices = (it.get("priceData") or {}).get("prices") or []
        reg = next((x for x in prices if x.get("id") == "PRICE"), prices[0] if prices else None)
        if not reg:
            continue
        price, unit_price = reg["value"].get("centAmount"), reg["value"].get("centUnitAmount")
        upt = norm((it.get("priceData") or {}).get("unitPriceUnitType")).strip()
        if p["unit"] in ("kg", "l"):
            per = {"1 kg": ("kg", 1), "1 l": ("l", 1), "100 ml": ("l", 0.1), "100 g": ("kg", 0.1), "100 gr": ("kg", 0.1)}.get(upt)
            if per and p["id"] in CROSS_KG_L and per[0] == "l":
                per = ("kg", per[1])
            if not unit_price or not per or per[0] != p["unit"]:
                continue
            size = round(price / unit_price * per[1], 3)
        elif p["unit"] == "rentat":
            m = re.search(r"(\d+)\s*(?:lv|lavados|dosis)", norm(text))
            if not m:
                continue
            size = int(m.group(1))
        elif p["unit"] == "ud" and p["ref"] == 1:
            size = 1
        else:
            m = COUNT.search(norm(text)) or re.search(r"(\d+)\s*u\b", norm(text))
            if p["unit"] == "dotzena":
                if re.search(r" 1 2 docena | media docena ", norm(text)):
                    size = 0.5
                elif " docena " in norm(text) and not m:
                    size = 1
                elif m:
                    size = round(int(m.group(1)) / 12, 3)
                else:
                    continue
            elif not m:
                continue
            else:
                size = int(m.group(1))
        offer = next((x for x in prices if x.get("id") != "PRICE"), None)
        promo = ("Oferta: " + str(offer["value"].get("centAmount")).replace(".", ",") + " €")[:60] if offer else ""
        out.append({"c": "consum", "name": (brand + " " + text).strip() if brand and brand.upper() not in text.upper() else text, "price": round(price, 2),
                    "size": size, "src": pd.get("url"), "own": brand.upper() == "CONSUM", "promo": promo, "ean": it.get("ean")})
    return out


PACK_WORDS = set("brick brik bricks briks paquete bandeja pieza tarro bote botella garrafa pack latas lata tarrina tarrinas ud uds unidades "
                 "x de del en la el con kg g l ml grande pequena mini".split())


def name_words(name):
    return {w for w in norm(name).split() if w not in PACK_WORDS and not re.match(r"^[\d.,]+$", w) and not re.match(r"^pack\d", w)}


def item_size(pi, unit):
    """A Mercadona item's pack size in Preuet's unit for the product (kg, L, dozens, units...)."""
    try:
        price, bulk = float(pi.get("unit_price")), float(pi.get("bulk_price") or 0)
    except (TypeError, ValueError):
        return None
    ref = str(pi.get("reference_format") or "").lower().strip()
    if unit in ("kg", "l"):
        per = {"kg": ("kg", 1), "l": ("l", 1), "100 ml": ("l", 0.1), "100 g": ("kg", 0.1)}.get(ref)
        return round(price / bulk * per[1], 3) if per and per[0] == unit and bulk else None
    n = pi.get("unit_size") if str(pi.get("size_format")) == "ud" else pi.get("total_units")
    try:
        n = float(n)
    except (TypeError, ValueError):
        return None
    return round(n / 12, 3) if unit == "dotzena" else n


def keep_photo(prev, o):
    """A pack read again keeps the photo (and barcode) it already had."""
    old = prev.get((o["p"], o["c"], o["name"]))
    if old:
        for k in ("img", "ean"):
            if old.get(k) and not o.get(k):
                o[k] = old[k]
    return o


def refresh_existing(d, merc, cons, day, report):
    """Mercadona: each pack Preuet already follows gets today's price from the shop itself (matched by its exact name).
    Consum: the original products get Consum's packs through tools/existing_rules.py."""
    from existing_rules import RULES
    items = []
    for it in merc:
        pi = it.get("pi") or {}
        try:
            items.append((it, float(pi.get("unit_price")), name_words(it.get("name"))))
        except (TypeError, ValueError):
            pass
    P = {p["id"]: p for p in d["products"]}
    hit = miss = 0
    for o in d["offerings"]:
        if o["c"] != "mercadona" or o["p"] not in RULES:
            continue
        mine, unit = name_words(o["name"]), P[o["p"]]["unit"]
        best = None
        for it, price, words in items:
            if not words or not mine:
                continue
            sim = len(mine & words) / len(mine | words)
            if sim < 0.75 or (best and sim <= best[0]):
                continue
            size = item_size(it.get("pi") or {}, unit)
            if size and abs(size - o["size"]) <= 0.1 * o["size"]:
                best = (sim, it, price)
        if not best:
            miss += 1
            continue
        _, it, price = best
        old = o["price"]
        o.update(price=round(price, 2), up=round(price / o["size"], 4), src=it.get("url") or o["src"], date=day, st="web")
        hit += 1
        if abs(price - old) > 0.005:
            report.append(("~" + o["p"], [{"c": "mercadona", "name": o["name"][:44] + f" (abans {old}) ", "price": round(price, 2), "size": o["size"]}]))
    print(f"mercadona: {hit} prices refreshed from the shop, {miss} packs not found (they keep their price and date)")
    for pid, (q, must, avoid, size) in RULES.items():
        p = dict(P[pid], q=q, must=must, avoid=avoid, size=size, start=P[pid].get("kind") != "marca")
        found = [x for x in consum_items(cons, p, day) if size[0] <= x["size"] <= size[1] and x["price"] > 0]
        for x in found:
            x["up"] = round(x["price"] / x["size"], 4)
        if found:
            med = statistics.median(x["up"] for x in found)
            found = [x for x in found if med / 3 <= x["up"] <= med * 3]
        seen, uniq = set(), []
        for x in sorted(found, key=lambda x: x["up"]):
            if (x["price"], x["size"]) not in seen:
                seen.add((x["price"], x["size"]))
                uniq.append(x)
        keep = [x for x in uniq if x["own"]][:2] + [x for x in uniq if not x["own"]][:2]
        report.append(("+" + pid, keep))
        if not keep:
            continue  # nothing recognisable at Consum: keep whatever Preuet had there
        prev = {(o["p"], o["c"], o["name"]): o for o in d["offerings"] if o["p"] == pid}
        d["offerings"] = [o for o in d["offerings"] if not (o["p"] == pid and o["c"] == "consum")]
        fresh = p["cat"] == "fruita"
        for x in keep:
            o = {"p": pid, "c": "consum", "name": x["name"][:120], "price": x["price"], "size": x["size"], "up": x["up"], "promo": x.get("promo", ""),
                 "src": x["src"], "date": day, "st": "web", "desde": False, "bk": "fresc" if fresh and not x["own"] else ("mb" if x["own"] else "fab"), "rank": 0}
            if x.get("ean"):
                o["ean"] = x["ean"]
            d["offerings"].append(keep_photo(prev, o))


def refresh_bonpreu(d, bon, day, report, done):
    """The products not in new_products.py (the original ones): Bonpreu's packs from its search page, checked against the
    price per kg or litre the other shops have for the same product."""
    if not bon:
        return
    from existing_rules import RULES
    hit = 0
    for prod in d["products"]:
        pid = prod["id"]
        if pid in done or pid not in bon:
            continue
        others = [o for o in d["offerings"] if o["p"] == pid and o["c"] != "bonpreu" and o.get("up")]
        if not others:
            continue
        ref_up = statistics.median(o["up"] for o in others)
        sizes = [o["size"] for o in others]
        rule = RULES.get(pid)
        p = dict(prod, avoid=rule[2] if rule else [], qca=ca_query(prod["ca"]))
        lo, hi = rule[3] if rule else (min(sizes) * 0.5, max(sizes) * 2)
        found = [x for x in bonpreu_items(bon[pid], p, ref_up) if lo <= x["size"] <= hi and x["price"] > 0]
        for x in found:
            x["up"] = round(x["price"] / x["size"], 4)
        seen, uniq = set(), []
        for x in sorted(found, key=lambda x: x["up"]):
            if (x["price"], x["size"]) not in seen:
                seen.add((x["price"], x["size"]))
                uniq.append(x)
        keep = [x for x in uniq if x["own"]][:2] + [x for x in uniq if not x["own"]][:2]
        if not keep:
            continue
        hit += 1
        report.append(("b" + pid, keep))
        prev = {(o["p"], o["c"], o["name"]): o for o in d["offerings"] if o["p"] == pid}
        d["offerings"] = [o for o in d["offerings"] if not (o["p"] == pid and o["c"] == "bonpreu")]
        fresh = prod["cat"] == "fruita"
        for x in keep:
            d["offerings"].append(keep_photo(prev, {"p": pid, "c": "bonpreu", "name": x["name"][:120], "price": x["price"], "size": x["size"], "up": x["up"],
                                                    "promo": "", "src": x["src"], "date": day, "st": "web", "desde": False,
                                                    "bk": "fresc" if fresh and not x["own"] else ("mb" if x["own"] else "fab"), "rank": 0}))
    print(f"bonpreu: {hit} of the original products found on its search page")


def cmd_build():
    sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
    from new_products import PRODUCTS
    day = sys.argv[2] if len(sys.argv) > 2 else time.strftime("%Y-%m-%d")
    merc = json.loads(gzip.decompress((RAW / "mercadona.json.gz").read_bytes()))
    cons = consum_pool(json.loads(gzip.decompress((RAW / "consum.json.gz").read_bytes())))
    bon_file = RAW / "bonpreu.json.gz"
    bon = json.loads(gzip.decompress(bon_file.read_bytes())) if bon_file.exists() else {}
    d = json.loads(DATA.read_text(encoding="utf-8"))
    have = {p["id"] for p in d["products"]}
    report = []
    for p in PRODUCTS:
        found = [x for x in mercadona_items(merc, p, day) + consum_items(cons, p, day) if p["size"][0] <= x["size"] <= p["size"][1] and x["price"] > 0]
        for x in found:
            x["up"] = round(x["price"] / x["size"], 4)
        ref_up = statistics.median(x["up"] for x in found) if found else None
        for x in bonpreu_items(bon.get(p["id"], []), p, ref_up):
            if p["size"][0] <= x["size"] <= p["size"][1] and x["price"] > 0:
                x["up"] = round(x["price"] / x["size"], 4)
                found.append(x)
        if found:  # drop unit prices far from the rest (a wrong size read from the name)
            med = statistics.median(x["up"] for x in found)
            found = [x for x in found if med / 3 <= x["up"] <= med * 3]
        keep = []
        for c in ("mercadona", "consum", "bonpreu"):
            mine = sorted((x for x in found if x["c"] == c), key=lambda x: x["up"])
            seen, uniq = set(), []
            for x in mine:  # the same pack in another scent or colour: once is enough
                if (x["price"], x["size"]) not in seen:
                    seen.add((x["price"], x["size"]))
                    uniq.append(x)
            own = [x for x in uniq if x["own"]][:2]
            other = [x for x in uniq if not x["own"]][:2]
            keep += own + other
        if p["id"] not in have and len({x["c"] for x in keep}) < 2:  # a new product needs two shops to be compared
            report.append((p["id"] + " (1 shop: left out)", keep))
            continue
        report.append((p["id"], keep))
        if not keep:
            continue
        prod = {k: p[k] for k in ("id", "ca", "es", "cat", "unit", "ref", "ref_ca", "ref_es")}
        prod.update(kind="equivalent", tags=p.get("tags", []), allergens=p.get("allergens", []), traces=p.get("traces", []), nut=p.get("nut"))
        old_prod = next((x for x in d["products"] if x["id"] == p["id"]), None)
        if old_prod and old_prod.get("img"):
            prod["img"] = old_prod["img"]
        d["products"] = [x if x["id"] != p["id"] else prod for x in d["products"]] if old_prod else d["products"] + [prod]
        prev = {(o["p"], o["c"], o["name"]): o for o in d["offerings"] if o["p"] == p["id"]}
        shops = {x["c"] for x in keep}  # a shop not read today keeps what Preuet had there
        d["offerings"] = [o for o in d["offerings"] if o["p"] != p["id"] or o["c"] not in shops]
        fresh = p["cat"] == "fruita"
        for x in keep:
            o = {"p": p["id"], "c": x["c"], "name": x["name"][:120], "price": x["price"], "size": x["size"], "up": x["up"], "promo": x.get("promo", ""),
                 "src": x["src"], "date": day, "st": "web", "desde": False, "bk": "fresc" if fresh and not x["own"] else ("mb" if x["own"] else "fab"), "rank": 0}
            if x.get("ean"):
                o["ean"] = x["ean"]
            d["offerings"].append(keep_photo(prev, o))
    refresh_existing(d, merc, cons, day, report)
    refresh_bonpreu(d, bon, day, report, {p["id"] for p in PRODUCTS})
    sys.path.insert(0, str(ROOT / "tools"))
    import update_data
    update_data.fix(d, d["meta"]["updated"])
    update_data.save(d)
    for pid, keep in report:
        print(f"{pid:22s} {'NEW' if pid not in have else '   '} " + (" | ".join(f"{x['c'][:4]} {x['name'][:42]} {x['price']}€/{x['size']}" for x in keep) or "— nothing found"))


def cmd_pages():
    """Saves the source page of every price older than two days (shops other than Mercadona's own and Consum) to tmp-raw/."""
    d = json.loads(DATA.read_text(encoding="utf-8"))
    cut = time.strftime("%Y-%m-%d", time.gmtime(time.time() - 2 * 86400))
    urls = sorted({o["src"] for o in d["offerings"] if o["date"] < cut and str(o.get("src", "")).startswith("https://")})
    RAW.mkdir(exist_ok=True)
    out, refused = {}, collections.Counter()
    started = time.time()
    save = lambda: (RAW / "pages.json.gz").write_bytes(gzip.compress(json.dumps(out, ensure_ascii=False).encode()))
    for i, url in enumerate(urls):
        host = urllib.parse.urlsplit(url).netloc
        if refused[host] >= 3:  # this shop refuses automated reads (Carrefour, Dia: 403): do not try the rest
            print(f"{i + 1}/{len(urls)} skip (refused) {url}", flush=True)
            continue
        if time.time() - started > 40 * 60:  # stay well inside the job's hour, and keep what was read
            print("stopping: 40 minutes", flush=True)
            break
        for attempt in range(3):  # Bonpreu answers 202 (still preparing) or times out now and then
            time.sleep(1.5 + 8 * attempt)
            st, ct, body = fetch(url)
            if st == 200 or st in (401, 403, 404, 410):  # a refusal or a missing page does not get better by asking again
                break
        refused[host] = refused[host] + 1 if st in (401, 403) else 0
        out[url] = {"status": st, "type": ct, "body": body[:3_000_000].decode("utf-8", "replace")}
        print(f"{i + 1}/{len(urls)} {st} {len(body):>8} {url}", flush=True)
        if i % 10 == 9:
            save()
    save()


def cmd_probe():
    for name, url in PROBES.items():
        st, ct, body = fetch(url)
        print(f"== {name}: {st} {ct} {len(body)} bytes")
        print(body[:900].decode("utf-8", "replace").replace("\n", " "))
        if name == "bonpreu-page":  # what one product looks like in the page state
            t = body.decode("utf-8", "replace")
            i = t.find('"price":{"current"')
            print("-- bonpreu product sample --")
            print(t[max(0, i - 2500):i + 1500] if i >= 0 else "(no price block found)")
        time.sleep(1.5)


if __name__ == "__main__":
    {"probe": cmd_probe, "collect": cmd_collect, "build": cmd_build, "pages": cmd_pages}[sys.argv[1]]()
