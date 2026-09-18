# SEO de Poum

Version 4.0.13, 18 septembre 2026. Domaine canonique : https://poum.app/.

## Ce qui est publié

Le build génère 397 URL HTML publiques : trois présentations du produit (calendrier gratuit, scan et offre Plus), puis les pages du guide : accueil, 360 fiches alimentaires, 7 familles, annuaire des aliments, guide général, listes « à éviter » et « à limiter », 20 recettes gratuites, annuaire des recettes et méthode éditoriale. L’accueil contient du vrai HTML avant le démarrage de l’application. Les autres pages se lisent intégralement sans JavaScript.

Les trois pages produit expliquent des usages différents et reprennent les fonctions réelles. Elles ne reproduisent ni les données personnelles ni les préparations premium. Les prix et le nombre de recettes sont calculés depuis le catalogue et l’offre du projet. Les liens sont présents dans le HTML initial et dans le pied de page après le rendu JavaScript.

Exemples :

- `/calendrier-grossesse/`
- `/scanner-grossesse/`
- `/poum-plus/`

- `/aliments/mozzarella-enceinte/`
- `/aliments/ananas-enceinte/`
- `/aliments/patate-douce-enceinte/`
- `/alimentation-grossesse/fromages-produits-laitiers/`
- `/aliments-a-eviter-enceinte/`
- `/recettes-grossesse/`

Les URL sont construites par `js/seo-routes.js`. Une modification du nom d’un aliment ou d’une recette peut changer son URL : conserver l’ancienne adresse par une redirection explicite avant de renommer. Les variantes de cuisson et les synonymes restent dans les fiches ; ils ne produisent pas des pages artificiellement dupliquées.

Chaque fiche reprend sans modification sa conclusion, sa préparation et les sources du catalogue. Elle conserve la distinction entre une recommandation spécifique et l’application de conseils généraux à une famille. Les pages n’inventent ni auteur médical, ni validation clinique, ni notes de lecteurs. La méthode expose les limites et l’assistance d’outils d’IA. Les dates de consultation des références ne sont pas actualisées à chaque déploiement.

## Indexation et données structurées

- Titres, descriptions, URL canoniques et Open Graph propres à chaque page ; nom du site `Poum` en `WebSite` et éditeur en `Organization`.
- `WebPage` / `CollectionPage` et `BreadcrumbList` pour les fiches et annuaires.
- `Recipe` pour les 20 recettes gratuites : ingrédients, portions, durée totale connue, image et étapes visibles dans le HTML. Pas de notes, valeurs nutritionnelles ou durées détaillées inventées.
- `/sitemap.xml` contient seulement les URL publiques canoniques, sans dates artificielles. `/robots.txt` déclare ce sitemap et écarte l’API et les retours de paiement/récupération.
- Liens HTML entre accueil, guide, familles, aliments, recettes et méthode. L’application lie chaque fiche d’aliment à son URL publique ; le pied de page donne accès au guide.
- GitHub Pages affiche `noindex,follow` et renvoie ses lecteurs vers les fiches sur Poum ; les pages éditoriales ne sont pas dupliquées dans ce miroir. L’ancien domaine Vercel conserve l’accès aux carnets, avec `X-Robots-Tag: noindex, follow`.
- Les API ne sont pas indexables. Une adresse inexistante garde un vrai statut HTTP 404.

Les 980 recettes Plus ne sont pas publiées par le générateur. Le catalogue public existant garde ses ingrédients et précautions ; leurs préparations restent soumises au contrôle serveur.

## Vitesse et accessibilité

Les pages éditoriales utilisent un style critique intégré, des polices WOFF2 locales et presque aucun JavaScript (uniquement la recherche progressive de l’annuaire). Les illustrations de l’application ont des variantes WebP 320/640 pixels ; les originaux sont conservés. La variante adaptée au mobile est préchargée sur l’accueil. Les catalogues déjà inclus dans `data.js` ne sont plus téléchargés une deuxième fois au démarrage. Les images de recettes ont des dimensions déclarées et celles des listes sont chargées à la demande.

