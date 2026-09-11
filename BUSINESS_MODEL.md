# Miamama Plus — modèle économique

Version du 11 septembre 2026, application 3.1.0. **Miamama — Alimentation & grossesse.** Le nom reste provisoire. Le paiement Stripe et les droits serveur sont implémentés. Leur ouverture dépend de la configuration documentée dans [STRIPE.md](STRIPE.md) ; tant qu’elle est incomplète, l’atelier reste offert et aucun checkout n’est proposé.

## Ce que l’on vend

**« Qu’est-ce qu’on mange cette semaine ? »** L’offre porte sur un résultat utilisable : une semaine de plats choisis, les courses regroupées et un carnet qui permet à une autre personne de prendre le relais en cuisine.

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

## Offre et prix

| Accès | Contenu |
| --- | --- |
| Gratuit durable | 360 fiches alimentaires sourcées, recherche/scan Open Food Facts selon disponibilité, 100 recettes, favoris, menus manuels, courses, export et synchronisation |
| Première semaine | Tout l’atelier sur une première date de semaine, ajustable sans carte bancaire, avec un compte gratuit |
| Miamama Plus | Nouvelles semaines personnalisées, plats modifiables, courses regroupées et carnet à partager |

- **Pass 9 mois : 29,90 € en une fois.** Neuf mois d’accès à partir de l’activation, sans renouvellement automatique. Aucun justificatif de grossesse.
- **Mensuel : 4,90 €/mois.** Renouvellement automatique ; résiliation possible pour empêcher la prochaine échéance, accès jusqu’à la fin de la période payée.

Le pass coûte 14,20 € de moins que neuf mensualités. Cette comparaison entre durées d’achat n’est pas une remise sur un ancien prix. Aucun compteur d’urgence, avis fictif, faux nombre de clientes ou achat par simple sélection d’une formule.

Les tarifs sont des hypothèses à tester, pas une preuve de disposition à payer. À expiration, les menus et courses déjà enregistrés restent accessibles, modifiables manuellement et exportables. Le pass couvre une période de vie limitée et évite de dépendre uniquement d’une longue rétention mensuelle.

## Un paywall après la preuve

1. La page `#plus` montre un exemple de menu avec des recettes du catalogue, les fonctions comprises et les prix. Les exemples sont explicitement identifiés comme exemples.
2. Le bouton principal ouvre l’atelier complet, également accessible depuis la navigation et **Mes menus**.
3. L’utilisatrice compose, consulte les recettes, ajuste les plats, prépare les courses et peut emporter son carnet.
4. Après le résultat, **Découvrir l’offre Plus** ouvre une présentation avec les nombres réellement obtenus : repas, plats utilisant les ingrédients sélectionnés et articles à prévoir.
5. Le prix et les conditions sont lisibles, la fermeture et la poursuite gratuite restent accessibles. Les sources et précautions ne rencontrent jamais un paywall.

La formule choisie ouvre Stripe après connexion ou création de compte. Le serveur relit le paiement avant d’activer les droits ; aucun booléen premium local ne fait autorité. Le pass ne se renouvelle pas. L’abonnement mensuel se gère depuis le portail client : moyen de paiement, factures et résiliation.

La deuxième date de semaine rencontre le paywall côté serveur. La première reste modifiable. Des accès discrets à Plus restent présents dans l’accueil, les recettes, leurs fiches, les favoris, les courses, les menus et la barre supérieure. La page d’offre permet d’ouvrir un exemple complet. Les membres actifs voient l’accès à leur atelier et à leur abonnement.

## Mesurer la valeur réelle

Faire essayer l’atelier à des participantes volontaires, puis vérifier des comportements concrets : gardent-elles plusieurs suggestions, utilisent-elles leurs ingrédients, emportent-elles le document, et reviennent-elles préparer la semaine suivante ? Demander ensuite si l’offre résout un problème pour lequel elles paieraient, et laquelle des deux formules elles choisiraient. Les clics sur le prix ne suffisent pas à prouver une demande solvable.

L’application n’ajoute ni mesure d’audience ni liste d’attente. Il reste sans publicité et sans vente de données. Une mesure future du parcours devrait se limiter aux événements nécessaires, en excluant les recherches d’aliments, le contenu des carnets et les informations médicales, avec information adaptée.

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

## Paiement et maintien du service

Le frontal reste en HTML/CSS/JS natifs. Vercel gère les achats authentifiés, les événements signés, les droits et la génération de semaines. Neon conserve les correspondances entre comptes et achats. Le miroir GitHub Pages ouvre le parcours de compte et de paiement sur le domaine Vercel.

Les prix et le portail sont créés dans les deux modes Stripe. Le pass dure neuf mois calendaires ; le mensuel suit les périodes réellement payées. Les événements rejoués n’étendent pas le pass. Un remboursement intégral ou un litige suspend l’accès concerné. La résiliation en fin de période préserve l’accès déjà payé. À expiration, les carnets créés restent disponibles. Le mode test est affiché explicitement.

La conversion est une hypothèse commerciale à mesurer ; le prix ne garantit pas la demande. Les informations du vendeur et de support utilisées par Checkout restent celles du compte Stripe. Voir [l’état exact de l’ouverture et les paramètres techniques](STRIPE.md).
