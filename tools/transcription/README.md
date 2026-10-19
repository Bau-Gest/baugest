# Transcription des documents manuscrits BauGest

Utilisé par la tâche planifiée Claude « Transcription BauGest ».

1. `prepare.py document.json reglages.json dossier` : rend les pages et découpe l'écriture en segments (positions en unités BauGest).
2. Claude lit chaque segment et écrit le texte tapé, **un item par paragraphe** : les segments d'un même paragraphe (n° `para` proposé par prepare.py, à corriger d'après la page) sont réunis en un seul texte.
   Exception : le contenu des cases de signature (rapport journalier, bon de régie, constat) n'est jamais transcrit ; il est recopié tel quel (écriture d'origine) dans le PDF.
3. `make_pdf.py transcription.json sortie.pdf` : PDF avec la mise en page BauGest (en-tête, logo, formulaire, lignes), texte tapé à l'emplacement de l'écriture.
   Mise en page validée par Joel le 17.10.2026 :
   - le texte suit la largeur de la page (retour à la ligne automatique, marge droite 940 ou `x2`) ; on ne change de ligne qu'à un nouveau paragraphe ;
   - aucune ligne vide : dans les zones de texte libre, chaque paragraphe suit directement le précédent ;
   - le premier texte de chaque ligne est aligné sur la marge gauche ; la suite d'un paragraphe s'aligne sur le texte (après la case ou la flèche) ; un texte écrit à droite d'un autre sur la même ligne reste sur cette ligne ;
   - une page manuscrite suivante continue sur les lignes libres de la page en cours (nouvelle page seulement si elle est pleine ; sauf page avec photo ou signature).

Le PDF est déposé dans le Drive à côté du document, avec le même nom (`.pdf` au lieu de `.json`).
BauGest l'affiche en priorité (pastille « Texte », bascule Manuscrit / Texte tapé).

## Tâches « À faire » (depuis le 19.10.2026)

Les tâches écrites au stylo dans BauGest sont dans `<Chantier>/À faire (ne pas supprimer).json` (appProperties `kind='todo'`).

1. `todo.py render afaire.json dossier` : une image PNG par tâche à transcrire + `todo.json` (liste vide = rien à faire).
2. Claude lit chaque image et écrit le texte tapé dans `textes.json` = `{"<id>": "texte"}` (une tâche = une ligne courte, sans retour à la ligne).
3. **Retélécharger** le fichier juste avant d'écrire (la tablette a pu ajouter des tâches entre-temps), puis
   `todo.py apply afaire.json textes.json sortie.json` et remplacer le contenu du fichier Drive par `sortie.json` (même ID de fichier, garder les appProperties).
   Le champ `m` des tâches n'est pas modifié : BauGest garde la transcription seulement si l'écriture n'a pas changé (`tx.v == iv`).
