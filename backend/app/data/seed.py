"""Seed crops + traits + references. Values are DRAFT (grade C = Ecocrop/FAO-56 style ranges).
Anything None means "not in our database" - the API says so instead of guessing.
Team: verify each row against its source, then set verified_by and upgrade the grade."""
from ..db import conn

REFS = {
    "FAO56": ("Allen et al. 1998, FAO Irrigation and Drainage Paper 56, Crop evapotranspiration", "https://www.fao.org/4/x0490e/x0490e00.htm"),
    "ECOCROP": ("FAO EcoCrop database", "https://gaez.fao.org/pages/ecocrop-search"),
    "GAEZ4": ("FAO/IIASA Global Agro-Ecological Zones v4", "https://gaez.fao.org/"),
    "SR2006": ("Saxton & Rawls 2006, Soil Sci. Soc. Am. J. 70:1569-1578", "https://doi.org/10.2136/sssaj2005.0117"),
    "POWER": ("NASA POWER Project (Prediction Of Worldwide Energy Resources)", "https://power.larc.nasa.gov/"),
}

CROPS = [  # id, name, arabic, kind
    ("wheat", "Durum/bread wheat", "القمح", "cereal"),
    ("barley", "Barley", "الشعير", "cereal"),
    ("oat", "Oat", "الشوفان", "cereal"),
    ("chickpea", "Chickpea", "الحمص", "legume"),
    ("lentil", "Lentil", "العدس", "legume"),
    ("faba", "Faba bean", "الفول", "legume"),
    ("vetch", "Vetch", "البيقية", "legume"),
    ("peas", "Dry pea", "البازلاء", "legume"),
    ("fallow", "Fallow", "بور", "fallow"),
]

# (crop, trait, value, unit, ref, locator, grade) - draft, unverified
TRAITS = [
    ("wheat", "water_need_mm", "450-650", "mm/season", "FAO56", "Table 12/Ch.6 (draft)", "C"),
    ("wheat", "heat_limit_tmax_c", "32", "C", "ECOCROP", "wheat record (draft)", "C"),
    ("wheat", "fixes_nitrogen", "no", None, "ECOCROP", None, "C"),
    ("barley", "water_need_mm", "350-500", "mm/season", "FAO56", "Table 12 (draft)", "C"),
    ("barley", "heat_limit_tmax_c", "32", "C", "ECOCROP", "barley record (draft)", "C"),
    ("barley", "fixes_nitrogen", "no", None, "ECOCROP", None, "C"),
    ("chickpea", "water_need_mm", "300-450", "mm/season", "FAO56", "Table 12 (draft)", "C"),
    ("chickpea", "heat_limit_tmax_c", "35", "C", "ECOCROP", "chickpea record (draft)", "C"),
    ("chickpea", "fixes_nitrogen", "yes", None, "ECOCROP", None, "C"),
    ("chickpea", "broomrape_risk", None, None, None, None, "L"),
    ("lentil", "water_need_mm", "300-450", "mm/season", "FAO56", "Table 12 (draft)", "C"),
    ("lentil", "heat_limit_tmax_c", "33", "C", "ECOCROP", "lentil record (draft)", "C"),
    ("lentil", "fixes_nitrogen", "yes", None, "ECOCROP", None, "C"),
    ("lentil", "broomrape_risk", None, None, None, None, "L"),
    ("faba", "water_need_mm", "400-600", "mm/season", "FAO56", "Table 12 (draft)", "C"),
    ("faba", "heat_limit_tmax_c", "30", "C", "ECOCROP", "faba record (draft)", "C"),
    ("faba", "fixes_nitrogen", "yes", None, "ECOCROP", None, "C"),
    ("faba", "broomrape_risk", "high", None, "ECOCROP", "draft - verify locally", "L"),
    ("peas", "water_need_mm", "350-500", "mm/season", "FAO56", "Table 12 (draft)", "C"),
    ("peas", "heat_limit_tmax_c", "28", "C", "ECOCROP", "pea record (draft)", "C"),
    ("peas", "fixes_nitrogen", "yes", None, "ECOCROP", None, "C"),
    ("fallow", "water_need_mm", "0", "mm/season", None, None, "L"),
    ("fallow", "fixes_nitrogen", "no", None, None, None, "L"),
]

def seed():
    with conn() as c:
        for rid, (cit, url) in REFS.items():
            c.execute("INSERT OR IGNORE INTO reference VALUES (?,?,?)", (rid, cit, url))
        for row in CROPS:
            c.execute("INSERT OR IGNORE INTO crop VALUES (?,?,?,?)", row)
        for crop, trait, val, unit, ref, loc, grade in TRAITS:
            c.execute("INSERT OR IGNORE INTO crop_trait VALUES (?,?,?,?,?,?,?,NULL)",
                      (crop, trait, val, unit, ref, loc, grade))
