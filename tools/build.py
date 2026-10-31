#!/usr/bin/env python3
"""Build Preuet.

    python3 tools/build.py artifact   -> dist/artifact/   page for the Claude artifact (shared data in Claude's db)
    python3 tools/build.py web        -> dist/web/        static site for GitHub Pages (shared data in Supabase)
    python3 tools/build.py            -> both

Sources
    src/_order.txt + src/*.js   app modules, concatenated in that order into one script
    src/styles.css              all styles
    data/preuet-data.json       prices, offers, products, recipes, templates, sources (inlined so the app opens offline;
                                the app also fetches data/preuet-data.json and swaps it in when it is newer)
    tools/page_body.html        artifact page head (title, fonts from Google Fonts, CSS slot, #app)
    tools/cdn.txt               artifact: Preact + htm from jsDelivr
    web/                        web-only files: config.js, manifest, service worker, self-hosted fonts, vendor libs, icons
"""
import hashlib
import json
import pathlib
import re
import shutil
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"

# The artifact host wraps the page in this base; the web build carries the same rules so both render alike.
BASE_CSS = (":root{color-scheme:light;box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);"
            "padding-bottom:env(safe-area-inset-bottom,0px)}html{scroll-padding-top:env(safe-area-inset-top,0px)}"
            "body{margin:0;padding:0;font:14px -apple-system,BlinkMacSystemFont,sans-serif;background:#fff;color:#000}"
            "img{max-width:100%}[hidden]:not([hidden=until-found i]){display:none!important}")

DESCRIPTION = ("Preuet compara la cistella sencera entre supermercats de l'àrea de Barcelona amb preus reals, "
               "qualitat-preu, nutrició, estoc col·laboratiu i receptes.")

SW_REGISTER = ('if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) '
               'window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));')


def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")


def load_data():
    txt = read("data/preuet-data.json")
    data = json.loads(txt)  # fail early on broken JSON
    if "</" in txt:
        raise SystemExit("data contains '</' — it would close the inline <script> tag")
    for key in ("meta", "categories", "chains", "products", "offerings", "offers", "recipes", "templates", "sources"):
        if key not in data:
            raise SystemExit(f"data is missing '{key}'")
    return txt, data


def app_js():
    order = [n.strip() for n in read("src/_order.txt").split("\n") if n.strip()]
    return "\n".join(read("src/" + n) for n in order)


def data_tag(txt):
    return '<script id="preuet-data" type="application/json">' + txt + "</script>"


def build_artifact(txt, data):
    out = DIST / "artifact"
    (out / "data").mkdir(parents=True, exist_ok=True)
    body = read("tools/page_body.html").replace("/*@@CSS@@*/", read("src/styles.css"), 1)
    html = "\n".join([body, data_tag(txt), read("tools/cdn.txt"), "<script>", app_js(), "</script>", ""])
    (out / "index.html").write_text(html, encoding="utf-8")
    (out / "data" / "preuet-data.json").write_text(txt, encoding="utf-8")
    copy_history(out)
    return out / "index.html", html


def copy_history(out):
    src = ROOT / "data" / "history.json"
    if src.exists():
        json.loads(src.read_text(encoding="utf-8"))
        shutil.copyfile(src, out / "data" / "history.json")


def build_web(txt, data):
    out = DIST / "web"
    if out.exists():
        shutil.rmtree(out)
    shutil.copytree(ROOT / "web", out)
    (out / "data").mkdir(parents=True, exist_ok=True)
    (out / "data" / "preuet-data.json").write_text(txt, encoding="utf-8")
    copy_history(out)
    body = read("tools/page_body.html")
    app_div = re.search(r'^<div id="app">.*$', body, re.M).group(0)
    noscript = re.search(r"^<noscript>.*$", body, re.M).group(0)
    head = [
        "<!doctype html>",
        '<html lang="ca">',
        "<head>",
        '<meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">',
        "<title>Preuet · La cistella més barata, a prop teu</title>",
        f'<meta name="description" content="{DESCRIPTION}">',
        '<meta name="theme-color" content="#F6F4F7" media="(prefers-color-scheme: light)">',
        '<meta name="theme-color" content="#151018" media="(prefers-color-scheme: dark)">',
        '<meta name="mobile-web-app-capable" content="yes">',
        '<meta name="apple-mobile-web-app-title" content="Preuet">',
        '<meta property="og:title" content="Preuet · La cistella més barata, a prop teu">',
        f'<meta property="og:description" content="{DESCRIPTION}">',
        '<link rel="icon" href="icons/icon.svg" type="image/svg+xml">',
        '<link rel="icon" href="icons/favicon-48.png" sizes="48x48" type="image/png">',
        '<link rel="apple-touch-icon" href="icons/icon-180.png">',
        '<link rel="manifest" href="manifest.webmanifest">',
        '<link rel="stylesheet" href="fonts/fonts.css">',
        "<style>" + BASE_CSS + "</style>",
        "<style>\n" + read("src/styles.css") + "</style>",
        '<script src="config.js"></script>',
        "</head>",
        "<body>",
        app_div,
        noscript,
        data_tag(txt),
        '<script src="vendor/htm-preact-standalone-3.1.1.umd.js"></script>',
        "<script>",
        app_js(),
        "</script>",
        "<script>" + SW_REGISTER + "</script>",
        "</body>",
        "</html>",
        "",
    ]
    html = "\n".join(head)
    (out / "index.html").write_text(html, encoding="utf-8")
    build_id = data["meta"]["updated"] + "-" + hashlib.sha256(html.encode("utf-8")).hexdigest()[:8]
    sw = (out / "sw.js").read_text(encoding="utf-8").replace("@@BUILD@@", build_id)
    (out / "sw.js").write_text(sw, encoding="utf-8")
    (out / ".nojekyll").write_text("", encoding="utf-8")
    return out / "index.html", html


def main(argv):
    targets = argv or ["artifact", "web"]
    txt, data = load_data()
    meta = data["meta"]
    for tgt in targets:
        fn = {"artifact": build_artifact, "web": build_web}.get(tgt)
        if not fn:
            raise SystemExit(f"unknown target {tgt!r} (use artifact or web)")
        path, html = fn(txt, data)
        print(f"{tgt:8s} {path.relative_to(ROOT)}  {len(html.encode('utf-8')):,} bytes  "
              f"data {meta.get('updated')}: {meta.get('n_prices')} prices, {meta.get('n_products')} products, "
              f"{len(data['offers'])} offers")


if __name__ == "__main__":
    main(sys.argv[1:])
