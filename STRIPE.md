# Poum Plus — configuration Stripe

Le compte Poilon Software est autorisé par Stripe CLI. Cette autorisation sert aux outils ; l’application utilise une **clé API serveur durable** dans Vercel. Aucune clé ni donnée de carte ne va dans le JavaScript public. Le SDK Stripe est fixé à 22.6.2, API `2026-08-26.dahlia`.

## Ressources déjà créées

Compte : `acct_1TOF2QBKxdkJ2tu1`, métadonnée `app=miamama` sur les ressources de l’application.

| Variable / ressource | Production | Sandbox |
| --- | --- | --- |
| Produit | `prod_VEt5lT9f7NmtUu` | `prod_VEsyWZLf0oRBsN` |
| `STRIPE_PRICE_MONTHLY` | `price_1UEPIxBKxdkJ2tu1QIg6it1j` | `price_1UEPCzBKxdkJ2tu1LaqAC4tu` |
| `STRIPE_PRICE_PASS` | `price_1UEPIyBKxdkJ2tu1cLyPDQAF` | `price_1UEPD0BKxdkJ2tu1u9azxo50` |
| `STRIPE_PORTAL_CONFIGURATION` | `bpc_1UEPJ1BKxdkJ2tu16IOiHYqE` | `bpc_1UEPD3BKxdkJ2tu1MLQeXuIs` |
| Webhook | `we_1UEPYhBKxdkJ2tu1uWpDyVog` | Utiliser un listener local |

Mensuel : 490 centimes EUR, renouvellement mensuel. Pass : 2 990 centimes EUR, neuf mois calendaires à partir du paiement, sans renouvellement. Le serveur vérifie prix, devise, mode, quantité et périodicité avant de créer Checkout.

## État de l’ouverture

Les cinq variables Stripe sont enregistrées dans l’environnement **Production** du projet Vercel `mat`. Vérification du 11 septembre 2026 : `configured: true`, mode `live`, deux pages Checkout ouvertes avec les montants corrects, portail client accessible, webhook activé et signatures valides acceptées. Les événements d’expiration des sessions ont été livrés. Aucun paiement réel n’a été effectué ; les comptes et sessions temporaires ont été nettoyés.

Le domaine `poum.app` est rattaché à Vercel et autorisé dans Neon Auth. Son DNS et HTTPS sont opérationnels. Le webhook conserve son adresse fonctionnelle `https://mat-sandy-six.vercel.app/api/stripe-webhook`. Le nom commercial devient Poum Plus ; la métadonnée interne `app=miamama`, les prix et identifiants Stripe sont conservés pour les achats existants.

Ne jamais copier de clé dans le chat, le dépôt, une description de commit, un argument de commande ou une variable `PUBLIC_*`. Les fichiers `.env*.local` sont ignorés par Git. Le portail contient la mise à jour du moyen de paiement, les factures et la résiliation en fin de période. Les informations commerciales et de support affichées par Stripe proviennent du compte du vendeur.

## Développement et tests

Pour tester localement, utiliser une clé **sandbox** dans `STRIPE_SECRET_KEY`, les deux prix sandbox, le portail sandbox et le secret d’un `stripe listen --forward-to localhost:4175/api/stripe-webhook`. Charger ces valeurs depuis un fichier `.env.stripe.test.local` privé après les variables Neon. Une variable Vercel nommée `STRIPE_TEST_SECRET_KEY` peut servir à transférer la clé test ; l’application lit exclusivement `STRIPE_SECRET_KEY` dans l’environnement où elle tourne.

Ne pas mélanger les prix ou secrets entre modes. Le mode test est signalé dans l’interface. Ne jamais brancher le listener test sur le webhook live. Les données de test utilisant la base dédiée doivent avoir un utilisateur temporaire et être nettoyées après vérification.

```sh
node --env-file=.env.development.local --env-file=.env.stripe.test.local scripts/dev.cjs
npm test
npm run test:browser
```

## Vérifications effectuées le 11 septembre 2026

Les tests avec le compte sandbox ont créé des sessions Checkout via le service, enregistré un paiement mensuel, vérifié les droits à partir de la facture payée, résilié en fin de période, ouvert le portail client et remboursé le paiement. Le pass a été payé dans la vraie page Checkout avec la carte de test Stripe, puis activé, rejoué sans prolongation et remboursé. Le client temporaire et ses lignes applicatives ont été supprimés. Aucun paiement réel n’a été effectué. Les tests automatisés couvrent aussi les signatures, les comptes distincts, les événements anciens, les impayés, les litiges et le contrôle serveur de la semaine offerte.

## Contrôle des droits

- `POST /api/billing` authentifie le compte et accepte uniquement `checkout`, `confirm`, `refresh` et `portal`. Les prix, le client Stripe et les URL de retour sont déterminés par le serveur.
- La page de succès transmet la référence de Checkout. Le serveur relit le paiement chez Stripe et vérifie son propriétaire avant de confirmer l’accès.
- Le webhook utilise les octets bruts et la signature Stripe, déduplique les événements et relit leur état actuel. Un événement ancien ne réactive pas un abonnement résilié.
- L’accès mensuel suit la dernière facture payée ; une échéance future impayée ne l’étend pas. Les remboursements intégraux et litiges retirent l’accès associé. Un remboursement partiel conserve l’accès. Le pass conserve sa date initiale lors d’un événement rejoué.
- La composition de semaines est exécutée dans `server/planner.cjs`, via `POST /api/workshop`. Une première date de semaine est attribuée atomiquement à chaque compte. Cette semaine reste ajustable ; les autres nécessitent un droit actif en base. Un drapeau local ne débloque pas le serveur.
- Les repas et courses déjà sauvegardés, le guide, les recettes et leurs sources restent utilisables sans Plus. La suppression du compte arrête les abonnements de l’application avant de supprimer ses références et son carnet.

Les tables `miette_billing_*`, `miette_subscriptions`, `miette_passes` et `miette_workshop_trials` sont créées par `npm run db:migrate`. Les verrous limitent les créations concurrentes ; les identifiants d’idempotence Stripe protègent les nouvelles tentatives de Checkout.

Documentation de référence : [Stripe Checkout](https://docs.stripe.com/api/checkout/sessions/create), [webhooks Stripe](https://docs.stripe.com/webhooks), [clés API](https://docs.stripe.com/keys), [Vercel Web Handlers et corps brut](https://vercel.com/kb/guide/how-do-i-get-the-raw-body-of-a-serverless-function).
