# Direction visuelle et éditoriale

Version 3.4.0, septembre 2026. Le nom affiché reste provisoirement **Miamama**, en attendant le choix d’un nouveau nom. Cette version reprend la présentation, sans changer les identifiants des carnets ou les contenus médicaux.

## Ton

Écrire comme dans un carnet de cuisine : des mots usuels et des indications concrètes. Le vouvoiement reste cohérent dans l’application. Les questions concernent une action réelle : « Enceinte, je peux en manger ? », « Enceinte, on mange quoi ? », « Si un plat ne me plaît pas ? ».

Les commandes nomment leur résultat : ingrédients, préparation, mes favoris, ma liste de courses. Éviter les diminutifs systématiques, les slogans sur chaque écran, les formules répétées autour des « envies » et les promesses d’accompagnement personnel. Aucun témoignage, auteur, avis professionnel ou processus de relecture n’est inventé.

La grossesse est visible dès le premier écran : titre principal, symbole maternel et signature permanente « Alimentation & grossesse », y compris sur téléphone. Les cartes de recettes signalent leurs précautions grossesse, et les menus Plus gardent ce contexte. Les conseils restent des informations générales avec leurs sources et leurs limites.

## Couleurs et caractères

| Élément | Couleur |
| --- | --- |
| Texte | `#382b33` |
| Boutons et liens | `#542b43` |
| Fond | `#fff9f2` |
| Navigation | `#542b43` |
| Filets | `#e8dbd8` |
| Accents ponctuels | `#98513d` |

Lora est réservée aux titres et aux noms des plats ; DM Sans sert à la lecture et aux commandes. Les textes et formulaires sont plus grands, y compris sur téléphone. Les statuts alimentaires conservent des libellés et des symboles en plus des couleurs.

La navigation et l’encart Plus utilisent un aplat prune profond, avec des accents abricot (`#edaa84`). Les zones de lecture restent sur fond crème. Les sections se distinguent par l’espace et les filets ; les panneaux encadrés servent principalement aux formulaires, aux fiches et au choix d’abonnement. Pas d’étoiles décoratives, de collages de cartes inclinées ou d’animations de flottement.

## Photographies et illustrations

Les pages utilisent les photographies culinaires locales déjà documentées dans [les crédits](../CREDITS.md). Elles illustrent des idées de plats ; l’application ne prétend pas qu’elles montrent les recettes testées ou cuisinées par son équipe. Les ingrédients écrits et les précautions font référence.

Le [symbole vectoriel](mark.svg) et ses variantes d’installation reprennent la palette prune/abricot. Les petits SVG alimentaires sont conservés. Deux nouvelles illustrations éditoriales — [la maman à table](table-maternite-v4.png) et [le carnet de cuisine](carnet-cuisine-v4.png) — ont été créées avec l’outil intégré de génération d’images. Leur style évoque la gouache sur papier. [Prompts exacts et provenance](PROMPTS-V4.md). Les trois scènes de grossesse générées précédemment ne sont plus utilisées par l’interface ni précachées. Leurs fichiers et [leur provenance](PROMPTS.md) restent dans le dépôt comme archives de la version précédente.

## Pages

- **Accueil :** recherche immédiatement disponible, liens vers les aliments, une illustration de grossesse, puis une recette du catalogue et un encart Plus compact. Sur téléphone, l’illustration reste petite pour laisser la recherche visible.
- **Catalogue :** titre, portée du guide, accès aux sources, recherche et filtres. Les explications individuelles sont conservées.
- **Recettes :** recherche par ingrédient, petites vignettes de collections et dessin de carnet. L’accès à Plus tient sur une ligne compacte. Une recette par ligne sur les petits écrans pour garder les titres lisibles.
- **Plus :** un exemple de menu, les fonctions comprises, les deux prix et les questions pratiques. L’accueil présente l’offre à côté de la recherche. Les recettes distinguent les 20 gratuites et les 80 Plus. Les autres pages proposent un accès direct à l’offre, et le résultat de l’atelier montre les nombres effectivement obtenus.
- **Atelier :** préférences, repas, courses, enregistrement. Les intitulés suivent l’ordre des actions.

Les règles visuelles communes se trouvent dans `design.css`, chargé après les styles fonctionnels de `styles.css`. Les deux fichiers sont locaux, copiés par la compilation et précachés pour le mode hors connexion.
