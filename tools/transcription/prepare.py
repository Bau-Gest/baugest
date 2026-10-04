"""Prépare un document BauGest (JSON du Drive) pour la transcription.

Usage : python3 prepare.py document.json reglages.json dossier_sortie

Produit dans dossier_sortie :
  page_N.png          la page entière (écriture seule, fond blanc, échelle 1.6)
  seg_N_K.png         un extrait par segment d'écriture (ligne ou morceau de ligne)
  info.json           tout ce qu'il faut pour make_pdf.py :
                      kind, title, date, site, logo, bg, form, sign,
                      pages[].segments[] = {id, x, y, x2, top, bottom, img}
                      pages[].signatures[] = {x, y, w, h, src} : contenu des cases de signature,
                      jamais transcrit, recopié tel quel dans le PDF (clé "images" de make_pdf.py)
                      (x, y = position conseillée du texte tapé, en unités BauGest)
"""
import base64
import io
import json
import os
import sys

from PIL import Image, ImageDraw

PW, PH, SC = 1000, 1414, 1.6
DOCS = {
    "pv": {"title": "PV de séance de chantier", "bg": "lined", "form": True, "sign": False},
    "journal": {"title": "Rapport journalier", "bg": "lined", "form": True, "sign": True},
    "regie": {"title": "Bon de régie", "bg": "plain", "form": True, "sign": True},
    "constat": {"title": "Constat / défaut", "bg": "plain", "form": True, "sign": True},
    "libre": {"title": "Note", "bg": "lined", "form": False, "sign": False},
}
# Cases de signature des modèles BauGest (x1, y1, x2, y2) : leur contenu n'est pas transcrit,
# il est recopié tel quel (écriture d'origine) dans le PDF.
def sign_boxes(kind, sign):
    if not sign:
        return []
    def row(y, n):
        w = (880 - (n - 1) * 30) / n
        return [(60 + i * (w + 30), y, 60 + i * (w + 30) + w, 1340) for i in range(n)]
    return {"journal": row(1215, 1), "regie": row(1110, 2), "constat": row(1140, 2)}.get(kind, [])


LAY_DEF = {"logo": True, "pos": "left", "date": "short", "bg": "auto", "site": True, "form": True, "sign": True}


def inside(b, box):
    cx, cy = (b[0] + b[2]) / 2, (b[1] + b[3]) / 2
    return box[0] <= cx <= box[2] and box[1] <= cy <= box[3]


def stroke_box(st):
    p = st.get("p", [])
    xs, ys = [q[0] for q in p], [q[1] for q in p]
    return [min(xs), min(ys), max(xs), max(ys)]


def draw_strokes(strokes, size, origin, scale, transparent=False):
    img = Image.new("RGBA" if transparent else "RGB", size, (255, 255, 255, 0) if transparent else "white")
    d = ImageDraw.Draw(img)
    ox, oy = origin
    for s in strokes:
        c, w, p = s.get("c", "#1d2733"), float(s.get("w", 2.8)), s.get("p", [])
        if len(p) == 1:
            r = w * (0.35 + p[0][2] * 1.3) / 2 * scale
            x, y = (p[0][0] - ox) * scale, (p[0][1] - oy) * scale
            d.ellipse([x - r, y - r, x + r, y + r], fill=c)
            continue
        for a, b in zip(p, p[1:]):
            lw = max(1, round(w * (0.35 + (a[2] + b[2]) / 2 * 1.3) * scale))
            xy = [(a[0] - ox) * scale, (a[1] - oy) * scale, (b[0] - ox) * scale, (b[1] - oy) * scale]
            d.line(xy, fill=c, width=lw)
            rr = lw / 2
            d.ellipse([xy[2] - rr, xy[3] - rr, xy[2] + rr, xy[3] + rr], fill=c)
    return img


def draw_page(page, scale):
    img = Image.new("RGB", (int(PW * scale), int(PH * scale)), "white")
    for im in page.get("i", []) or []:
        src = im.get("src", "")
        if "," not in src:
            continue
        try:
            pic = Image.open(io.BytesIO(base64.b64decode(src.split(",", 1)[1]))).convert("RGBA")
            pic = pic.resize((max(1, int(im["w"] * scale)), max(1, int(im["h"] * scale))))
            img.paste(pic, (int(im["x"] * scale), int(im["y"] * scale)), pic)
        except Exception:
            pass
    d = ImageDraw.Draw(img)
    for s in page.get("s", []) or []:
        c, w, p = s.get("c", "#1d2733"), float(s.get("w", 2.8)), s.get("p", [])
        if not p:
            continue
        if len(p) == 1:
            r = w * (0.35 + p[0][2] * 1.3) / 2 * scale
            x, y = p[0][0] * scale, p[0][1] * scale
            d.ellipse([x - r, y - r, x + r, y + r], fill=c)
            continue
        for a, b in zip(p, p[1:]):
            lw = max(1, round(w * (0.35 + (a[2] + b[2]) / 2 * 1.3) * scale))
            xy = [a[0] * scale, a[1] * scale, b[0] * scale, b[1] * scale]
            d.line(xy, fill=c, width=lw)
            rr = lw / 2
            d.ellipse([xy[2] - rr, xy[3] - rr, xy[2] + rr, xy[3] + rr], fill=c)
    return img


