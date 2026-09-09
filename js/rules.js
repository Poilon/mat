(function (root) {
  'use strict';
  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[œŒ]/g, 'oe').toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  const flattenIngredients = (ingredients, depth = 0) => Array.isArray(ingredients) && depth < 6 ? ingredients.slice(0, 100).flatMap(i => [i && i.id, i && i.text, ...flattenIngredients(i && i.ingredients, depth + 1)]).filter(v => typeof v === 'string') : [];
  const list = value => Array.isArray(value) ? value.filter(v => typeof v === 'string') : [];
  const boundedText = value => typeof value === 'string' ? value.slice(0, 12000) : '';
  const risk = (id, title, text, status, source) => ({ id, title, text, status, source });

  /** Precaution detection, not clinical validation. No API product is ever classified as compatible. */
  function analyzeProduct(product = {}) {
    const name = normalize(boundedText(product.product_name_fr || product.product_name));
    const categories = normalize(list(product.categories_tags).join(' ') + ' ' + boundedText(product.categories));
    const identity = name + ' ' + categories;
    const ingredientText = boundedText(product.ingredients_text_fr || product.ingredients_text);
    const ingredients = normalize(ingredientText + ' ' + flattenIngredients(product.ingredients).join(' '));
    const all = identity + ' ' + ingredients;
    const flags = [];
    const add = (...args) => flags.push(risk(...args));
    const hasIngredients = Boolean(ingredientText.trim() || flattenIngredients(product.ingredients).length);
    const hasCategories = Boolean(categories.trim());
    const alcoholValue = product.nutriments && product.nutriments.alcohol_100g;
    const alcoholAmount = alcoholValue !== undefined && alcoholValue !== null && alcoholValue !== '' ? Number(alcoholValue) : NaN;
    // A "non-alcoholic" beer may still contain alcohol. Never turn a zero claim into clearance.
    const zeroClaim = /(?:\b(sans alcool|non alcoholic|alcohol free|zero alcool)\b|\b0[.,]0\s*%)/.test(identity);
    const removeVinegar = text => text.replace(/\b(vinaigres?(?: de)? (?:vin(?: blanc| rouge)?|cidre)|(?:red |white )?wine vinegars?|cider vinegars?)\b/g, '');
    const alcoholicType = /\b(alcoholic beverages|beers?|wines?|spirits|bieres?|vins?|cidres?|champagne|rhum|rum|whisk[ey]+|vodka|liqueurs?|cognac|porto)\b/.test(removeVinegar(identity));
    const alcoholIngredients = /\b(rhum|rum|cognac|whisk[ey]+|vodka|liqueur|marsala|kirsch|vin blanc|vin rouge|white wine|red wine|ethyl alcohol|ethanol|alcool)\b/.test(removeVinegar(ingredients).replace(/\b(sans alcool|alcool de sucre)\b/g, ''));
    if (alcoholAmount > 0 || (alcoholicType && !zeroClaim) || alcoholIngredients) {
      add('alcohol', 'Alcool repéré ou probable', 'Zéro alcool pendant la grossesse. La cuisson ne garantit pas son élimination ; vérifiez aussi les desserts et sauces.', 'avoid', 'spf');
    } else if (alcoholicType || zeroClaim) {
      add('zero-alcohol', 'Teneur en alcool à confirmer', 'La mention « sans alcool » ne suffit pas toujours. Vérifiez la teneur exacte sur l’emballage ; cette fiche ne certifie pas le produit.', 'unknown', 'spf');
    }
    if (/\b(energy drinks?|boissons? energisantes?)\b/.test(identity)) add('energy', 'Boisson énergisante', 'Ces boissons sont déconseillées pendant la grossesse.', 'avoid', 'nutrition');
    if (/\b(espadon|swordfish|requin|shark|marlin|lamproie|lamprey|siki|saumonette)\b/.test(all)) add('high-mercury', 'Poisson à forte teneur possible en mercure', 'Éviter cette espèce pendant la grossesse, même cuite. La chaleur ne retire pas le mercure.', 'avoid', 'ameli');
    if (/\b(thon|tuna|bonite|dorade|sea bream|lotte|monkfish|halibut|fletan)\b/.test(all)) add('mercury', 'Espèce de poisson à limiter', 'Limiter la consommation et varier les espèces. La mise en conserve ne retire pas le mercure.', 'limit', 'ameli');
    const hardCheese = /\b(comte|gruyere|emmental|emmenthal|beaufort|parmesan|parmigiano|hard cooked cheeses|pates pressees cuites)\b/.test(identity);
    const softCheese = /\b(brie|camembert|munster|reblochon|morbier|roquefort|gorgonzola|pont l eveque|blue cheeses|soft cheeses|pates molles)\b/.test(identity);
    const rawMilk = /\b(lait cru|raw milk|unpasteuri[sz]ed milk|lait non pasteurise|lait thermise|thermi[sz]ed milk)\b/.test(all);
    if (softCheese) add('soft-cheese', 'Fromage à risque consommé froid', 'La pasteurisation seule ne suffit pas pour ce type de fromage. Privilégiez un fromage à pâte pressée cuite sans croûte.', 'avoid', 'spf');
    if (rawMilk && !hardCheese) add('raw-milk', 'Lait cru ou thermisé repéré', 'La pasteurisation n’est pas confirmée. Les fromages au lait cru hors pâtes pressées cuites et le lait cru sont à éviter tels quels.', 'avoid', 'agriculture');
    if (hardCheese && !softCheese) add('hard-cheese', 'Type de fromage à confirmer', 'S’il s’agit bien d’une pâte pressée cuite, retirer la croûte et préférer un morceau à râper soi-même. Vérifier le produit complet.', 'precaution', 'agriculture');
    if (/\b(smoked salmon|smoked trout|saumon fume|truite fumee|gravlax|sashimi|ceviche|tarama|raw fish)\b/.test(all) || (/\bsushis?\b/.test(identity) && !/\b(vegetari|vegetal|vegan)/.test(identity))) add('raw-fish', 'Poisson cru ou fumé possible', 'Éviter le poisson cru, fumé ou mariné consommé tel quel. Confirmer la préparation exacte sur l’emballage.', 'avoid', 'ministry');
    if (/\b(saucisson|salami|jambon cru|jambon sec|prosciutto|chorizo|tartare de boeuf|beef tartare|carpaccio de boeuf)\b/.test(all)) add('raw-meat', 'Viande crue ou charcuterie sèche repérée', 'À éviter telle quelle. Le salage, le séchage et la congélation ne remplacent pas une cuisson adaptée.', 'avoid', 'ministry');
    if (/\b(rillettes|pates de viande|meat pates|terrine|foie gras|jambon blanc|cooked ham|jambon cuit)\b/.test(identity)) add('deli', 'Charcuterie prête à manger', 'Vérifier le traitement et la conservation. Les charcuteries réfrigérées prêtes à consommer sont à éviter froides ; le jambon blanc peut être recuit à cœur.', 'precaution', 'spf');
    if (/\b(sprouts|graines germees|germes de luzerne|alfalfa)\b/.test(all)) add('sprouts', 'Graines germées possibles', 'Éviter leur consommation crue. Un simple rinçage ne suffit pas à conclure.', 'precaution', 'ameli');
    // A trace allergen or soy lecithin is not classified as a soy drink or tofu.
    if (/\b(tofu|tempeh|edamame|soya drinks|soy drinks|soy milks|soja drink|boisson[ s]*[a-z ]*soja|lait de soja|yaourt[ s]*[a-z ]*soja|desserts? au soja)\b/.test(identity)) add('soy', 'Aliment à base de soja', 'Les recommandations françaises déconseillent les aliments à base de soja pendant la grossesse par précaution.', 'avoid', 'ameli');
    else if (/\b(proteines? de soja|soy proteins?|soybeans|graines? de soja|farine de soja)\b/.test(ingredients)) add('soy-ingredient', 'Ingrédient à base de soja', 'La composition doit être examinée au regard des recommandations françaises sur le soja.', 'precaution', 'ameli');
    if (/\b(cafe|coffee|caffeine|cafeine|the vert|the noir|green tea|black tea|matcha|cola|guarana)\b/.test(all)) add('caffeine', 'Caféine possible', 'Compter toutes les sources : le repère EFSA est au maximum 200 mg par jour pendant la grossesse. La quantité de ce produit reste à vérifier.', 'limit', 'efsa');
    if (/\b(oeuf|oeufs|eggs?|egg yolk|jaune d oeuf)\b/.test(all)) add('eggs', 'Œuf repéré', 'Un ingrédient œuf ne dit pas si le produit est cru, cuit ou pasteurisé. Vérifier le traitement ; éviter les œufs crus ou peu cuits.', 'precaution', 'spf');
    if (!rawMilk && !hardCheese && !softCheese && /\b(lait|milk|fromage|cheese|mozzarella|feta|ricotta|mascarpone|cream|creme|yogurts?|yaourts?)\b/.test(all)) add('dairy', 'Produit laitier repéré', 'Vérifier la pasteurisation, le type de fromage et la conservation. Le mot « lait » seul ne permet pas de conclure.', 'precaution', 'ministry');
    if (/\b(chicken|poulet|turkey|dinde|beef|boeuf|pork|porc|meats?|viandes?|fish|poisson|salmon|saumon|cod|cabillaud)\b/.test(all)) add('cooking', 'Préparation à vérifier', 'Vérifier si le produit nécessite une cuisson complète à cœur et respecter les indications du fabricant.', 'precaution', 'toxo');
    if (/\b(herbal teas|infusions|tisanes|complements alimentaires|food supplements|essential oils|huiles essentielles)\b/.test(identity)) add('herbs', 'Plantes ou compléments', 'Faire vérifier chaque plante, dose et extrait par votre pharmacien, médecin ou sage-femme.', 'unknown', 'ameli');
    // "À vérifier" remains the default. Only concrete caution/avoidance signals change it.
    const priority = { unknown: 0, precaution: 1, limit: 2, avoid: 3 };
    const strongest = flags.reduce((best, flag) => priority[flag.status] > priority[best] ? flag.status : best, 'unknown');
    const status = strongest === 'avoid' || strongest === 'limit' ? strongest : 'unknown';
    return { status, flags, missing: [!hasIngredients && 'Ingrédients non renseignés', !hasCategories && 'Catégorie non renseignée'].filter(Boolean), reason: status === 'unknown' ? 'Les données du produit ne permettent pas de confirmer sa compatibilité avec la grossesse.' : 'Des précautions ont été repérées automatiquement dans la description. Confirmez-les sur l’emballage.', sources: [...new Set(flags.map(f => f.source))] };
  }
  function isValidBarcode(input) {
    const code = String(input).replace(/[\s-]/g, '');
    if (!/^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(code)) return false;
    let sum = 0;
    for (let i = code.length - 2, weight = 3; i >= 0; i--, weight = weight === 3 ? 1 : 3) sum += Number(code[i]) * weight;
    return (10 - sum % 10) % 10 === Number(code.at(-1));
  }
  const exports = { normalize, analyzeProduct, isValidBarcode };
  if (typeof module !== 'undefined' && module.exports) module.exports = exports;
  root.MietteRules = exports;
})(typeof window !== 'undefined' ? window : globalThis);
