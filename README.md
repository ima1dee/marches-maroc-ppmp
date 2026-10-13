# Marchés Maroc — PPMP

Collecte des consultations publiques en cours sur marchespublics.gov.ma, sans compte ni dépôt d’offre. Exécution proposée toutes les six heures. Les horaires GitHub Actions ne sont pas garantis.

`data/catalogue.json` n’est publié qu’après une collecte complète des pages de la liste active. En cas d’échec, le dernier catalogue est conservé et `data/status.json` indique la tentative échouée. L’absence d’une annonce ne prouve pas son annulation.

Le périmètre initial exclut les BDC, archives et résultats. Les enchères et procédures non reconnues sont exclues du catalogue des marchés. Les favoris, notes et candidatures ne sont jamais envoyés dans ce dépôt.

Source : Portail Marocain des Marchés Publics (TGR). Les dates de publication et de collecte accompagnent les données. Projet indépendant, sans affiliation au portail.

Installation : `npm install`, `npx playwright install chromium`, puis `npm run collect`. Aucun secret nécessaire. Le dépôt public permet l’utilisation des runners standard gratuits de GitHub, selon ses conditions en vigueur. Un accès effectif au PPMP depuis GitHub doit être validé par une première exécution.
