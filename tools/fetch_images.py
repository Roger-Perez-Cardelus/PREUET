#!/usr/bin/env python3
"""Product photos for Preuet, from Wikimedia Commons (free licences only, with author and licence kept).

    python3 tools/fetch_images.py candidates [--only ID,ID] [--out DIR]
        Searches Commons for every product (QUERIES below) and saves up to 6 candidates per product:
        DIR/candidates.json and a contact sheet DIR/sheet-NN.jpg to choose from by eye.

    python3 tools/fetch_images.py fetch [--only ID,ID] [--cands DIR/candidates.json] [--again]
        Downloads the chosen photo of each product (PICKS below: the candidate number, or a "File:..." title),
        crops it to 4:3 (640×480) and a 160×160 thumbnail into web/img/products/, and writes the author, the
        licence and the source page into data/preuet-data.json (products[].img).

Only CC0, public domain, CC BY and CC BY-SA photos are used. The app shows the credit under each photo.
Wikimedia rate-limits shared IPs hard (429, Retry-After up to 10 min): the "Fotos de producte" GitHub action runs the
fetch step from a GitHub runner instead (Actions → Fotos de producte → Run workflow).
Commons asks for a descriptive User-Agent and few requests: this tool waits between calls and honours Retry-After.
"""
import argparse
import html
import io
import json
import os
import pathlib
import re
import sys
import time
import urllib.parse
import urllib.request

from PIL import Image, ImageDraw, ImageOps

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "preuet-data.json"
OUT = ROOT / "web" / "img" / "products"
API = "https://commons.wikimedia.org/w/api.php"
UA = "PreuetBot/1.0 (EETAC-UPC student project; https://github.com/Roger-Perez-Cardelus/PREUET)"
OK_LICENCE = re.compile(r"^(CC0|Public domain|PD|CC BY(-SA)? \d(\.\d)?( \w+)?)$", re.I)

# Commons search terms (English finds more photos). Generic on purpose: a Preuet product is a class of equivalent products.
QUERIES = {
    "llet-sencera": "milk carton", "llet-semi": "milk carton", "llet-desnatada": "milk in a glass", "llet-sense-lactosa": "milk bottle",
    "llet-nostra": "milk bottle glass", "asturiana-semi": "milk brick carton", "beguda-soja": "soy milk", "beguda-civada": "oat milk",
    "beguda-ametlla": "almond milk", "iogurt-natural": "plain yogurt", "fageda-natural": "yogurt pots", "iogurt-grec": "greek yogurt",
    "kefir": "kefir", "ous-m": "eggs carton", "ous-l": "brown eggs", "mantega": "butter block", "nata-cuinar": "whipping cream",
    "formatge-llesques": "sliced cheese", "formatge-ratllat": "grated cheese", "formatge-fresc": "queso de Burgos",
    "pa-motlle": "sliced white bread", "pa-motlle-sc": "white sandwich bread", "pa-motlle-integral": "wholemeal bread slices",
    "barra-pa": "baguette", "flocs-civada": "rolled oats", "corn-flakes": "cornflakes bowl", "galetes-maria": "galletas maría",
    "cafe-molt": "ground coffee", "cacau-soluble": "cocoa powder", "melmelada": "strawberry jam", "mel": "honey jar",
    "crema-cacau": "chocolate hazelnut spread", "arros-rodo": "short grain rice", "arros-llarg": "long grain rice",
    "macarrons": "macaroni pasta", "espaguetis": "dry spaghetti", "cigrons-cuits": "chickpeas", "llenties-cuites": "cooked lentils",
    "mongetes-cuites": "cannellini beans", "llenties-seques": "brown lentils", "tomaquet-triturat": "canned tomatoes",
    "tomaquet-fregit": "tomato sauce", "tonyina": "canned tuna", "oli-oliva-ve": "extra virgin olive oil bottle",
    "oli-oliva-suau": "olive oil bottle", "oli-gira-sol": "sunflower oil bottle", "sal": "table salt", "sucre": "white sugar",
    "farina": "wheat flour", "maionesa": "mayonnaise", "ketchup": "ketchup", "brou-pollastre": "chicken broth",
    "pit-pollastre": "chicken breast", "cuixes-pollastre": "chicken legs raw", "carn-picada": "minced meat raw",
    "llom-porc": "raw pork chops", "pernil-dolc": "sliced cooked ham", "pit-gall-dindi": "sliced turkey breast",
    "pernil-serra": "jamón serrano", "salmo": "salmon fillet raw", "lluc": "hake fish", "platan-canaries": "plátano de Canarias",
    "banana": "bananas", "pomes": "Golden Delicious", "taronges": "oranges fruit", "mandarines": "mandarin oranges",
    "peres": "conference pears", "llimones": "lemons", "kiwi": "kiwifruit", "alvocat": "avocado", "tomaquets": "tomatoes",
    "patates": "potato tubers", "pastanagues": "carrots", "carbasso": "zucchini", "pebrot-vermell": "red bell pepper",
    "broquil": "broccoli", "espinacs": "spinach leaves", "cogombre": "cucumber", "alberginia": "eggplant", "aigua": "bottled water",
    "suc-taronja": "orange juice glass", "coca-cola": "cola drink glass", "detergent-roba": "laundry detergent liquid",
    "rentaplats-ma": "dishwashing liquid", "lleixiu": "bleach bottle", "paper-wc": "toilet paper rolls", "paper-cuina": "kitchen paper towel roll",
    "gel-dutxa": "shower gel", "xampu": "shampoo bottle", "pasta-dents": "toothpaste", "bolquers-t4": "disposable diapers",
    "pa-sense-gluten": "gluten-free bread", "pasta-sense-gluten": "fusilli pasta",
}

