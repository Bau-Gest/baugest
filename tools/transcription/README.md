# Transcription des documents manuscrits BauGest

Utilisé par la tâche planifiée Claude « Transcription BauGest ».

1. `prepare.py document.json reglages.json dossier` : rend les pages et découpe l'écriture en segments (positions en unités BauGest).
2. Claude lit chaque segment et écrit le texte tapé.
3. `make_pdf.py transcription.json sortie.pdf` : PDF avec la mise en page BauGest (en-tête, logo, formulaire, lignes), texte tapé à l'emplacement de l'écriture.

Le PDF est déposé dans le Drive à côté du document, avec le même nom (`.pdf` au lieu de `.json`).
BauGest l'affiche en priorité (pastille « Texte », bascule Manuscrit / Texte tapé).
