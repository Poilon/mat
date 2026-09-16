# Poum 4 — Le compagnon de grossesse

Le calendrier, les examens et les repas partagent le carnet existant. Pas de nouvelle table, pas de migration de production. Les tarifs et ressources Stripe existants restent identiques.

## Parcours livrés

- `#accueil` : nouvel accueil éditorial ; après configuration, progression en SA, terme, prochaines étapes et recettes filtrées.
- `#grossesse` : dernières règles ou terme communiqué, durée du cycle, date de naissance facultative, statut toxoplasmose uniquement s'il a été confirmé par un professionnel, consentement, pause et retrait du suivi.
- `#calendrier` : 23 repères généraux français, contrôles supplémentaires en cas de non-immunisation toxoplasmose confirmée, filtres, dates/heures réellement fixées, notes, statut, responsable, rendez-vous personnels et questions de consultation.
- `#examens` : saisie des analyses prescrites, proposition d'intitulés depuis une ordonnance, comparaison avec un résultat, confirmation manuelle des mentions et suivi « attendu / en attente / reçu et vérifié / discuté ».
- `#envies` : goûts temporaires jusqu'à aujourd'hui, pour sept jours ou sans date de fin. Les allergies et goûts habituels restent distincts. Le moteur partagé applique ces exclusions à la navigation, aux suggestions et à la génération côté serveur.
- `#plus` : nouvelle présentation de l'offre ; export ICS des rendez-vous à venir dont la date a été saisie et export neutre des dates confiées à un proche, droits vérifiés sur le serveur. Les menus, recettes Plus et courses conservent leurs droits existants.

Le calendrier dans Poum, le suivi documentaire et les exclusions sont gratuits. Les rappels Plus sont des alarmes dans un fichier ICS à importer dans son agenda. Seules les dates renseignées par la personne sont exportées ; aucune période estimée ne crée de rendez-vous. Pas d'envoi automatique de notifications ou d'e-mails ; pas de synchronisation bidirectionnelle avec Google/Apple. Après une modification, il faut exporter à nouveau et gérer la mise à jour dans l'agenda destinataire. L'export pour un proche ne contient ni intitulés médicaux ni notes ; ses identifiants sont opaques. Aucun message n'est envoyé au proche par Poum.

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

Le compte Neon connecté `poilon@gmail.com` dispose d’un bandeau « Mode admin » global, sans condition de validation de l’e-mail. Le switch choisit Gratuit ou Plus ; « Accès réel » rétablit les droits Stripe. Le choix est conservé 30 jours dans un cookie HttpOnly, Secure en HTTPS, propre au navigateur et lié à l’identifiant du compte. Le cookie exprime seulement une préférence : chaque requête vérifie à nouveau l’identité et l’adresse renvoyées par la session Neon côté serveur. Aucun autre compte ne bénéficie de cette option.

Les recettes, la composition des menus, les dîners et les exports calendrier utilisent le même accès effectif. Les téléchargements de recettes sont séparés par mode pour retrouver les paywalls en revenant au gratuit. Les carnets et la semaine d’essai déjà utilisée restent conservés. Les achats et la gestion Stripe demandent de revenir à l’accès réel ; la simulation ne modifie jamais un abonnement ni un paiement. Le statut `emailVerified` ne conditionne pas cet accès administrateur.

## Revue du calendrier — 16 septembre 2026 (4.0.2)

Le premier calendrier confondait visuellement le début d’une plage d’organisation avec une date de rendez-vous. En particulier, la déclaration commençait arbitrairement à 8 SA et son jour était mis en avant. Cette règle a été supprimée. Le modèle distingue désormais les périodes, les échéances formulées dans les recommandations, les actions à organiser et les dates saisies. Les plages ne sont pas exportées en ICS ; l’API refuse un export sans date à venir renseignée. Les anciens fichiers déjà importés dans un agenda externe ne peuvent pas être corrigés à distance.

| Étape | Repère retenu et limite |
| --- | --- |
| Premier examen / déclaration | Avant la fin du troisième mois ; déclaration après le premier examen, sans imposer une échographie T1 préalable. Pas de jour administratif précis déduit de la DDR. |
| Échographies | T1 : 11 SA–13 SA + 6 j ; T2 : 20–24 SA ; T3 : 30–35 SA selon le repère Ameli. Les plages en dates civiles sont des estimations. |
| Consultations du 4e au 9e mois | Mois calendaires depuis le début de grossesse estimé, sans multiplication par 4,35 semaines ; dates de l’Assurance Maladie prioritaires. |
| Entretien prénatal | À organiser le plus tôt possible après la déclaration, sans attendre une plage arbitraire. |
| Prévention | Possible dès la déclaration, de préférence avant 24 SA. |
| Dentiste | À partir du quatrième mois ; pas d’échéance artificielle à 23 SA. |
| Bilan du sixième mois / anesthésie | Respectivement sixième et huitième mois, selon ordonnance et organisation de la maternité. |
| Toxoplasmose | En cas de non-immunisation confirmée : repères mensuels ajoutés dès le début du suivi, y compris deuxième et troisième mois. Le précédent prélèvement et l’ordonnance déterminent le jour réel ; les périodes antérieures au premier bilan peuvent être écartées. |
| Vaccinations | Discussion dès le début du suivi ; les fenêtres de la coqueluche et du VRS sont distinctes des campagnes grippe/Covid-19. Aucune date de vaccination n’est prescrite automatiquement. |
| Inscription, préparation, sac | Actions d’organisation, sans date nationale imposée par Poum. |

Références relues : [premier trimestre Ameli](https://www.ameli.fr/assure/sante/devenir-parent/grossesse/grossesse-en-bonne-sante/grossesse/grossesse-soins-dentaires-dentiste-consultation), [suivi mensuel Ameli](https://www.ameli.fr/assure/sante/devenir-parent/grossesse/grossesse-en-bonne-sante/grossesse/consultation-suivi-mensuel), [déclaration Service Public](https://www.service-public.gouv.fr/particuliers/vosdroits/F968), [examens Service Public](https://www.service-public.gouv.fr/particuliers/vosdroits/F963), [vaccinations pendant la grossesse — Santé publique France](https://professionnels.vaccination-info-service.fr/Recommandations-vaccinales-specifiques/Personnes-exposees-a-des-risques-specifiques/Femmes-enceintes).

Cette revue documentaire corrige les règles et leur présentation ; elle ne constitue pas une validation clinique indépendante. Le calcul depuis la DDR reste une estimation, même corrigé de la durée du cycle ; les rendez-vous fixés et la datation clinique priment.

## Cocher les étapes terminées

Le calendrier s’ouvre sur « À faire ». Cocher « Fait » retire immédiatement l’étape de cette liste et des filtres de catégories, tout en conservant ses dates, notes et attribution. Le filtre « Faits » permet de retrouver l’historique et de décocher pour remettre l’étape à faire. Les étapes écartées restent dans « Écartés ». Le statut utilise le carnet et sa synchronisation existants.