# Chosen photo per product (exact Commons title), picked by eye from the candidates; a number picks from --cands instead.
PICKS = {
    "llet-sencera": "File:Tetra-Milk-Carton---Betsukai-Milk---2024-04-27 08.jpg",
    "llet-semi": "File:Dg milk containers.jpg",
    "llet-sense-lactosa": "File:Plastic bottle of milk.jpg",
    "llet-nostra": "File:Milk bottle and two doughnuts.jpg",
    "asturiana-semi": "File:22-07-2017 Carton of UHT Milk of Matinal brand.JPG",
    "beguda-soja": "File:Soymilk can and glass 2.jpg",
    "beguda-civada": "File:Oat milk glass.jpg",
    "beguda-ametlla": "File:Raw almond milk 2.jpg",
    "iogurt-natural": "File:Plain Yogurt.jpg",
    "iogurt-grec": "File:Strained yogurt (20250302).jpg",
    "kefir": "File:Kefir in a glass.JPG",
    "ous-m": "File:Egg cartons with chicken eggs 03.jpg",
    "ous-l": "File:Brown Eggs from Taiwan (1).jpg",
    "mantega": "File:Butter block.JPG",
    "formatge-llesques": "File:White cheddar cheese sliced CNE.jpg",
    "formatge-ratllat": "File:Grated cheese Annie Mole.jpg",
    "formatge-fresc": "File:Queso De Burgos 002.JPG",
    "pa-motlle": "File:Sliced sandwich breads 2021-8-28.jpg",
    "pa-motlle-integral": "File:Multigrain bread.JPG",
    "barra-pa": "File:Baguettes - stonesoup.jpg",
    "flocs-civada": "File:Rolled oats 2.jpg",
    "corn-flakes": "File:Corn flakes in a bowl.jpg",
    "galetes-maria": "File:Galleta María.jpg",
    "cafe-molt": "File:Coffee powdered.jpg",
    "cacau-soluble": "File:Cocoa-powder-1883108.jpg",
    "melmelada": "File:Strawberry jam on a dish.JPG",
    "mel": "File:Three French monofloral honey jars.jpg",
    "crema-cacau": "File:Crema di cioccolato.jpg",
    "arros-rodo": "File:Short-grain rice (japonica).jpg",
    "arros-llarg": "File:Long grain rice.jpg",
    "macarrons": "File:Macaronis.jpeg",
    "cigrons-cuits": "File:Ordinary chickpeas in a ceramic bowl.jpg",
    "llenties-cuites": "File:Liat Portal for Foodie Disorder - Cooked Lentils with Caramelized Onions.jpg",
    "llenties-seques": "File:Lentils (Brown, Pardina, Beluga).jpg",
    "tomaquet-fregit": "File:Fresh Tomato Sauce (Unsplash).jpg",
    "tonyina": "File:Lata de atún-Albo.jpg",
    "oli-oliva-ve": "File:Extra Virgin Olive Oil.jpg",
    "oli-oliva-suau": "File:Bottle of olive oil.jpg",
    "oli-gira-sol": "File:Bottle 1 liter Sunflower refined oil.jpg",
    "sal": "File:Table salt with salt shaker V1.jpg",
    "sucre": "File:Sugar 2xmacro.jpg",
    "farina": "File:All-Purpose Flour (4107895947).jpg",
    "maionesa": "File:Mayonnaise (1).jpg",
    "ketchup": "File:French Fries with Ketchup 01.jpg",
    "brou-pollastre": "File:Broth.jpg",
    "pit-pollastre": "File:Chicken breasts and wing quarters.jpg",
    "cuixes-pollastre": "File:Raw chicken thighs.jpg",
    "carn-picada": "File:Hackfleisch-1.jpg",
    "pernil-dolc": "File:Ham (4).jpg",
    "pit-gall-dindi": "File:Cooked turkey breast - November 2023 - Sarah Stierch.jpg",
    "pernil-serra": "File:Jamón serrano (by Awersowy).jpg",
    "salmo": "File:Raw salmon fillets.jpg",
    "lluc": "-",  # no suitable free photo found: the app shows the category icon
    "platan-canaries": "File:Plátanos de Canarias.JPG",
    "banana": "File:Bananas on black background 02.jpg",
    "taronges": "File:Oranges - whole-halved-segment.jpg",
    "mandarines": "File:Mandarins - whole and halved.jpg",
    "peres": "File:Four pears.jpg",
    "llimones": "File:Lemon - whole and split.jpg",
    "kiwi": "File:Kiwi (Actinidia chinensis) 1 Luc Viatour.jpg",
    "alvocat": "File:Avocado Hass - single and halved.jpg",
    "tomaquets": "File:Tomato je.jpg",
    "pastanagues": "File:Carrots at Ljubljana Central Market.JPG",
    "carbasso": "File:Calabacín, Múnich, Alemania, 2013-03-30, DD 01.JPG",
    "pebrot-vermell": "File:Red bell pepper.jpg",
    "broquil": "File:Brassica oleracea italica, Sault Ste Marie 1.JPG",
    "espinacs": "File:Spinach leaves.jpg",
    "cogombre": "File:Ryerson Market cucumbers on sale.jpg",
    "alberginia": "File:Eggplant 3.jpg",
    "aigua": "File:Water bottle in room.jpg",
    "suc-taronja": "File:Orange juice 1 edit1.jpg",
    "coca-cola": "File:Cola glass (4343698290).jpg",
    "detergent-roba": "File:Liquid detergent.JPG",
    "rentaplats-ma": "File:Tesco and Sainsburys own dishwashing liquid.jpg",
    "lleixiu": "File:HK Kao Bleaches 2.JPG",
    "paper-wc": "File:Toilet paper roll.jpg",
    "paper-cuina": "File:Roll of paper towels standing on toilet-paper holder.jpg",
    "gel-dutxa": "File:Shower gel bottles.jpg",
    "xampu": "File:Green shampoo bottle.jpg",
    "pasta-dents": "File:Toothpasteonbrush.jpg",
    "bolquers-t4": "File:Disposable Diapers at Kroger.jpg",
    "pa-sense-gluten": "-",  # no suitable free photo found: the app shows the category icon
    "fageda-natural": "File:Llaeth y Llan, Village Dairy yogurt.jpg",
    "nata-cuinar": "File:Whipping Cream.jpg",
    "pa-motlle-sc": "File:White sandwich bread.jpg",
    "espaguetis": "File:Spaghetti measure.jpg",
    "mongetes-cuites": "File:White kidney beans🫘.jpg",
    "tomaquet-triturat": "File:Canned tomatoes.jpg",
    "llom-porc": "File:Close-up of raw pork chops on a wooden cutting board with fresh herbs ready for cooking.jpg",
    "pomes": "File:Golden Delicious apples.jpg",
    "patates": "File:Potato tubers in pail.jpg",
    "pasta-sense-gluten": "File:Fusilli and Penne Pasta.jpg",
    "llet-desnatada": "File:Milk-bottle.jpg",
}

