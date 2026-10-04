"""PDF « texte tapé » avec la mise en page BauGest.

Usage : python3 make_pdf.py transcription.json sortie.pdf

transcription.json :
{
  "kind": "pv" | "journal" | "regie" | "constat" | "libre",
  "title": "PV de séance de chantier",
  "date": "2026-10-02",               (AAAA-MM-JJ)
  "site": "102602 GACO",              (ligne sous le titre, "" si aucune)
  "logo": "logo.png",                 (facultatif)
  "bg": "lined" | "plain" | "grid",   (facultatif, sinon celui du modèle)
  "form": true, "sign": true,         (facultatifs, réglages BauGest)
  "pages": [ { "items": [ {"x": 320, "y": 262, "text": "Container de chantier", "size": 22, "check": false} ] } ]
}
x, y : position (ligne de base) en unités de page BauGest (page = 1000 x 1414),
soit la position de l'écriture dans l'image rendue divisée par l'échelle du rendu.
"images" / "signatures" : [{"x","y","w","h","src"}] images recopiées telles quelles
(cases de signature fournies par prepare.py, jamais transcrites).
"check": true dessine une croix dans une case à cocher (x, y = coin haut-gauche de la case).
Un texte qui commence par "[x] " ou "[ ] " dessine une case cochée ou vide devant le texte ;
un texte qui commence par "→ " dessine une flèche.
Par défaut ("snap": true), chaque texte est calé sur la ligne d'écriture la plus proche
et placé à droite des libellés du formulaire (Lieu :, Heure :…).
"""
import json
import sys

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

PW, PH = 1000, 1414
W, H = A4
K = W / PW
LAB, LN, HEAD, FILL, INK, PAPER = "#5f6f84", "#b9c5d3", "#1d2733", "#eef2f6", "#1f3a8a", "#fbfaf6"
DOCS = {
    "pv": {"bg": "lined", "form": True, "sign": False},
    "journal": {"bg": "lined", "form": True, "sign": True},
    "regie": {"bg": "plain", "form": True, "sign": True},
    "constat": {"bg": "plain", "form": True, "sign": True},
    "libre": {"bg": "lined", "form": False, "sign": False},
}


class Page:
    def __init__(self, c):
        self.c = c
        self.labels = []

    def X(self, x):
        return x * K

    def Y(self, y):
        return H - y * K

    def text(self, t, x, y, size=22, bold=True, color=LAB, align="left", cond=False):
        c = self.c
        font = "Helvetica-Bold" if bold else "Helvetica"
        fs = size * K
        to = c.beginText()
        to.setFont(font, fs)
        to.setFillColor(HexColor(color))
        scale = 82 if cond else 100
        to.setHorizScale(scale)
        w = c.stringWidth(t, font, fs) * scale / 100
        px = self.X(x) - (w if align == "right" else 0)
        to.setTextOrigin(px, self.Y(y))
        to.textLine(t)
        c.drawText(to)
        return w / K

    def line(self, x1, y1, x2, y2, color=LN, w=1.6):
        c = self.c
        c.setStrokeColor(HexColor(color))
        c.setLineWidth(w * K)
        c.line(self.X(x1), self.Y(y1), self.X(x2), self.Y(y2))

    def box(self, x, y, w, h, fill="#ffffff", color=LN):
        c = self.c
        c.setFillColor(HexColor(fill))
        c.setStrokeColor(HexColor(color))
        c.setLineWidth(1.6 * K)
        c.rect(self.X(x), self.Y(y + h), w * K, h * K, stroke=1, fill=1)

    def fld(self, label, x, y, x2):
        w = self.text(label, x, y)
        self.labels.append((x, x + w, y))
        self.line(x + w + 10, y + 5, x2, y + 5)

    def sect(self, label, y):
        self.text(label.upper(), 60, y, size=21, color=HEAD)
        self.line(60, y + 10, 940, y + 10, HEAD, 2)

    def tbl(self, x, y, cols, rh, rows, heads):
        tw = sum(cols)
        self.box(x, y, tw, rh * (rows + 1))
        self.c.setFillColor(HexColor(FILL))
        self.c.rect(self.X(x + 1), self.Y(y + rh - 1), (tw - 2) * K, (rh - 2) * K, stroke=0, fill=1)
        cx = x
        for i, h in enumerate(heads):
            self.text(h, cx + 10, y + rh - 13, size=18)
            cx += cols[i]
            if i < len(cols) - 1:
                self.line(cx, y, cx, y + rh * (rows + 1))
        for r in range(1, rows + 1):
            self.line(x, y + rh * r, x + tw, y + rh * r)

    def cbx(self, x, y, label):
        self.box(x, y - 20, 24, 24)
        return self.text(label, x + 34, y)

    def signs(self, y, labels):
        n = len(labels)
        w = (880 - (n - 1) * 30) / n
        for i, l in enumerate(labels):
            x = 60 + i * (w + 30)
            self.box(x, y, w, 1340 - y)
            self.text(l, x + 12, y + 28, size=17)
            self.text("Nom, date, signature", x + 12, 1330, size=15, bold=False)


