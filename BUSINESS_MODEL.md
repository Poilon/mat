# L’atelier Plus — modèle économique proposé

Version du 9 septembre 2026, application 2.3.0. **Pré-lancement : atelier complet offert, aucun paiement ouvert, aucun abonnement actif.** La page `#plus` présente le service ; `#atelier` permet de l’utiliser sans compte ni carte bancaire.

## Ce que l’on vend

**« Le menu est prêt. Vous pouvez souffler. »** L’offre porte sur un résultat utilisable : une semaine de plats choisis, les courses regroupées et un carnet qui permet à une autre personne de prendre le relais en cuisine.

Le parcours part de trois situations concrètes : un aliment ne tente plus, des ingrédients attendent dans le placard, ou la personne qui partage le quotidien peut s’occuper des repas. Les sept jours seuls ne justifient pas le prix : l’intérêt vient de l’ensemble des préférences, des changements simples, de la liste qui se recalcule et du document prêt à emporter.

Les fiches, les explications, les sources et toutes les recettes restent gratuites. Le produit ne vend pas un accès à la sécurité alimentaire, un régime médical, une protection contre les allergies ou un suivi professionnel. Il ne promet pas de montant économisé ni de temps gagné chiffré. Aucun terme de grossesse ou résultat médical n’est demandé.

## Ce qui fonctionne dès maintenant

| Besoin | Fonction livrée |
| --- | --- |
| Préparer la semaine entière | 7 dîners ou 7 déjeuners + 7 dîners, pour deux personnes, sans recette répétée dans la proposition |
| Composer selon ses envies | Quatre ambiances culinaires, 30 ou 45 minutes maximum, option végétarienne |
| Écarter ce qui ne tente pas | Poisson, champignons, œufs, fromage, oignon/échalote, coco : filtres sur les ingrédients écrits, hors allergies et traces |
| Utiliser le placard | Douze ingrédients sélectionnables ; priorité aux recettes qui les utilisent, avec les correspondances affichées |
| Garder la main | Épingler un plat, en remplacer un seul, recomposer le reste en gardant ses épingles |
| Préparer les courses | Quantités cumulées par ingrédient et unité, quatre rayons, mentions de préparation conservées, cases « déjà à la maison » après vérification des quantités |
| Retrouver son organisation | Ajout aux menus et aux courses du carnet existant ; actualisation des seuls repas précédemment ajoutés par cet atelier, si personne ne les a modifiés ailleurs |
| Passer le relais | Document HTML autonome contenant menu, courses, ingrédients, étapes, allergènes et précautions sourcées ; ouverture hors connexion et impression/PDF depuis le navigateur |

Le brouillon et les préférences sont locaux, séparés par compte. Les menus et courses ajoutés au carnet suivent sa synchronisation. Les articles déjà à la maison ne sont retirés qu’après confirmation de la quantité par l’utilisatrice. Compléter la liste applique un besoin minimal et conserve les quantités existantes plus élevées ; cela n’additionne pas plusieurs fois la même semaine. Après un changement de recette, les coches du placard sont réinitialisées pour revérifier les nouveaux besoins.

Les goûts culinaires sont des préférences de sélection, pas un bilan nutritionnel. L’atelier ne commande pas les courses et ne dispose d’aucun prix de panier. Le document à partager est téléchargé : aucun partage avec un tiers n’est automatique.

## Offre et prix proposés

| Accès | Contenu |
| --- | --- |
| Gratuit durable | 360 fiches alimentaires sourcées, recherche/scan Open Food Facts selon disponibilité, 100 recettes, favoris, menus manuels, courses, export et synchronisation |
| Découverte actuelle | Tout l’atelier, renouvelable sans quota, sans compte ni carte bancaire |
| Plus au lancement commercial envisagé | Utilisation répétée de l’atelier complet ; première semaine complète offerte avant le premier achat |

- **Pass 9 mois : 29,90 € en une fois.** Neuf mois d’accès à partir de l’activation, sans renouvellement automatique. Aucun justificatif de grossesse.
- **Mensuel : 4,90 €/mois.** Renouvellement automatique ; résiliation possible pour empêcher la prochaine échéance, accès jusqu’à la fin de la période payée.

Le pass coûte 14,20 € de moins que neuf mensualités. Cette comparaison entre durées d’achat n’est pas une remise sur un ancien prix. Aucun compteur d’urgence, avis fictif, faux nombre de clientes ou achat par simple sélection d’une formule.

Les tarifs sont des hypothèses à tester, pas une preuve de disposition à payer. À expiration, les menus et courses déjà enregistrés restent accessibles, modifiables manuellement et exportables. Le pass couvre une période de vie limitée et évite de dépendre uniquement d’une longue rétention mensuelle.

## Un paywall après la preuve

