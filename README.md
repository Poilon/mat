# Nidelle — Votre assiette & votre grossesse

Application en français sur l’alimentation pendant la grossesse : **360 fiches alimentaires, dont 105 fruits, légumes et herbes, 100 recettes, recherche Open Food Facts, scanner et carnet synchronisé**.

**Application : https://mat-sandy-six.vercel.app/** · [Code source](https://github.com/Poilon/mat)

L’interface reste en HTML, CSS et JavaScript natifs. Vercel héberge les fichiers statiques et les fonctions serveur ; Neon PostgreSQL et Neon Auth assurent la sauvegarde et la connexion par e-mail et mot de passe. Les recettes et le carnet local restent utilisables sans compte.

## Fonctionnalités

- Identité centrée sur la grossesse : symbole de maternité, palette sauge/crème/terre cuite, trois illustrations originales et icônes alimentaires. [Charte de marque et fichiers](assets/brand/BRAND.md), [prompts des illustrations](assets/brand/PROMPTS.md).
- 60 nouvelles fiches d’épices, mélanges, aromates et condiments, avec une rubrique dédiée et des distinctions entre usage culinaire, infusions et extraits.
- 360 fiches avec explication propre à chaque aliment, mécanisme du risque, conditions de consommation, préparation et liens vers les sources. Filtres fruits/légumes/herbes, recherche tolérante aux accents et navigation par lots de 48.

- Recherche par aliment, nom de produit, marque ou code-barres. L’accueil passe automatiquement à Open Food Facts pour une recherche sans correspondance dans le guide.
- Codes EAN/UPC vérifiés avant recherche ; caméra native ou lecteur ZXing pour les navigateurs sans `BarcodeDetector` ; lecture d’une photo de code-barres entièrement sur l’appareil.
- 100 recettes originales et 9 collections, recherche par ingrédients, filtres, portions, favoris, menus de la semaine et courses calculées à partir des recettes.
- **Nidelle Plus en pré-lancement** : page `#plus`, offre à 4,90 €/mois ou pass 9 mois à 29,90 €, paywall dans les menus et aperçu gratuit de deux jours avec préférences. Les quatre repas peuvent être consultés puis ajoutés aux créneaux libres du carnet. Aucun paiement ni abonnement n’est actif ; toutes les fonctionnalités existantes restent gratuites. [Modèle économique, hypothèses et lancement](BUSINESS_MODEL.md).
- Compte facultatif, connexion, récupération du mot de passe, déconnexion et suppression du compte avec confirmation du mot de passe.
- Carnet sauvegardé automatiquement, copie locale hors connexion, synchronisation au retour du réseau. Les modifications indépendantes sont fusionnées ; un conflit sur le même élément demande un choix explicite.
- Carnets séparés par compte et carnet invité distinct. L’ajout du carnet invité lors de la connexion est facultatif.
- Export/import JSON avec confirmation, export texte des courses, effacement du carnet.
- Application web installable depuis les navigateurs compatibles et instructions iPhone/Android/ordinateur. Les recettes, leurs photos et le guide sont mis en cache après la première visite.

## Ancienne adresse et transfert

**https://poilon.com/mat/** conserve une version statique avec un accès visible à la version connectée. « Transférer mon carnet » ouvre la nouvelle application et propose l’importation, sans supprimer la copie existante. Le transfert se fait entre les deux onglets par `postMessage`, avec vérification de l’origine, de la fenêtre source et d’un identifiant aléatoire ; le carnet n’est placé ni dans l’URL ni dans les journaux serveur. L’export/import JSON est également disponible si le navigateur bloque le nouvel onglet.

Le workflow GitHub Pages compile le lecteur de codes-barres et configure ce miroir avec `STATIC_MIRROR=1`. Les fonctions de compte utilisent l’adresse Vercel. Aucun `CNAME` ne doit être ajouté pour le sous-chemin `/mat/`.

## Développement

Node.js 24 et npm :

```sh
npm ci
# Récupérer les variables du projet Vercel auquel ce dépôt est lié :
vercel env pull .env.development.local --environment development --scope poilons-projects
npm run db:migrate
npm run dev
```

Ouvrir **http://localhost:4175**. Le serveur local fournit les mêmes routes que Vercel. Sans variables Neon, le guide, les recettes et le carnet invité fonctionnent ; les comptes et le relais de recherche nécessitent leur configuration. Les variables `.env*` sont ignorées par Git, sauf le modèle `.env.example` qui ne contient aucun secret.

```sh
npm run build          # Interface et scanner dans dist/
npm test               # Règles, catalogue, fusion du carnet et contrôles serveur
npm run test:browser   # Parcours, comptes simulés, deux appareils, hors connexion, photo et accessibilité
```

