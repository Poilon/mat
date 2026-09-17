(function (root) {
  'use strict';
  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[œŒ]/g, 'oe').toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  const flattenIngredients = (ingredients, depth = 0) => Array.isArray(ingredients) && depth < 6 ? ingredients.slice(0, 100).flatMap(i => [i && i.id, i && i.text, ...flattenIngredients(i && i.ingredients, depth + 1)]).filter(v => typeof v === 'string') : [];
  const list = value => Array.isArray(value) ? value.filter(v => typeof v === 'string') : [];
  const boundedText = value => typeof value === 'string' ? value.slice(0, 12000) : '';
  const E = typeof module !== 'undefined' && module.exports ? require('./evidence.js') : root.MietteEvidence;

  /** Partial signal detection, never clinical clearance. Matched terms are normalized, not quotations. */
  function analyzeProduct(product = {}) {
    const fields = {
      name: normalize(boundedText(product.product_name_fr || product.product_name)),
      categories: normalize(list(product.categories_tags).join(' ') + ' ' + boundedText(product.categories)),
      ingredients: normalize(boundedText(product.ingredients_text_fr || product.ingredients_text) + ' ' + flattenIngredients(product.ingredients).join(' '))
    };
    const labels = { name: 'Nom du produit', categories: 'Catégories', ingredients: 'Ingrédients', nutriments: 'Valeur déclarée' };
    const identity = ['name', 'categories'];
    const allFields = ['name', 'categories', 'ingredients'];
    const match = (pattern, keys = allFields, transform = value => value) => keys.flatMap(field => {
      const found = transform(fields[field]).match(pattern);
      return found ? [{ field, label: labels[field], term: found[0].trim().slice(0, 120) }] : [];
    });
    const flags = [];
    const facts = [];
    const affirmativeTreatment=text=>text.replace(/\b(?:non|not|sans|pas|without)\s+(?:de\s+)?(?:lait\s+)?(?:uht|pasteuri[sz]\w*)\b/g,'');
    const fact = (id, title, pattern, keys = allFields) => {
      const matches = match(pattern, keys, affirmativeTreatment);
      if(matches.length)facts.push({id,title,matches});
    };
    // Describe explicit mentions only. A treatment of one ingredient does not
    // establish the treatment or safety of the entire finished product.
    fact('uht','Mention UHT',/\buht\b/);
    const pasteurised=match(/\bpasteuri[sz](?:e|ee|es|ees|ed)\b/,allFields,affirmativeTreatment);
    if(pasteurised.length)facts.push({id:'pasteurised',title:'Mention de pasteurisation',matches:pasteurised});
    fact('canned','Conserve indiquée',/\b(?:en conserve|conserves|canned foods|canned vegetables|canned fish|tinned)\b/,identity);
    fact('frozen','Produit surgelé indiqué',/\b(?:surgele[es]*|frozen)\b/,identity);
    fact('milk-powder','Lait en poudre indiqué',/\b(?:lait(?: ecreme| entier| demi ecreme)? en poudre|(?:skimmed |whole |skim )?milk powder|powdered milk)\b/,['ingredients']);
    const add = (id, title, text, status, profile, matches) => {
      if (!matches.length) return;
      const p = E.profiles[profile];
      flags.push({ id, title, text, status, source: p.sources[0], sources: p.sources, profile, matches,
        explanation: { title: p.title, mechanism: p.mechanism, condition: p.condition, steps: p.steps } });
    };
    const signal = (id, title, text, status, profile, pattern, keys = allFields) => add(id, title, text, status, profile, match(pattern, keys));
    const removeVinegar = text => text.replace(/\b(vinaigres?(?: de)? (?:vin(?: blanc| rouge)?|cidre)|(?:red |white )?wine vinegars?|cider vinegars?)\b/g, '');
    const zeroClaim = match(/(?:\b(sans alcool|non alcoholic|alcohol free|zero alcool)\b|\b0[.,]0\s*%)/, identity);
    const alcoholicType = match(/\b(alcoholic beverages|beers?|wines?|spirits|bieres?|vins?|cidres?|champagne|rhum|rum|whisk[ey]+|vodka|liqueurs?|cognac|porto)\b/, identity, removeVinegar);
    const alcoholIngredients = match(/\b(rhum|rum|cognac|whisk[ey]+|vodka|liqueur|marsala|kirsch|vin blanc|vin rouge|white wine|red wine|ethyl alcohol|ethanol|alcool)\b/, ['ingredients'], text => removeVinegar(text).replace(/\b(sans alcool|alcool de sucre)\b/g, ''));
    const declaredAlcohol = product.nutriments?.alcohol_100g;
    const alcoholAmount = declaredAlcohol !== undefined && declaredAlcohol !== null && declaredAlcohol !== '' ? Number(declaredAlcohol) : NaN;
    const alcoholMatches = [...(alcoholAmount > 0 ? [{ field: 'nutriments', label: labels.nutriments, term: 'Teneur en alcool supérieure à zéro' }] : []), ...(!zeroClaim.length ? alcoholicType : []), ...alcoholIngredients];
    if (alcoholMatches.length) add('alcohol', 'Alcool repéré ou probable', 'La description indique de l’alcool ou un ingrédient alcoolisé. Confirmer la recette exacte ; la cuisson ne garantit pas l’élimination de l’alcool.', 'avoid', 'alcohol', alcoholMatches);
    else if (alcoholicType.length || zeroClaim.length) add('zero-alcohol', 'Teneur en alcool à confirmer', 'La mention « sans alcool » ne suffit pas toujours : vérifier la teneur exacte et les autres ingrédients sur l’emballage.', 'unknown', 'alcohol', [...zeroClaim, ...alcoholicType]);
    signal('energy', 'Boisson énergisante', 'La catégorie de boisson repérée est déconseillée pendant la grossesse, y compris sans sucre.', 'avoid', 'energy', /\b(energy drinks?|boissons? energisantes?)\b/, identity);
    signal('high-mercury', 'Poisson à forte teneur possible en mercure', 'L’espèce repérée figure parmi les poissons à éviter, même cuits.', 'avoid', 'highMercury', /\b(espadon|swordfish|requin|shark|marlin|lamproie|lamprey|siki|saumonette)\b/);
    const mercuryMatches = match(/\b(thon|tuna|bonite|dorade|sea bream|sea bass|lotte|monkfish|halibut|fletan|brochet|pike|anguille|eel)\b/);
    // "Bar" alone also names a snack in English: restrict this French fish term to the beginning of the product name.
    mercuryMatches.push(...match(/^bar(?: sauvage| d elevage| commun| au| en| frais| entier| grille| cuit|$)/, ['name']));
    add('mercury', 'Espèce de poisson à limiter', 'Limiter la fréquence et varier les espèces ; la conserve ne retire pas le mercure. La fiche ne donne pas un quota de portions propre à ce produit.', 'limit', 'mercury', mercuryMatches);
    const hardCheese = match(/\b(comte|gruyere|emmental|emmenthal|beaufort|parmesan|parmigiano|hard cooked cheeses|pates pressees cuites)\b/, identity);
    const softCheese = match(/\b(brie|camembert|munster|reblochon|morbier|roquefort|gorgonzola|pont l eveque|epoisses|taleggio|blue cheeses|soft cheeses|pates molles)\b/, identity);
    const rawMilk = match(/\b(lait cru|raw milk|unpasteuri[sz]ed milk|lait non pasteurise|lait thermise|thermi[sz]ed milk)\b/);
    add('soft-cheese', 'Fromage à risque consommé froid', 'Vérifier le type de fromage et sa préparation : une pasteurisation seule ne suffit pas à lever cette précaution.', 'avoid', 'softCheese', softCheese);
    if (!hardCheese.length) add('raw-milk', 'Lait cru ou thermisé repéré', 'Le lait cru et les fromages au lait cru hors exceptions sont à éviter tels quels. Vérifier aussi s’il s’agit d’un ingrédient d’un plat entièrement cuit.', 'avoid', 'rawMilk', rawMilk);
    if (!softCheese.length) add('hard-cheese', 'Type de fromage à confirmer', 'Si c’est bien une pâte pressée cuite en morceau, le repère est différent de celui des fromages mous. Vérifier le produit complet et retirer la croûte.', 'precaution', 'hardCheese', hardCheese);
    const rawFish = match(/\b(smoked salmon|smoked trout|saumon fume|truite fumee|gravlax|sashimi|ceviche|tarama|raw fish)\b/);
    if (!match(/\b(vegetari|vegetal|vegan)/, identity).length) rawFish.push(...match(/\bsushis?\b/, identity));
    add('raw-fish', 'Poisson cru ou fumé possible', 'Confirmer le poisson et sa préparation : éviter la forme crue, fumée ou marinée consommée telle quelle.', 'avoid', 'rawFish', rawFish);
    signal('raw-meat', 'Viande crue ou charcuterie sèche repérée', 'Vérifier si l’ingrédient est consommé tel quel ou entièrement cuit dans la recette.', 'avoid', 'rawMeat', /\b(saucisson|salami|jambon cru|jambon sec|prosciutto|chorizo|tartare de boeuf|beef tartare|carpaccio de boeuf)\b/);
    signal('deli', 'Charcuterie prête à manger', 'La description ne confirme pas le traitement. Les formes réfrigérées prêtes à manger sont à éviter froides ; le jambon blanc peut être recuit à cœur.', 'precaution', 'deli', /\b(rillettes|pates de viande|meat pates|terrine|foie gras|jambon blanc|cooked ham|jambon cuit)\b/, identity);
    add('sprouts', 'Graines germées possibles', 'Vérifier si les graines germées sont crues ou entièrement cuites ; un simple rinçage ne suffit pas pour la forme crue.', 'precaution', 'sprouts', match(/\b(graines germees|germes de luzerne|alfalfa|sprouts|sprouted seeds)\b/, allFields, text => text.replace(/\bbrussels sprouts\b/g, '')));
    const soyFood = match(/\b(tofu|tempeh|edamame|soya drinks|soy drinks|soy milks|soja drink|boisson[ s]*[a-z ]*soja|lait de soja|yaourt[ s]*[a-z ]*soja|desserts? au soja)\b/, identity);
    if (soyFood.length) add('soy', 'Aliment à base de soja', 'La famille repérée est concernée par la précaution française sur les aliments à base de soja.', 'avoid', 'soy', soyFood);
    else signal('soy-ingredient', 'Ingrédient à base de soja', 'L’ingrédient ne donne pas sa teneur en isoflavones : vérifier la quantité et la recette. Une trace d’allergène ou de la lécithine seule ne déclenche pas ce signal.', 'precaution', 'soy', /\b(proteines? de soja|soy proteins?|soybeans|graines? de soja|farine de soja)\b/, ['ingredients']);
    signal('caffeine', 'Caféine possible', 'La dose de caféine n’est pas connue à partir de ce seul terme. Compter toutes les sources pour le repère EFSA de 200 mg/jour au maximum.', 'limit', 'caffeine', /\b(cafe|coffee|caffeine|cafeine|the vert|the noir|green tea|black tea|matcha|cola|guarana|yerba mate)\b/);
    const biscuit=match(/\b(?:biscuits?|cookies?)\b/,identity).length>0;
    signal('eggs', biscuit?'Œuf dans un biscuit':'Œuf repéré', biscuit?'Pour un biscuit entièrement cuit, l’œuf incorporé à la pâte se distingue d’un œuf cru. Vérifier les éventuelles garnitures et les consignes du fabricant.':'L’ingrédient œuf ne dit pas si le produit est cru, cuit ou pasteurisé. Privilégier une préparation entièrement cuite et vérifier les indications de l’emballage.', 'precaution', 'eggs', /\b(oeuf|oeufs|eggs?|egg yolk|jaune d oeuf)\b/);
    if (!rawMilk.length && !hardCheese.length && !softCheese.length) signal('dairy', 'Produit laitier repéré', 'Le mot lait ou fromage ne confirme pas la pasteurisation, le type de produit et sa conservation.', 'precaution', 'dairy', /\b(lait|milk|fromage|cheese|mozzarella|feta|ricotta|mascarpone|cream|creme|yogurts?|yaourts?)\b/);
    const poultry = match(/\b(chicken|poulet|turkey|dinde|duck|canard|pintade)\b/);
    const meat = match(/\b(beef|boeuf|pork|porc|meats?|viandes?|agneau|veal|veau)\b/);
    const fish = match(/\b(fish|poisson|salmon|saumon|cod|cabillaud)\b/);
    if (poultry.length) add('cooking', 'Cuisson de la volaille à vérifier', 'Confirmer si la volaille est un ingrédient déjà cuit ou un produit à cuire. Suivre les consignes du fabricant.', 'precaution', 'poultry', poultry);
    if (meat.length) add('meat-cooking', 'Cuisson de la viande à vérifier', 'La dénomination ne confirme pas la cuisson réelle de la viande. Vérifier la préparation prévue.', 'precaution', 'meat', meat);
    if (fish.length) add('fish-cooking', 'Cuisson du poisson à vérifier', 'La dénomination ne confirme pas la cuisson réelle du poisson. Vérifier aussi l’espèce et la conservation.', 'precaution', 'fish', fish);
    signal('herbs', 'Plantes ou compléments', 'Faire examiner la liste des plantes, la dose et la forme du produit ; une mention générale ne permet pas de conclure.', 'unknown', 'herbs', /\b(herbal teas|infusions?|tisanes?|complements alimentaires|food supplements|essential oils|huiles essentielles)\b/, identity);
    signal('liquorice', 'Réglisse repérée', 'La réglisse est contre-indiquée pendant la grossesse selon l’Assurance Maladie, y compris dans une tisane ou un bonbon.', 'avoid', 'liquorice', /\b(reglisse|licorice|liquorice|glycyrrhiza)\b/);
    const priority = { unknown: 0, precaution: 1, limit: 2, avoid: 3 };
    flags.sort((a,b)=>priority[b.status]-priority[a.status]);
    const strongest = flags.reduce((best, flag) => priority[flag.status] > priority[best] ? flag.status : best, 'unknown');
    const status = strongest;
    const missing=[!fields.ingredients.trim() && 'Ingrédients non renseignés', !fields.categories.trim() && 'Catégorie non renseignée'].filter(Boolean);
    const qualityIssues=list(product.data_quality_errors_tags).length>0;
    const label=status==='avoid'?'À éviter':status==='limit'?'À limiter':status==='precaution'?'Précautions de préparation':flags.length?'Composition à préciser':missing.length||qualityIssues?'Fiche incomplète':'Aucun signal repéré';
    const dairy=flags.find(f=>f.id==='dairy');
    if(dairy&&facts.some(f=>['uht','pasteurised'].includes(f.id))){dairy.title='Traitement indiqué, conservation à respecter';dairy.text='Une mention UHT ou de pasteurisation figure dans la fiche. Vérifier à quel ingrédient elle se rapporte, le type de produit et ses consignes de conservation ; cette mention ne suffit pas pour tous les fromages.';}
    else if(dairy&&facts.some(f=>f.id==='milk-powder')){dairy.title='Lait en poudre dans la recette';dairy.text='La fiche indique du lait en poudre parmi les ingrédients. Les allergènes du lait restent à prendre en compte ; suivez les consignes de conservation du produit fini.';}
    const summary=flags[0]?.text||(qualityIssues?'Open Food Facts signale une incohérence dans cette fiche. Comparez les informations avec l’emballage.':missing.length?missing.join(' · ')+'. Les informations disponibles restent consultables.':'Aucun signal particulier détecté dans les données disponibles. Retrouvez la composition et les informations déclarées.');
    return { status, label, summary, flags, facts, qualityIssues, missing,
      unknowns: ['Traitement thermique et préparation réelle', 'Conservation, chaîne du froid et état du lot', 'Quantité consommée et situation personnelle'],
      reason: summary,
      sources: [...new Set(flags.flatMap(f => f.sources))] };
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
