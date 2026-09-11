'use strict';
const {veg,proteins,fillings,fruit,sweetPairs}=require('./ingredients.cjs');
const basic=require('./savory.cjs').families,world=require('./world.cjs').families,sweet=require('./sweet.cjs').families;
const I=(name,quantity,unit='g')=>({name,quantity,unit});
const imageMap={'recipes/gratin':'recipes/lasagna','recipes/rice':'recipes/risotto','recipes/quiche':'recipes/lasagna','recipes/omelette':'recipes/pancakes','recipes/wrap':'recipes/tacos'};
const ids={'mushrooms':'mushroom',strawberry:'strawberries'};
function health(r,kind){
 const text=r.ingredients.map(i=>i.name).join(' '),precautions=['wash','chill'];
 const notes=['Lavez les fruits, légumes et herbes à l’eau potable avant de les couper. Gardez les aliments crus séparés des aliments prêts à manger.'];
 if(kind==='poultry'){precautions.push('chicken');notes.push('Cuisez la volaille à 74 °C à cœur, vérifiés avec un thermomètre ; la couleur seule ne suffit pas. Ne lavez pas la viande crue.');}
 if(kind==='fish'){precautions.push('fish');notes.push('Utilisez du poisson frais non fumé et cuisez-le à cœur à 63 °C. Variez les espèces au fil des repas ; ce catalogue ne contrôle pas votre consommation hebdomadaire de poisson.');}
 if(/lait uht|yaourt|crème|feta|mozzarella|cheddar|beurre/i.test(text)){precautions.push('dairy');notes.push('Choisissez les laitages pasteurisés ou UHT indiqués et respectez la date et la chaîne du froid.');}
 if(/comté|emmental|parmesan/i.test(text)){precautions.push('cheese');notes.push('Retirez la croûte des fromages et râpez un morceau juste avant usage.');}
 if(/œuf/i.test(text)){precautions.push('eggs');notes.push('Cuisez entièrement les œufs et les appareils : blanc, jaune et centre doivent être pris, sans partie liquide.');}
 if(/farine|pâte |levure/i.test(text)){precautions.push('flour');notes.push('Ne goûtez pas les pâtes ou mélanges contenant de la farine ou de l’œuf crus.');}
 if(/soja|miso/i.test(text))notes.push('La sauce soja est à réserver à une consommation occasionnelle pendant la grossesse, selon l’Assurance Maladie. Choisissez une sauce sans alcool ajouté.');
 const allergens=[];
 for(const [name,re] of [['Blé (gluten)',/pâtes|orzo|lasagnes|semoule|boulgour|gnocchi|farine de blé|pâte |pain|tortilla|macaroni|udon|sauce soja/],['Avoine (gluten possible)',/avoine/],['Lait',/lait uht|crème uht|yaourt|beurre|comté|emmental|parmesan|mozzarella|cheddar|feta/],['Œuf',/œuf|pâtes|orzo|lasagnes|gnocchi|pâte /],['Poisson',/saumon|cabillaud|truite|colin|pâte de curry/],['Soja',/soja|miso|pâte de curry/],['Sésame',/sésame/],['Arachides',/cacahuète/],['Moutarde',/moutarde|colombo|ras-el-hanout|curry/],['Céleri',/céleri|curry|colombo|ras-el-hanout/],['Crustacés',/pâte de curry/],['Sulfites possibles',/raisins secs|moutarde/]])if(re.test(text.toLowerCase()))allergens.push(name);
 r.precautions=precautions;r.safety=notes.join(' ');r.sources=[...new Set(['ameli','toxo','temperature',...(/soja|miso/i.test(text)?['soy']:[])])];
 r.allergens=(allergens.length?allergens.join(', '):'Aucun des 14 allergènes réglementés identifié dans les ingrédients simples')+'. Vérifiez la composition et les traces sur chaque emballage, notamment les mélanges d’épices et sauces.';
}
function make(f,keys){
 const isSweet=!!f.sweet,a=(isSweet?fruit:veg)[keys[0]],b=(isSweet?fruit:veg)[keys[1]],p=isSweet?null:proteins[keys[2]],kind=p?.[3];
 const names=isSweet?[a[0],b[0]]:[a[0],b[0],p[0]];
 const title=f.label+' · '+names.join(', ');
 const ingredients=isSweet?[I(a[1],125),I(b[1],125),...f.ingredients]:[I(a[1],150),I(b[1],150),I(p[1],p[2]),I('Huile d’olive pour la garniture',1,'c. à soupe'),I('Eau pour les légumes',60,'ml'),...f.ingredients];
 let steps,checks;
 if(isSweet){steps=[`Lavez les fruits à l’eau potable avant de les peler ou de les couper. Préparez ${a[1].toLowerCase()} : ${a[3]}. Préparez ${b[1].toLowerCase()} : ${b[3]}. Pesez les quantités après retrait des peaux, noyaux ou parties non utilisées.`,...f.steps.map(s=>s.replaceAll('les fruits préparés',`${a[0]} et ${b[0]} préparés`))];checks=['Les fruits sont lavés, les noyaux et parties dures retirés.'];}
 else{
 const ordered=[a,b].sort((x,y)=>y[2]-x[2]),early=ordered[0],late=ordered[1],gap=early[2]-late[2];
 steps=[`Lavez les légumes à l’eau potable avant découpe. Préparez ${a[1].toLowerCase()} ${a[3]}, puis ${b[1].toLowerCase()} ${b[3]}. Pesez les quantités prêtes à cuire. Préparez aussi les ingrédients de la base et de la sauce indiqués ci-dessous.`,
 `Chauffez ${kind==='legume'?'l’huile d’olive':'la moitié de l’huile d’olive'} dans une grande poêle à feu moyen. Ajoutez ${early[0]} et l’eau pour les légumes, couvrez et cuisez ${gap?gap+' minutes avant d’ajouter '+late[0]+', puis encore '+late[2]+' minutes':early[2]+' minutes avec '+late[0]}. Remuez de temps en temps et ajoutez une cuillerée d’eau si le fond sèche. Découvrez et laissez l’excédent d’eau s’évaporer 2 à 3 minutes. Vérifiez les deux légumes et prolongez si nécessaire.`,
 kind==='legume'?`Rincez et égouttez ${p[1].toLowerCase()}. Chauffez-les 4 minutes dans une petite casserole avec 2 cuillerées d’eau, en remuant, puis égouttez si nécessaire. Gardez la garniture séparée jusqu’à l’assemblage.`:
 `Sur une planche réservée aux aliments crus, coupez ${p[1].toLowerCase()} en morceaux de ${kind==='poultry'?'2':'3'} cm${kind==='fish'?', après retrait des arêtes et de la peau si nécessaire':''}. Lavez mains et ustensiles après manipulation. Chauffez l’huile d’olive restante dans une seconde poêle. Cuisez ${kind==='poultry'?'10 à 12':'6 à 10'} minutes à feu moyen en retournant ; prolongez jusqu’à ${kind==='poultry'?'74':'63'} °C au centre des morceaux les plus épais, mesurés au thermomètre. Réservez dans un récipient propre.`,...f.steps.map(s=>s.replaceAll('les légumes',`${a[0]} et ${b[0]}`).replaceAll('la garniture',p[0]))];
 checks=['Les morceaux ont une taille régulière.',`${a[1]} : ${a[4]}. ${b[1]} : ${b[4]}.`,kind==='legume'?'Les légumes secs sont chauds à cœur.':`Le thermomètre indique au moins ${kind==='poultry'?74:63} °C dans les morceaux les plus épais.`];}
 const r={id:'poum-'+f.id+'-'+keys.join('-'),title,subtitle:(f.world?'Une adaptation maison inspirée de '+f.cuisine+'. ': 'Une déclinaison maison. ')+f.tip,collection:f.collection,image:imageMap[f.image]||f.image,time:f.time+(isSweet?0:10),type:isSweet?'dessert':f.collection==='apero'?'apero':f.collection==='brunch'?'breakfast':'dinner',vegetarian:isSweet||kind==='legume',foods:(isSweet?[a[2],b[2]]:[a[5],b[5],p[4]]).map(id=>ids[id]||id),servings:2,edition:3,family:f.id,cuisine:f.cuisine||(f.collection==='italie'?'Italie':'Europe'),tags:[f.cuisine||f.label,isSweet?'Douceur':kind==='legume'?'Végétarien':kind==='fish'?'Poisson cuit':'Volaille cuite'],ingredients,steps};
 r.guide={equipment:[...new Set([...(isSweet?[]:['Grande poêle','Petite casserole',...(kind==='legume'?[]:['Seconde poêle','Thermomètre de cuisine'])]),...f.equipment])],before:[`Quantités pour 2 personnes. Prévoyez les ustensiles et pesez les ingrédients avant de commencer.`,isSweet?'Le poids des fruits correspond à la partie comestible. Le temps de cuisson varie avec leur maturité.':'Lisez la cuisson de la base avant de commencer : vous pouvez la lancer pendant celle des légumes si vous êtes à l’aise avec deux cuissons.',f.tip],steps:steps.map((s,i)=>({title:i===0?'Préparer les ingrédients':i===steps.length-1?'Terminer et servir':'En cuisine',check:checks[i]||(i===steps.length-1?f.check:''),tip:''}))};
 health(r,kind);return r;
}
function generate(){const groups=[...basic.map(f=>fillings.slice(0,12).map(keys=>make(f,keys))),...world.map(f=>fillings.slice(0,20).map(keys=>make(f,keys))),...sweet.map(f=>sweetPairs.map(keys=>make(f,keys)))];return Array.from({length:20},(_,i)=>groups.map(rows=>rows[i]).filter(Boolean)).flat();}
module.exports={generate};
