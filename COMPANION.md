# Poum 4 — Le compagnon de grossesse

Le calendrier, les examens et les repas partagent le carnet existant. Pas de nouvelle table, pas de migration de production. Les tarifs et ressources Stripe existants restent identiques.

## Parcours livrés

- `#accueil` : nouvel accueil éditorial ; après configuration, progression en SA, terme, prochaines étapes et recettes filtrées.
- `#grossesse` : dernières règles ou terme communiqué, durée du cycle, date de naissance facultative, statut toxoplasmose uniquement s'il a été confirmé par un professionnel, consentement, pause et retrait du suivi.
- `#calendrier` : 23 repères généraux français, contrôles supplémentaires en cas de non-immunisation toxoplasmose confirmée, filtres, dates/heures réellement fixées, notes, statut, responsable, rendez-vous personnels et questions de consultation.
- `#examens` : saisie des analyses prescrites, proposition d'intitulés depuis une ordonnance, comparaison avec un résultat, confirmation manuelle des mentions et suivi « attendu / en attente / reçu et vérifié / discuté ».
- `#envies` : goûts temporaires jusqu'à aujourd'hui, pour sept jours ou sans date de fin. Les allergies et goûts habituels restent distincts. Le moteur partagé applique ces exclusions à la navigation, aux suggestions et à la génération côté serveur.
- `#plus` : nouvelle présentation de l'offre ; export ICS des étapes à venir et export neutre des dates confiées à un proche, droits vérifiés sur le serveur. Les menus, recettes Plus et courses conservent leurs droits existants.

Le calendrier dans Poum, le suivi documentaire et les exclusions sont gratuits. Les rappels Plus sont des alarmes dans un fichier ICS à importer dans son agenda. Pas d'envoi automatique de notifications ou d'e-mails ; pas de synchronisation bidirectionnelle avec Google/Apple. Après une modification, il faut exporter à nouveau et gérer la mise à jour dans l'agenda destinataire. L'export pour un proche ne contient ni intitulés médicaux ni notes ; ses identifiants sont opaques. Aucun message n'est envoyé au proche par Poum.

## Lecture documentaire

`src/documents.js` est compilé séparément et chargé à la demande. PDF.js lit les PDF textuels et rend les pages scannées pour Tesseract. Les images sont traitées par Tesseract en français. Les scripts, workers, fichiers de langue, polices et ressources de décodage sont servis par le même déploiement. Aucun service d'OCR tiers ne reçoit les documents.

Limites : 10 Mo, 10 pages de PDF, JPEG/PNG/WebP ou texte. Le lecteur a besoin de réseau pour charger ses ressources ; la saisie manuelle reste disponible hors connexion. Les PDF protégés demandent une copie déverrouillée. Une lecture difficile doit être remplacée par une saisie manuelle.

Le fichier original et le texte complet ne sont pas enregistrés dans le carnet. Seuls les noms d'analyses, les statuts et les extraits explicitement confirmés sont conservés ; ils sont inclus dans la synchronisation et l'export JSON. Les correspondances présentent le nom du document et la page. Aucune valeur biologique n'est interprétée et aucune conclusion médicale n'est produite. Un intitulé présent peut désigner un résultat encore en attente : la personne doit vérifier le document original.

## Données et compatibilité

`journey` est un champ du JSON du carnet : profil, étapes par identifiant, questions et bilans. La fusion traite séparément les étapes, questions et bilans ; deux éditions concurrentes du même élément demandent une résolution. Retirer le consentement supprime l'ensemble du suivi. La suppression du compte et l'effacement global du carnet suivent le comportement existant.

`api/notebook.js` conserve `journey` et les exclusions temporaires lorsqu'un ancien client les omet. Les mises à jour restent conditionnées à la révision. Les carnets invités et les comptes restent séparés ; l'import du carnet invité est désormais décoché par défaut. Un document en cours de lecture et les formulaires ne peuvent pas être enregistrés pour un autre compte après un changement de session.

Les nouveaux écrans signalent l'état local ou synchronisé. Le lecteur lourd n'est pas précaché ; le calendrier, les vues et les données personnelles déjà sauvegardées restent utilisables hors connexion.

## Repères médicaux

Sources consultées le 16 septembre 2026 :

- [Ameli : première consultation](https://www.ameli.fr/assure/sante/devenir-parent/grossesse/grossesse-en-bonne-sante/grossesse/grossesse-soins-dentaires-dentiste-consultation)
- [Ameli : suivi mensuel](https://www.ameli.fr/assure/sante/devenir-parent/grossesse/grossesse-en-bonne-sante/grossesse/consultation-suivi-mensuel)
- [Service Public : examens](https://www.service-public.gouv.fr/particuliers/vosdroits/F963)
- [Service Public : déclaration](https://www.service-public.gouv.fr/particuliers/vosdroits/F968)
- [HAS : information sur le dépistage de la trisomie 21](https://www.has-sante.fr/jcms/c_2899277/fr/depistage-de-la-trisomie-21)

Le calcul prend comme repère 41 SA (287 jours), corrigé de l'écart à un cycle de 28 jours. Il ne remplace pas la datation clinique. Un terme renseigné par le professionnel devient prioritaire. Les périodes mensuelles sont des repères d'organisation approximatifs ; les dates effectivement fixées sont conservées après correction du terme. L'âge est affiché comme information de consultation, sans générer une prescription. Les contrôles, vaccins et dépistages sont à adapter au suivi réel. Le calendrier ne prétend pas couvrir toutes les situations médicales. Les tâches pratiques sont identifiées comme repères Poum.

Cette version n'a pas fait l'objet d'une validation clinique indépendante. Elle organise des informations et documents ; elle ne certifie pas la complétude d'un bilan, la normalité de résultats ni l'absence d'allergènes.

## Validation et publication

Node.js 24 est indiqué dans `.nvmrc` et `package.json`. Le build Vercel exécute les tests unitaires avant la compilation. Le workflow `ci.yml` vérifie les tests unitaires et les parcours Chromium ; les simulations ne contactent pas Neon ou Stripe. La protection de branche n'est pas modifiée par ce changement.

La suite couvre notamment les corrections de datation sans perte de rendez-vous, consentement/retrait, fusion des comptes, vrai PDF, vraie image OCR avec contrôle des appels réseau, revue explicite des extraits, allergies persistantes et expiration des envies. La recette en production vérifie les pages et ressources publiques sans créer d'achat ni importer de données médicales réelles.

## Switch de test propriétaire

Le compte Neon `poilon@gmail.com`, avec e-mail vérifié, dispose d’un bandeau « Mode test » global. Le switch choisit Gratuit ou Plus ; « Accès réel » rétablit les droits Stripe. Le choix est conservé 30 jours dans un cookie HttpOnly, Secure en HTTPS, propre au navigateur et lié à l’identifiant du compte. Le cookie exprime seulement une préférence : chaque requête vérifie à nouveau l’identité et l’e-mail confirmé côté serveur. Aucun autre compte ne bénéficie de cette option.

Les recettes, la composition des menus, les dîners et les exports calendrier utilisent le même accès effectif. Les téléchargements de recettes sont séparés par mode pour retrouver les paywalls en revenant au gratuit. Les carnets et la semaine d’essai déjà utilisée restent conservés. Les achats et la gestion Stripe demandent de revenir à l’accès réel ; la simulation ne modifie jamais un abonnement ni un paiement. Une adresse non vérifiée doit être confirmée avant que le switch apparaisse.
