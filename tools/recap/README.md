# Récap PV DT avant séance

Utilisé par la tâche planifiée « Récap PV BauGest » (lu–ve 17:35, Europe/Zurich).

1. La tâche lit `Réglages PhotoChantier (ne pas supprimer).json` : chantiers `sites[]`
   - `meet` : `{from:'AAAA-MM-JJ' (1re séance, donne le jour de la semaine), time:'HH:MM', every:1–4 (semaines), dur:min, place?}`
   - `comp` : id dans `fields.companies` (notre entreprise), `abbr` : abréviations utilisées par la DT (séparées par des virgules).
2. Séances = `from + k × 7 × every` jours. Récap si une séance tombe entre demain et le prochain jour ouvrable (vendredi → samedi, dimanche, lundi).
3. Compare les deux PV les plus récents de `<Chantier>/PV de chantier/` (PDF directement dans ce dossier, jamais `PV annulés/`, `Annotations/`, `Récaps séances/`).
4. Rédige `recap.json` (format en tête de `make_recap.py`), puis :

```
python3 make_recap.py recap.json "2026-10-13_Récap PV_102602 GACO.pdf"
```

5. Dépose le PDF dans `<Chantier>/PV de chantier/Récaps séances/` (créé si besoin) et envoie une notification.

Dépendance : `pip install reportlab`.
