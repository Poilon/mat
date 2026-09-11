# SEO de Poum

Version 3.6.0, 11 septembre 2026. Domaine canonique : https://poum.app/.

## Ce qui est publié

Le build génère 394 URL HTML publiques à partir des données existantes du guide : accueil, 360 fiches alimentaires, 7 familles, annuaire des aliments, guide général, listes « à éviter » et « à limiter », 20 recettes gratuites, annuaire des recettes et méthode éditoriale. L’accueil contient du vrai HTML avant le démarrage de l’application. Les autres pages se lisent intégralement sans JavaScript.

Exemples :

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

## Search Console : étape dépendant du compte Google du propriétaire

Aucun accès Search Console n’est disponible dans la session. Une demande de la balise publique de vérification a été adressée au propriétaire ; aucune soumission n’est déclarée effectuée sans accès.

1. Ajouter la propriété **Préfixe de l’URL** `https://poum.app/` dans https://search.google.com/search-console.
2. Choisir **Balise HTML** et ajouter la balise `google-site-verification` fournie dans le `<head>` de `index.html`, puis redéployer et valider la propriété. Ne jamais communiquer de mot de passe ni de jeton OAuth.
3. Dans **Sitemaps**, soumettre `https://poum.app/sitemap.xml`.
4. Inspecter l’accueil et quelques fiches principales ; demander leur indexation, puis suivre les pages indexées, les impressions, les requêtes et les clics.
5. Comparer les recherches par aliment et les recherches générales après accumulation de données. Affiner les titres et les fiches à partir des requêtes réelles. Une relecture médicale identifiable et des liens éditoriaux pertinents sont des travaux de fond, pas des signaux à inventer.

Ne pas utiliser l’Indexing API réservée aux catégories éligibles pour ces fiches, ni les anciens points d’entrée de ping des sitemaps. Publier un sitemap ne garantit ni l’indexation ni une première position.

## Références de mise en œuvre

- https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics
- https://developers.google.com/search/docs/crawling-indexing/links-crawlable
- https://developers.google.com/search/docs/appearance/structured-data/recipe
- https://developers.google.com/search/docs/appearance/site-names
- https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- https://developers.google.com/search/docs/fundamentals/creating-helpful-content