_last = [0.0]
PAUSE = float(os.environ.get("PREUET_IMG_PAUSE", "15"))  # seconds between photo downloads


def get(url, binary=False, tries=20):
    for i in range(tries):
        # the API takes a call every ~1 s; upload.wikimedia.org (the photos) wants far fewer from a bot
        wait = (PAUSE if "upload.wikimedia.org" in url else 1.2) - (time.time() - _last[0])
        if wait > 0:
            time.sleep(wait)
        _last[0] = time.time()
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        try:
            with urllib.request.urlopen(req, timeout=40) as r:
                data = r.read()
                return data if binary else json.loads(data)
        except urllib.error.HTTPError as e:
            if e.code in (429, 503):
                time.sleep(int(e.headers.get("Retry-After") or 10) + 1)
                continue
            raise
        except urllib.error.URLError:
            time.sleep(5 * (i + 1))
    raise SystemExit(f"giving up on {url}")


def thumb_url(u):
    """Commons now hands out thumbnails on thumb.wikimedia.org; the same file is also served on upload.wikimedia.org."""
    u = (u or "").split("?")[0]
    return u.replace("https://thumb.wikimedia.org/", "https://upload.wikimedia.org/")


def plain(s):
    return html.unescape(re.sub(r"<[^>]+>", "", s or "")).strip()


