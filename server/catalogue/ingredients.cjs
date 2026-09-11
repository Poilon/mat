'use strict';
// Culinary building blocks: names include the preparation and treatment that matter.
const veg={
 zucchini:['courgette','Courgette',10,'en demi-rondelles de 5 mm','la chair devient tendre sans se défaire','zucchini'],
 tomato:['tomate','Tomate',8,'en dés de 2 cm, en retirant le pédoncule','les dés sont souples et leur jus commence à réduire','tomato'],
 broccoli:['brocoli','Brocoli',12,'en petites fleurettes de 2 cm et la tige pelée en dés de 1 cm','une pointe de couteau traverse facilement la tige','broccoli'],
 carrot:['carotte','Carotte',16,'en demi-rondelles de 3 mm','les rondelles se coupent facilement avec la spatule','carrot'],
 leek:['poireau','Poireau',12,'en fines rondelles, après avoir rincé entre les feuilles','les rondelles sont fondantes, sans brunir','leek'],
 mushroom:['champignons','Champignons de Paris',10,'en lamelles de 5 mm, après nettoyage et retrait du pied terreux','l’eau rendue par les champignons s’est évaporée','mushrooms'],
 sweet:['patate douce','Patate douce',18,'pelée puis en dés de 1 cm','une pointe de couteau entre sans résistance','sweet-potato'],
 spinach:['épinards','Épinards frais',5,'en retirant les tiges épaisses','les feuilles sont tombées et leur eau est évaporée','spinach'],
 eggplant:['aubergine','Aubergine',18,'en dés de 1 cm','les dés sont fondants jusque dans leur centre','eggplant'],
 pepper:['poivron','Poivron',14,'épépiné, sans membranes blanches, en dés de 1 cm','la chair est souple et le liquide a réduit','bell-pepper'],
 squash:['butternut','Courge butternut',18,'pelée, épépinée puis en dés de 1 cm','les dés s’écrasent facilement sous une fourchette','butternut'],
 cauliflower:['chou-fleur','Chou-fleur',14,'en petites fleurettes de 2 cm','une pointe de couteau traverse les tiges','cauliflower'],
 peas:['petits pois','Petits pois surgelés',8,'sans décongélation préalable','les pois sont chauds à cœur et tendres ; respectez aussi les consignes du sachet','peas'],
 fennel:['fenouil','Fenouil',16,'sans la base dure, en fines lamelles de 3 mm','les lamelles sont souples et légèrement translucides','fennel']
};
const proteins={
 chickpeas:['pois chiches','Pois chiches en conserve égouttés',140,'legume','chickpeas'],
 lentils:['lentilles','Lentilles en conserve égouttées',140,'legume','lentils'],
 white:['haricots blancs','Haricots blancs en conserve égouttés',140,'legume','white-beans'],
 red:['haricots rouges','Haricots rouges en conserve égouttés',140,'legume','kidney-beans'],
 chicken:['poulet','Blanc de poulet cru',180,'poultry','chicken'],
 turkey:['dinde','Escalope de dinde crue',180,'poultry','turkey'],
 salmon:['saumon','Filet de saumon frais non fumé',180,'fish','salmon'],
 cod:['cabillaud','Filet de cabillaud frais',180,'fish','cod'],
 trout:['truite','Filet de truite fraîche non fumée',180,'fish','trout'],
 pollock:['colin','Filet de colin frais',180,'fish','pollock']
};
const fillings=[
 ['zucchini','tomato','chickpeas'],['broccoli','carrot','chicken'],['leek','mushroom','salmon'],['sweet','spinach','lentils'],
 ['eggplant','pepper','white'],['squash','mushroom','turkey'],['cauliflower','peas','chickpeas'],['carrot','zucchini','cod'],
 ['spinach','leek','white'],['tomato','pepper','chicken'],['mushroom','carrot','lentils'],['broccoli','leek','trout'],
 ['sweet','carrot','red'],['zucchini','peas','turkey'],['fennel','carrot','pollock'],['squash','spinach','chickpeas'],
 ['cauliflower','mushroom','lentils'],['leek','carrot','chicken'],['eggplant','tomato','chickpeas'],['zucchini','mushroom','white'],
 ['broccoli','peas','lentils'],['fennel','tomato','salmon'],['carrot','spinach','red'],['pepper','mushroom','turkey']
];
const fruit={
 apple:['pomme','Pomme','apple','pelée, épépinée, en dés de 1 cm'],pear:['poire','Poire','pear','pelée, épépinée, en dés de 1 cm'],
 banana:['banane','Banane','banana','pelée, en rondelles de 1 cm'],peach:['pêche','Pêche','peach','dénoyautée, en dés de 1 cm'],
 apricot:['abricot','Abricot','apricot','dénoyauté, en quartiers'],plum:['prune','Prune','plum','dénoyautée, en quartiers'],
 mango:['mangue','Mangue','mango','pelée, sans noyau, en dés de 1 cm'],pineapple:['ananas','Ananas','pineapple','pelé, sans cœur dur, en dés de 1 cm'],
 strawberry:['fraise','Fraise fraîche','strawberry','lavée avant équeutage, puis coupée en quatre'],raspberry:['framboise','Framboise fraîche','raspberry','triée, lavée doucement et égouttée'],
 blueberry:['myrtille','Myrtille fraîche','blueberry','triée, lavée et égouttée'],cherry:['cerise','Cerise','cherry','lavée, équeutée et dénoyautée']
};
const sweetPairs=[['apple','pear'],['apple','raspberry'],['apple','blueberry'],['pear','banana'],['pear','raspberry'],['pear','cherry'],['banana','strawberry'],['banana','blueberry'],['banana','mango'],['peach','raspberry'],['peach','apricot'],['peach','blueberry'],['apricot','cherry'],['apricot','plum'],['plum','apple'],['plum','pear'],['mango','pineapple'],['mango','strawberry'],['pineapple','banana'],['strawberry','raspberry']];
module.exports={veg,proteins,fillings,fruit,sweetPairs};
