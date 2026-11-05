"""New products for Preuet's catalogue (November 2026): common basket items that were missing.

Each entry is a product class like the existing ones in data/preuet-data.json, plus how to find it on the shelves:
    q        Spanish search words (Consum's search; Mercadona's catalogue is read whole)
    must     groups of words that must all appear in the shelf name (each group: any of its alternatives)
    avoid    words that rule a shelf item out (other varieties, flavours, formats)
    size     acceptable pack sizes, in the product's unit (min, max)
Nutrition values are typical values per 100 g/ml for the class (reference, as for the other products); allergens follow
the 14 EU allergens. Prices are never written here: they only come from the shops (tools/fetch_prices.py).
"""

N = lambda kcal, fat, sat, carb, sug, prot, salt, fib=None, basis="g": {  # noqa: E731
    "kcal": kcal, "fat": fat, "sat": sat, "carb": carb, "sug": sug, "prot": prot, "salt": salt, **({"fib": fib} if fib is not None else {}), "basis": basis}

PRODUCTS = [
    # fruit and veg
    dict(id="ceba", ca="Ceba", es="Cebolla", cat="fruita", unit="kg", ref=1, ref_ca="1 kg", ref_es="1 kg", tags=["sg", "vg"],
         nut=N(40, 0.1, 0, 9.3, 4.2, 1.1, 0.01, 1.7), q="cebolla", must=[["cebolla"]], avoid=["frita", "crujiente", "polvo", "tierna", "morada", "roja", "chalota", "caramelizada", "deshidratada", "tortilla", "pizza", "sopa", "pimiento"], size=(0.5, 3)),
    dict(id="alls", ca="Alls", es="Ajos", cat="fruita", unit="kg", ref=0.25, ref_ca="250 g", ref_es="250 g", tags=["sg", "vg"],
         nut=N(149, 0.5, 0.1, 33, 1, 6.4, 0.04, 2.1), q="ajo", must=[["ajo", "ajos"]], avoid=["picado", "polvo", "negro", "tierno", "frito", "granulado", "salsa", "aceite", "perejil", "pasta", "pan", "pimiento", "baguette", "mayonesa", "ajonesa", "tiras", "ali oli", "alioli", "gambas", "champi", "troceado", "alinados", "congelado", "mousse", "sal de", "queso"], size=(0.1, 0.5)),
    dict(id="enciam", ca="Enciam iceberg", es="Lechuga iceberg", cat="fruita", unit="ud", ref=1, ref_ca="1 u.", ref_es="1 ud.", tags=["sg", "vg"],
         nut=N(14, 0.1, 0, 3, 2, 0.9, 0.03, 1.2), q="lechuga iceberg", must=[["iceberg"]], avoid=["ensalada", "mezcla", "bolsa", "cortada"], size=(1, 1)),
    dict(id="porros", ca="Porros", es="Puerros", cat="fruita", unit="kg", ref=0.5, ref_ca="500 g", ref_es="500 g", tags=["sg", "vg"],
         nut=N(61, 0.3, 0, 14, 3.9, 1.5, 0.05, 1.8), q="puerro", must=[["puerro", "puerros"]], avoid=["crema", "sopa", "ajos"], size=(0.2, 1.5)),
    dict(id="xampinyons", ca="Xampinyons", es="Champiñones", cat="fruita", unit="kg", ref=0.25, ref_ca="250 g", ref_es="250 g", tags=["sg", "vg"],
         nut=N(22, 0.3, 0.1, 3.3, 2, 3.1, 0.01, 1), q="champiñon", must=[["champinon", "champinones"]], avoid=["lata", "conserva", "laminado en", "frasco", "crema", "salsa", "pizza", "rellenos", "ajillo", "bote", "pack", "risotto", "lata", "salteado"], size=(0.2, 0.6)),
    dict(id="raim", ca="Raïm", es="Uva", cat="fruita", unit="kg", ref=0.5, ref_ca="500 g", ref_es="500 g", tags=["sg", "vg"],
         nut=N(69, 0.2, 0.1, 18, 16, 0.7, 0.01, 0.9), q="uva", must=[["uva", "uvas"]], avoid=["pasas", "zumo", "mosto", "vinagre", "gominola", "aceite", "bebida", "refresc", "vino", "gelatina"], size=(0.3, 1.5)),
    dict(id="pesols-congelats", ca="Pèsols congelats", es="Guisantes congelados", cat="fruita", unit="kg", ref=1, ref_ca="1 kg", ref_es="1 kg", tags=["sg", "vg"],
         nut=N(81, 0.4, 0.1, 14, 5.7, 5.4, 0.01, 5.1), q="guisantes congelados", must=[["guisante", "guisantes"]], avoid=["lata", "conserva", "jamon", "zanahoria", "menestra", "salteado", "frasco"], size=(0.4, 1.5)),
    # meat and fish
    dict(id="hamburgueses", ca="Hamburgueses de vedella", es="Hamburguesas de vacuno", cat="carn", unit="kg", ref=0.4, ref_ca="400 g", ref_es="400 g", tags=["sg"],
         nut=N(230, 17, 7, 1, 0.5, 18, 1.2), q="hamburguesa vacuno", must=[["hamburguesa", "hamburguesas", "burger"], ["vacuno", "ternera", "vaca", "buey"]], avoid=["pollo", "cerdo", "vegetal", "pan", "queso", "mixta", "pavo", "congelad"], size=(0.2, 1)),
    dict(id="salsitxes", ca="Salsitxes de porc", es="Salchichas frescas de cerdo", cat="carn", unit="kg", ref=0.4, ref_ca="400 g", ref_es="400 g", tags=[],
         nut=N(260, 22, 8, 1, 0.5, 15, 1.8), q="salchichas frescas", must=[["salchicha", "salchichas", "longaniza"], ["fresca", "frescas", "cerdo"]], avoid=["frankfurt", "cocida", "cocidas", "pollo", "pavo", "viena", "ahumada", "lata", "queso", "bacon", "mini", "vegetal"], size=(0.2, 1)),
    dict(id="baco", ca="Bacó a tires", es="Bacon en lonchas", cat="carn", unit="kg", ref=0.15, ref_ca="150 g", ref_es="150 g", tags=["sg"],
         nut=N(300, 27, 10, 0.5, 0.5, 14, 2.5), q="bacon lonchas", must=[["bacon", "beicon"]], avoid=["taquitos", "tacos", "pavo", "queso", "crujiente", "sabor", "macarrones", "pieza", "pizza"], size=(0.08, 0.4)),
    dict(id="gambes", ca="Gambes pelades congelades", es="Gambas peladas congeladas", cat="carn", unit="kg", ref=0.3, ref_ca="300 g", ref_es="300 g", tags=["sg"], allergens=["crustacis"],
         nut=N(80, 0.8, 0.2, 0, 0, 18, 0.9), q="gamba pelada congelada", must=[["gamba", "gambas", "langostino", "langostinos"], ["pelada", "peladas", "pelados", "pelado"]], avoid=["ajillo", "cocida", "cocidos", "rebozad", "tempura", "brocheta"], size=(0.15, 1)),
    dict(id="salmo-fumat", ca="Salmó fumat", es="Salmón ahumado", cat="carn", unit="kg", ref=0.1, ref_ca="100 g", ref_es="100 g", tags=["sg"], allergens=["peix"],
         nut=N(180, 11, 2, 0, 0, 20, 3), q="salmon ahumado", must=[["salmon"], ["ahumado"]], avoid=["tacos", "crema", "pate", "untable", "eneldo", "sushi"], size=(0.05, 0.3)),
    dict(id="sardines", ca="Sardines en oli (llauna)", es="Sardinas en aceite (lata)", cat="rebost", unit="kg", ref=0.12, ref_ca="≈ 120 g", ref_es="≈ 120 g", tags=["sg"], allergens=["peix"],
         nut=N(220, 15, 3, 0, 0, 22, 0.9), q="sardinas aceite", must=[["sardina", "sardinas", "sardinillas"], ["aceite"]], avoid=["tomate", "picante", "limon", "escabeche", "ahumad"], size=(0.06, 0.4)),
    # dairy
    dict(id="formatge-curat", ca="Formatge curat", es="Queso curado", cat="lactics", unit="kg", ref=0.25, ref_ca="250 g", ref_es="250 g", tags=["sg"], allergens=["llet"],
         nut=N(420, 35, 22, 0.5, 0.5, 26, 1.8), q="queso curado", must=[["queso"], ["curado"]], avoid=["lonchas", "rallado", "tacos", "dados", "semicurado", "untar", "loncha", "cabra", "light", "crema", "cheddar", "pizza", "vegalia"], size=(0.15, 1.2)),
    dict(id="mozzarella", ca="Mozzarella fresca", es="Mozzarella fresca", cat="lactics", unit="kg", ref=0.125, ref_ca="125 g", ref_es="125 g", tags=["sg"], allergens=["llet"],
         nut=N(250, 19, 13, 1.5, 1, 18, 0.5), q="mozzarella fresca", must=[["mozzarella"]], avoid=["rallada", "rallado", "pizza", "barra", "bufala", "lonchas", "light", "perlas", "mini"], size=(0.1, 0.3)),
    dict(id="natilles", ca="Natilles", es="Natillas", cat="lactics", unit="kg", ref=0.5, ref_ca="4 × 125 g", ref_es="4 × 125 g", tags=["sg"], allergens=["llet"],
         nut=N(115, 3.5, 2.2, 18, 15, 3.5, 0.15), q="natillas", must=[["natillas", "natilla"]], avoid=["chocolate", "galleta", "proteina", "vegetal", "sin lactosa"], size=(0.4, 1)),
    dict(id="flam", ca="Flam d'ou", es="Flan de huevo", cat="lactics", unit="kg", ref=0.4, ref_ca="4 × 100 g", ref_es="4 × 100 g", tags=["sg"], allergens=["llet", "ous"],
         nut=N(130, 3.5, 2, 21, 19, 4, 0.15), q="flan huevo", must=[["flan"], ["huevo"]], avoid=["vainilla", "chocolate", "nata", "queso", "polvo", "sobre", "proteina", "azucares"], size=(0.3, 1)),
    dict(id="nata-muntar", ca="Nata per muntar", es="Nata para montar", cat="lactics", unit="l", ref=0.2, ref_ca="200 ml", ref_es="200 ml", tags=["sg"], allergens=["llet"],
         nut=N(337, 35, 23, 3, 3, 2, 0.08, basis="ml"), q="nata para montar", must=[["nata"], ["montar"]], avoid=["spray", "vegetal", "azucarada", "cocinar"], size=(0.18, 1.1)),
    # pantry
    dict(id="fideus", ca="Fideus", es="Fideos", cat="rebost", unit="kg", ref=0.5, ref_ca="500 g", ref_es="500 g", tags=["vg"], allergens=["gluten"],
         nut=N(355, 1.5, 0.3, 72, 3, 12, 0.01), q="fideos", must=[["fideo", "fideos", "fideua"]], avoid=["arroz", "chinos", "yakisoba", "sopa", "integral", "sin gluten", "instant", "ramen", "wok", "caldo"], size=(0.25, 1)),
    dict(id="pa-ratllat", ca="Pa ratllat", es="Pan rallado", cat="rebost", unit="kg", ref=0.25, ref_ca="250 g", ref_es="250 g", tags=["vg"], allergens=["gluten"],
         nut=N(370, 3, 0.6, 72, 4, 12, 1.2), q="pan rallado", must=[["pan"], ["rallado"]], avoid=["ajo", "perejil", "sin gluten", "panko", "integral"], size=(0.2, 1)),
    dict(id="blat-de-moro", ca="Blat de moro dolç (llauna)", es="Maíz dulce (lata)", cat="rebost", unit="kg", ref=0.3, ref_ca="≈ 300 g", ref_es="≈ 300 g", tags=["sg", "vg"],
         nut=N(80, 1.2, 0.2, 13, 5, 2.9, 0.4, 2.5), q="maiz dulce", must=[["maiz"], ["dulce"]], avoid=["palomitas", "tortitas", "harina", "congelad", "mazorca", "sin sal"], size=(0.14, 1)),
    dict(id="olives", ca="Olives farcides d'anxova", es="Aceitunas rellenas de anchoa", cat="rebost", unit="kg", ref=0.35, ref_ca="≈ 350 g", ref_es="≈ 350 g", tags=["sg"], allergens=["peix"],
         nut=N(150, 15, 2.5, 0.5, 0, 1.2, 3), q="aceitunas rellenas anchoa", must=[["aceituna", "aceitunas", "olivas"], ["anchoa"]], avoid=["pimiento", "suave", "doble", "limon", "bajas en sal", "banderillas", "gildas"], size=(0.1, 1)),
    dict(id="vinagre", ca="Vinagre de vi", es="Vinagre de vino", cat="rebost", unit="l", ref=1, ref_ca="1 L", ref_es="1 L", tags=["sg", "vg"],
         nut=N(20, 0, 0, 0.5, 0.5, 0, 0.01, basis="ml"), q="vinagre vino", must=[["vinagre"], ["vino"]], avoid=["jerez", "modena", "balsamico", "manzana", "crema", "reserva", "spray"], size=(0.5, 1.5)),
    dict(id="pebre", ca="Pebre negre mòlt", es="Pimienta negra molida", cat="rebost", unit="kg", ref=0.05, ref_ca="≈ 50 g", ref_es="≈ 50 g", tags=["sg", "vg"],
         nut=N(250, 3.3, 1.4, 64, 0.6, 10, 0.05), q="pimienta negra molida", must=[["pimienta"], ["negra"], ["molida"]], avoid=["grano", "molinillo", "mezcla", "blanca", "limon"], size=(0.03, 0.2)),
    dict(id="xocolata-negra", ca="Xocolata negra", es="Chocolate negro", cat="fleca", unit="kg", ref=0.1, ref_ca="100 g", ref_es="100 g", tags=["vg"], allergens=["soja"], traces=["llet", "fruitsecs"],
         nut=N(540, 38, 23, 35, 29, 7, 0.02), q="chocolate negro", must=[["chocolate"], ["negro", "puro", "fondant"]], avoid=["almendra", "avellana", "naranja", "menta", "bombon", "galleta", "leche", "blanco", "postre", "sin azucar", "cobertura", "relleno", "barrita", "cacahuete", "gotas", "fundir", "polvo", "aritos", "filipino", "cacao puro", "turron", "tortitas"], size=(0.08, 0.3)),
    dict(id="galetes-digestive", ca="Galetes integrals tipus Digestive", es="Galletas integrales tipo Digestive", cat="fleca", unit="kg", ref=0.4, ref_ca="400 g", ref_es="400 g", tags=["vg"], allergens=["gluten"], traces=["llet", "soja"],
         nut=N(480, 21, 10, 63, 18, 7, 1.1, 4), q="galletas digestive", must=[["digestive"]], avoid=["chocolate", "avena", "sin azucar", "rellena", "cacao"], size=(0.25, 1)),
    dict(id="magdalenes", ca="Magdalenes", es="Magdalenas", cat="fleca", unit="kg", ref=0.35, ref_ca="≈ 350 g", ref_es="≈ 350 g", tags=[], allergens=["gluten", "ous", "llet"],
         nut=N(430, 22, 2.5, 52, 28, 6, 0.8), q="magdalenas", must=[["magdalena", "magdalenas"]], avoid=["chocolate", "integral", "sin azucar", "rellena", "pepitas", "sin gluten", "proteina", "yogur", "limon", "cacao"], size=(0.2, 1)),
    dict(id="te", ca="Te negre (bossetes)", es="Té negro (bolsitas)", cat="fleca", unit="ud", ref=25, ref_ca="25 bossetes", ref_es="25 bolsitas", tags=["sg", "vg"],
         nut=None, q="te negro", must=[["te"], ["negro", "black", "breakfast", "ceylan"]], avoid=["chai", "frutos", "limon", "menta", "verde", "rojo", "capsula", "matcha", "melocoton", "frambuesa", "vainilla", "canela"], size=(20, 100)),
    # drinks
    dict(id="cervesa", ca="Cervesa (llaunes de 33 cl)", es="Cerveza (latas de 33 cl)", cat="begudes", unit="l", ref=1.98, ref_ca="6 × 33 cl", ref_es="6 × 33 cl", tags=["vg"], allergens=["gluten"],
         nut=N(42, 0, 0, 3.2, 0.2, 0.4, 0.01, basis="ml"), q="cerveza lata", must=[["cerveza"]], avoid=["botella", "botellin", "barril", "sin alcohol", "0,0", "0.0", "tostada", "radler", "limon", "negra", "ipa", "trigo", "sin gluten", "especial", "abadia", "roja", "vidrio"], size=(0.3, 8.5)),
    dict(id="aigua-gas", ca="Aigua amb gas", es="Agua con gas", cat="begudes", unit="l", ref=1, ref_ca="1 L", ref_es="1 L", tags=["sg", "vg"],
         nut=N(0, 0, 0, 0, 0, 0, 0.02, basis="ml"), q="agua con gas", must=[["agua"], ["gas"]], avoid=["sin gas", "sabor", "limon", "tonica"], size=(0.5, 9)),
    dict(id="refresc-taronja", ca="Refresc de taronja", es="Refresco de naranja", cat="begudes", unit="l", ref=2, ref_ca="2 L", ref_es="2 L", tags=["sg", "vg"],
         nut=N(40, 0, 0, 10, 10, 0, 0.02, basis="ml"), q="refresco naranja", must=[["refresco"], ["naranja"]], avoid=["zero", "sin azucar", "lata", "latas", "light", "gas", "cero"], size=(1.5, 2.5)),
    dict(id="vi-negre", ca="Vi negre jove", es="Vino tinto joven", cat="begudes", unit="l", ref=0.75, ref_ca="75 cl", ref_es="75 cl", tags=["sg", "vg"], allergens=["sulfits"],
         nut=N(85, 0, 0, 2.6, 0.6, 0.1, 0.01, basis="ml"), q="vino tinto", must=[["vino"], ["tinto"]], avoid=["reserva", "crianza", "sin alcohol", "brick", "cocinar", "dulce", "verano", "sangria", "gran"], size=(0.7, 0.8)),
    # household and personal care
    dict(id="suavitzant", ca="Suavitzant", es="Suavizante", cat="llar", unit="rentat", ref=60, ref_ca="60 rentats", ref_es="60 lavados", tags=[],
         nut=None, q="suavizante", must=[["suavizante"]], avoid=["perlas", "secadora", "toallitas", "ambientador", "serum", "unas"], size=(20, 150)),
    dict(id="pastilles-rentaplats", ca="Pastilles per al rentaplats", es="Pastillas para el lavavajillas", cat="llar", unit="ud", ref=40, ref_ca="40 pastilles", ref_es="40 pastillas", tags=[],
         nut=None, q="lavavajillas pastillas", must=[["lavavajillas"], ["pastilla", "pastillas", "capsulas", "tabletas"]], avoid=["mano", "abrillantador", "sal", "limpiador", "ambientador"], size=(15, 120)),
    dict(id="bosses-escombraries", ca="Bosses d'escombraries", es="Bolsas de basura", cat="llar", unit="ud", ref=30, ref_ca="30 bosses", ref_es="30 bolsas", tags=[],
         nut=None, q="bolsas basura", must=[["bolsa", "bolsas"], ["basura"]], avoid=["perfumad", "olor", "papelera", "100 l", "industrial", "compostable", "jardin"], size=(10, 60)),
    dict(id="netejador-multiusos", ca="Netejador multiús", es="Limpiador multiusos", cat="llar", unit="l", ref=1, ref_ca="1 L", ref_es="1 L", tags=[],
         nut=None, q="limpiador multiusos", must=[["limpiador", "limpiahogar"], ["multiusos", "multiuso"]], avoid=["toallitas", "recambio", "gel", "bayeta", "pastillas", "cambiador"], size=(0.5, 2)),
    dict(id="desodorant", ca="Desodorant (esprai)", es="Desodorante (spray)", cat="higiene", unit="l", ref=0.2, ref_ca="200 ml", ref_es="200 ml", tags=[],
         nut=None, q="desodorante spray", must=[["desodorante"], ["spray", "aerosol"]], avoid=["roll", "stick", "pies", "barra", "crema", "calzado"], size=(0.1, 0.3)),
    dict(id="tovalloletes", ca="Tovalloletes humides per a nadó", es="Toallitas húmedas para bebé", cat="higiene", unit="ud", ref=80, ref_ca="80 tovalloletes", ref_es="80 toallitas", tags=[],
         nut=None, q="toallitas bebe", must=[["toallitas"], ["bebe", "infantiles", "sensitive", "pure", "water"]], avoid=["desmaquillantes", "wc", "intimas", "limpieza", "gafas", "mascotas", "suelo"], size=(40, 400)),
]

# second batch (tools/more_products.py): added only when two supermarkets or more sell it
from more_products import MORE  # noqa: E402

PRODUCTS = PRODUCTS + MORE
