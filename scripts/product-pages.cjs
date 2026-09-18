'use strict';
const { offer } = require('../js/plus.js');

// Public product explanations: no personal records and no premium recipe steps.
module.exports = function productPages({ link, esc, freeCount, recipeCount }) {
  const price = plan => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(plan.cents / 100);
  const pass = offer.plans.find(p => p.id === 'pass');
  const monthly = offer.plans.find(p => p.id === 'monthly');
  const intro = (label, title, description) => `<p class="seo-kicker">${label}</p><h1>${title}</h1><p class="seo-intro">${description}</p>`;
  const start = (url, text) => `<p>${link(url, text, 'seo-button')}</p>`;
  const section = (title, body) => `<section><h2>${title}</h2>${body}</section>`;
  const faq = items => `<section class="seo-faq"><h2>Vos questions</h2>${items.map(([q,a])=>`<details><summary>${q}</summary><p>${a}</p></details>`).join('')}</section>`;
  return [
    {
      url: '/calendrier-grossesse/',
      title: 'Calendrier de grossesse gratuit : rendez-vous et examens',
      description: 'Créez votre calendrier de grossesse avec Poum : vos repères, les étapes expliquées, les rendez-vous à noter et les questions à préparer pour vos consultations.',
      body: intro('Le suivi de grossesse · Gratuit', 'Votre calendrier de grossesse, étape par étape.', 'Comprendre ce qui arrive, retrouver vos rendez-vous et préparer vos questions : Poum rassemble les repères de votre suivi au même endroit.') +
        start('/#grossesse', 'Créer mon calendrier gratuit') +
        `<img class="seo-product-art" src="/assets/brand/pregnancy-notebook.webp" alt="Illustration d’une femme enceinte notant ses questions dans un carnet" width="700" height="700">` +
        section('Commencer avec les dates que vous connaissez', '<p>Renseignez le premier jour de vos dernières règles, avec la durée habituelle de votre cycle si vous la connaissez, ou le terme communiqué par votre professionnel de santé. Poum utilise ce repère pour afficher des périodes prévisionnelles.</p><p>Une estimation calculée à partir des règles peut différer de la datation médicale. Quand votre sage-femme ou votre médecin confirme votre terme, remplacez votre repère dans Poum. Vos rendez-vous déjà fixés et vos notes sont conservés.</p>') +
        section('Un intitulé de rendez-vous ne suffit pas', '<p>Ouvrez une étape pour comprendre son utilité, les sujets qui peuvent être abordés, les documents à préparer et les questions à poser. Vous pouvez ainsi préparer votre consultation avant le jour du rendez-vous.</p><ol class="seo-steps"><li>Consultez la période indiquée et les explications de l’étape.</li><li>Organisez le rendez-vous avec le professionnel concerné.</li><li>Notez la date et l’heure réellement convenues.</li><li>Après le rendez-vous, cochez « Fait » : l’étape quitte la liste à faire et reste consultable dans les étapes terminées.</li></ol><p>Les périodes sont des repères, pas des rendez-vous réservés. Poum ne prend pas rendez-vous à votre place.</p>') +
        section('Vos examens et vos questions', '<p>Le carnet permet de rassembler le suivi de vos examens, vos notes et les questions pour la prochaine consultation. Il aide à faire le point sur vos documents ; il ne prescrit pas d’analyses et n’interprète pas vos résultats à la place d’un professionnel.</p><p>Une question apparaît entre deux consultations ? Notez-la dans votre carnet pour la retrouver lors de votre prochain échange.</p>') +
        section('Ce qui est gratuit, ce qui relève de Plus', `<p>La création du calendrier, les explications des étapes, les dates de rendez-vous et leur suivi sont gratuits. Vous pouvez commencer sans carte bancaire.</p><p>L’export des rendez-vous datés vers un agenda externe fait partie de ${link('/poum-plus/','Poum Plus')}. Poum n’envoie pas de rappels automatiques : les rappels d’un agenda dépendent de l’import du fichier et des réglages de cet agenda.</p>`) +
        faq([
          ['Puis-je changer mes dates ensuite ?', 'Oui. Modifiez vos repères lorsque votre terme est confirmé ou ajusté. Les dates de rendez-vous que vous avez saisies restent prioritaires sur les périodes estimées.'],
          ['Le calendrier convient-il à toutes les situations ?', 'Il présente des repères français généraux. Une grossesse multiple, un parcours de PMA, une datation incertaine ou un suivi particulier nécessitent les indications de votre équipe médicale. Vous pouvez ajouter vos propres rendez-vous.'],
          ['Puis-je effacer mon suivi ?', 'Oui. Dans vos repères de grossesse, vous pouvez mettre le suivi en pause ou l’effacer. Consultez aussi la page '+link('/#confidentialite','Vos données')+' pour les informations sur l’enregistrement et la synchronisation.']
        ]) +
        `<p class="seo-caution">Les indications de votre sage-femme ou médecin et votre calendrier de suivi officiel restent prioritaires. Poum organise votre suivi, sans remplacer une consultation.</p>` +
        section('Aussi, les questions du quotidien', `<p>Retrouvez le ${link('/alimentation-grossesse/','guide alimentaire pendant la grossesse')}, les ${link('/recettes-grossesse/','recettes gratuites')} et le fonctionnement du ${link('/scanner-grossesse/','scan de produits avec Plus')}.</p>`) +
        start('/#grossesse', 'Commencer mon suivi')
    },
    {
      url: '/scanner-grossesse/',
      title: 'Scanner un produit alimentaire enceinte avec Poum Plus',
      description: 'Comment fonctionne le scan de code-barres Poum Plus : fiche du produit, ingrédients, allergènes déclarés et précautions repérées pendant la grossesse.',
      body: intro('Le scan · Poum Plus', 'Ce produit, je peux en manger enceinte ?', 'Scannez son code-barres pour consulter les informations disponibles sur sa composition et les précautions repérées pendant la grossesse.') +
        start('/#plus', 'Découvrir le scan avec Poum Plus') +
        section('Comment utiliser le scan', '<ol class="seo-steps"><li>Connectez-vous à votre compte avec un accès Poum Plus actif.</li><li>Ouvrez le scanner dans la recherche de produits et autorisez la caméra si vous souhaitez l’utiliser.</li><li>Présentez le code-barres. Vous pouvez aussi choisir une photo ou saisir les chiffres du code.</li><li>Consultez la fiche trouvée et comparez les informations avec votre emballage.</li></ol><p>Le code-barres sert à retrouver le produit. Il ne permet pas de contrôler son lot, sa date limite, sa conservation ou sa cuisson.</p>') +
        section('Ce que vous retrouvez dans la fiche', '<dl class="seo-definitions"><dt>Les précautions repérées</dt><dd>Des indications à partir du nom, des catégories et de la composition renseignés. La réponse peut demander de vérifier un ingrédient ou une préparation.</dd><dt>La liste d’ingrédients</dt><dd>La composition disponible dans la fiche, à comparer avec l’étiquette de votre produit.</dd><dt>Les allergènes et traces déclarés</dt><dd>Les mentions présentes dans la base. Une mention absente ne garantit pas l’absence d’allergène ou de traces.</dd><dt>Les mentions de traitement et de conservation</dt><dd>Les éléments renseignés, par exemple un traitement du lait ou une consigne après ouverture. Ils ne sont pas disponibles sur tous les produits.</dd></dl>') +
        section('Quand des informations manquent', '<p>Les fiches proviennent d’Open Food Facts, une base collaborative. Elles peuvent être absentes, anciennes ou incomplètes. Si le produit n’est pas trouvé ou si les informations ne suffisent pas, Poum ne peut pas conclure à sa compatibilité avec votre situation.</p><p>« Aucun signal repéré » n’est pas une garantie de sécurité. Vérifiez l’étiquette et les conditions de préparation ; demandez conseil à votre professionnel de santé si vous avez un doute.</p>') +
        section('Le scan est payant ; la recherche par nom reste gratuite', `<p>La caméra, la photo et la saisie d’un code-barres nécessitent Poum Plus. Avec un accès gratuit, vous pouvez rechercher un produit par son nom et consulter le ${link('/aliments/','guide des aliments')}.</p><p>La première semaine de menus offerte avec un compte gratuit ne débloque pas le scan. Retrouvez le détail des accès et les tarifs sur ${link('/poum-plus/','la page Poum Plus')}.</p>`) +
        faq([
          ['Faut-il installer une application ?', 'Poum fonctionne dans le navigateur. Pour le scan caméra, votre appareil et votre navigateur doivent autoriser l’accès à la caméra. La photo et la saisie du code sont aussi proposées avec Plus.'],
          ['Les photos sont-elles envoyées à Poum ?', 'La caméra et les photos de codes-barres sont analysées sur votre appareil. Le code lu est envoyé au serveur Poum puis à Open Food Facts pour rechercher le produit. Les images de la caméra ne sont pas enregistrées dans le carnet.'],
          ['Puis-je consulter les précautions sans abonnement ?', 'Oui. La recherche de produits par nom et le guide alimentaire sont gratuits. L’accès au scan de code-barres nécessite Plus.']
        ]) +
        `<p>${link('/sources-et-methode/','Lire les sources et la méthode de Poum')} · ${link('/calendrier-grossesse/','Découvrir le calendrier gratuit')}</p>`
    },
    {
      url: '/poum-plus/',
      title: 'Poum gratuit ou Poum Plus : fonctionnalités et tarifs',
      description: `Calendrier gratuit, guide alimentaire et recettes ; avec Poum Plus, scan de produits, semaines de menus et exports. Pass ${pass.months} mois ou abonnement mensuel.`,
      body: intro('Les accès Poum', 'Commencer gratuitement. Choisir Plus si vous en avez besoin.', 'Le suivi de grossesse reste gratuit. Plus ajoute le scan des produits, les nouvelles semaines de menus et les exports pour organiser votre quotidien.') +
        `<div class="seo-plan-grid"><section class="seo-plan"><p class="seo-kicker">Gratuit</p><h2>Votre suivi et vos repères</h2><ul><li>${link('/calendrier-grossesse/','Calendrier de grossesse')} et étapes expliquées</li><li>Suivi documentaire des examens et questions à poser</li><li>${link('/alimentation-grossesse/','Guide alimentaire')} et recherche de produits par nom</li><li>${freeCount} ${link('/recettes-grossesse/','recettes complètes gratuites')}</li><li>Une première semaine de menus offerte avec un compte</li></ul>${start('/#grossesse','Commencer gratuitement')}</section><section class="seo-plan"><p class="seo-kicker">Poum Plus</p><h2>Le scan, les menus et les exports</h2><ul><li>${link('/scanner-grossesse/','Scan caméra, photo ou code-barres')}</li><li>Nouvelles semaines de menus et courses regroupées</li><li>Accès au catalogue de ${new Intl.NumberFormat('fr-FR').format(recipeCount)} recettes, dont les recettes gratuites</li><li>Exports des menus, courses et rendez-vous datés</li></ul>${start('/#plus','Choisir mon accès Plus')}</section></div>` +
        section('Deux formules, les mêmes fonctions Plus', `<div class="seo-plan-grid">${[pass,monthly].map(plan=>`<div class="seo-plan"><h3>${esc(plan.name)}</h3><p class="seo-price">${esc(price(plan))} <span>${esc(plan.cadence)}</span></p><p>${esc(plan.terms)}</p></div>`).join('')}</div><p>Le compte permet de retrouver votre accès. Le paiement s’effectue sur la page sécurisée de Stripe, ouverte depuis Poum.</p>`) +
        section('Des recettes qui tiennent compte de vos choix', '<p>Renseignez séparément vos allergies, vos goûts habituels et ce qui ne vous tente pas en ce moment. L’atelier propose les plats à partir des ingrédients renseignés et de vos exclusions. Vous pouvez remplacer un plat avant de retrouver les courses correspondantes.</p><p>Le filtrage ne garantit pas l’absence d’allergènes ou de traces. Vérifiez toujours les ingrédients que vous achetez et leurs étiquettes.</p>') +
        faq([
          ['La semaine offerte inclut-elle le scan ?', 'Non. Elle permet d’essayer une première semaine de menus avec un compte gratuit. Le scan de code-barres nécessite un accès Plus actif.'],
          ['Le pass se renouvelle-t-il automatiquement ?', `Non. Le pass donne ${pass.months} mois d’accès en un paiement. L’abonnement mensuel, lui, se renouvelle automatiquement et peut être résilié pour la prochaine échéance depuis Mon espace.`],
          ['Dois-je payer pour suivre mes rendez-vous ?', 'Non. Le calendrier, les dates de rendez-vous et les étapes cochées restent gratuits. Seul l’export vers un agenda externe fait partie de Plus.'],
          ['Poum fournit-il un suivi médical ?', 'Non. Poum aide à organiser les rendez-vous, documents et questions, et propose des repères alimentaires. Les prescriptions, l’interprétation des résultats et les conseils adaptés à votre grossesse relèvent de votre professionnel de santé.']
        ]) + start('/#plus', 'Voir les formules dans Poum')
    }
  ];
};
