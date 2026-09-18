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

## Comprendre une étape depuis l’accueil

Les cartes « À prévoir » ouvrent une fiche sur place : explication, période indicative ou date renseignée, préparation et lien vers la source officielle. Un bouton distinct permet ensuite d’ouvrir le rendez-vous concerné dans le calendrier pour y noter une date ou une question. La fiche se ferme avec Échap et rend le focus à la carte ; elle se ferme aussi lors d’un changement de compte. Le bilan prénatal de prévention dispose d’une explication détaillée fondée sur la page Ameli du suivi mensuel.

Les textes d’accueil et de navigation privilégient des formulations directes (« Bonjour Poilon. », « À prévoir », « Calendrier, examens et repas. »), avec un vouvoiement cohérent.

## Liste et explications — 4.0.6

Le calendrier devient une liste compacte : période, intitulé, statut et case « Fait ». Ouvrir une ligne affiche son utilité, les sujets possibles, la préparation, les suites et les champs personnels. Ces explications sont aussi utilisées dans les fiches de l’accueil. Les aides sur les périodes et les exports sont regroupées avec les outils du calendrier pour laisser la liste visible rapidement.

Le tri suit désormais toute la chaîne d’étapes préalables, même sans date renseignée : le premier examen précède la déclaration, qui précède le bilan de prévention. Le précédent tri plaçait le bilan de prévention en premier parce que sa plage technique commençait à la DDR. Une date saisie reste prioritaire et les rendez-vous datés sont classés par date et heure. Aucun repère de tri ne devient une date fixée ou exportée. L’accueil utilise le même ordre.