def segments(page):
    """Regroupe les traits en lignes, puis coupe les lignes aux grands blancs."""
    boxes = []
    for s in page.get("s", []) or []:
        p = s.get("p", [])
        if not p:
            continue
        xs, ys = [q[0] for q in p], [q[1] for q in p]
        boxes.append([min(xs), min(ys), max(xs), max(ys)])
    if not boxes:
        return []
    boxes.sort(key=lambda b: (b[1] + b[3]) / 2)
    lines = []
    for b in boxes:
        cy, h = (b[1] + b[3]) / 2, b[3] - b[1]
        best = None
        for L in lines:
            core_top, core_bot = L["mid"] - L["h"] * 0.55, L["mid"] + L["h"] * 0.55
            if core_top <= cy <= core_bot or (h < 18 and abs(cy - L["mid"]) < 30):
                best = L
                break
        if best is None:
            lines.append({"boxes": [b], "mid": cy, "h": max(h, 30)})
        else:
            best["boxes"].append(b)
            mids = sorted((q[1] + q[3]) / 2 for q in best["boxes"])
            best["mid"] = mids[len(mids) // 2]
            hs = sorted(q[3] - q[1] for q in best["boxes"])
            best["h"] = max(30, hs[len(hs) // 2])
    out = []
    for L in lines:
        bs = sorted(L["boxes"], key=lambda b: b[0])
        cur = [bs[0]]
        for b in bs[1:]:
            if b[0] - max(q[2] for q in cur) > 110:
                out.append(cur)
                cur = [b]
            else:
                cur.append(b)
        out.append(cur)
    segs = []
    for g in out:
        x1, y1 = min(b[0] for b in g), min(b[1] for b in g)
        x2, y2 = max(b[2] for b in g), max(b[3] for b in g)
        mid = sorted((b[1] + b[3]) / 2 for b in g)[len(g) // 2]
        hs = sorted(b[3] - b[1] for b in g)
        h = hs[len(hs) // 2]
        segs.append({"x": round(x1), "y": round(mid + h * 0.35), "x2": round(x2), "top": round(y1), "bottom": round(y2)})
    segs.sort(key=lambda s: (s["top"] // 25, s["x"]))
    return segs


def main(doc_path, settings_path, out):
    os.makedirs(out, exist_ok=True)
    doc = json.load(open(doc_path, encoding="utf-8"))
    S = json.load(open(settings_path, encoding="utf-8")) if settings_path and os.path.exists(settings_path) else {}
    F = S.get("fields", S)
    sites = S.get("sites", [])
    site = next((s for s in sites if s.get("id") == doc.get("siteId")), None)
    kind = doc.get("kind", "libre")
    base = DOCS.get(kind, DOCS["libre"])
    lay = {**LAY_DEF, **(F.get("docLay") or {}), **((site or {}).get("docLayout") or {})}
    bg = (doc.get("bg") or (base["bg"] if lay.get("bg") == "auto" else lay.get("bg"))) or base["bg"]
    logo = ""
    if lay.get("logo") and site and site.get("logo") and "," in site["logo"]:
        im = Image.open(io.BytesIO(base64.b64decode(site["logo"].split(",", 1)[1]))).convert("RGBA")
        k = 180 / max(im.size)
        im = im.resize((max(1, int(im.width * k)), max(1, int(im.height * k))))
        flat = Image.new("RGB", im.size, "white")
        flat.paste(im, mask=im.split()[3])
        logo = os.path.join(out, "logo.png")
        flat.quantize(64).save(logo, optimize=True)
    site_label = ""
    if lay.get("site") and site:
        site_label = (str(site.get("number") or "") + " " + str(site.get("name") or "")).strip()
    info = {
        "kind": kind, "title": doc.get("title") or (F.get("docTitles") or {}).get(kind) or base["title"],
        "date": doc.get("date", ""), "site": site_label, "logo": logo, "bg": bg,
        "form": bool(lay.get("form", True)), "sign": bool(lay.get("sign", True)), "pages": [],
    }
    boxes = sign_boxes(kind, base["sign"] and bool(lay.get("sign", True)) and bool(lay.get("form", True)) and base["form"])
    for pi, page in enumerate(doc.get("pages", [])):
        signatures = []
        if pi == 0 and boxes:
            keep, signed = [], {i: [] for i in range(len(boxes))}
            for st in page.get("s", []) or []:
                if not st.get("p"):
                    continue
                hit = next((i for i, bx in enumerate(boxes) if inside(stroke_box(st), bx)), None)
                (keep if hit is None else signed[hit]).append(st)
            page = {**page, "s": keep}
            for i, sts in signed.items():
                if not sts:
                    continue
                bx = boxes[i]
                sc = 2
                im = draw_strokes(sts, (int((bx[2] - bx[0]) * sc), int((bx[3] - bx[1]) * sc)), (bx[0], bx[1]), sc, transparent=True)
                path = os.path.join(out, f"signature_{i + 1}.png")
                im.save(path, optimize=True)
                signatures.append({"x": round(bx[0], 1), "y": bx[1], "w": round(bx[2] - bx[0], 1), "h": bx[3] - bx[1], "src": path})
        img = draw_page(page, SC)
        full = os.path.join(out, f"page_{pi + 1}.png")
        img.save(full)
        segs = segments(page)
        for k, sg in enumerate(segs):
            pad = 14
            box = [max(0, (sg["x"] - pad) * SC), max(0, (sg["top"] - pad) * SC),
                   min(PW, sg["x2"] + pad) * SC, min(PH, sg["bottom"] + pad) * SC]
            crop = img.crop([int(v) for v in box])
            path = os.path.join(out, f"seg_{pi + 1}_{k + 1}.png")
            crop.save(path)
            sg["id"] = f"{pi + 1}.{k + 1}"
            sg["img"] = path
        info["pages"].append({"image": full, "segments": segs, "signatures": signatures, "photos": len(page.get("i", []) or [])})
    json.dump(info, open(os.path.join(out, "info.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(json.dumps({"pages": len(info["pages"]), "segments": [len(p["segments"]) for p in info["pages"]], "out": out}))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "", sys.argv[3] if len(sys.argv) > 3 else "prep")
