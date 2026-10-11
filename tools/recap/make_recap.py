"""PDF « Récap PV DT » avant une séance de chantier, avec les couleurs BauGest.

Usage : python3 make_recap.py recap.json sortie.pdf

recap.json :
{
  "chantier": "102602 GACO",
  "entreprise": "Dupont SA",                      ("" si aucune)
  "seance": "2026-10-13 09:00",                   (AAAA-MM-JJ HH:MM)
  "lieu": "Baraque de chantier",                  (facultatif)
  "pv_precedent": {"nom": "PV 11.pdf", "numero": "11", "date": "2026-09-29"},   (null si aucun)
  "pv_dernier":   {"nom": "PV 12.pdf", "numero": "12", "date": "2026-10-06"},
  "pv_manquant": false,                           (true : aucun nouveau PV depuis la dernière séance)
  "resume": "Texte court (3 à 6 phrases) : l'essentiel pour l'entreprise.",
  "sections": [
    {"titre": "À notre charge", "points": [
      {"texte": "Fournir les plans d'armature du mur M3", "ref": "12.4", "delai": "2026-10-10",
       "statut": "nouveau" | "modifie" | "ouvert" | "clos" | "retard" | "info", "avant": "texte du PV précédent (facultatif)"}
    ]}
  ]
}
Les dates AAAA-MM-JJ sont affichées au format suisse (JJ.MM.AAAA).
Sections vides : ignorées. Aucune donnée n'est inventée par ce script : il ne fait que la mise en page.
"""
import json
import sys
from datetime import datetime
from xml.sax.saxutils import escape

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle, KeepTogether

HEAD, LAB, LN, FILL, SIGNAL = "#1d2733", "#5f6f84", "#b9c5d3", "#eef2f6", "#f2c230"
STAT = {
    "nouveau": ("NOUVEAU", "#1f7a3a"), "modifie": ("MODIFIÉ", "#b26a00"), "ouvert": ("OUVERT", "#1f3a8a"),
    "clos": ("CLOS", "#6b7280"), "retard": ("EN RETARD", "#b42318"), "info": ("INFO", "#5f6f84"),
}
JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"]


def ch(d):
    """AAAA-MM-JJ[ HH:MM] -> JJ.MM.AAAA[ à HHhMM] ; autre texte inchangé."""
    if not d:
        return ""
    d = str(d).strip()
    for fmt, out in (("%Y-%m-%d %H:%M", "%d.%m.%Y à %Hh%M"), ("%Y-%m-%d", "%d.%m.%Y")):
        try:
            return datetime.strptime(d, fmt).strftime(out)
        except ValueError:
            pass
    return d


def jour(d):
    try:
        return JOURS[datetime.strptime(str(d)[:10], "%Y-%m-%d").weekday()] + " "
    except ValueError:
        return ""


def P(t, st):
    return Paragraph(escape(str(t or "")).replace("\n", "<br/>"), st)


def pv_txt(pv):
    if not pv:
        return "—"
    bits = [("PV n° " + str(pv["numero"])) if pv.get("numero") else "", ch(pv.get("date")), pv.get("nom") or ""]
    return " · ".join(b for b in bits if b)


