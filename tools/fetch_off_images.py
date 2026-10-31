#!/usr/bin/env python3
"""Photos of the actual packs sold at each supermarket, from Open Food Facts (CC BY-SA, photos of real products).

    python3 tools/fetch_off_images.py [--only PRODUCT_ID,...] [--again]

For every price Preuet follows (data/preuet-data.json, offerings) it searches Open Food Facts by the shelf name and keeps
a hit only when it is clearly the same pack: same brand (own brands like Hacendado, Carrefour, Dia, Bonpreu included),
most of the name's words, and the same size (±15 %) when both sizes are known. Then it saves the front photo
(web/img/off/<barcode>.jpg, 400×400, and a 160×160 thumbnail) and writes into the data:
    offerings[].ean, offerings[].img = {f, t, s}      the photo of that very pack
    products[].img                                   the photo of one of its packs (Commons photos stay for loose produce)
data/off-matches.json keeps every decision (shelf name → Open Food Facts name, brand, size, score) to check by hand.

Open Food Facts is a shared, volunteer-run service: this tool identifies itself and waits between calls.
It runs from GitHub Actions (Actions → Fotos de producte → font: off) because this project's cloud sandbox cannot reach it.
"""
import argparse
import io
import json
import pathlib
import re
import sys
import time
import unicodedata
import urllib.parse
import urllib.request

from PIL import Image, ImageOps

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "preuet-data.json"
MATCHES = ROOT / "data" / "off-matches.json"
OUT = ROOT / "web" / "img" / "off"
UA = "Preuet/1.0 (EETAC-UPC student project; https://github.com/Roger-Perez-Cardelus/PREUET)"
FIELDS = "code,product_name,product_name_es,product_name_ca,generic_name,brands,quantity,image_front_url,countries_tags"
LOOSE = re.compile(r"granel|\bpieza\b|\b1 u\.?$|\bunitat\b|\bunidad\b", re.I)

# Own brands (and their sub-brands) as they appear in shelf names, mapped to how Open Food Facts usually spells the brand.
OWN = {
    "hacendado": "hacendado", "deliplus": "deliplus", "bosque verde": "bosque verde", "carrefour": "carrefour", "dia": "dia",
    "la almazara del olivar": "dia", "nuestra alacena": "dia", "seleccion de dia": "dia", "bonpreu": "bonpreu", "bonnatur": "bonpreu",
    "ametller origen": "ametller origen", "essencials": "ametller origen", "consum": "consum", "bonarea": "bonarea",
    "milbona": "milbona", "chef select": "chef select", "la collita": "bonpreu",
}
STOP = set("de del la el les els los las en amb con sin sense i y a al per para x u ud uds unidades unitats pack paquete paquet brick briks "
           "bandeja safata bossa bolsa malla tarro pot lata latas llaunes tarrinas tarrines rodajas lonchas talls botella ampolla garrafa caixa caja aprox approx gr g kg ml l cl litre litro".split())


def norm(s):
    s = unicodedata.normalize("NFD", str(s or "").lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", " ", s)).strip()


def words(s):
    return {w for w in norm(s).split() if w not in STOP and not re.match(r"^\d", w) and len(w) > 1}


def brand_of(name):
    n = " " + norm(name) + " "
    for k, v in OWN.items():
        if " " + k + " " in n:
            return v
    first = str(name).split(" ")[0]
    if len(first) > 2 and first.isupper():  # Bonpreu writes the brand first, in capitals: "HEINZ Quètxup"
        return norm(first)
    return None


def grams(q):
    """Size in g or ml from Open Food Facts' quantity, like '1 l', '500 g', '6 x 1 L', '3 x 56 g', '1,5 L'."""
    s = str(q or "").lower().replace(",", ".")
    unit = r"(kg|g|gr|l|ml|cl)\b"
    m = re.search(r"(\d+)\s*[x×]\s*(\d+(?:\.\d+)?)\s*" + unit, s)
    k = 1.0
    if m:
        k, val, u = float(m.group(1)), float(m.group(2)), m.group(3)
    else:
        m = re.search(r"(\d+(?:\.\d+)?)\s*" + unit, s)
        if not m:
            return None
        val, u = float(m.group(1)), m.group(2)
    return k * val * {"kg": 1000, "g": 1, "gr": 1, "l": 1000, "ml": 1, "cl": 10}[u]


def size_of(o, unit):
    """Preuet already knows each pack's size (in kg or L); dozens and units have no weight to compare."""
    return o["size"] * 1000 if unit in ("kg", "l") and o.get("size") else None


_last = [0.0]


def get(url, binary=False, pause=1.5, tries=8):
    for i in range(tries):
        wait = pause - (time.time() - _last[0])
        if wait > 0:
            time.sleep(wait)
        _last[0] = time.time()
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=40) as r:
                data = r.read()
                return data if binary else json.loads(data)
        except urllib.error.HTTPError as e:
            if e.code in (429, 502, 503, 504):
                time.sleep(int(e.headers.get("Retry-After") or 20 * (i + 1)))
                continue
            if e.code == 404:
                return None
            raise
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
            time.sleep(10 * (i + 1))
    return None


