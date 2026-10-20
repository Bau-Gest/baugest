"""Tâches « À faire » écrites au stylo dans BauGest : rendu pour la transcription, puis fichier des textes tapés.

Fichiers Drive, dans le dossier du chantier :
  « À faire (ne pas supprimer).json »  écrit par BauGest (appProperties kind='todo') — la tâche planifiée ne le modifie jamais
  « À faire – texte tapé.json »        écrit par la tâche planifiée : {"<id tâche>": {"v": iv, "t": "texte"}}
                                       BauGest le lit et reprend le texte si l'écriture n'a pas changé depuis (v == iv)
Une tâche est à transcrire si elle a de l'écriture (ink) et qu'aucun texte n'existe pour sa version iv
(ni dans tx du fichier À faire, ni dans le fichier texte tapé).

Usage :
  python3 todo.py render afaire.json dossier_sortie [texte_tape.json]
      → dossier_sortie/<id>.png (écriture de la tâche, fond blanc) + dossier_sortie/todo.json
        todo.json = [{id, img, t}] (t = texte déjà tapé, à garder en contexte) ; liste vide = rien à faire
  python3 todo.py texts afaire.json textes.json [texte_tape.json] sortie.json
      textes.json = {"<id>": "texte tapé", ...} — une ligne de texte par ligne écrite, séparées par \n
      (liste de matériel : un article par ligne, quantités et unités telles qu'écrites)
      → sortie.json = nouveau « À faire – texte tapé.json » (anciens textes encore valables + nouveaux)
"""
import json
import os
import sys

from prepare import draw_strokes

TW, SC = 1000, 2.0  # largeur 1000 unités ; hauteur libre (une ligne = 100 unités, plusieurs lignes possibles)


def load(path):
    return json.load(open(path, encoding="utf-8")) if path and os.path.exists(path) else {}


def pending(doc, old):
    out = []
    for t in doc.get("tasks", []):
        if t.get("del") or not t.get("ink"):
            continue
        iv = t.get("iv")
        if (t.get("tx") or {}).get("v") == iv and (t.get("tx") or {}).get("t"):
            continue
        if (old.get(t["id"]) or {}).get("v") == iv and (old.get(t["id"]) or {}).get("t"):
            continue
        out.append(t)
    return out


def render(src, out, old_path=None):
    doc, old = load(src), load(old_path)
    os.makedirs(out, exist_ok=True)
    items = []
    for t in pending(doc, old):
        pts = [p for s in t["ink"] for p in s.get("p", [])]
        x0 = max(0, min(p[0] for p in pts) - 20)
        y0 = max(0, min(p[1] for p in pts) - 20)
        x1 = min(TW, max(p[0] for p in pts) + 20)
        y1 = max(p[1] for p in pts) + 20
        size = (max(1, round((x1 - x0) * SC)), max(1, round((y1 - y0) * SC)))
        strokes = [{**s, "c": "#1d2733"} for s in t["ink"]]
        img = draw_strokes(strokes, size, (x0, y0), SC)
        name = f"{t['id']}.png"
        img.save(os.path.join(out, name))
        items.append({"id": t["id"], "img": name, "t": t.get("t", "")})
    json.dump(items, open(os.path.join(out, "todo.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"{len(items)} tâche(s) à transcrire")


def texts(src, texts_path, old_path, dst):
    doc, new, old = load(src), load(texts_path), load(old_path)
    tasks = {t["id"]: t for t in doc.get("tasks", []) if not t.get("del")}
    out = {k: v for k, v in old.items() if k in tasks and v.get("v") == tasks[k].get("iv")}
    n = 0
    for k, txt in new.items():
        txt = str(txt).strip()
        if k in tasks and txt:
            out[k] = {"v": tasks[k].get("iv", ""), "t": txt}
            n += 1
    json.dump(out, open(dst, "w", encoding="utf-8"), ensure_ascii=False)
    print(f"{n} tâche(s) transcrite(s), {len(out)} texte(s) dans le fichier")


if __name__ == "__main__":
    a = sys.argv[1:]
    if a[:1] == ["render"] and len(a) in (3, 4):
        render(a[1], a[2], a[3] if len(a) == 4 else None)
    elif a[:1] == ["texts"] and len(a) in (4, 5):
        texts(a[1], a[2], a[3] if len(a) == 5 else None, a[-1])
    else:
        print(__doc__)
        sys.exit(1)