Installer Chromium une fois avec `npx playwright install chromium`. Les tests navigateur démarrent un serveur isolé sur le port 4176 sans accès à la base de production. Les vérifications réelles du serveur sont effectuées séparément avec des comptes temporaires.

## Publication et configuration

Le dépôt GitHub est relié au projet Vercel **mat** dans **poilons-projects**. Un push sur `main` déclenche le déploiement Vercel et le miroir GitHub Pages. Une publication manuelle est également possible :

```sh
vercel deploy --prod --yes --scope poilons-projects
```

La base dédiée **miette-db**, créée sur l’offre gratuite, est en région Francfort. L’intégration injecte `DATABASE_URL` et `NEON_AUTH_BASE_URL` dans les environnements Vercel. Les secrets sont uniquement lus par `api/` et `server/` ; `dist/js/runtime.js` ne contient que des adresses publiques.

Avant de changer le domaine de production, l’ajouter aux domaines autorisés de Neon Auth. Le domaine actuellement autorisé est `https://mat-sandy-six.vercel.app`, avec le nom d’application « Nidelle ». La configuration actuelle se trouve dans `neon_auth.project_config` ; le domaine a été ajouté explicitement à `trusted_origins`. Le développement local reste autorisé. Ne pas autoriser tous les domaines ni modifier le DNS racine de `poilon.com` pour cette application.

`npm run db:migrate` initialise uniquement les tables applicatives. Neon crée et gère son schéma d’authentification. Le retrait d’un compte passe par une réauthentification auprès de Neon Auth, puis une transaction qui supprime son carnet, les vérifications associées et son utilisateur ; les clés étrangères Neon suppriment ses sessions et identifiants de connexion. Ce chemin dépend du schéma Better Auth et doit être revérifié après une évolution du service.

## Données et réseau

La marque est devenue **Nidelle**. Les anciens identifiants internes `Miette*`, les clés locales `miette-*`, le protocole de transfert et les tables existantes sont conservés pour retrouver les carnets sans migration. Les exports portent désormais le nom Nidelle ; l’import accepte aussi les anciens fichiers Miette. Le dépôt et les adresses de déploiement restent ceux du projet `mat`.

- Les routes privées vérifient la session auprès de Neon Auth et déterminent l’utilisateur à partir de celle-ci. Aucun identifiant fourni par le client ne choisit le propriétaire du carnet.
- Cookies de session `HttpOnly` et `Secure` en production, origine vérifiée sur les mutations, validation JSON et taille limitée, requêtes SQL paramétrées. Les jetons de session ne sont pas renvoyés au JavaScript.
- Les sauvegardes utilisent une révision et une mise à jour conditionnelle pour prévenir les écrasements entre appareils. Les copies locales des comptes restent sur leurs appareils pour le mode hors connexion ; les déconnecter ne les fusionne pas avec le carnet invité.
- Le relais Open Food Facts autorise seulement la recherche et la lecture de produits. Cache serveur et CDN, délais maximaux, quotas partagés en base et identification `User-Agent` de Nidelle. Recherche uniquement à la validation, jamais à chaque frappe.
- L’application ne télécharge pas toute la base OFF. Les limites partagées sont de 8 recherches textuelles et 75 lectures de codes par minute avant cache ; une réponse limitée demande de réessayer. Cache navigateur de 24 h pour les recherches récentes.
- En cas de panne ou de délai dépassé, le relais essaie un second point d’accès officiel (`fr.openfoodfacts.org`) avec `cc=world` pour conserver la recherche internationale. Chaque tentative consomme le quota partagé ; les réponses 429 ne déclenchent pas de contournement.
- La recherche nécessite internet et la disponibilité d’Open Food Facts. Le guide et les recettes sont disponibles hors connexion une fois leur cache installé. Les images de produits distants ne sont pas promises hors connexion.
- Les noms recherchés et les codes sont transmis à Vercel puis à OFF. Les images de caméra et les photos choisies restent sur l’appareil. Aucun outil publicitaire ou de mesure d’audience n’est intégré. Les hébergeurs traitent les données techniques nécessaires à leur service.
- La limitation des appels utilise une empreinte de l’adresse IP renouvelée quotidiennement, sans enregistrer l’IP en clair dans les tables applicatives. Les anciens compteurs sont retirés lors des migrations.

## Sources et portée des conseils

Les fiches éditoriales s’appuient sur les recommandations publiques françaises de l’Assurance Maladie, de Santé publique France / Manger Bouger, des ministères de la Santé et de l’Agriculture, ainsi que sur les repères EFSA concernant la caféine. Des références complémentaires identifiées (FDA, CDC, FoodSafety.gov, NHS, Food Standards Agency National Kidney Foundation, NIH/NCCIH et MotherToBaby/OTIS) précisent certains cas : lavage, conserves, cuisson, riz, farine, rétinol et carambole. Les recommandations françaises restent la base ; les différences de périmètre sont expliquées. Liens et date de consultation dans chaque fiche et dans **Sources & méthode**. Références consultées le **9 septembre 2026**.