def search(q):
    """Search-a-licious first (the fast new search), then the classic search (10 calls a minute)."""
    r = get("https://search.openfoodfacts.org/search?" + urllib.parse.urlencode(
        {"q": q, "langs": "es,ca,en", "page_size": 20, "fields": FIELDS}))
    if r and isinstance(r.get("hits"), list):
        return r["hits"]
    r = get("https://world.openfoodfacts.org/cgi/search.pl?" + urllib.parse.urlencode(
        {"search_terms": q, "search_simple": 1, "json": 1, "page_size": 20, "fields": FIELDS}), pause=7)
    return (r or {}).get("products") or []


def name_of(h):
    return h.get("product_name_es") or h.get("product_name_ca") or h.get("product_name") or h.get("generic_name") or ""


def score(o, h, want_brand, unit):
    hb = norm(" ".join(h.get("brands") if isinstance(h.get("brands"), list) else [h.get("brands") or ""]))
    if want_brand and want_brand not in hb and want_brand not in norm(name_of(h)):
        return 0, "brand"
    mine = words(o["name"]) - set(want_brand.split() if want_brand else [])
    theirs = words(name_of(h)) | words(hb)
    if not mine:
        return 0, "no words"
    s = len(mine & theirs) / len(mine)
    a, b = size_of(o, unit), grams(h.get("quantity") or name_of(h))
    if a and b:
        if abs(a - b) > 0.15 * max(a, b):
            return 0, "size %s vs %s" % (a, b)
        s += 0.2
    tags = h.get("countries_tags") or []
    if "en:spain" in tags:
        s += 0.1
    return s, ""


def photo(code, url):
    OUT.mkdir(parents=True, exist_ok=True)
    big, small = OUT / f"{code}.jpg", OUT / f"{code}-s.jpg"
    if big.exists() and small.exists():
        return True
    raw = get(url, binary=True, pause=0.8)
    if not raw:
        return False
    im = Image.open(io.BytesIO(raw)).convert("RGB")
    ImageOps.pad(im, (400, 400), color=(255, 255, 255)).save(big, quality=80, optimize=True, progressive=True)
    ImageOps.pad(im, (160, 160), color=(255, 255, 255)).save(small, quality=78, optimize=True)
    return True


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--only", type=lambda s: set(s.split(",")))
    ap.add_argument("--again", action="store_true", help="search again offerings that already have a photo")
    a = ap.parse_args()
    d = json.loads(DATA.read_text(encoding="utf-8"))
    P = {p["id"]: p for p in d["products"]}
    log = json.loads(MATCHES.read_text(encoding="utf-8")) if MATCHES.exists() else {}
    found = tried = 0
    for o in d["offerings"]:
        if (a.only and o["p"] not in a.only) or o.get("st") == "comunitat":
            continue
        if o.get("img") and not a.again:
            continue
        if P[o["p"]]["cat"] == "fruita" and (LOOSE.search(o["name"]) or not brand_of(o["name"])):
            continue  # loose fruit and veg: no barcode, no Open Food Facts page
        tried += 1
        want = brand_of(o["name"])
        q = " ".join(w for w in norm(o["name"]).split() if not re.match(r"^\d", w) and w not in STOP)
        best, why = None, "no hits"
        for h in search(q):
            s, reason = score(o, h, want, P[o["p"]]["unit"])
            if s >= 0.6 and h.get("code") and (not best or s > best[0]):
                best = (s, h)
            elif reason:
                why = reason
        key = o["c"] + " | " + o["name"]
        if not best:
            log[key] = {"match": None, "why": why}
            print(f"  -  {key[:70]:70s} {why}", flush=True)
            continue
        s, h = best
        code = re.sub(r"\D", "", str(h["code"]))
        url = h.get("image_front_url")
        if not url:
            r = get(f"https://world.openfoodfacts.org/api/v2/product/{code}.json?fields=image_front_url", pause=0.8)
            url = ((r or {}).get("product") or {}).get("image_front_url")
        if not url or not photo(code, url):
            log[key] = {"match": name_of(h), "code": code, "why": "no front photo"}
            continue
        o["ean"] = code
        o["img"] = {"f": f"img/off/{code}.jpg", "t": f"img/off/{code}-s.jpg", "s": f"https://world.openfoodfacts.org/product/{code}"}
        log[key] = {"match": name_of(h), "brands": h.get("brands"), "quantity": h.get("quantity"), "code": code, "score": round(s, 2)}
        found += 1
        print(f"  ok {key[:70]:70s} → {name_of(h)[:40]} ({h.get('quantity')}) {s:.2f}", flush=True)
    # product photo: a real pack when there is one (the cheapest pack with a photo), otherwise keep what it had
    for p in d["products"]:
        packs = sorted((o for o in d["offerings"] if o["p"] == p["id"] and o.get("img")), key=lambda o: (o["rank"], o["up"]))
        if packs:
            o = packs[0]
            p["img"] = dict(o["img"], a="Open Food Facts", l="CC BY-SA 3.0", n=o["name"], c=o["c"])
    MATCHES.write_text(json.dumps(log, ensure_ascii=False, indent=1, sort_keys=True), encoding="utf-8")
    txt = json.dumps(d, ensure_ascii=False, separators=(",", ":"))
    if "</" in txt:
        raise SystemExit("refusing to write: data contains '</'")
    DATA.write_text(txt, encoding="utf-8")
    n = sum(1 for p in d["products"] if (p.get("img") or {}).get("a") == "Open Food Facts")
    print(f"{found} of {tried} packs matched; {n} of {len(d['products'])} products now show a real pack")


if __name__ == "__main__":
    sys.exit(main())