Les tests couvrent les 360 réponses et leurs sources, tous les liens internes, le sitemap, l’absence de publications premium, les données structurées, les pages sans JavaScript, le moteur de recherche de l’annuaire, les lecteurs mobiles et l’accessibilité. Les audits Lighthouse sont des mesures de laboratoire, pas une garantie de positionnement ou de performances réelles.

## Search Console : constat du 18 septembre 2026

La propriété Domaine `poum.app` existe et son rapport a été consulté dans la session Chrome du propriétaire. Le rapport global affiche une dernière mise à jour au 14 septembre : 1 page indexée, 386 détectées non explorées, 7 explorées non indexées, 3 avec redirection. Ce constat n’est pas une explication de la décision de Google ni un audit complet de la qualité des contenus.

Les sept exemples explorés sont : compote de fruits, marlin, gnocchis au pesto, épeautre, chèvre à croûte fleurie, gruyère, câpres en bocal. Leurs dates d’exploration affichées vont du 13 au 15 septembre. Le sitemap public répondait HTTP 200 et contenait 394 URL avant cette évolution. L’accueil, l’annuaire des aliments et deux fiches échantillonnées répondaient 200, autorisaient l’indexation et avaient une canonique correspondant à leur URL. Aucun blocage global n’a été identifié dans cet échantillon.

### Travail effectué sur le site

- Ajout de trois pages publiques pour expliquer le suivi de grossesse, le scan et la différence gratuit/Plus ; le sitemap comporte désormais 397 URL.
- Liens directs depuis l’accueil, les pages du guide et le pied de page de l’application, maintenus après l’exécution de JavaScript.
- Titre d’accueil centré sur le suivi et le calendrier gratuit, cohérent avant et après le rendu JavaScript.
- Vérification des liens internes, des pages sans JavaScript, des vues mobiles et de l’accessibilité. Les dates des anciennes références restent inchangées.

### Actions Search Console à effectuer après publication

1. Dans **Sitemaps**, vérifier l’état de `https://poum.app/sitemap.xml`. S’il est déjà traité avec succès, conserver cette même adresse ; une nouvelle URL de sitemap n’est pas nécessaire.
2. Inspecter en priorité `https://poum.app/calendrier-grossesse/`, puis `/scanner-grossesse/` et `/poum-plus/`. Faire le test en direct et demander l’indexation si la page est accessible et indexable. Les quotas éventuels restent ceux de Google.
3. Pour les sept pages déjà explorées, lire le détail de l’inspection (rendu, canonique retenue, éventuels blocages). Ne pas soumettre en boucle des demandes d’exploration : ce statut ne donne pas sa cause exacte.
4. Vérifier les trois redirections : elles sont normales si elles pointent vers la bonne adresse canonique. Leurs destinations exactes restent à contrôler.
5. Relever dans 7 à 14 jours les dates d’exploration, pages indexées, impressions, requêtes et clics. Ce délai sert au suivi, ce n’est pas une promesse d’indexation.

Aucune demande d’indexation ni nouvelle soumission de sitemap n’est déclarée effectuée par cette modification. Le rapport a été lisible pendant le diagnostic ; son onglet n’était plus accessible lors de la préparation des nouvelles pages.

### Travail de fond

Faire relire et enrichir en priorité les fiches utiles aux utilisatrices, en commençant par les pages déjà explorées et les recherches réellement observées. Ajouter des exemples propres au sujet, expliquer les nuances et maintenir les sources précises. Une relecture médicale doit être réelle et consentie avant de mentionner un nom ou une validation.

Chercher des liens éditoriaux pertinents par des démonstrations et retours de partenaires réels. Ne pas acheter de liens artificiels ou fabriquer des avis. Les échanges n’ont pas été envoyés dans cette intervention.

Ne pas utiliser l’Indexing API réservée aux catégories éligibles pour ces fiches, ni les anciens points d’entrée de ping des sitemaps. Publier un sitemap ou demander une exploration ne garantit ni l’indexation ni une première position.

## Références de mise en œuvre

- https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics
- https://developers.google.com/search/docs/crawling-indexing/links-crawlable
- https://developers.google.com/search/docs/appearance/structured-data/recipe
- https://developers.google.com/search/docs/appearance/site-names
- https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- https://developers.google.com/search/docs/fundamentals/creating-helpful-content
