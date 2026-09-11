'use strict';
function enrich(r){
 if(!r.guide){
 const text=r.steps.join(' '), equipment=['Balance ou verre doseur','Couteau et planche propres'];
 for(const [re,label] of [[/four|enfourne/i,'Four et plat adapté'],[/poêle|faites revenir|faites dorer/i,'Poêle et spatule'],[/casserole|bouill|mijot|frém/i,'Casserole'],[/mixe/i,'Mixeur'],[/fouett|batte/i,'Fouet et saladier'],[/égoutt/i,'Passoire'],[/râpe/i,'Râpe'],[/74 °C|63 °C|poulet|poisson|saumon|cabillaud/i,'Thermomètre de cuisine']])if(re.test(text))equipment.push(label);
 const steps=r.steps.map((s,i)=>{
 const cues=[];
 if(/rince|lave|épluch|émince|coupe/i.test(s))cues.push('Travaillez sur une planche propre ; des morceaux de taille régulière cuisent plus uniformément. Lavez les végétaux avant de les découper.');
 if(/dore|revenir|poêle|saisir/i.test(s))cues.push('Laissez de la place entre les morceaux. Si le fond brunit avant que le cœur soit cuit, baissez le feu ; travaillez en plusieurs fois si la poêle est trop petite.');
 if(/mijot|frém|rédui/i.test(s))cues.push('Maintenez de petites bulles régulières. Remuez jusqu’au fond et ajoutez un peu d’eau si la sauce attache avant la fin de la cuisson.');
 if(/pâtes|riz|quinoa|boulgour|semoule/i.test(s)&&/cui|bouill|gonfl/i.test(s))cues.push('Le temps et la quantité d’eau du paquet priment pour la variété utilisée. Goûtez avec un ustensile propre pour vérifier que le grain ou la pâte n’est plus dur au centre.');
 if(/four|enfourne/i.test(s))cues.push('Placez le plat au milieu du four. La coloration du dessus ne garantit pas la cuisson au centre : vérifiez aussi le cœur de la préparation avant de servir.');
 if(/œuf|oeuf|pâte crue/i.test(s)&&/cui|pris|liquid|four|poêle/i.test(s))cues.push('Vérifiez le centre et la partie la plus épaisse : l’œuf doit être entièrement pris. Une préparation encore liquide doit poursuivre sa cuisson.');
 if(/mixe/i.test(s))cues.push('Arrêtez l’appareil avant de racler les parois. Pour une préparation chaude, évitez un récipient fermé ; gardez le pied du mixeur immergé pour limiter les projections.');
 if(/saumon|cabillaud|poisson|truite/i.test(s)&&/cui|four|poêle/i.test(s))cues.push('Contrôlez la partie la plus épaisse au thermomètre : 63 °C à cœur. Les indications visuelles seules ne suffisent pas.');
 if(/poulet|dinde/i.test(s)&&/cui|four|poêle|dore/i.test(s))cues.push('Contrôlez les morceaux les plus épais au thermomètre : la volaille doit atteindre 74 °C à cœur.');
 if(/serv|répart|assembl|garnis/i.test(s))cues.push('Utilisez des assiettes et ustensiles propres, différents de ceux ayant touché des ingrédients crus. Servez dès l’assemblage ; gardez les préparations froides au réfrigérateur jusqu’au service.');
 return {title:i===0?'Pour commencer':i===r.steps.length-1?'Pour terminer':'La bonne cuisson',check:cues.join(' '),tip:''};
 });
 r.guide={equipment,before:['Lisez toutes les étapes, puis pesez les ingrédients pour le nombre de personnes choisi.','Préparez les ustensiles avant de commencer. Les durées sont indicatives : le repère de cuisson prime sur la minuterie.'],steps};
 }
 r.storage='Mettez les restes rapidement au réfrigérateur, dans un récipient propre fermé, à 4 °C maximum. Ne les conservez pas plus de 3 jours et respectez toute durée plus courte indiquée sur les produits. Réchauffez les plats destinés à être servis chauds uniformément à cœur (74 °C au thermomètre). Pour les préparations froides, maintenez la chaîne du froid jusqu’au service.';
 r.sources=[...new Set([...(r.sources||['spf','toxo']),'ameli','temperature'])];
 return r;
}
module.exports={enrich};