1. La page `#plus` montre de vraies recettes du catalogue et les trois situations quotidiennes. Les exemples sont explicitement identifiés comme exemples.
2. Le bouton principal ouvre l’atelier complet, également accessible depuis la navigation et **Mes menus**.
3. L’utilisatrice compose, consulte les recettes, ajuste les plats, prépare les courses et peut emporter son carnet.
4. Après le résultat, **Découvrir l’offre Plus** ouvre une présentation avec les nombres réellement obtenus : repas, plats utilisant les ingrédients sélectionnés et articles à prévoir.
5. Le prix et les conditions sont lisibles, la fermeture et la poursuite gratuite restent accessibles. Les sources et précautions ne rencontrent jamais un paywall.

**Dans cette version**, les formules affichent leurs conditions mais n’ouvrent aucun achat. Le bouton ramène à l’atelier offert. Aucune réservation, période d’essai avec facturation ultérieure ou activation d’abonnement n’est simulée. Il n’existe pas de booléen premium faisant autorité dans le navigateur.

**Au lancement envisagé**, le premier carnet complet doit être utilisable gratuitement. Le point de conversion à tester serait la préparation d’une nouvelle semaine après cette première expérience. Remplacer les plats et corriger le premier carnet doivent rester possibles pendant la découverte. Toute future limite devra être expliquée avant le parcours et contrôlée côté serveur, avec accès permanent aux carnets déjà enregistrés.

## Valider la valeur avant d’ouvrir les paiements

Faire essayer l’atelier à des participantes volontaires, puis vérifier des comportements concrets : gardent-elles plusieurs suggestions, utilisent-elles leurs ingrédients, emportent-elles le document, et reviennent-elles préparer la semaine suivante ? Demander ensuite si l’offre résout un problème pour lequel elles paieraient, et laquelle des deux formules elles choisiraient. Les clics sur le prix ne suffisent pas à prouver une demande solvable.

Le pré-lancement n’ajoute ni mesure d’audience ni liste d’attente. Il reste sans publicité et sans vente de données. Une mesure future du parcours devrait se limiter aux événements nécessaires, en excluant les recherches d’aliments, le contenu des carnets et les informations médicales, avec information adaptée.

Le contenu utile peut servir à l’acquisition. Le routage actuel par fragments ne suffit pas pour un catalogue SEO : créer de vraies pages statiques par aliment et recette avant d’investir dans ce canal. Une recommandation commerciale par un professionnel ne constitue pas une validation clinique.

## Scénario de recettes, à titre d’hypothèse

Sur 1 000 utilisatrices actives par mois, en supposant 70 % des nouveaux achats sur le pass et 30 % sur le mensuel :

| Conversion en nouveaux achats | Pass vendus | Nouveaux abonnements | Encaissement initial brut |
| --- | ---: | ---: | ---: |
| 2 % | 14 | 6 | 448 € |
| 3 % | 21 | 9 | 672 € |
| 5 % | 35 | 15 | 1 120 € |

Ces scénarios excluent les renouvellements antérieurs et ne sont ni des prévisions ni un bénéfice. Un pass finance neuf mois de service et ne constitue pas du revenu mensuel récurrent. Au scénario central, les neuf nouveaux abonnements apporteraient 44,10 € de revenu mensuel récurrent initial avant résiliations et déductions.

Le budget doit couvrir hébergement, comptes et base de données, frais du prestataire de paiement, maintenance des sources, relecture clinique indépendante, support, remboursements, taxes et acquisition. Vérifier les [tarifs du prestataire](https://stripe.com/fr/pricing) avant toute décision de marge. Limiter les dépenses d’acquisition jusqu’à disposer de coûts réels par cohorte et d’achats confirmés.

## Passage à de vrais paiements

Le frontal peut rester statique ; un droit payant fiable nécessite une autorité serveur. Vercel et les comptes Neon sont déjà présents. `js/plus.js` fournit la composition et les prix de présentation, jamais une preuve d’achat.

Avant l’ouverture :

1. Valider le service et les prix avec des utilisatrices ; faire relire la portée des suggestions et conserver leur statut d’idées culinaires.
2. Configurer les produits du vendeur, les conditions de vente, le support, les taxes, la résiliation et le remboursement, en environnement de test.
3. Créer les [sessions Checkout](https://docs.stripe.com/payments/checkout) depuis une fonction authentifiée : le serveur sélectionne le prix autorisé et identifie le compte depuis la session.
4. Activer les droits après [webhook signé et vérifié](https://docs.stripe.com/webhooks), avec déduplication et gestion des paiements différés, échecs, remboursements, résiliations et expiration du pass. La page de retour ne débloque aucun droit par elle-même.
5. Autoriser les nouvelles générations auprès du serveur et fournir une gestion de facturation. Les documents et menus déjà créés restent gratuits, y compris hors connexion ; une variable locale ne protège pas la génération actuellement publique.
6. Vérifier achats de test, renouvellement, résiliation, expiration, restauration sur un autre appareil et événements rejoués avant toute facturation réelle. Le miroir GitHub Pages ouvre le parcours de compte et de paiement sur le domaine Vercel.

Cette version livre le service complet à essayer et une offre fondée sur son résultat. Elle ne crée aucun produit Stripe et ne facture personne.
