# Ce soir — Poum 3.7.0

Le parcours `/#cesoir` propose jusqu’à trois recettes du catalogue selon les envies, la durée, le nombre de personnes, les ingrédients écartés et ceux du placard. Les durées proposées (30 min, 45 min, sans limite) correspondent au catalogue existant. Une envie influence le classement ; les exclusions et la durée restent des contraintes. Le texte libre cherche les mots indiqués dans les ingrédients : ce n’est pas un moteur de prise en charge des allergies. Aucun contenu culinaire ou médical n’est généré par une IA dans ce parcours.

## Expérience et accès

- Le premier dîner complet est offert sans compte. Les propositions et les précautions sont visibles avant le choix. Les suivants nécessitent un abonnement confirmé côté serveur. L’essai du parcours est distinct de la première semaine offerte de l’atelier.
- Une requête de choix porte un UUID conservé pendant les reprises. Une mise à jour conditionnelle atomique du profil empêche deux requêtes concurrentes de consommer plusieurs dîners gratuits. Effacer les dîners ne réinitialise pas l’essai.
- Sans compte, un cookie fonctionnel aléatoire HttpOnly/SameSite=Lax (Secure en HTTPS) identifie le navigateur pendant un an. Comme tout essai anonyme, la suppression des cookies permet de repartir d’un autre navigateur ; le site n’utilise pas d’empreinte d’appareil. Avec un compte, l’accès Plus est vérifié via la session et le stockage de facturation existants.
- Les dîners sans compte sont transférés uniquement par une action explicite « Le retrouver dans mon compte ». Le carnet général conserve son flux d’import indépendant.
- Le dernier dîner est aussi conservé localement, séparément pour chaque compte. Lecture possible hors connexion ; aucune modification de liste partagée n’est annoncée comme enregistrée sans réponse du serveur.
- Les courses ajoutées au carnet général constituent une copie indépendante. Les ajouts répétés conservent les quantités maximales déjà prévues sans les doubler. Les derniers dîners peuvent être rouverts ; ce parcours ne remplace pas automatiquement un créneau du planning existant.

## Relais

La page `/relais/` reçoit un jeton aléatoire de 256 bits dans le fragment de l’URL. Il ne figure donc pas dans la requête HTTP du document, ni dans son référent. Le lecteur le transmet dans le corps JSON des appels à l’API. Seule son empreinte SHA-256 est stockée en base.

Le lien ouvre un seul dîner et permet de cocher ses ingrédients et ses étapes, ainsi que de changer son état de préparation. Il ne révèle ni propriétaire, ni profil, ni préférences, ni autres repas. Il expire au bout de 30 jours. Le propriétaire peut le désactiver ou le remplacer ; l’autorisation du lien est revérifiée dans chaque UPDATE, y compris si la désactivation arrive pendant une requête. Les champs autorisés sont explicitement validés. Le repas reste accessible à son propriétaire après révocation ou fin de l’abonnement.

Les pages visibles actualisent les données toutes les cinq secondes. Les modifications de deux ingrédients différents se combinent atomiquement ; sur un même ingrédient, la dernière modification enregistrée l’emporte. Les réponses plus anciennes ne remplacent pas une révision plus récente. Le suivi des étapes réutilise ce mécanisme. L’API est limitée en fréquence, ne permet pas les mutations interorigines et ne met aucune réponse en cache. La page de relais est exclue du sitemap, marquée noindex/nofollow, sans référent et sans inscription obligatoire. Elle ne télécharge pas le carnet de l’application.

Le bouton de partage ouvre seulement la feuille de partage du téléphone, après un clic. Rien n’est envoyé automatiquement. Une copie manuelle du lien est disponible en repli. Un lien régénéré désactive le précédent ; ce comportement est annoncé avant l’action.

## Données et exploitation

`server/tonight-schema.cjs` crée `poum_tonight_profiles` et `poum_tonight_meals`. Migration additive intégrée à `scripts/migrate.cjs`, à exécuter avant le déploiement du nouvel endpoint. Les tables ont été créées dans les environnements de développement et production pendant cette livraison.

« Effacer mes dîners » demande confirmation dans le parcours, supprime les repas et les envies et désactive les liens. Seul le fait que l’essai a été consommé reste enregistré. La suppression de compte efface ses dîners dans la même transaction que le carnet et l’identité. L’export historique du carnet n’inclut pas cet espace séparé : cette limite est indiquée dans Vos données.

Le miroir GitHub Pages dirige Ce soir vers Poum. Il ne publie aucune page de relais. Les étapes des 80 recettes premium ne sont toujours pas présentes dans le catalogue public généré ; l’API du dîner retourne seulement la recette choisie et autorisée.

## Validation

Tests de filtres, quantités, premier dîner, idempotence, accès payant, ownership, portée des liens, expiration, rotation, suppression et révocation. Tests navigateur entre deux contextes pour les courses, les étapes, l’état du dîner et la révocation ; mobile 320/390 px, bureau, accessibilité, paywall et maintien de l’accès au dîner offert. Vérification sur PostgreSQL réel de deux choix gratuits concurrents et de deux mises à jour simultanées de courses, puis suppression des données de test.

Les textes des 100 recettes n’ont pas été réécrits. Cette livraison apporte leur lecture avec suivi des étapes ; l’enrichissement éditorial détaillé reste un chantier distinct.
