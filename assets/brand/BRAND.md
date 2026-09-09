# Nidelle — Votre assiette & votre grossesse

Nidelle accompagne les petits choix alimentaires pendant la grossesse : comprendre un repère, préparer un repas et garder ses idées. La marque associe la maternité à une cuisine quotidienne gourmande, sans promesse de sécurité absolue.

## Signature et ton

**Nidelle** associe le « nid » à « elle » : un nom doux qui place la personne enceinte au centre de l’accompagnement. La marque se décline en **Nidelle Plus** pour l’offre de menus. Le logotype s’écrit `nidelle` en minuscules ; la signature descriptive reste « Votre assiette & votre grossesse ».

**« Bien dans l’assiette. Bien dans votre grossesse. »**

Vouvoiement chaleureux, phrases courtes, explications concrètes. Parler d’envies, de repas et de gestes possibles. Expliquer les précautions sans culpabiliser, sans présenter une source générale comme une validation propre à chaque aliment. Les quatre éléments d’une fiche : pourquoi, ce qui change la réponse, gestes en cuisine et références.

## Identité visuelle

| Élément | Valeur | Usage |
| --- | --- | --- |
| Sauge | `#496453` | Marque, boutons principaux |
| Sauge foncé | `#334d3d` | Titres et navigation active |
| Ivoire | `#fcfaf5` | Fond de l’application |
| Crème | `#fbf6ed` | Scènes illustrées |
| Terre cuite | `#9b5948` | Signature et accents |
| Pêche | `#ebc1a9` | Aplats décoratifs |
| Texte | `#354237` | Lecture |

**Lora** pour la signature et les titres, **DM Sans** pour les explications et les commandes. Polices hébergées localement. Les couleurs des statuts gardent leur sens et sont accompagnées d’un libellé et d’un symbole.

Le symbole `mark.svg` évoque une personne enceinte tenant son ventre, avec un cœur. Utiliser ce fichier vectoriel comme référence. Les versions PNG servent à l’installation sur l’écran d’accueil ; la version 512 px conserve une marge adaptée au masque des icônes mobiles.

## Illustrations

Trois scènes originales à la gouache numérique, grain de papier, formes souples et palette coordonnée. La grossesse est visible, avec des postures naturelles et une place pour le quotidien. Les images sont décoratives ; les consignes alimentaires restent écrites.

| Fichier | Placement | Format |
| --- | --- | --- |
| [pregnancy-hero.webp](pregnancy-hero.webp) | Accueil : femme enceinte à table | 1000 × 1000 |
| [pregnancy-foods.webp](pregnancy-foods.webp) | Catalogue et guide : panier de fruits et légumes | 700 × 700 |
| [pregnancy-notebook.webp](pregnancy-notebook.webp) | Menus, carnet et états vides | 700 × 700 |
| [mark.svg](mark.svg) | Logo et favicon | SVG |
| [icon-192.png](icon-192.png), [icon-512.png](icon-512.png) | Icône d’application | PNG |

Les scènes ont été créées avec l’outil intégré **imagegen**. Les [prompts complets](PROMPTS.md) sont conservés pour prolonger la direction artistique. Compression WebP après génération, fichiers locaux et précachés pour le mode hors connexion.

Les petites illustrations alimentaires restent des SVG natifs dans `js/icons.js`. Le catalogue étend ce vocabulaire avec notamment ananas, patate douce, poire, agrumes, cerise, kiwi, aubergine, poivron, courge et asperges. Certaines icônes représentent une famille d’aliments.

## Mise en page

Sur ordinateur, la scène principale accompagne le texte sur deux colonnes. Sur téléphone, le texte précède une illustration pleine largeur. Le catalogue affiche 48 aliments à la fois avec un bouton explicite pour continuer. Les fiches conservent une lecture verticale, des sources cliquables et des commandes accessibles au clavier.
