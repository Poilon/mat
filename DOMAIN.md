# Poum — domaine de production

État du 11 septembre 2026, version 3.5.1 : **https://poum.app** est actif avec HTTPS dans le projet Vercel `mat` (`prj_SVBdo0Uy4vMY8luGRmmgX5ZoHGdy`). `https://www.poum.app` redirige en 308 vers le domaine principal.

## Configuration

- DNS externe : `ns53.domaincontrol.com` et `ns54.domaincontrol.com`.
- Enregistrement A racine : `@` → `76.76.21.21` ; CNAME `www` → `poum.app`.
- Domaines Vercel rattachés et vérifiés : `poum.app`, `www.poum.app`.
- Neon Auth autorise `https://poum.app` et l’adresse historique `https://mat-sandy-six.vercel.app`. Le nom de l’application est Poum.
- `PUBLIC_APP_URL=https://poum.app/` dans la production Vercel et le workflow GitHub Pages. Les métadonnées publiques utilisent ce domaine.
- Le produit Stripe s’appelle Poum Plus. Les prix, la métadonnée interne `app=miamama` et les identifiants d’achat sont conservés.
- Checkout construit ses URL de retour depuis l’origine de l’application. Le retour par défaut du portail est `https://poum.app/#plus`.
- Le webhook conserve son adresse fonctionnelle `https://mat-sandy-six.vercel.app/api/stripe-webhook`, indépendante de la navigation des utilisateurs.

## Vérifications

HTTPS public, redirection `www`, inscription, déconnexion/reconnexion et récupération du carnet dans une seconde session vérifiés sur `poum.app`. Les deux pages de paiement réelles affichent Poum Plus et les montants attendus ; les URL de succès et d’annulation utilisent `poum.app`. Le portail est accessible, et un compte sans achat n’obtient pas les recettes Plus.

Aucun paiement réel effectué. Les sessions de vérification ont été expirées et le compte technique supprimé de l’application et de Stripe.

## Accès depuis l’ancien domaine

L’adresse historique reste accessible : les sessions et les données locales sont propres à chaque origine. Les comptes retrouvent leur carnet par synchronisation ; les utilisateurs sans compte peuvent exporter leur ancien carnet et l’importer sur Poum. L’import accepte les exports Poum, Miamama, Nidelle et Miette. Ne pas imposer une redirection qui empêcherait de récupérer les carnets locaux.
