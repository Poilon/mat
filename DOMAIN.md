# Poum — domaine de production

État du 11 septembre 2026 : `poum.app` est rattaché et vérifié dans le projet Vercel `mat` (`prj_SVBdo0Uy4vMY8luGRmmgX5ZoHGdy`). Neon Auth autorise `https://poum.app` et l’adresse historique `https://mat-sandy-six.vercel.app`. Le nom d’application et le produit Stripe sont Poum / Poum Plus ; les identifiants internes restent inchangés.

## DNS à raccorder

Vercel détecte les serveurs `ns53.domaincontrol.com` et `ns54.domaincontrol.com`, avec les anciennes adresses de parking `3.33.130.190` et `15.197.148.33`. Sa configuration recommande un enregistrement A `@` vers `76.76.21.21`. Le fournisseur du domaine doit remplacer uniquement ces deux entrées A du domaine racine par la nouvelle adresse. Aucun accès au compte registrar n’est disponible dans cette session.

## Quand le DNS est prêt

1. Vérifier le HTTPS public sur `https://poum.app`, puis inscription, connexion et synchronisation d’un carnet avec un compte temporaire.
2. Vérifier les deux Checkouts sans paiement réel, leurs URL de retour vers `poum.app`, et le portail client ; expirer les sessions et supprimer le compte de vérification.
3. Définir `PUBLIC_APP_URL=https://poum.app/` dans la production Vercel et dans `.github/workflows/pages.yml`, puis redéployer. Mettre à jour les métadonnées publiques et l’adresse principale du README.
4. Le webhook de paiement existant sur l’adresse Vercel reste opérationnel et peut conserver cette adresse. Un changement éventuel exige une vérification de signature sur la nouvelle adresse avant modification chez Stripe.

L’adresse historique reste accessible : les sessions et les données locales sont propres à chaque origine. Les comptes retrouvent leur carnet par synchronisation ; les utilisateurs sans compte peuvent exporter leur ancien carnet et l’importer sur Poum. L’import accepte les exports Poum, Miamama, Nidelle et Miette. Ne pas imposer une redirection qui empêcherait de récupérer les carnets locaux.