def paper(p, bg):
    c = p.c
    c.setFillColor(HexColor(PAPER))
    c.rect(0, 0, W, H, stroke=0, fill=1)
    if bg == "lined":
        for y in range(262, PH - 60, 56):
            p.line(60, y, PW - 60, y, "#d9e2ec", 1.4)
    elif bg == "grid":
        for x in range(60, PW - 59, 40):
            p.line(x, 220, x, PH - 60, "#e1e7ee", 1.1)
        for y in range(220, PH - 59, 40):
            p.line(60, y, PW - 60, y, "#e1e7ee", 1.1)


def header(p, T, pi, pc):
    c = p.c
    c.setFillColor(HexColor(PAPER))
    c.rect(0, p.Y(214), W, 214 * K, stroke=0, fill=1)
    left, right = 60, 940
    if T.get("logo"):
        img = ImageReader(T["logo"])
        iw, ih = img.getSize()
        lh = 118
        lw = min(260, lh * iw / ih)
        lhh = lw * ih / iw
        c.drawImage(img, p.X(60), p.Y(44 + (lh - lhh) / 2 + lhh), lw * K, lhh * K, mask="auto")
        left = 60 + lw + 28
    d = T["date"]
    dt = f"{d[8:10]}.{d[5:7]}.{d[0:4]}"
    p.text("DATE", right, 76, size=17, align="right")
    dw = p.text(dt, right, 128, size=50, color=HEAD, align="right", cond=True)
    title = T["title"].upper()
    maxw = right - dw - 45 - left
    fs = 54
    while c.stringWidth(title, "Helvetica-Bold", fs * K) * 0.82 / K > maxw and fs > 22:
        fs -= 2
    p.text(title, left, 112, size=fs, color=HEAD, cond=True)
    sub = "   ·   ".join(x for x in [T.get("site", ""), f"suite · page {pi + 1}" if pi else ""] if x)
    if sub:
        p.text(sub, left, 152, size=23)
    p.line(60, 190, 940, 190, HEAD, 3)
    p.text(f"page {pi + 1} / {pc}", 940, 1386, size=15, bold=False, color="#98a3b1", align="right")


def form(p, kind, sign):
    if kind == "pv":
        p.fld("Lieu :", 60, 262, 540)
        p.fld("Heure :", 580, 262, 940)
        p.fld("Participants :", 60, 316, 940)
        p.line(60, 367, 940, 367)
        p.sect("Points traités · décisions", 425)
        p.sect("Actions", 1010)
        p.tbl(60, 1030, [50, 530, 170, 130], 46, 6, ["", "Action", "Qui", "Délai"])
        for r in range(1, 7):
            p.box(72, 1030 + 46 * r + 11, 24, 24)
    elif kind == "journal":
        x = p.text("Météo :", 60, 262) + 80
        for m in ["Soleil", "Nuageux", "Pluie", "Neige"]:
            x += p.cbx(x, 262, m) + 60
        p.fld("T° :", 800, 262, 900)
        p.text("°C", 906, 262)
        p.tbl(60, 290, [340, 180, 180, 180], 42, 5, ["Personnel", "Nombre", "Heures", "Remarque"])
        for i, r in enumerate(["Contremaître", "Ouvriers", "Machinistes", "Chauffeurs", "Sous-traitants"]):
            p.text(r, 72, 290 + 42 * (i + 2) - 13, size=19, bold=False)
        p.fld("Machines, engins :", 60, 580, 940)
        p.line(60, 628, 940, 628)
        p.sect("Travaux exécutés", 690)
        p.sect("Livraisons · matériaux", 1000 if sign else 1060)
        p.sect("Remarques · incidents", 1110 if sign else 1200)
        if sign:
            p.signs(1215, ["Visa du conducteur de travaux"])
    elif kind == "regie":
        p.fld("N° de bon :", 60, 262, 400)
        p.fld("Ordonné par :", 440, 262, 940)
        p.fld("Travaux :", 60, 316, 940)
        p.line(60, 367, 940, 367)
        p.tbl(60, 400, [400, 300, 180], 42, 5, ["Personnel · nom", "Fonction", "Heures"])
        p.tbl(60, 670, [700, 180], 42, 3, ["Machines · engins", "Heures"])
        p.tbl(60, 855, [520, 180, 180], 42, 4, ["Matériaux · fournitures", "Quantité", "Unité"])
        if sign:
            p.signs(1110, ["Entreprise", "Direction des travaux / maître d’ouvrage"])
    elif kind == "constat":
        bot = 990 if sign else 1080
        p.fld("Localisation :", 60, 262, 940)
        p.fld("Constaté par :", 60, 316, 520)
        p.fld("En présence de :", 560, 316, 940)
        p.sect("Description", 380)
        p.sect("Croquis", 640)
        p.box(60, 660, 880, bot - 660)
        for x in range(100, 940, 40):
            p.line(x, 661, x, bot - 1, "#e4e9ef", 1)
        for y in range(700, bot, 40):
            p.line(61, y, 939, y, "#e4e9ef", 1)
        y0 = bot + 50
        p.fld("Mesure à prendre :", 60, y0, 940)
        p.fld("Responsable :", 60, y0 + 50, 560)
        p.fld("Délai :", 600, y0 + 50, 940)
        if sign:
            p.signs(1140, ["Constaté par", "Pris connaissance"])


