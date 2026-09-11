# Catalogue et préférences — Poum 3.8

Le catalogue contient **1 000 recettes et déclinaisons** : les 100 identifiants historiques sont conservés ; 900 déclinaisons déterministes sont assemblées à la compilation et sur le serveur. Il ne s’agit pas de 1 000 recettes testées en cuisine. Les photos sont des inspirations, réutilisées par type de plat. Les adaptations internationales sont nommées comme telles, sans revendication d’authenticité.

- 360 déclinaisons de 30 préparations salées, avec 12 associations explicites de légumes et garnitures.
- 360 déclinaisons de 18 préparations internationales, avec 20 associations explicites. Thaïlande, Chine, Japon, Sénégal, Afrique de l’Ouest, Maroc, Antilles, Pérou, Brésil, États-Unis, Canada, Grèce et Espagne.
- 180 déclinaisons de 9 préparations sucrées et 20 duos de fruits.

Les modules éditoriaux sont dans `server/catalogue/`. Chaque préparation définit ses proportions, gestes, ustensiles et repères de cuisson ; les ingrédients définissent leur découpe et leur cuisson. `server/recipe-guide.cjs` ajoute aux 100 recettes historiques des indications techniques sans déplacer leurs étapes : les cases des repas déjà partagés gardent donc leur sens. Les guides se lisent dans les recettes, les dîners partagés, les carnets exportés et les 20 pages de recettes gratuites.

Les consignes grossesse et de conservation citent notamment l’Assurance Maladie et FoodSafety.gov. Ces sources concernent l’hygiène et les précautions, pas la validation culinaire d’une recette. Les nouveaux plats au soja utilisent seulement des sauces, signalées pour une consommation occasionnelle. Aucun menu n’est présenté comme un programme nutritionnel médical ; le moteur ne contrôle pas toutes les fréquences alimentaires hebdomadaires.

## Accès et affichage

20 recettes complètes restent gratuites ; 980 préparations et leurs guides sont accessibles via les droits Plus ou les essais autorisés. Ingrédients, allergènes, précautions, conservation et sources sont publics. Le build retire `steps` et `guide` des recettes payantes. Les générateurs serveur ne sont pas copiés dans le site statique. Le dépôt source reste public : le contrôle d’accès concerne l’application, pas le secret du code publié.

La recherche accepte les ingrédients et les pays. Le filtre « Cuisine du monde » se combine avec collection, durée, végétarien et accès. Le catalogue est affiché par lots de 12 ; seules les 20 recettes gratuites ont une page SEO indexable. Pas de création de 900 pages minces pour les moteurs de recherche.

## Allergies et goûts

Après création du compte, le profil propose les 14 familles d’allergènes, d’autres allergies saisies par nom et les ingrédients peu appréciés. La saisie d’allergies demande un accord explicite et facultatif. Les choix se synchronisent dans le carnet, avec les mêmes règles de conflit, export, retrait et isolation entre comptes.

`js/diet.js` est partagé entre navigateur et serveur. Il examine les ingrédients, dérivés courants, déclarations et possibilités d’allergènes. Une déclaration manquante est exclue lorsqu’une allergie est sélectionnée. Les exclusions libres utilisent un repérage textuel normalisé, pas une ontologie exhaustive des dérivés. Les traces et contaminations croisées des produits réellement achetés ne peuvent pas être certifiées ; l’interface demande de vérifier les étiquettes.

Les contraintes filtrent la recherche, le choix manuel, les menus générés, les remplacements et Ce soir. Un changement de profil invalide un brouillon de menu avant enregistrement ou export. Les anciens menus restent visibles avec une alerte ; les courses ne sont pas générées à partir d’un plat devenu exclu. Le serveur recontrôle les contraintes au choix d’un dîner. En l’absence de recette correspondante, il renvoie une erreur sans assouplir une allergie.

Les API connectées combinent les exclusions reçues avec le profil sauvegardé, afin qu’un onglet ancien ne perde pas une exclusion ajoutée sur un autre appareil. Lors d’un retrait de préférence, attendre la synchronisation du carnet. Ce soir ne duplique pas les allergies dans ses préférences en base ; le profil actuel est relu au besoin. Un lien de relais contient uniquement le repas, jamais le profil ou la liste personnelle d’allergies. Les allergènes propres à la recette y restent visibles.
