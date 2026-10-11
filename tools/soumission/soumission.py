"""Soumission rentrée (série de prix) → tableau des positions BauGest (JSON).

Usage : python3 soumission.py <fichier .crbx | .e1s | .docx> sortie.json

Formats lus :
- .crbx (BauBit, Messerli…) : archive zip contenant un fichier SIA 451 (.e1s / .01s), lignes à colonnes fixes.
- .docx : soumission imprimée par BauBit vers Word (tableaux Pos. | Cd. | Description | Un. | Quantité | Prix | Montant).
Un PDF n'est pas lu par ce script : la tâche « Soumission BauGest » le lit elle-même et écrit le même JSON.

JSON produit (lu par la rubrique Soumission de la tablette, même format que la lecture .crbx faite dans index.html) :
{
  "v": 1,
  "src": {"name": "Série de prix.crbx", "fmt": "crbx" | "docx" | "pdf"},
  "projet": "BV 16056 ROUTE 302 …",                (texte libre, peut être vide)
  "entreprise": "Charles Gasser SA",               (peut être vide)
  "total": 5765480.0,                              (total brut CHF ; null si inconnu)
  "cans": [{"can": "151", "titre": "Constructions de réseaux enterrés", "total": 461278.0}],
  "pos": [
    {"can": "151", "p": "121", "h": 1, "t": "Excavation à la main pour sondages. …"},          (titre de paragraphe : h = 1)
    {"can": "151", "p": "121.001", "t": "Classes d'exploitation 2 à 4.", "u": "m3", "q": 200.0, "pu": 34.0, "m": 6800.0}
  ]
}
q, pu, m : null si la position n'est pas chiffrée. Aucune donnée n'est inventée : tout vient du fichier.
"""
import json
import re
import sys
import zipfile
from pathlib import Path

# Titres des CAN : le .crbx coupe les titres longs sur deux champs (espaces perdus) → titre d'origine quand il est connu.
CAN_TITRES = {
    "102": "Mesures environnementales", "111": "Travaux en régie", "112": "Essais", "113": "Installations de chantier",
    "116": "Coupes de bois et défrichements", "117": "Démolitions et démontages", "125": "Guidage temporaire du trafic",
    "151": "Constructions de réseaux enterrés", "161": "Epuisement des eaux", "162": "Enceintes de fouilles",
    "181": "Aménagements extérieurs", "211": "Fouilles et terrassements", "221": "Couches de fondation pour surfaces de circulation",
    "222": "Bordures, pavages, dallages et escaliers", "223": "Chaussées et revêtements", "237": "Canalisations et évacuation des eaux",
    "241": "Constructions en béton coulé sur place", "281": "Dispositifs routiers de retenue", "282": "Signalisation: Signaux routiers",
    "286": "Marquages", "315": "Construction préfabriquée en béton et en maçonnerie",
}


def join_lines(lines):
    """Recolle les lignes d'un texte coupé à largeur fixe (césure « -» en fin de ligne)."""
    out = ""
    for ln in (s.strip() for s in lines):
        if not ln:
            continue
        if not out:
            out = ln
        elif out.endswith("-") and ln[:1].islower() and not out.endswith(" -"):
            out = out[:-1] + ln
        else:
            out += " " + ln
    return re.sub(r"\s+", " ", out).strip()


def fmt_pos(code):
    code = code.strip()
    if len(code) == 6 and code.isdigit():
        return code[:3] if code[3:] == "000" else code[:3] + "." + code[3:]
    return code


def finish(doc):
    tot = {}
    for p in doc["pos"]:
        if p.get("m") is not None:
            tot[p["can"]] = tot.get(p["can"], 0.0) + p["m"]
    for c in doc["cans"]:
        if c.get("total") is None:
            c["total"] = round(tot.get(c["can"], 0.0), 2)
    if doc.get("total") is None and doc["cans"]:
        doc["total"] = round(sum(c["total"] or 0 for c in doc["cans"]), 2)
    return doc


