# Transcription des documents manuscrits BauGest

Utilisé par la tâche planifiée Claude « Transcription BauGest ».

1. `prepare.py document.json reglages.json dossier` : rend les pages et découpe l'écriture en segments (positions en unités BauGest).
2. Claude lit chaque segment et écrit le texte tapé, **un item par paragraphe** : les segments d'un même paragraphe (n° `para` proposé par prepare.py, à corriger d'après la page) sont réunis en un seul texte.
   Exception : le contenu des cases de signature (rapport journalier, bon de régie, constat) n'est jamais transcrit ; il est recopié tel quel (écriture d'origine) dans le PDF.
3. `make_pdf.py transcription.json sortie.pdf` : PDF avec la mise en page BauGest (en-tête, logo, formulaire, lignes), texte tapé à l'emplacement de l'écriture.
   Le texte suit la largeur de la page (retour à la ligne automatique, marge droite 940 ou `x2`) ; on ne change de ligne qu'à un nouveau paragraphe. Une ligne qui tomberait sur un texte déjà écrit descend d'une ligne.

Le PDF est déposé dans le Drive à côté du document, avec le même nom (`.pdf` au lieu de `.json`).
BauGest l'affiche en priorité (pastille « Texte », bascule Manuscrit / Texte tapé).