def search(q, n=6):
    params = {"action": "query", "format": "json", "generator": "search", "gsrsearch": q + " filetype:bitmap",
              "gsrnamespace": "6", "gsrlimit": "25", "prop": "imageinfo", "iiprop": "url|extmetadata|size|mime",
              "iiurlwidth": "640", "iiextmetadatafilter": "LicenseShortName|Artist|UsageTerms", "maxlag": "5"}
    d = get(API + "?" + urllib.parse.urlencode(params))
    pages = sorted((d.get("query") or {}).get("pages", {}).values(), key=lambda p: p.get("index", 0))
    out = []
    for p in pages:
        ii = (p.get("imageinfo") or [{}])[0]
        meta = ii.get("extmetadata") or {}
        lic = plain((meta.get("LicenseShortName") or {}).get("value"))
        if ii.get("mime") not in ("image/jpeg", "image/png") or ii.get("width", 0) < 500 or not OK_LICENCE.match(lic):
            continue
        out.append({"title": p["title"], "thumb": ii.get("thumburl"), "page": ii.get("descriptionurl"), "licence": lic,
                    "author": plain((meta.get("Artist") or {}).get("value"))[:80] or "Wikimedia Commons", "w": ii["width"], "h": ii["height"]})
        if len(out) >= n:
            break
    return out


def by_title(title):
    params = {"action": "query", "format": "json", "titles": title, "prop": "imageinfo", "iiprop": "url|extmetadata|size|mime",
              "iiurlwidth": "640", "iiextmetadatafilter": "LicenseShortName|Artist|UsageTerms"}
    d = get(API + "?" + urllib.parse.urlencode(params))
    p = next(iter(d["query"]["pages"].values()))
    ii = p["imageinfo"][0]
    meta = ii.get("extmetadata") or {}
    lic = plain((meta.get("LicenseShortName") or {}).get("value"))
    if not OK_LICENCE.match(lic):
        raise KeyError(f"{title}: licence {lic!r} is not allowed")
    return {"title": p["title"], "thumb": ii["thumburl"], "page": ii["descriptionurl"], "licence": lic,
            "author": plain((meta.get("Artist") or {}).get("value"))[:80] or "Wikimedia Commons"}


