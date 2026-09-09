(function (root) {
  'use strict';
  const sources = {
    ameli: { name: 'Assurance Maladie', title: 'Aliments à éviter et hygiène pendant la grossesse', url: 'https://www.ameli.fr/assure/sante/devenir-parent/grossesse/grossesse-en-bonne-sante/grossesse-alimentation/les-aliments-eviter-et-les-precautions-d-hygiene-pendant-la-grossesse' },
    toxo: { name: 'Assurance Maladie', title: 'Prévenir la toxoplasmose', url: 'https://www.ameli.fr/assure/sante/themes/toxoplasmose/prevention' },
    nutrition: { name: 'Assurance Maladie', title: 'Adapter son alimentation pendant la grossesse', url: 'https://www.ameli.fr/assure/sante/devenir-parent/grossesse/grossesse-en-bonne-sante/grossesse-alimentation/alimentation-grossesse' },
    spf: { name: 'Santé publique France · Manger Bouger', title: 'Les précautions alimentaires pendant la grossesse', url: 'https://www.mangerbouger.fr/manger-mieux/a-tout-age-et-a-chaque-etape-de-la-vie/les-recommandations-et-conseils-avant-pendant-et-apres-la-grossesse/quels-aliments-eviter-et-quelles-precautions-prendre-quand-on-est-enceinte' },
    ministry: { name: 'Ministère de la Santé', title: 'Réduire les risques alimentaires', url: 'https://sante.gouv.fr/archives/archives-presse/archives-breves/article/femmes-enceintes-et-jeunes-enfants-comment-reduire-les-risques-alimentaires' },
    agriculture: { name: 'Ministère de l’Agriculture', title: 'Manger cru : risques et prévention', url: 'https://agriculture.gouv.fr/manger-cru-quels-sont-les-risques-et-comment-les-eviter' },
    efsa: { name: 'EFSA', title: 'La caféine dans l’alimentation', url: 'https://www.efsa.europa.eu/fr/topics/topic/caffeine' },
    off: { name: 'Open Food Facts', title: 'Base collaborative de produits alimentaires', url: 'https://world.openfoodfacts.org/' },
    temperature: { name: 'FoodSafety.gov · autorités sanitaires américaines', title: 'Températures minimales de cuisson, notamment 74 °C pour la volaille', url: 'https://www.foodsafety.gov/food-safety-charts/safe-minimum-internal-temperatures' }
  };
  const statuses = {
    compatible: { label: 'Compatible', short: 'Compatible', icon: 'check', description: 'Compatible dans les conditions de préparation indiquées, en respectant l’hygiène et la conservation.' },
    precaution: { label: 'Avec précautions', short: 'Avec précautions', icon: 'info', description: 'La cuisson, le lavage ou les indications de l’étiquette doivent être vérifiés avant de consommer.' },
    limit: { label: 'À limiter', short: 'À limiter', icon: 'clock', description: 'La quantité ou la fréquence compte, en plus des précautions de préparation.' },
    avoid: { label: 'À éviter', short: 'À éviter', icon: 'close', description: 'À écarter sous la forme décrite. Consultez les alternatives proposées.' },
    unknown: { label: 'À vérifier', short: 'À vérifier', icon: 'search', description: 'Les informations disponibles ne suffisent pas à conclure. Aucune absence de risque n’est déduite.' }
  };
  const categories = [
    { id: 'all', label: 'Tout explorer', icon: 'grid' },
    { id: 'produce', label: 'Fruits & légumes', icon: 'apple' },
    { id: 'dairy', label: 'Produits laitiers', icon: 'milk' },
    { id: 'protein', label: 'Viandes & œufs', icon: 'meat' },
    { id: 'fish', label: 'Poissons', icon: 'fish' },
    { id: 'pantry', label: 'Épicerie', icon: 'bread' },
    { id: 'drinks', label: 'Boissons', icon: 'cup' }
  ];
  const groups = {
    produce: { status: 'compatible', reason: 'Un végétal peut porter de la terre. Le lavage reste nécessaire, y compris avant de l’éplucher.', preparation: ['Rincer soigneusement à l’eau potable, en retirant toute trace de terre.', 'Utiliser des mains et ustensiles propres. Si le lavage est incertain, préférer une préparation cuite.'], sources: ['toxo'] },
    vegetables: { status: 'compatible', reason: 'Ces légumes ont leur place dans une alimentation variée.', preparation: ['Laver soigneusement, puis cuire selon votre recette.', 'Séparer les végétaux lavés des aliments crus non préparés.'], sources: ['toxo', 'nutrition'] },
    grains: { status: 'compatible', reason: 'Les céréales et légumes secs permettent de varier les repas selon votre appétit.', preparation: ['Cuire selon les instructions du paquet ; ne pas consommer de pâte ou farine crue.', 'Réfrigérer rapidement les restes et bien les réchauffer.'], sources: ['nutrition', 'spf'] },
    nuts: { status: 'compatible', reason: 'À intégrer à une alimentation variée si vous n’y êtes pas allergique.', preparation: ['Choisir des fruits à coque nature, non moisis, dans un emballage intact.', 'Respecter vos allergies et les conditions de conservation.'], sources: ['nutrition'] },
    dairy: { status: 'precaution', reason: 'Pour ce type de produit laitier frais, la pasteurisation et la conservation sont à vérifier.', preparation: ['Choisir explicitement du lait pasteurisé ou un produit UHT.', 'Respecter la chaîne du froid, la date limite et le délai indiqué après ouverture.'], sources: ['ministry'] },
    hardCheese: { status: 'compatible', reason: 'Les pâtes pressées cuites font partie des fromages possibles pendant la grossesse.', preparation: ['Retirer la croûte avec un couteau propre.', 'Acheter un morceau emballé et le râper vous-même si nécessaire.'], sources: ['agriculture', 'spf'] },
    softCheese: { status: 'avoid', reason: 'Ces fromages à pâte molle ou à affinage court sont à éviter consommés froids, même pasteurisés.', preparation: ['Choisir plutôt un fromage à pâte pressée cuite, sans croûte.', 'Une recette avec du fromage nécessite une cuisson complète ; simplement fondu ou tiédi ne suffit pas.'], sources: ['spf'] },
    rawMilk: { status: 'avoid', reason: 'Le lait cru expose à des infections alimentaires.', preparation: ['Remplacer par du lait pasteurisé ou UHT.', 'La mention « thermisé » n’équivaut pas à « pasteurisé ».'], sources: ['agriculture'] },
    meat: { status: 'precaution', reason: 'La viande doit être cuite à cœur. Une marinade ou une congélation ne remplace pas cette précaution.', preparation: ['Cuire entièrement, sans centre cru ni jus rosé ; suivre les instructions du produit.', 'Nettoyer planche, couteau et mains après manipulation de viande crue.'], sources: ['toxo', 'ministry'] },
    rawMeat: { status: 'avoid', reason: 'La viande crue ou peu cuite et les charcuteries sèches sont à écarter.', preparation: ['Préférer une viande fraîche entièrement cuite.', 'Être immunisée contre la toxoplasmose ne protège pas des autres infections alimentaires.'], sources: ['toxo', 'ministry'] },
    deli: { status: 'avoid', reason: 'Ces charcuteries réfrigérées prêtes à manger peuvent présenter un risque de listériose.', preparation: ['Éviter leur consommation froide.', 'Pour le jambon blanc, choisir plutôt une recette où il est recuit à cœur, comme un gratin.'], sources: ['spf'] },
    eggs: { status: 'precaution', reason: 'La précaution porte sur la salmonellose : le blanc et le jaune doivent être fermes.', preparation: ['Préparer des œufs durs ou une omelette cuite entièrement.', 'Éviter les préparations maison avec des œufs crus.'], sources: ['spf', 'agriculture'] },
    rawEggs: { status: 'avoid', reason: 'Ces préparations maison contiennent habituellement des œufs non cuits.', preparation: ['Choisir une recette sans œuf cru, ni alcool.', 'Pour une version industrielle, vérifier l’étiquette et les conditions de conservation.'], sources: ['spf'] },
    fish: { status: 'precaution', reason: 'Le poisson se consomme bien cuit. Varier les espèces et les provenances.', preparation: ['Cuire à cœur et servir bien chaud ; éviter cru, fumé ou mariné.', 'Repère général : deux repas de poisson par semaine, dont un poisson gras.'], sources: ['spf'] },
    rawFish: { status: 'avoid', reason: 'Le cru et le fumage ne suppriment pas les risques infectieux.', preparation: ['Remplacer par du poisson frais bien cuit.', 'La congélation ne détruit pas Listeria.'], sources: ['ministry', 'spf'] },
    shellfish: { status: 'precaution', reason: 'Les coquillages et crustacés demandent une provenance contrôlée et une cuisson complète.', preparation: ['Acheter auprès d’un circuit contrôlé, respecter la conservation et bien cuire.', 'Éviter les crustacés déjà décortiqués vendus cuits au rayon frais.'], sources: ['agriculture', 'spf'] },
    mercury: { status: 'limit', reason: 'Certains poissons accumulent davantage de mercure. La cuisson ne retire pas ce contaminant.', preparation: ['Limiter la fréquence et alterner avec sardine, saumon ou cabillaud.', 'Cette précaution vaut aussi pour le thon en conserve.'], sources: ['ameli'] },
    highMercury: { status: 'avoid', reason: 'Ces grands prédateurs sont à éviter pendant la grossesse en raison du mercure.', preparation: ['Choisir une autre espèce, bien cuite.', 'Cuire, congeler ou mettre en conserve ne retire pas le mercure.'], sources: ['ameli'] },
    caffeine: { status: 'limit', reason: 'Additionner la caféine de toutes les sources : café, thé, cola, chocolat…', preparation: ['Repère EFSA pendant la grossesse : au maximum 200 mg de caféine par jour, toutes sources confondues.', 'La teneur varie beaucoup. Consulter l’étiquette ou choisir du décaféiné.'], sources: ['efsa'] },
    alcohol: { status: 'avoid', reason: 'Le repère est zéro alcool pendant toute la grossesse, y compris dans les desserts et plats.', preparation: ['Utiliser du bouillon ou de l’eau à la place du vin en cuisine.', 'La cuisson ne garantit pas l’élimination de l’alcool.'], sources: ['spf', 'nutrition'] },
    soy: { status: 'avoid', reason: 'Les recommandations françaises actuelles déconseillent les aliments à base de soja par précaution.', preparation: ['Varier les protéines avec des lentilles ou pois chiches.', 'La sauce soja relève d’un usage occasionnel distinct.'], sources: ['ameli'] },
    sprouts: { status: 'avoid', reason: 'Les graines germées consommées crues peuvent être contaminées.', preparation: ['Ne pas les ajouter crues dans un sandwich ou une salade.', 'Choisir des légumes lavés puis cuits.'], sources: ['ameli'] },
    sweet: { status: 'limit', reason: 'Les produits sucrés se consomment en quantité modérée dans une alimentation variée.', preparation: ['Consulter la composition, notamment la présence d’alcool ou de caféine.', 'Respecter vos éventuelles consignes médicales personnalisées.'], sources: ['nutrition', 'efsa'] }
  };
  // An editorial guide, deliberately separate from the collaborative OFF database.
  const entries = [
    ['avocado', 'Avocat', 'produce', 'avocado', 'produce', 'Bien lavé, puis épluché', 'avocats guacamole'],
    ['salmon', 'Saumon frais', 'fish', 'salmon', 'fish', 'Oui, lorsqu’il est bien cuit', 'saumons salmon'],
    ['mozzarella', 'Mozzarella', 'dairy', 'mozzarella', 'dairy', 'Au lait pasteurisé, à vérifier', 'mozza burrata'],
    ['eggs', 'Œufs', 'protein', 'eggs', 'eggs', 'Blanc et jaune bien cuits', 'oeuf oeufs omelette egg'],
    ['strawberries', 'Fraises', 'produce', 'berries', 'produce', 'Un bon lavage, et à savourer', 'fraise fruits rouges'],
    ['brie', 'Brie & camembert', 'dairy', 'cheese', 'softCheese', 'À éviter consommés froids', 'brie camembert croûte fleurie'],
    ['broccoli', 'Brocoli', 'produce', 'veggies', 'vegetables', 'Bien lavé, délicieux à la vapeur', 'brocolis'],
    ['yogurt', 'Yaourt nature', 'dairy', 'milk', 'dairy', 'Vérifier le lait pasteurisé', 'yaourts yogourt yogurt'],
    ['apple', 'Pomme', 'produce', 'apple', 'produce', 'Lavée avant de la croquer', 'pommes'],
    ['banana', 'Banane', 'produce', 'banana', 'produce', 'Laver la peau avant de l’éplucher', 'bananes'],
    ['tomato', 'Tomate', 'produce', 'tomato', 'produce', 'Bien laver, même les tomates cerises', 'tomates'],
    ['spinach', 'Épinards', 'produce', 'leafy', 'vegetables', 'Lavés puis cuits', 'epinard spinach'],
    ['carrot', 'Carottes', 'produce', 'carrot', 'produce', 'Bien lavées et épluchées', 'carotte'],
    ['zucchini', 'Courgette', 'produce', 'zucchini', 'vegetables', 'Rôtie, vapeur ou en velouté', 'courgettes'],
    ['lettuce', 'Salade verte', 'produce', 'leafy', 'produce', 'Seulement si le lavage est maîtrisé', 'laitue mâche roquette crudités'],
    ['raspberry', 'Framboises', 'produce', 'berries', 'produce', 'Rincer soigneusement à l’eau potable', 'framboise myrtilles'],
    ['melon', 'Melon', 'produce', 'melon', 'produce', 'Laver la peau avant de le couper', 'pastèque'],
    ['potato', 'Pommes de terre', 'produce', 'potato', 'vegetables', 'Bien cuites, sans parties vertes', 'patate pomme de terre'],
    ['mushroom', 'Champignons de culture', 'produce', 'mushroom', 'vegetables', 'Nettoyés et bien cuits', 'champignon de paris'],
    ['sprouts', 'Graines germées crues', 'produce', 'veggies', 'sprouts', 'À éviter dans une salade', 'alfalfa luzerne pousses germes'],
    ['milk', 'Lait pasteurisé ou UHT', 'dairy', 'milk', 'dairy', 'Respecter la conservation', 'lait entier demi écrémé'],
    ['raw-milk', 'Lait cru', 'dairy', 'milk', 'rawMilk', 'Préférer le lait pasteurisé', 'lait non pasteurisé'],
    ['comte', 'Comté & emmental', 'dairy', 'cheese', 'hardCheese', 'Sans la croûte, en morceau', 'gruyère beaufort emmenthal'],
    ['parmesan', 'Parmesan en morceau', 'dairy', 'cheese', 'hardCheese', 'À râper vous-même, sans croûte', 'parmigiano reggiano'],
    ['feta', 'Feta', 'dairy', 'cheese', 'dairy', 'Vérifier la pasteurisation', 'féta'],
    ['ricotta', 'Ricotta', 'dairy', 'mozzarella', 'dairy', 'Au lait pasteurisé et bien conservée', 'fromage frais'],
    ['goat', 'Chèvre à croûte fleurie', 'dairy', 'cheese', 'softCheese', 'À éviter consommé froid', 'bûche crottin chèvre'],
    ['roquefort', 'Roquefort & bleu', 'dairy', 'cheese', 'softCheese', 'Choisir un fromage à pâte pressée cuite', 'gorgonzola fourme bleu'],
    ['reblochon', 'Reblochon & morbier', 'dairy', 'cheese', 'softCheese', 'À éviter sans cuisson complète', 'tartiflette'],
    ['cream', 'Crème fraîche pasteurisée', 'dairy', 'milk', 'dairy', 'Vérifier l’étiquette et la DLC', 'crème liquide beurre pasteurisé'],
    ['chicken', 'Poulet', 'protein', 'poultry', 'meat', 'Entièrement cuit à cœur', 'volaille poulets'],
    ['turkey', 'Dinde', 'protein', 'poultry', 'meat', 'Sans partie crue à cœur', 'escalope'],
    ['beef', 'Bœuf', 'protein', 'meat', 'meat', 'Bien cuit, jamais saignant', 'boeuf steak viande rouge'],
    ['ground-beef', 'Steak haché', 'protein', 'meat', 'meat', 'Bien cuit jusque dans le centre', 'hamburger burger viande hachée'],
    ['pork', 'Porc', 'protein', 'meat', 'meat', 'À cuire entièrement', 'côte de porc rôti'],
    ['tartare', 'Tartare & carpaccio de viande', 'protein', 'meat', 'rawMeat', 'La viande crue est à éviter', 'tartare boeuf carpaccio'],
    ['salami', 'Saucisson & jambon cru', 'protein', 'meat', 'rawMeat', 'Le séchage ne remplace pas la cuisson', 'saucisson sec salami chorizo prosciutto'],
    ['ham', 'Jambon blanc froid', 'protein', 'meat', 'deli', 'À recuire à cœur dans une recette', 'jambon cuit'],
    ['pate', 'Pâté & rillettes réfrigérés', 'protein', 'meat', 'deli', 'À éviter prêts à consommer', 'pate terrine foie gras réfrigéré'],
    ['cod', 'Cabillaud', 'fish', 'fish', 'fish', 'Bien cuit à cœur', 'colin merlu lieu morue'],
    ['trout', 'Truite fraîche', 'fish', 'fish', 'fish', 'Bien cuite, pas fumée', 'truite'],
    ['sardines', 'Sardines fraîches', 'fish', 'fish', 'fish', 'Bien cuites, pour varier les poissons', 'sardine maquereau hareng'],
    ['smoked-salmon', 'Saumon fumé', 'fish', 'salmon', 'rawFish', 'À éviter tel quel', 'truite fumée gravlax'],
    ['sushi', 'Sushi au poisson cru', 'fish', 'salmon', 'rawFish', 'Préférer une version entièrement cuite', 'sashimi ceviche poisson cru tarama'],
    ['shrimp', 'Crevettes crues à cuire', 'fish', 'fish', 'shellfish', 'Bien cuire, puis décortiquer', 'crevette gambas crustacé'],
    ['mussels', 'Moules à cuire', 'fish', 'fish', 'shellfish', 'Provenance contrôlée et cuisson complète', 'moule coquillage'],
    ['oysters', 'Huîtres crues', 'fish', 'fish', 'rawFish', 'Les coquillages crus sont à éviter', 'huitre huître'],
    ['tuna', 'Thon, même en conserve', 'fish', 'fish', 'mercury', 'À limiter et à varier', 'thon albacore tuna'],
    ['seabass', 'Bar & dorade', 'fish', 'fish', 'mercury', 'Limiter ces poissons prédateurs', 'lotte baudroie raie flétan'],
    ['swordfish', 'Espadon & requin', 'fish', 'fish', 'highMercury', 'À éviter, même cuits', 'espadon marlin siki saumonette lamproie'],
    ['lentils', 'Lentilles', 'pantry', 'beans', 'grains', 'Bien cuites, en salade ou en dhal', 'lentille lentilles corail'],
    ['chickpeas', 'Pois chiches', 'pantry', 'beans', 'grains', 'Bien cuits ou en conserve', 'pois chiche houmous maison cuit'],
    ['quinoa', 'Quinoa', 'pantry', 'beans', 'grains', 'Rincer puis cuire selon le paquet', 'céréales'],
    ['rice', 'Riz', 'pantry', 'beans', 'grains', 'Cuit, puis rapidement réfrigéré', 'riz complet basmati'],
    ['pasta', 'Pâtes', 'pantry', 'bread', 'grains', 'Cuites, avec une sauce adaptée', 'spaghetti penne pâtes complètes'],
    ['bread', 'Pain complet', 'pantry', 'bread', 'grains', 'Un pain bien cuit, selon votre appétit', 'pain baguette céréales'],
    ['oats', 'Flocons d’avoine', 'pantry', 'beans', 'grains', 'En porridge bien chaud', 'avoine oatmeal porridge'],
    ['almonds', 'Amandes & noix', 'pantry', 'nuts', 'nuts', 'Nature, si vous n’êtes pas allergique', 'noisette noix de cajou pistaches fruits à coque'],
    ['chocolate', 'Chocolat', 'pantry', 'sweet', 'sweet', 'Un plaisir à modérer', 'cacao chocolat noir lait'],
    ['mousse', 'Mousse & tiramisu maison', 'pantry', 'sweet', 'rawEggs', 'À éviter avec des œufs crus', 'mousse chocolat tiramisu'],
    ['mayonnaise', 'Mayonnaise maison', 'pantry', 'bowl', 'rawEggs', 'À éviter avec de l’œuf cru', 'mayo sauce oeuf cru'],
    ['tofu', 'Tofu & tempeh', 'pantry', 'cheese', 'soy', 'Le soja est déconseillé par précaution', 'soja tofu tempeh edamame'],
    ['water', 'Eau potable', 'drinks', 'water', null, 'La boisson à privilégier', 'eau minérale eau pétillante'],
    ['coffee', 'Café', 'drinks', 'drink', 'caffeine', 'Tenir compte de toute la caféine', 'espresso expresso café filtre'],
    ['tea', 'Thé & matcha', 'drinks', 'drink', 'caffeine', 'La théine est aussi de la caféine', 'thé vert thé noir matcha'],
    ['cola', 'Cola', 'drinks', 'drink', 'caffeine', 'Caféine et sucre à prendre en compte', 'soda coca pepsi'],
    ['energy-drink', 'Boissons énergisantes', 'drinks', 'can', null, 'Déconseillées pendant la grossesse', 'red bull monster energy'],
    ['wine', 'Vin, bière & spiritueux', 'drinks', 'wine', 'alcohol', 'Le repère : zéro alcool', 'alcool vin bière cidre rhum champagne'],
    ['soy-drink', 'Boisson au soja', 'drinks', 'milk', 'soy', 'Préférer une autre boisson', 'lait soja boisson soja'],
    ['herbal-tea', 'Tisanes & plantes', 'drinks', 'drink', null, 'Vérifier chaque plante avec un professionnel', 'tisane infusion plantes huiles essentielles']
  ];
  const foods = entries.map(([id, name, category, art, group, summary, aliases]) => ({
    id, name, category, art, group, summary, aliases, origin: 'guide',
    ...(groups[group] || { status: 'unknown', reason: 'La composition ou l’usage demande un avis individualisé.', preparation: ['Demander conseil à votre pharmacien, médecin ou sage-femme avant de consommer des plantes ou extraits.'], sources: ['ameli'] })
  }));
  Object.assign(foods.find(f => f.id === 'water'), { status: 'compatible', reason: 'L’eau potable est la boisson de référence pendant la grossesse.', preparation: ['Boire régulièrement selon votre soif.', 'Utiliser une eau destinée à la consommation humaine.'], sources: ['nutrition'] });
  Object.assign(foods.find(f => f.id === 'energy-drink'), { status: 'avoid', reason: 'Les boissons énergisantes sont déconseillées pendant la grossesse.', preparation: ['Préférer de l’eau.', 'Ne pas les confondre avec les boissons de réhydratation prescrites.'], sources: ['nutrition'] });
  const ingredient = (name, quantity, unit = '') => ({ name, quantity, unit });
  const recipes = [
    {
      id: 'sunny-bowl', title: 'Bowl de quinoa, douceur d’avocat', subtitle: 'Du croquant, de la couleur et un peu de soleil.', image: 'bowl', time: 25, type: 'lunch', vegetarian: true, tags: ['Végétarien', 'Tout en couleur'], foods: ['avocado', 'quinoa', 'chickpeas', 'carrot'], servings: 2,
      ingredients: [ingredient('Quinoa sec', 120, 'g'), ingredient('Pois chiches cuits égouttés', 200, 'g'), ingredient('Avocat', 1), ingredient('Carotte', 2), ingredient('Citron', 0.5), ingredient('Huile d’olive', 2, 'c. à soupe')],
      steps: ['Lavez les végétaux et le citron. Épluchez les carottes et coupez-les en fines lamelles.', 'Rincez le quinoa et cuisez-le dans l’eau selon le paquet. Réchauffez les pois chiches.', 'Lavez la peau de l’avocat avant de le couper avec un couteau propre, puis retirez la peau et le noyau.', 'Répartissez les ingrédients dans deux bols. Ajoutez le jus de citron et l’huile d’olive. Servez aussitôt.'],
      safety: 'Lavez soigneusement les crudités. Si leur lavage est incertain, cuisez les carottes et remplacez l’avocat par un légume cuit.', allergens: 'Aucun des 14 allergènes réglementés dans les ingrédients proposés ; vérifier les étiquettes et les traces.'
    },
    {
      id: 'lemon-salmon', title: 'Saumon au four & légumes rôtis', subtitle: 'Le dîner tout simple qui fait du bien.', image: 'salmon', time: 35, type: 'dinner', vegetarian: false, tags: ['Au four', 'Facile'], foods: ['salmon', 'broccoli', 'carrot', 'potato'], servings: 2,
      ingredients: [ingredient('Pavé de saumon frais', 2), ingredient('Pomme de terre', 4), ingredient('Brocoli', 1), ingredient('Citron', 0.5), ingredient('Huile d’olive', 2, 'c. à soupe')],
      steps: ['Préchauffez le four à 200 °C. Lavez les légumes et le citron. Épluchez les pommes de terre et coupez-les en petits morceaux.', 'Mélangez les pommes de terre et le brocoli en fleurettes avec l’huile. Enfournez pour environ 15 minutes.', 'Ajoutez le saumon frais et le citron. Poursuivez la cuisson environ 15 à 20 minutes, selon l’épaisseur du poisson.', 'Vérifiez que le poisson est entièrement cuit à cœur, opaque et se détache en lamelles ; prolongez si nécessaire. Servez chaud.'],
      safety: 'Utilisez du saumon frais, entièrement cuit à cœur. Le temps est indicatif et dépend de l’épaisseur et du four.', allergens: 'Poisson.'
    },
    {
      id: 'green-pasta', title: 'Pâtes crémeuses aux petits légumes', subtitle: 'Un grand oui au réconfort.', image: 'pasta', time: 20, type: 'dinner', vegetarian: true, tags: ['20 minutes', 'Végétarien'], foods: ['pasta', 'zucchini', 'cream', 'parmesan'], servings: 2,
      ingredients: [ingredient('Pâtes complètes sèches', 160, 'g'), ingredient('Courgette', 2), ingredient('Crème pasteurisée', 100, 'ml'), ingredient('Parmesan en morceau sans croûte', 30, 'g'), ingredient('Huile d’olive', 1, 'c. à soupe')],
      steps: ['Lavez les courgettes et coupez-les en petits dés. Faites-les cuire dans l’huile environ 10 minutes.', 'Cuisez les pâtes selon le paquet. Gardez un peu d’eau de cuisson avant de les égoutter.', 'Ajoutez la crème pasteurisée aux légumes et faites chauffer le tout. Détendez la sauce avec un peu d’eau de cuisson.', 'Mélangez aux pâtes et râpez vous-même le parmesan sans croûte. Servez bien chaud.'],
      safety: 'Choisissez une crème pasteurisée bien conservée et du parmesan en morceau, à râper juste avant usage.', allergens: 'Blé (gluten), lait. Œuf possible selon les pâtes.'
    },
    {
      id: 'morning-porridge', title: 'Porridge poire & amandes', subtitle: 'Pour les matins qui prennent leur temps.', image: 'porridge', time: 12, type: 'breakfast', vegetarian: true, tags: ['Petit-déjeuner', 'Express'], foods: ['oats', 'milk', 'almonds'], servings: 2,
      ingredients: [ingredient('Flocons d’avoine', 80, 'g'), ingredient('Lait UHT', 400, 'ml'), ingredient('Poire', 2), ingredient('Amandes nature', 20, 'g'), ingredient('Cannelle', 0.5, 'c. à café')],
      steps: ['Lavez, épluchez et coupez les poires en petits dés.', 'Versez l’avoine, le lait UHT et la poire dans une casserole.', 'Faites frémir pendant 8 à 10 minutes en remuant, jusqu’à ce que les flocons soient cuits et la poire tendre.', 'Répartissez dans des bols avec les amandes et une petite pincée de cannelle culinaire.'],
      safety: 'Utilisez du lait pasteurisé ou UHT et respectez les allergies aux fruits à coque.', allergens: 'Lait, amandes, avoine (gluten possible : vérifier la certification).'
    },
    {
      id: 'lentil-soup', title: 'Velouté de lentilles corail & carotte', subtitle: 'Une cuillère de douceur, tout simplement.', image: 'soup', time: 30, type: 'dinner', vegetarian: true, tags: ['Végétarien', 'À la cuillère'], foods: ['lentils', 'carrot'], servings: 2,
      ingredients: [ingredient('Lentilles corail sèches', 140, 'g'), ingredient('Carotte', 3), ingredient('Oignon', 1), ingredient('Eau', 650, 'ml'), ingredient('Huile d’olive', 1, 'c. à soupe'), ingredient('Cumin moulu', 0.5, 'c. à café')],
      steps: ['Lavez et épluchez les carottes. Épluchez l’oignon puis émincez les légumes.', 'Faites revenir l’oignon dans l’huile. Ajoutez les carottes, les lentilles rincées et le cumin.', 'Couvrez avec l’eau. Laissez cuire environ 25 minutes, jusqu’à ce que légumes et lentilles soient tendres.', 'Mixez selon la texture souhaitée. Ajoutez un peu d’eau si nécessaire et servez chaud.'],
      safety: 'Cuisez les lentilles complètement. Refroidissez rapidement les portions gardées pour plus tard et placez-les au réfrigérateur.', allergens: 'Aucun des 14 allergènes réglementés dans les ingrédients proposés ; vérifier les étiquettes et les traces.'
    },
    {
      id: 'roasted-chickpeas', title: 'Légumes rôtis & pois chiches dorés', subtitle: 'Le four s’occupe presque de tout.', image: 'vegetables', time: 35, type: 'lunch', vegetarian: true, tags: ['Au four', 'Végétarien'], foods: ['chickpeas', 'zucchini', 'carrot'], servings: 2,
      ingredients: [ingredient('Pois chiches cuits égouttés', 300, 'g'), ingredient('Courgette', 2), ingredient('Carotte', 3), ingredient('Huile d’olive', 2, 'c. à soupe'), ingredient('Paprika doux', 1, 'c. à café')],
      steps: ['Préchauffez le four à 200 °C. Lavez et préparez les légumes en petits morceaux réguliers.', 'Égouttez les pois chiches en conserve et rincez-les. Déposez-les dans un plat avec les légumes.', 'Ajoutez l’huile et le paprika. Mélangez et cuisez environ 30 minutes, en remuant à mi-cuisson.', 'Vérifiez que les légumes sont tendres et servez avec du pain complet selon votre appétit.'],
      safety: 'Choisissez une conserve intacte et cuisez les légumes. Les photos de recettes sont des illustrations : suivez les ingrédients indiqués.', allergens: 'Aucun des 14 allergènes réglementés dans la recette de base ; blé si vous ajoutez du pain.'
    },
    {
      id: 'spinach-frittata', title: 'Frittata aux épinards & pommes de terre', subtitle: 'Un classique généreux à partager.', image: 'vegetables', time: 35, type: 'lunch', vegetarian: true, tags: ['À partager', 'Végétarien'], foods: ['eggs', 'spinach', 'potato', 'milk'], servings: 2,
      ingredients: [ingredient('Œuf', 4), ingredient('Pomme de terre', 2), ingredient('Épinards frais', 150, 'g'), ingredient('Lait UHT', 50, 'ml'), ingredient('Huile d’olive', 1, 'c. à soupe')],
      steps: ['Lavez les légumes. Épluchez les pommes de terre, coupez-les et cuisez-les à l’eau jusqu’à tendreté.', 'Préchauffez le four à 180 °C. Faites revenir les épinards dans l’huile jusqu’à ce qu’ils soient cuits.', 'Battez les œufs avec le lait UHT. Mélangez avec les légumes dans un petit plat huilé.', 'Cuisez environ 20 minutes. Le centre doit être totalement pris, sans œuf liquide ; prolongez si besoin. Servez bien chaud.'],
      safety: 'Les œufs doivent être intégralement cuits, au centre comme sur les bords.', allergens: 'Œuf, lait.'
    },
    {
      id: 'apple-oat', title: 'Pommes au four, crumble d’avoine', subtitle: 'La petite douceur de l’après-midi.', image: 'porridge', time: 30, type: 'snack', vegetarian: true, tags: ['Goûter', 'Tout doux'], foods: ['apple', 'oats', 'almonds'], servings: 2,
      ingredients: [ingredient('Pomme', 2), ingredient('Flocons d’avoine', 40, 'g'), ingredient('Poudre d’amande', 20, 'g'), ingredient('Beurre pasteurisé', 20, 'g'), ingredient('Sucre', 10, 'g')],
      steps: ['Préchauffez le four à 180 °C. Lavez et épluchez les pommes, retirez les pépins puis coupez-les.', 'Répartissez les fruits dans deux ramequins.', 'Mélangez l’avoine, la poudre d’amande, le beurre et le sucre jusqu’à obtenir des miettes.', 'Couvrez les fruits puis cuisez environ 25 minutes, jusqu’à tendreté des pommes et cuisson du crumble.'],
      safety: 'Utilisez du beurre pasteurisé et vérifiez vos allergies. Ce dessert est une idée de plaisir, à adapter à votre appétit.', allergens: 'Lait, amandes, avoine (gluten possible).'
    },
    {
      id: 'cod-rice', title: 'Cabillaud citronné & riz moelleux', subtitle: 'Peu d’ingrédients, beaucoup de simplicité.', image: 'salmon', time: 30, type: 'dinner', vegetarian: false, tags: ['Facile', 'Au four'], foods: ['cod', 'rice', 'zucchini'], servings: 2,
      ingredients: [ingredient('Filet de cabillaud', 2), ingredient('Riz sec', 140, 'g'), ingredient('Courgette', 2), ingredient('Citron', 0.5), ingredient('Huile d’olive', 1, 'c. à soupe')],
      steps: ['Préchauffez le four à 190 °C. Lavez les courgettes et le citron.', 'Coupez les courgettes en petits dés et mettez-les dans un plat huilé. Cuisez-les 10 minutes.', 'Ajoutez les filets et le citron, puis cuisez environ 15 à 20 minutes, jusqu’à cuisson complète du poisson à cœur.', 'Pendant ce temps, cuisez le riz selon les instructions du paquet. Servez le tout chaud.'],
      safety: 'Le poisson doit être entièrement cuit ; prolongez selon l’épaisseur. Le temps n’est pas une garantie de cuisson.', allergens: 'Poisson.'
    },
    {
      id: 'tomato-pasta', title: 'Pâtes à la tomate & ricotta', subtitle: 'Un petit goût d’Italie, chez vous.', image: 'pasta', time: 25, type: 'dinner', vegetarian: true, tags: ['Facile', 'Végétarien'], foods: ['pasta', 'tomato', 'ricotta'], servings: 2,
      ingredients: [ingredient('Pâtes sèches', 160, 'g'), ingredient('Tomates concassées en conserve', 400, 'g'), ingredient('Ricotta au lait pasteurisé', 100, 'g'), ingredient('Oignon', 1), ingredient('Huile d’olive', 1, 'c. à soupe')],
      steps: ['Épluchez et émincez l’oignon. Faites-le revenir dans l’huile.', 'Ajoutez les tomates et laissez mijoter environ 15 minutes.', 'Cuisez les pâtes suivant le paquet. Incorporez la ricotta pasteurisée à la sauce et chauffez-la uniformément.', 'Mélangez et servez immédiatement.'],
      safety: 'Vérifiez la mention « lait pasteurisé » sur la ricotta et respectez sa conservation.', allergens: 'Blé (gluten), lait. Œuf possible selon les pâtes.'
    }
  ];
  const book = typeof module !== 'undefined' && module.exports ? require('./recipes.js') : root.MietteRecipeBook;
  const originalCollections = ['bowls', 'four', 'italie', 'brunch', 'soupes', 'bowls', 'four', 'douceurs', 'four', 'italie'];
  recipes.forEach((recipe, index) => { recipe.collection = originalCollections[index]; });
  recipes.push(...book.recipes);
  const data = { sources, statuses, categories, groups, foods, recipes, recipeCollections: book.collections, reviewed: '9 septembre 2026', reviewedISO: '2026-09-09' };
  if (typeof module !== 'undefined' && module.exports) module.exports = data;
  root.MietteData = data;
})(typeof window !== 'undefined' ? window : globalThis);
