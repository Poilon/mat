# Miette — Bien manger, à deux.

Application en français consacrée à l’alimentation pendant la grossesse. **HTML, CSS et JavaScript natifs, sans backend, sans clé API et sans compilation.**

Application : **https://poilon.com/mat/** · Dépôt : **https://github.com/Poilon/mat**

## Publication GitHub Pages

Chaque push sur `main` lance `.github/workflows/pages.yml` : vérification des règles puis publication des seuls fichiers du site statique. `node_modules`, les tests et les fichiers de développement ne sont pas envoyés dans l’artefact du site.

Le dépôt utilise GitHub Actions comme source Pages. Il hérite du domaine `poilon.com` du site de compte `Poilon/poilon.github.io`, d’où l’adresse `/mat/`. Aucun fichier `CNAME` ne doit être ajouté à ce dépôt pour ce sous-chemin. Les ressources, les liens internes, le manifeste et le service worker utilisent des chemins relatifs.

## Ouvrir l’application

Ouvrir `index.html` pour une consultation locale. Pour bénéficier de la mise en cache hors connexion et de la caméra lorsque le navigateur la prend en charge, servir les fichiers statiques :

```sh
python3 -m http.server 4173
```

Puis ouvrir **http://localhost:4173**. `npm start` exécute le même serveur de fichiers, si Node.js est disponible. Il ne s’agit pas d’un backend applicatif.

Le site peut aussi être déposé sur tout hébergement statique HTTPS, y compris dans un sous-dossier. Copier `index.html`, `styles.css`, `manifest.webmanifest`, `sw.js`, les dossiers `js/` et `assets/`. Aucune installation npm n’est nécessaire pour utiliser ou publier l’app.

## Fonctionnalités

- Accueil, interface responsive et navigation au clavier.
- **70 aliments ou familles alimentaires**, recherche locale instantanée, filtres par catégorie et précaution.
- Recherche mondiale **Open Food Facts**, par nom, marque ou code-barres, avec pagination.
- Lecture caméra native si `BarcodeDetector` et `getUserMedia` sont disponibles. Saisie manuelle toujours accessible, avec validation de la clé GTIN/EAN/UPC.
- Fiches avec conditions de préparation, ingrédients disponibles, allergènes déclarés, valeurs nutritionnelles et liens vers les sources.
- **100 recettes originales**, réparties dans 9 collections : brunch, bowls, Italie, cuisine d’ailleurs, bistro, four, soupes, douceurs et apéritif.
- Recherche instantanée par plat ou ingrédient, filtres combinables par collection, repas, durée et végétarien ; tri par inspiration, temps ou nom.
- Portions de 1 à 8 personnes avec quantités recalculées, favoris, menus et liste de courses pour toutes les recettes. Recherche intégrée au choix des menus.
- Catalogue et photos accessibles hors connexion après la première visite et la mise en cache.
- Favoris alimentaires et recettes, menus hebdomadaires, liste de courses avec cumul des quantités et cases à cocher.
- Export texte de la liste et export JSON du carnet ; effacement des données depuis l’interface.
- Prénom facultatif et préférence végétarienne, enregistrés uniquement dans ce navigateur.
- Service worker et manifeste pour installation et consultation hors connexion après une première ouverture réussie sur HTTPS ou localhost.
- Images, illustrations et polices du guide incluses dans les fichiers.

## Sources et portée des conseils

Les fiches éditoriales s’appuient sur les recommandations publiques françaises de l’Assurance Maladie, de Santé publique France / Manger Bouger, des ministères de la Santé et de l’Agriculture, ainsi que sur les repères EFSA concernant la caféine. Liens et date de consultation dans chaque fiche et dans **Sources & méthode**. Références consultées le **9 septembre 2026**.

Le contenu est un guide général, **sans validation clinique indépendante**. Il ne remplace pas un médecin ou une sage-femme. Allergies, diabète gestationnel, traitements et situations individuelles ne sont pas pris en charge. « Compatible » concerne un aliment du guide dans les conditions écrites de préparation et de conservation ; ce n’est pas une garantie d’absence de risque.

### Analyse Open Food Facts

Open Food Facts est une base collaborative de produits, **pas une base de décisions médicales**. L’app ne charge pas toute la base : elle l’interroge à la demande. Les règles locales cherchent des signaux dans les noms, catégories et ingrédients en français et en anglais. Elles conservent tous les signaux repérés, peuvent produire des faux positifs et ne couvrent pas tous les ingrédients, langues ou traitements.

