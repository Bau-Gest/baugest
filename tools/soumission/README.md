# Soumission BauGest

Rubrique « Soumission » de la tablette : tableau des positions de la soumission rentrée, filtrable par CAN, n° de position et texte.

Drive : `<N° Nom du chantier>/Soumission/` (une seule soumission ; l'ancienne va dans `Soumission/Anciennes versions/`).

- `.crbx` (BauBit, SIA 451) : lu directement par la tablette (`soumParse451` dans `index.html`), tableau immédiat.
- Word / PDF : lus par la tâche planifiée « Soumission BauGest » (vendredi 17:44), qui dépose `<nom sans extension> – positions.json` à côté.
  La tablette préfère ce JSON au `.crbx` (textes complets), sauf si un `.crbx` plus récent a été déposé.

`soumission.py fichier.(crbx|docx) sortie.json` : même lecture que la tablette pour le `.crbx`, et lecture des Word imprimés par BauBit.
Montant d'une position = quantité totale × PU, arrondi à 0.05 CHF (comme BauBit). Le format JSON est décrit en tête du script.
Contrôle : le script affiche la somme des positions par CAN et la compare au « Total CAN » du fichier (⚠ si écart).