# ---------- SIA 451 (.crbx / .e1s) ----------
def read_451(raw):
    for enc in ("utf-8", "cp1252"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            pass
    return raw.decode("latin-1")


UNIT_LINE = re.compile(r"^\s*(gl|up|fft|m|m1|m2|m3|h|pce|p|kg|t|l|j|sem|mois|%)\s*$", re.I)


def parse_451(text, name=""):
    lines = text.splitlines()
    doc = {"v": 1, "src": {"name": name, "fmt": "crbx"}, "projet": "", "entreprise": "", "total": None, "cans": [], "pos": []}
    cans, pos = {}, {}
    for l in lines:
        k = l[:1]
        if k == "A" and len(l) > 136:
            doc["projet"] = " ".join(x for x in (l[81:91].strip(), l[91:121].strip(), l[136:166].strip()) if x)
        elif k == "Z" and len(l) > 136:
            doc["entreprise"] = l[136:166].strip()
        if k != "G" or len(l) < 42:
            continue
        can, code, sub, lvl = l[1:4], l[7:13].strip(), l[13:17].strip(), l[41]
        txt = l[92:] if len(l) > 92 else ""
        if not code:
            if lvl == "1":
                raw = (l[92:122] + l[137:]).strip()
                cans[can] = {"can": can, "titre": CAN_TITRES.get(can) or re.sub(r"\s+", " ", raw), "total": None}
            continue
        cans.setdefault(can, {"can": can, "titre": CAN_TITRES.get(can, ""), "total": None})
        p = pos.setdefault((can, code), {"can": can, "p": fmt_pos(code), "title": [], "text": [], "u": "", "q": None, "pu": None, "m": None})
        if lvl == "2" and not sub:
            p["title"].append(txt)
        elif lvl == "3":
            p["text"].append(txt)
        elif lvl == "5":
            p["u"] = l[42:].strip()
        elif lvl == "6":
            m = re.search(r"([+-]\d{13})\s+[A-Z ]?([+-]\d{12})", l[42:])
            if m:
                qi, pi = int(m.group(1)), int(m.group(2))
                p["q"] = (p["q"] or 0) + qi / 1000
                p["pu"] = pi / 100
                p["v"] = p.get("v", 0) + qi * pi  # montant exact en 1/100 000 CHF
    doc["cans"] = list(cans.values())
    for p in pos.values():
        if "v" in p:  # montant arrondi à 0.05 CHF par position, comme BauBit
            v = p["v"]
            p["m"] = (abs(v) + 2500) // 5000 * 5 * (1 if v >= 0 else -1) / 100
        body = [t for t in p["text"] if t.strip() and t.strip() != p["u"] and not UNIT_LINE.match(t)]
        t = join_lines(body) or join_lines(p["title"])
        o = {"can": p["can"], "p": p["p"], "t": t}
        if p["u"] or p["q"] is not None:
            o.update({"u": p["u"], "q": round(p["q"], 3) if p["q"] is not None else None, "pu": p["pu"],
                      "m": round(p["m"], 2) if p["m"] is not None else None})
        else:
            o["h"] = 1
        doc["pos"].append(o)
    return finish(doc)


def parse_crbx(path):
    path = Path(path)
    if path.suffix.lower() in (".e1s", ".01s"):
        return parse_451(read_451(path.read_bytes()), path.name)
    with zipfile.ZipFile(path) as z:
        names = [n for n in z.namelist() if re.search(r"\.(e1s|01s|[a-z]1s)$", n, re.I)] or z.namelist()
        return parse_451(read_451(z.read(names[0])), path.name)


# ---------- Word (.docx) ----------
NUM = re.compile(r"^-?[\d' ]+(?:\.\d+)?$")


def num(s):
    s = (s or "").replace("'", "").replace("’", "").replace(" ", "").strip()
    return float(s) if s and NUM.match(s) else None


def cell_text(xml):
    paras = []
    for p in re.findall(r"<w:p[ >].*?</w:p>|<w:p/>", xml, flags=re.S):
        p = re.sub(r"<w:br/>|<w:cr/>", "<w:t>\n</w:t>", p)
        t = "".join(re.findall(r"<w:t(?: [^>]*)?>([^<]*)</w:t>", p))
        paras.append(t)
    lines = [ln for pa in paras for ln in pa.split("\n")]
    return join_lines(lines).replace("&apos;", "'").replace("&quot;", '"').replace("&lt;", "<").replace("&gt;", ">").replace("&amp;", "&")


def parse_docx(path):
    path = Path(path)
    with zipfile.ZipFile(path) as z:
        x = z.read("word/document.xml").decode("utf-8")
    doc = {"v": 1, "src": {"name": path.name, "fmt": "docx"}, "projet": "", "entreprise": "", "total": None, "cans": [], "pos": []}
    rows = []
    for r in re.findall(r"<w:tr[ >].*?</w:tr>", x, flags=re.S):
        rows.append([cell_text(c) for c in re.findall(r"<w:tc>.*?</w:tc>", r, flags=re.S)])
    pending, cur, in_pos = [], None, False
    can_tot = re.compile(r"^Total\s+(\d{3})\s+[A-Z]/\d{4}\s+(.*)$")
    for c in rows:
        if not c:
            continue
        c0 = c[0].strip()
        if c0 == "Pos." and len(c) >= 7:
            in_pos = True
            continue
        if c0 == "Total brut" and len(c) >= 3 and doc["total"] is None:
            doc["total"] = num(c[-1])
            continue
        m = can_tot.match(c0)
        if m:
            can = m.group(1)
            doc["cans"].append({"can": can, "titre": m.group(2).strip() or CAN_TITRES.get(can, ""), "total": num(c[-1])})
            for p in pending:
                p["can"] = can
            doc["pos"].extend(pending)
            pending, cur, in_pos = [], None, False
            continue
        if not in_pos or c0.startswith("Total"):
            continue
        if len(c) >= 7 and c0:
            cur = {"can": "", "p": c0, "t": c[2].strip()}
            u = c[3].strip()
            if u:
                cur.update({"u": u, "q": num(c[4]), "pu": num(c[5]), "m": num(c[6]), "_parts": 0})
            else:
                cur["h"] = 1
            pending.append(cur)
        elif len(c) >= 7 and not c0 and cur is not None and "u" in cur:
            q, pu, mt = num(c[4]), num(c[5]), num(c[6])
            if q is None and pu is None and mt is None:
                continue
            if cur["_parts"] == 0:
                cur["q"], cur["m"] = 0.0, 0.0
            cur["_parts"] += 1
            cur["q"] = round((cur["q"] or 0) + (q or 0), 3)
            cur["m"] = round((cur["m"] or 0) + (mt or 0), 2)
            if pu is not None:
                cur["pu"] = pu
        elif len(c) == 5 and cur is not None and "u" in cur:
            # ligne de somme des sous-ensembles : unité | quantité | — | montant
            q, mt = num(c[2]), num(c[4])
            if q is not None:
                cur["q"] = q
            if mt is not None:
                cur["m"] = mt
    for p in doc["pos"]:
        p.pop("_parts", None)
    paras = [cell_text(p) for p in re.findall(r"<w:p[ >].*?</w:p>", x[:200000], flags=re.S)]
    for i, t in enumerate(paras):
        if t.startswith("Projet "):
            doc["projet"] = t
            break
    for t in paras:
        mm = re.match(r"^(.*?(?:SA|Sàrl|AG|GmbH)\b.*?)$", t)
        if mm and len(t) < 80 and ("Cons." in t or "SA" in t):
            doc["entreprise"] = t
    return finish(doc)


def parse(path):
    ext = Path(path).suffix.lower()
    if ext == ".docx":
        return parse_docx(path)
    if ext in (".crbx", ".e1s", ".01s"):
        return parse_crbx(path)
    raise SystemExit(f"Format non pris en charge par ce script : {ext}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    d = parse(sys.argv[1])
    Path(sys.argv[2]).write_text(json.dumps(d, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    n = sum(1 for p in d["pos"] if not p.get("h"))
    chiff = sum(1 for p in d["pos"] if p.get("m") is not None)
    somme = round(sum(p["m"] for p in d["pos"] if p.get("m") is not None), 2)
    print(f"{len(d['cans'])} CAN · {n} positions ({chiff} chiffrées) · somme {somme:,.2f} · total du fichier {d['total']}")
    for c in d["cans"]:
        s = round(sum(p["m"] for p in d["pos"] if p["can"] == c["can"] and p.get("m") is not None), 2)
        flag = "" if c["total"] is None or abs(s - c["total"]) < 0.05 else f"  ⚠ somme des positions {s:,.2f}"
        print(f"  CAN {c['can']} {c['titre']} : {c['total']}{flag}")