def products(only):
    d = json.loads(DATA.read_text(encoding="utf-8"))
    ids = [p["id"] for p in d["products"]]
    return d, [i for i in ids if not only or i in only]


def cmd_candidates(a):
    out = pathlib.Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    path = out / "candidates.json"
    cands = json.loads(path.read_text()) if path.exists() else {}
    _, ids = products(a.only)
    for pid in ids:
        if pid in cands and not a.only:
            continue
        cands[pid] = search(QUERIES[pid])
        print(f"{pid:22s} {len(cands[pid])} candidates", flush=True)
        path.write_text(json.dumps(cands, ensure_ascii=False, indent=1))
    # contact sheets: one row per product, 6 small photos with their number
    rows = [pid for pid in ids if cands.get(pid)]
    for s in range(0, len(rows), 12):
        sheet = Image.new("RGB", (6 * 170 + 170, 12 * 130), "white")
        dr = ImageDraw.Draw(sheet)
        for r, pid in enumerate(rows[s:s + 12]):
            dr.text((4, r * 130 + 55), pid, fill="black")
            for c, cand in enumerate(cands[pid][:6]):
                try:
                    im = Image.open(io.BytesIO(get(thumb_url(cand["thumb"]), binary=True))).convert("RGB")
                    im = ImageOps.fit(im, (160, 120))
                    sheet.paste(im, (170 + c * 170, r * 130))
                    dr.rectangle([170 + c * 170, r * 130, 170 + c * 170 + 18, r * 130 + 14], fill="black")
                    dr.text((174 + c * 170, r * 130 + 1), str(c), fill="white")
                except Exception as e:  # noqa: BLE001 - a broken thumbnail just leaves a gap
                    print("  thumb", pid, c, e)
        sheet.save(out / f"sheet-{s // 12:02d}.jpg", quality=80)
        print("sheet", s // 12, flush=True)


def cmd_fetch(a):
    d, ids = products(a.only)
    cands = json.loads(pathlib.Path(a.cands).read_text()) if a.cands else {}
    OUT.mkdir(parents=True, exist_ok=True)
    byid = {p["id"]: p for p in d["products"]}
    for pid in ids:
        pick = PICKS.get(pid, 0 if cands.get(pid) else None)
        if pick is None or pick == "-":
            continue
        if not a.again and byid[pid].get("img") and (OUT / f"{pid}.jpg").exists():
            continue  # already done: rerunning carries on where it stopped
        try:
            cand = by_title(pick) if isinstance(pick, str) else cands[pid][pick]
        except (KeyError, IndexError) as e:
            print(f"{pid:22s} skipped: {e}", flush=True)
            continue
        im = Image.open(io.BytesIO(get(thumb_url(cand["thumb"]), binary=True))).convert("RGB")
        ImageOps.fit(im, (640, 480), centering=(0.5, 0.5)).save(OUT / f"{pid}.jpg", quality=78, optimize=True, progressive=True)
        ImageOps.fit(im, (160, 160), centering=(0.5, 0.5)).save(OUT / f"{pid}-s.jpg", quality=76, optimize=True)
        byid[pid]["img"] = {"f": f"img/products/{pid}.jpg", "t": f"img/products/{pid}-s.jpg", "a": cand["author"], "l": cand["licence"], "s": cand["page"]}
        print(f"{pid:22s} {cand['licence']:14s} {cand['author'][:40]}", flush=True)
        save(d)


def save(d):
    txt = json.dumps(d, ensure_ascii=False, separators=(",", ":"))
    if "</" in txt:
        raise SystemExit("refusing to write: data contains '</'")
    DATA.write_text(txt, encoding="utf-8")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("candidates"); c.add_argument("--only", type=lambda s: set(s.split(","))); c.add_argument("--out", default="img-candidates")
    f = sub.add_parser("fetch"); f.add_argument("--only", type=lambda s: set(s.split(","))); f.add_argument("--cands")
    f.add_argument("--again", action="store_true", help="download again products that already have a photo")
    a = ap.parse_args()
    {"candidates": cmd_candidates, "fetch": cmd_fetch}[a.cmd](a)


if __name__ == "__main__":
    sys.exit(main())