def build(data, out):
    s_title = ParagraphStyle("t", fontName="Helvetica-Bold", fontSize=17, leading=21, textColor=HexColor(HEAD))
    s_sub = ParagraphStyle("s", fontName="Helvetica", fontSize=10.5, leading=14, textColor=HexColor(LAB))
    s_h = ParagraphStyle("h", fontName="Helvetica-Bold", fontSize=12.5, leading=16, textColor=HexColor(HEAD), spaceBefore=10, spaceAfter=4)
    s_b = ParagraphStyle("b", fontName="Helvetica", fontSize=10, leading=13.5, textColor=HexColor(HEAD))
    s_m = ParagraphStyle("m", fontName="Helvetica", fontSize=8.5, leading=11, textColor=HexColor(LAB))
    s_tag = ParagraphStyle("g", fontName="Helvetica-Bold", fontSize=7.5, leading=9, textColor=HexColor("#ffffff"), alignment=1)
    s_warn = ParagraphStyle("w", parent=s_b, textColor=HexColor("#b42318"), fontName="Helvetica-Bold")

    seance = data.get("seance", "")
    story = [
        P("Récap PV DT – séance du " + jour(seance) + ch(seance), s_title),
        Spacer(1, 3),
        P(" · ".join(x for x in [data.get("chantier"), data.get("entreprise") and "Entreprise : " + data["entreprise"],
                                 data.get("lieu") and "Lieu : " + data["lieu"]] if x), s_sub),
        Spacer(1, 8),
    ]
    info = Table([[P("PV précédent", s_m), P(pv_txt(data.get("pv_precedent")), s_b)],
                  [P("Dernier PV", s_m), P(pv_txt(data.get("pv_dernier")), s_b)]], colWidths=[30 * mm, None])
    info.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), HexColor(FILL)), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                              ("LINEBEFORE", (0, 0), (0, -1), 3, HexColor(SIGNAL)),
                              ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4)]))
    story += [info, Spacer(1, 6)]
    if data.get("pv_manquant"):
        story.append(P("Aucun nouveau PV reçu depuis la dernière séance : rappel des points ouverts du dernier PV.", s_warn))
    if data.get("resume"):
        story += [P("En bref", s_h), P(data["resume"], s_b)]

    for sec in data.get("sections") or []:
        pts = [p for p in sec.get("points") or [] if (p.get("texte") or "").strip()]
        if not pts:
            continue
        rows = []
        for p in pts:
            lab, col = STAT.get(p.get("statut") or "info", STAT["info"])
            tag = Table([[P(lab, s_tag)]], colWidths=[19 * mm])
            tag.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), HexColor(col)), ("TOPPADDING", (0, 0), (-1, -1), 2),
                                     ("BOTTOMPADDING", (0, 0), (-1, -1), 2), ("LEFTPADDING", (0, 0), (-1, -1), 1), ("RIGHTPADDING", (0, 0), (-1, -1), 1)]))
            body = [P(p["texte"], s_b)]
            meta = " · ".join(x for x in [p.get("ref") and "Point " + str(p["ref"]), p.get("delai") and "Délai : " + ch(p["delai"])] if x)
            if meta:
                body.append(P(meta, s_m))
            if p.get("avant"):
                body.append(P("Avant : " + p["avant"], s_m))
            rows.append([tag, body])
        t = Table(rows, colWidths=[21 * mm, None])
        t.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LINEBELOW", (0, 0), (-1, -2), 0.4, HexColor(LN)),
                               ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4), ("LEFTPADDING", (0, 0), (0, -1), 0)]))
        story += [KeepTogether([P(sec.get("titre") or "", s_h), t])]

    def foot(c, doc):
        c.saveState()
        c.setFont("Helvetica", 7.5)
        c.setFillColor(HexColor(LAB))
        c.drawString(18 * mm, 10 * mm, "BauGest · récap généré automatiquement à partir des PV DT – à vérifier avec le PV d'origine")
        c.drawRightString(A4[0] - 18 * mm, 10 * mm, "Page %d" % doc.page)
        c.setFillColor(HexColor(SIGNAL))
        c.rect(0, A4[1] - 4 * mm, A4[0], 4 * mm, stroke=0, fill=1)
        c.restoreState()

    doc = SimpleDocTemplate(out, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=16 * mm, bottomMargin=18 * mm,
                            title="Récap PV DT – " + (data.get("chantier") or ""), author="BauGest")
    doc.build(story, onFirstPage=foot, onLaterPages=foot)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    with open(sys.argv[1], encoding="utf-8") as f:
        build(json.load(f), sys.argv[2])
