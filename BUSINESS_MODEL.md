# Nidelle Plus — modèle économique proposé

Version du 9 septembre 2026. **Pré-lancement : aucun paiement ouvert, aucun abonnement actif.** La page `#plus` et le paywall des menus présentent l’offre. L’aperçu de deux jours fonctionne dès maintenant, sans compte ni carte bancaire.

## Ce que l’on vend

La grossesse apporte déjà beaucoup de décisions quotidiennes. Nidelle aide à comprendre les aliments gratuitement ; **Nidelle Plus vend le temps gagné pour imaginer et organiser ses repas**. La proposition est concrète : « Une semaine d’idées, en quelques gestes. »

Le produit reste sans publicité, sans vente de données et sans promesse de suivi médical personnalisé. Le choix végétarien et le temps de cuisine servent à sélectionner des recettes ; ils ne constituent pas un bilan nutritionnel. Aucun trimestre, résultat médical ou terme de grossesse n’est nécessaire pour tester l’aperçu.

## Offre et prix

| Fonction | Nidelle gratuit | Nidelle Plus, au lancement |
| --- | --- | --- |
| 360 fiches, raisons, précautions, sources | Oui | Inclus |
| Recherche et scan Open Food Facts | Oui, selon la disponibilité du service | Même accès |
| Toutes les 100 recettes et leurs précautions | Oui | Inclus |
| Favoris, menus manuels, courses, export et synchronisation | Oui | Inclus |
| Proposition automatique de 2 jours / 4 repas | Oui, déjà utilisable | Inclus |
| Composer 7 jours / 14 repas en une fois | — | Prévu |
| Temps disponible et option végétarienne | Dans l’aperçu | Sur la semaine entière |
| Remplacer un plat ou renouveler une proposition | Nouvelle proposition dans l’aperçu | Prévu sur la semaine |
| Ajouter la proposition au carnet puis aux courses | Depuis l’aperçu | Depuis la semaine entière |

Deux tarifs à tester, affichés dans l’app :

- **Pass 9 mois : 29,90 € en une fois.** Neuf mois d’accès à compter de l’activation, sans renouvellement automatique. C’est la formule mise en avant, adaptée à une période de vie limitée. Aucun justificatif de grossesse.
- **Mensuel : 4,90 €/mois.** Renouvellement automatique, résiliation à tout moment pour empêcher la prochaine échéance ; accès jusqu’à la fin de la période déjà payée.

Le pass coûte 14,20 € de moins que neuf mensualités à 4,90 €. C’est une comparaison entre deux durées d’achat, pas une remise sur un ancien prix. Pas d’abonnement annuel imposé, de compteur d’urgence ni de formule précochée conduisant à un encaissement. Les prix restent des hypothèses commerciales ; les conditions définitives seront établies avant l’ouverture.

À expiration, les menus enregistrés restent lisibles, modifiables à la main et exportables. Aucun contenu personnel ne devient inaccessible.

## Placement du paywall

1. Une entrée « Découvrir Nidelle Plus » et une page d’offre accessible directement à `#plus`.
2. Dans **Mes menus**, un bloc propose **Essayer 2 jours** et **Composer 7 jours · Plus**.
3. L’aperçu permet de choisir une date, une durée et l’option végétarienne, puis de consulter quatre vraies recettes. Il remplit seulement les créneaux encore libres, en vérifiant à nouveau le carnet au moment d’ajouter.
4. Après l’aperçu, « Découvrir l’offre » ouvre le paywall. « Composer 7 jours · Plus » l’ouvre également depuis le calendrier.
5. Le paywall explique le bénéfice et les deux formules ; sa fermeture et la poursuite gratuite sont toujours visibles. Aucun écran de paiement au milieu d’une précaution alimentaire, d’une source ou d’une recette.

**Dans cette version**, la sélection d’une formule affiche ses conditions, puis le bouton propose l’aperçu gratuit. Le texte indique que l’offre et les paiements sont en préparation. Aucun achat, réservation, abonnement ni période d’essai payante ne sont simulés. L’aperçu peut être renouvelé ; il n’existe pas de quota caché ni de verrou prétendument sécurisé dans le navigateur.

## Acquisition et validation

Le premier canal serait le contenu utile : fiches consultables depuis les moteurs de recherche, recettes et pages pratiques partageables. Le routage actuel par fragments (`#…`) ne suffit pas à un catalogue SEO : prévoir des pages statiques avec URL, titre et description propres avant d’investir dans ce canal. Les recommandations de professionnels peuvent ensuite aider à faire connaître l’outil, sans présenter une recommandation commerciale comme une validation clinique.

Commencer par observer, avec des participantes volontaires : comprennent-elles les deux offres, ajoutent-elles les quatre repas, et souhaitent-elles payer pour une semaine complète ? Le pré-lancement actuel ne collecte pas ces observations automatiquement : aucune mesure d’audience ni liste d’attente n’a été ajoutée.