Les contenus de `js/pregnancy-guide.js` distinguent explications et prescriptions. Ils couvrent les étapes générales, les consultations mensuelles et les contrôles de toxoplasmose, avec leurs sources. Références supplémentaires relues le 16 septembre 2026 : [préparation à la parentalité](https://www.ameli.fr/assure/sante/devenir-parent/grossesse/grossesse-en-bonne-sante/grossesse/preparation-parentalite), [bilan bucco-dentaire](https://www.ameli.fr/assure/sante/devenir-parent/grossesse/grossesse-en-bonne-sante/grossesse/femme-enceinte-soins-dentaire-mtdents), [toxoplasmose](https://www.ameli.fr/assure/sante/themes/toxoplasmose/bons-reflexes-cas-faut-consulter) et [information péridurale HCL](https://www.chu-lyon.fr/analgesie-peridurale-obstetricale). Les thèmes proposés ne sont pas un programme exhaustif de consultation et n’ont pas de validation clinique indépendante.

Les goûts habituels sont désormais modifiables dans « Mes envies », à côté des exclusions temporaires et de leur durée. Le profil conserve les allergies et un lien vers cet écran. Une sauvegarde du profil conserve les goûts déjà enregistrés ; retirer les envies temporaires ne retire ni les goûts habituels ni les allergies. Les champs du carnet et la synchronisation restent identiques.

## Fiches Open Food Facts — 4.0.9

Les fiches distinguent les signaux à éviter ou limiter, les précautions de préparation, les compositions à préciser, les fiches incomplètes et l’absence de signal repéré dans les données disponibles. Cette dernière indication n’est pas une certification de compatibilité pendant la grossesse. Les cartes affichent une explication propre au produit en plus de la marque.

Les détails présentent la composition disponible, les allergènes déclarés, les traces, la conservation et la date de modification lorsqu’elles sont renseignées. Les mentions UHT, pasteurisation, lait en poudre, conserve et surgelé sont reliées aux champs concernés ; une mention d’ingrédient ne valide pas tout le produit. Les précautions les plus fortes restent prioritaires. Une valeur manquante n’est jamais présentée comme une absence d’allergène.

Le proxy demande ces champs supplémentaires à Open Food Facts. Le cache navigateur passe au schéma 2, et la requête versionnée renouvelle les anciennes réponses sans multiplier les appels. Référence : [champs de l’API produit Open Food Facts](https://openfoodfacts.github.io/documentation/docs/Product-Opener/v2/products/get-product-by-code/).

L’accueil ne répète plus le prénom dans la section alimentation : la salutation reste en tête du suivi.

## Montrer la valeur de Plus — 4.0.10

L’accueil présente « Ma semaine prête » juste après son introduction. L’aperçu montre deux idées de plats explicitement non personnalisées, le reste de la semaine, les courses et le carnet à emporter. Le cadenas ouvre l’offre existante ; l’essai offert reste une action distincte. Le comparatif précise ce qui reste gratuit et ce que Plus ajoute. Aucun menu payant n’est généré pour afficher cet aperçu.

L’accès Plus actif remplace cette présentation par un accès direct à l’atelier. Le changement suit l’état serveur et le switch admin, sans modifier les droits, prix, achats ou données du carnet. Les anciens textes évoquant 100 recettes ont été alignés sur le catalogue de 1 000 recettes.

Constats SEO au 17 septembre 2026 : accueil pré-rendu, robots et sitemap accessibles, 394 URL publiées, titres/canonical/données structurées présents dans le générateur. Le contenu public reste centré sur l’alimentation ; calendrier, examens et offre Plus ne disposent pas encore de pages publiques dédiées dans le sitemap. Les écrans applicatifs en fragments ne remplacent pas ces pages. Ce contrôle ne mesure ni l’indexation Search Console, ni les performances réelles des visiteurs, ni le taux de conversion.

## Scanner depuis l’accueil Plus — 4.0.11

Le tableau de bord Plus met en avant le scan avec « Ce produit, je peux en manger enceinte ? ». Son bouton ouvre le scanner existant, avec caméra, photo ou saisie du code-barres. Le texte décrit les précautions repérées, ingrédients et allergènes déclarés, avec la limite des données collaboratives. Il ne promet pas une autorisation médicale binaire. La visibilité suit l’accès serveur et le switch admin ; les accès gratuits au scanner existant restent disponibles.

## Pages de présentation et découverte — 4.0.13

Trois pages HTML publiques expliquent le calendrier gratuit, le scan de produits et les accès Poum Plus : `/calendrier-grossesse/`, `/scanner-grossesse/`, `/poum-plus/`. Elles se lisent sans JavaScript, sont reliées depuis l’accueil et le guide et figurent dans le sitemap. Les prix proviennent de la configuration commune de l’offre. Les liens restent présents après le rendu de l’application. Aucun document personnel ni contenu de recette premium n’est publié.

Le titre de l’accueil met le suivi de grossesse au premier plan. Les informations d’indexation et la marche à suivre sont consignées dans `SEO.md` ; publier ces pages ne garantit pas leur indexation.

## Scan réservé à Plus — 4.0.12

Le scan caméra, la lecture de photo et la recherche par code-barres saisi à la main nécessitent un accès Plus actif. Les boutons ouvrent une offre explicite pour les comptes gratuits et les visiteurs. L’essai de menus n’inclut pas le scan ; la recherche de produits par nom reste gratuite. Les textes de l’offre distinguent ces accès.

Le serveur authentifie le compte et vérifie son accès effectif (switch admin compris) avant toute réponse par code-barres, même quand le produit est en cache interne. Les réponses par code-barres sont privées et non stockables par le navigateur/CDN ; la recherche publique par nom conserve son cache. Le navigateur transmet la session, ignore les anciens caches de codes-barres et n’utilise pas de repli direct vers Open Food Facts pour cette fonction. Les erreurs de configuration ne donnent pas accès au scan. Une perte d’accès ferme le scanner et retire les résultats du scan en cours. Les fiches déjà enregistrées au carnet sont conservées.

Validation : tests du contrat serveur pour visiteur, gratuit, payé, configuration absente, cache partagé et modes admin ; tests navigateur des offres, de la saisie, de la photo, de la caméra et de la conservation de la recherche gratuite par nom.
