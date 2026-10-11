# Récap PV DT avant séance

Utilisé par la tâche planifiée « Récap PV BauGest » (lu–ve 17:35, Europe/Zurich). Rappel le matin de la séance : tâche « Rappel séance BauGest » (06:52).

1. La tâche lit `Réglages PhotoChantier (ne pas supprimer).json` : chantiers `sites[]`
   - `meet` : `{from:'AAAA-MM-JJ' (1re séance, donne le jour de la semaine), time:'HH:MM', every:1–4 (semaines), dur:min, place?}`
   - `comp` : id dans `fields.companies` (notre entreprise), `abbr` : abréviations utilisées par la DT (séparées par des virgules).
2. Séances = `from + k × 7 × every` jours. Récap si une séance tombe entre demain et le prochain jour ouvrable (vendredi → samedi, dimanche, lundi).
3. Compare les deux PV les plus récents de `<Chantier>/PV de chantier/` (PDF directement dans ce dossier sauf les « … – récap….pdf », jamais `PV annulés/` ni `Annotations/`). Points cochés « fait » dans BauGest : `PV de chantier/Annotations/<nom du PV> - annotations BauGest.json`, champ `done` (valeurs texte = point réglé par nous) → statut `regle`.
4. Rédige `recap.json` (format en tête de `make_recap.py`), puis :

```
python3 make_recap.py recap.json "PV 12 – récap.pdf"
```

5. Dépose le PDF à côté du dernier PV : `<Chantier>/PV de chantier/<nom du PV> – récap.pdf` (si ce nom existe déjà, PV manquant : `<nom du PV> – récap <AAAA-MM-JJ de la séance>.pdf`). BauGest ne le liste pas comme un PV : bouton « Récap séance » sur la ligne du PV (tablette et PC).

Dépendance : `pip install reportlab`.