def fit(p, it, bg):
    """Place le texte sur la ligne d'écriture la plus proche et à droite des libellés du formulaire."""
    x, y = it["x"], it["y"]
    for lx1, lx2, ly in p.labels:
        if abs(y - ly) <= 24:
            y = ly
            if x < lx2 + 10:
                x = lx2 + 12
            return x, y
    if bg == "lined" and 240 <= y <= PH - 60:
        line = 262 + round((y - 262) / 56) * 56
        if abs(y - line) <= 24:
            y = line - 5
    return x, y


def items(p, its, bg="plain", snap=True):
    for it in its:
        if snap and not it.get("check"):
            it = {**it}
            it["x"], it["y"] = fit(p, it, bg)
        t0 = it.get("text", "")
        if t0[:3] in ("[x]", "[X]", "[ ]"):
            x, y, sz = it["x"], it["y"], it.get("size", 22)
            items(p, [{"x": x, "y": y - 20, "check": True, "box": True}] if t0[1] != " " else [], bg, False)
            if t0[1] == " ":
                p.box(x, y - 20, 24, 24, color=INK)
            it = {**it, "text": t0[3:].lstrip(), "x": x + 36}
        if it.get("check"):
            x, y = it["x"], it["y"]
            if it.get("box", True):
                p.c.setFillColor(HexColor("#ffffff"))
                p.box(x, y, 24, 24, color=INK)
            p.line(x + 5, y + 5, x + 19, y + 19, INK, 2.6)
            p.line(x + 19, y + 5, x + 5, y + 19, INK, 2.6)
            continue
        t, x, y, sz = it["text"], it["x"], it["y"], it.get("size", 22)
        if t.startswith("→"):
            m = y - sz * 0.32
            p.line(x, m, x + sz * 1.1, m, INK, 2)
            p.line(x + sz * 0.75, m - sz * 0.3, x + sz * 1.1, m, INK, 2)
            p.line(x + sz * 0.75, m + sz * 0.3, x + sz * 1.1, m, INK, 2)
            t, x = t[1:].lstrip(), x + sz * 1.6
        p.text(t, x, y, size=sz, bold=False, color=INK)


def main(src, out):
    T = json.load(open(src, encoding="utf-8"))
    kind = T.get("kind", "libre")
    base = DOCS.get(kind, DOCS["libre"])
    bg = T.get("bg") or base["bg"]
    show_form = T.get("form", True) and base["form"]
    sign = T.get("sign", True) and base["sign"]
    c = canvas.Canvas(out, pagesize=A4)
    c.setTitle(T["title"])
    c.setAuthor("BauGest")
    pages = T.get("pages") or [{"items": []}]
    for pi, pg in enumerate(pages):
        p = Page(c)
        paper(p, bg)
        header(p, T, pi, len(pages))
        if pi == 0 and show_form:
            form(p, kind, sign)
        for im in pg.get("images", []) + pg.get("signatures", []):
            c.drawImage(ImageReader(im["src"]), p.X(im["x"]), p.Y(im["y"] + im["h"]), im["w"] * K, im["h"] * K, mask="auto")
        items(p, pg.get("items", []), bg, T.get("snap", True))
        c.showPage()
    c.save()
    print("OK", out)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