**Aucun produit Open Food Facts n’est automatiquement déclaré « Compatible ».** Une fiche sans signal reste « À vérifier », y compris avec un Nutri-Score A. La pasteurisation, la cuisson réelle, la chaîne du froid et les rappels de lots ne peuvent pas être confirmés par cette app. Les règles ne suppriment pas les précautions en fonction du trimestre ou de l’immunité à la toxoplasmose.

Pour maintenir le guide, modifier `js/data.js` (guide) ou `js/recipes.js` (nouvelles recettes), vérifier les recommandations auprès des sources primaires puis actualiser la date. `js/rules.js` contient séparément les règles partielles de repérage des produits.

## Accès API et réseau

- Produit : `https://world.openfoodfacts.org/api/v3/product/{code}.json`.
- Texte libre : `https://world.openfoodfacts.org/cgi/search.pl`, endpoint de recherche historique, l’API v2 ne proposant pas de vraie recherche en texte libre.
- Requêtes GET publiques directement depuis le navigateur, sans cookies ni authentification. L’identification de l’app utilise `app_name` et `app_version` ; un navigateur ne permet pas de personnaliser fiablement `User-Agent`.
- Recherche distante uniquement à la validation, jamais à chaque frappe. Limitation locale : 8 recherches/minute avec 7 secondes entre requêtes et 12 lectures/minute avec 4,5 secondes entre requêtes. Les limites par IP du service restent prioritaires ; plusieurs personnes derrière une IP peuvent les partager.
- Cache local : 12 résultats de recherche maximum, pendant 24 h. Les favoris restent conservés jusqu’à leur suppression. Les recherches ont un délai maximal de 18 secondes et les anciennes requêtes sont annulées.
- Le site gère les erreurs réseau, les produits absents, les données manquantes et les limitations de débit. Les nouvelles recherches nécessitent une connexion et la disponibilité du service OFF/CORS.
- Open Food Facts reçoit les recherches, les codes-barres et les informations usuelles de connexion. Le carnet, le prénom et les images de caméra ne lui sont pas envoyés. Les images produits sont chargées depuis son domaine ; elles ne sont pas promises hors connexion.
- Pour une diffusion à grande échelle, suivre la [documentation et les conditions Open Food Facts](https://openfoodfacts.github.io/openfoodfacts-server/api/), déclarer l’usage auprès du service et revoir les besoins de trafic. Aucun secret d’authentification ne doit être ajouté au site.

## Organisation

```text
index.html              Point d’entrée
styles.css              Interface, responsive, accessibilité, impression
js/data.js              Guide éditorial, recettes initiales, sources
js/recipes.js           90 recettes originales et 9 collections
js/rules.js             Repérage des précautions + validation des codes
js/api.js               Client OFF, normalisation, cache, limites, annulation
js/icons.js             Icônes et illustrations SVG natives
js/app.js               Navigation, fiches, caméra et carnet local
assets/                 Photos, polices et icônes incluses
sw.js                   Cache de l’app statique
manifest.webmanifest    Installation sur les appareils compatibles
tests/                  Tests du moteur et des parcours navigateur
```

Au déploiement d’une nouvelle version, changer le nom `CACHE` dans `sw.js` pour renouveler les fichiers précachés. Le service worker ne met pas en cache les requêtes externes. Aucun script publicitaire ni outil de suivi n’est inclus.

## Vérifications

Tests du guide et des règles, sans dépendance externe :

```sh
npm test
```

Tests de parcours Chromium, réponses OFF simulées, accessibilité avec axe, et rechargement hors connexion :

```sh
npm install
npx playwright install chromium
npm run test:browser
```

Ces dépendances servent uniquement aux tests. Les parcours simulés couvrent notamment la recherche, la pagination, le cache, l’annulation, les données manquantes, les erreurs, l’échappement HTML, les favoris, les portions, les menus, les courses et le mobile. Les tests logiciels ne constituent pas une validation médicale. Le fonctionnement réel de la caméra dépend de l’appareil, de ses autorisations et du navigateur ; la saisie manuelle est le repli prévu.

## Crédits

Les données OFF sont sous [Open Database License](https://opendatacommons.org/licenses/odbl/1-0/), les contenus individuels sous Database Contents License et les images produits sous CC BY-SA. Chaque fiche produit renvoie à sa source. Cette base est distincte du guide éditorial Miette.

Photos d’inspiration : Unsplash, voir `assets/CREDITS.md`. Les images ne remplacent pas les ingrédients écrits des recettes. Illustrations SVG créées pour Miette. DM Sans et Lora sont distribuées sous SIL Open Font License ; les licences sont incluses dans `assets/fonts/`.