Chaque fiche distingue une recommandation citant l’aliment ou sa préparation d’une application par Nidelle des conseils généraux à sa famille. Les sources ne sont pas présentées comme une validation individuelle de chacun des 360 aliments.

Le contenu est un guide général, **sans validation clinique indépendante**. Il ne remplace pas un médecin ou une sage-femme. Allergies, diabète gestationnel, traitements et situations individuelles ne sont pas pris en charge. « Compatible » concerne un aliment du guide dans les conditions écrites de préparation et de conservation ; ce n’est pas une garantie d’absence de risque.

### Analyse Open Food Facts

Open Food Facts est une base collaborative de produits, **pas une base de décisions médicales**. L’app ne charge pas toute la base : elle l’interroge à la demande. Les règles locales cherchent des signaux dans les noms, catégories et ingrédients en français et en anglais. Chaque signal affiche le champ et le terme normalisé qui l’ont déclenché, une explication et les références correspondantes. Les points impossibles à confirmer sont affichés séparément. Les règles conservent tous les signaux repérés, peuvent produire des faux positifs et ne couvrent pas tous les ingrédients, langues ou traitements.

**Aucun produit Open Food Facts n’est automatiquement déclaré « Compatible ».** Une fiche sans signal reste « À vérifier », y compris avec un Nutri-Score A. La pasteurisation, la cuisson réelle, la chaîne du froid et les rappels de lots ne peuvent pas être confirmés par cette app. Les règles ne suppriment pas les précautions en fonction du trimestre ou de l’immunité à la toxoplasmose.

Pour maintenir le guide, modifier `js/catalogue.js` (explications individuelles et 230 ajouts) et `js/evidence.js` (sources, mécanismes, conditions et date), en conservant les identifiants des 70 fiches initiales dans `js/data.js`. Les 60 fiches supplémentaires d’épices et condiments sont dans `js/seasonings.js`, et les recettes supplémentaires dans `js/recipes.js`. Vérifier chaque modification médicale auprès des sources primaires, indiquer si le conseil porte sur une famille ou un aliment cité, puis actualiser la date. `js/rules.js` contient séparément les règles partielles de repérage des produits ; elles réutilisent les explications documentées.

## Organisation

```text
index.html, styles.css  Interface native
js/data.js             Assemblage du guide, identifiants et recettes initiales
js/catalogue.js        300 explications individuelles et 230 aliments ajoutés
js/evidence.js         Sources, mécanismes, conditions et date de consultation
js/seasonings.js       60 épices, aromates, mélanges et condiments
js/recipes.js          90 recettes supplémentaires et collections
js/rules.js            Repérage partiel des précautions et contrôle EAN/UPC
js/api.js              Normalisation et cache de la recherche
js/app.js              Pages, fiches, compte, menus, courses, transfert et installation
js/plus.js             Offre de pré-lancement et aperçu gratuit de quatre repas
js/cloud.js            Session, sauvegarde et synchronisation
js/notebook.js         Fusion des modifications entre appareils
src/scanner.js         Lecteur ZXing compilé en dist/js/scanner.js
api/                   Fonctions Vercel : auth, compte, carnet, produits, configuration
server/                Validation, connexion PostgreSQL, sessions et quotas
scripts/               Compilation, développement et migration applicative
assets/brand/          Logo, illustrations de grossesse et charte de marque
assets/                Photos, polices, icônes et licences
sw.js                  Cache du guide, des recettes et de l’interface ; aucune API privée
```

Changer le nom du cache dans `sw.js` lorsque les fichiers précachés évoluent. Les tests logiciels ne constituent pas une validation médicale. La caméra physique dépend du téléphone, du navigateur et des autorisations ; la photo et la saisie du code restent disponibles.

## Crédits

Les données OFF sont sous [Open Database License](https://opendatacommons.org/licenses/odbl/1-0/), les contenus individuels sous Database Contents License et les images produits sous CC BY-SA. Chaque fiche produit renvoie à sa source. Cette base est distincte du guide éditorial Nidelle.

Photos d’inspiration : Unsplash, voir `assets/CREDITS.md`. Les images ne remplacent pas les ingrédients écrits des recettes. Illustrations SVG créées pour Nidelle. Les trois scènes de grossesse ont été générées avec l’outil intégré imagegen ; leurs prompts et usages sont documentés dans `assets/brand/`. DM Sans et Lora sont distribuées sous SIL Open Font License ; les licences sont incluses dans `assets/fonts/`.

Lecture des codes-barres : [ZXing Browser](https://github.com/zxing-js/browser), licence MIT, et ZXing Library, licence Apache-2.0. Les licences des bibliothèques sont incluses dans `assets/licenses/` et les mentions présentes dans les sources sont conservées par la compilation.