Une fois le paiement réellement disponible, mesurer un parcours minimal : aperçu terminé → repas ajoutés → offre consultée → achat confirmé par le serveur. Suivre les formules choisies, les remboursements, les mois réellement payés et l’usage des menus après achat. Les métriques éventuelles devront éviter les recherches d’aliments, le carnet ou les informations de santé et faire l’objet d’une information adaptée.

Le prix de 29,90 € et le partage gratuit/payant sont des hypothèses à valider. Ne pas conclure à une demande solvable sur le seul nombre de clics d’une page de pré-lancement.

## Scénario de recettes, à titre d’hypothèse

Sur **1 000 utilisatrices actives par mois**, avec 70 % des achats sur le pass et 30 % sur le mensuel :

| Conversion en nouveaux achats | Pass vendus | Nouveaux abonnements mensuels | Encaissement initial brut |
| --- | ---: | ---: | ---: |
| 2 % | 14 | 6 | 448 € |
| 3 % | 21 | 9 | 672 € |
| 5 % | 35 | 15 | 1 120 € |

Ce sont des scénarios, pas des prévisions ni un bénéfice. Ils excluent les renouvellements des cohortes précédentes. Les pass sont encaissés une fois pour neuf mois de service : leur produit n’est pas du revenu mensuel récurrent. Au scénario central, seuls les neuf nouveaux abonnements apportent 44,10 € de revenu mensuel récurrent initial avant résiliations et déductions.

Pour une carte standard de l’Espace économique européen, Stripe affiche **1,5 % + 0,25 € par transaction** ; l’offre à l’usage de Stripe Billing affiche **0,7 % du volume Billing**. Cela représente environ 0,70 € de frais de paiement pour un pass, et 0,36 € pour une mensualité en ajoutant Billing, avec ces seules hypothèses. D’autres cartes, services, devises ou litiges changent ces frais. [Tarifs officiels Stripe, consultés le 9 septembre 2026](https://stripe.com/fr/pricing).

Le budget doit aussi couvrir l’hébergement, les services de compte et de base de données, la maintenance des sources, une relecture clinique indépendante, le support, les remboursements, les taxes applicables et l’acquisition. Les montants bruts ci-dessus n’en tiennent pas compte. Limiter les dépenses d’acquisition jusqu’à connaître la marge réelle par cohorte ; neuf mois de durée proposée ne prouvent pas neuf mensualités de rétention. Le pass sert aussi à limiter la dépendance à une longue rétention sur un besoin temporaire.

## Passage à de vrais paiements

Le frontal peut rester statique ; **un paiement réel nécessite une autorité serveur**. Le projet dispose déjà de fonctions Vercel et de comptes Neon. L’offre décrite dans `js/plus.js` est uniquement une configuration de présentation, jamais une preuve d’achat.

Avant toute ouverture :

1. Terminer et vérifier la composition complète de sept jours et le remplacement d’un plat, en conservant les précautions de chaque recette et les repas déjà enregistrés. Faire relire la portée des suggestions ; ne pas vendre une promesse de régime médical.
2. Configurer les produits Stripe du vendeur : prix unique pour le pass, prix récurrent pour le mensuel, conditions de vente, support, information sur les prix et taxes, résiliation et remboursement. Utiliser un environnement de test tant que ces éléments ne sont pas prêts.
3. Créer les sessions Checkout depuis une fonction authentifiée. Le serveur choisit le prix dans une liste autorisée ; aucun montant ni identifiant de compte du navigateur ne fait autorité. [Checkout prend en charge les paiements uniques et récurrents](https://docs.stripe.com/payments/checkout).
4. Activer les droits en base après événement Stripe vérifié, avec contrôle de signature sur le corps brut, déduplication des événements et gestion des paiements différés, échecs, remboursements et résiliations. La page de retour ne débloque rien par elle-même. [Documentation officielle des webhooks Stripe](https://docs.stripe.com/webhooks).
5. Fournir un état d’abonnement lu auprès du serveur et un accès à la gestion de la facturation. La génération premium est autorisée par le serveur ; un booléen dans `localStorage` ne protège pas un service payant. Les menus déjà enregistrés restent dans le carnet gratuit, y compris hors connexion.
6. Vérifier les achats de test, le renouvellement, la résiliation, le pass à expiration, la restauration sur un autre appareil, les événements rejoués et les remboursements avant d’activer les paiements réels. Sur le miroir GitHub Pages, ouvrir le parcours de compte et de paiement sur le domaine Vercel.

Cette version livre le positionnement, l’offre, ses points d’entrée et un aperçu utile. Elle ne crée aucun produit Stripe et ne facture personne.
