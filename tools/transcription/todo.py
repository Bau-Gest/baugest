"""Tâches « À faire » écrites au stylo dans BauGest : rendu pour la transcription, puis écriture du texte.

Fichier Drive : « <Chantier>/À faire (ne pas supprimer).json » (appProperties kind='todo').
Chaque tâche : {id, ink: [traits], iv: version de l'écriture, tx: {v, t} | absent, t?: texte tapé (point de PV), ...}
Une tâche est à transcrire si elle a de l'écriture (ink) et que tx manque ou que tx.v != iv.

Usage :
  python3 todo.py render afaire.json dossier_sortie
      → dossier_sortie/<id>.png (écriture de la tâche, fond blanc) + dossier_sortie/todo.json
        todo.json = [{id, img, t}] (t = texte déjà tapé, à garder en contexte) ; liste vide = rien à faire
  python3 todo.py apply afaire.json textes.json sortie.json
      textes.json = {"<id>": "texte tapé", ...}
      → sortie.json = afaire.json avec tx = {v: iv, t: texte} pour ces tâches.
        Le champ m (dernière modification) n'est PAS changé : BauGest fusionne le texte sans écraser
        une modification faite entre-temps sur la tablette.
"""
import json
import os
import sys

from prepare import draw_strokes

TW, TH, SC = 1000, 200, 2.0


def pending(doc):
    out = []
    for t in doc.get("tasks", []):
        if t.get("del") or not t.get("ink"):
            continue
        tx = t.get("tx") or {}
        if tx.get("v") == t.get("iv") and tx.get("t"):
            continue
        out.append(t)
    return out


def render(src, out):
    doc = json.load(open(src, encoding="utf-8"))
    os.makedirs(out, exist_ok=True)
    items = []
    for t in pending(doc):
        pts = [p for s in t["ink"] for p in s.get("p", [])]
        x0 = max(0, min(p[0] for p in pts) - 20)
        y0 = max(0, min(p[1] for p in pts) - 20)
        x1 = min(TW, max(p[0] for p in pts) + 20)
        y1 = min(TH, max(p[1] for p in pts) + 20)
        size = (max(1, round((x1 - x0) * SC)), max(1, round((y1 - y0) * SC)))
        strokes = [{**s, "c": "#1d2733"} for s in t["ink"]]
        img = draw_strokes(strokes, size, (x0, y0), SC)
        name = f"{t['id']}.png"
        img.save(os.path.join(out, name))
        items.append({"id": t["id"], "img": name, "t": t.get("t", "")})
    json.dump(items, open(os.path.join(out, "todo.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"{len(items)} tâche(s) à transcrire")


def apply(src, texts, dst):
    doc = json.load(open(src, encoding="utf-8"))
    tx = json.load(open(texts, encoding="utf-8"))
    n = 0
    for t in doc.get("tasks", []):
        txt = str(tx.get(t["id"], "")).strip()
        if txt:
            t["tx"] = {"v": t.get("iv", ""), "t": txt}
            n += 1
    json.dump(doc, open(dst, "w", encoding="utf-8"), ensure_ascii=False)
    print(f"{n} tâche(s) transcrite(s)")


if __name__ == "__main__":
    if len(sys.argv) == 4 and sys.argv[1] == "render":
        render(sys.argv[2], sys.argv[3])
    elif len(sys.argv) == 5 and sys.argv[1] == "apply":
        apply(sys.argv[2], sys.argv[3], sys.argv[4])
    else:
        print(__doc__)
        sys.exit(1)
