/* Editorial explanations, reviewed against the linked French public sources.
   Topics describe a conversation, not an individual prescription. */
(function(root){
  'use strict';
  const ameli='https://www.ameli.fr/assure/sante/devenir-parent/grossesse/grossesse-en-bonne-sante/grossesse/';
  const guides={
    first:{
      intro:'Ce rendez-vous sert à faire connaissance avec la personne qui suivra votre grossesse et à organiser les premières étapes.',
      topics:[['Votre santé','Antécédents, allergies, traitements et grossesses précédentes : ces informations permettent d’adapter le suivi. Signalez aussi les médicaments ou compléments pris sans ordonnance.'],['Comment vous allez','Fatigue, nausées, moral, travail : vous pouvez parler de ce qui vous gêne ou vous inquiète.'],['Le suivi à organiser','Le professionnel fait le point sur vos dates, vous examine et précise les examens à prévoir. Demandez qui vous expliquera les résultats et comment le joindre.']],
      bring:['Votre date de dernières règles, si vous la connaissez.','Vos ordonnances, résultats disponibles et votre liste de questions.'],
      next:'Repartez avec les prochaines étapes et les coordonnées utiles. La première consultation et l’échographie du premier trimestre sont deux rendez-vous distincts.'
    },
    'blood-first':{
      intro:'Il s’agit de réaliser les analyses prescrites au début du suivi, puis d’en discuter avec le professionnel qui vous accompagne.',
      topics:[['Comprendre l’ordonnance','Selon votre situation : groupe sanguin, rhésus, anticorps, dépistages infectieux ou analyses d’urines. Demandez à quoi correspond chaque ligne ; cette fiche ne constitue pas une ordonnance.'],['Organiser le prélèvement','Le laboratoire vous indique les conditions à respecter et les documents nécessaires. Ne supposez pas qu’il faut être à jeun : vérifiez pour les analyses prescrites.'],['Retrouver les résultats','Notez où ils seront transmis et qui doit les relire. Une ligne absente peut correspondre à un résultat encore attendu.']],
      bring:['L’ordonnance en cours et les résultats antérieurs demandés.'],
      next:'Dans « Mes examens », gardez la trace de ce qui est prescrit et reçu. Faites expliquer les résultats ; Poum ne les interprète pas.'
    },
    screening:{
      intro:'Ce temps d’information vous aide à choisir si vous souhaitez un dépistage de la trisomie 21 et à comprendre ses limites.',
      topics:[['Ce que le dépistage indique','Il estime une probabilité ; il ne pose pas un diagnostic. Le parcours peut associer l’âge, une échographie et des marqueurs sanguins.'],['Votre choix','Vous pouvez poser vos questions, accepter ou refuser. Demandez comment se déroule chaque examen et comment ses résultats vous seront expliqués.'],['Les suites possibles','Selon les résultats, d’autres examens peuvent être proposés, dont le DPNI. Un résultat de dépistage doit être discuté avant toute conclusion.']],
      bring:['Vos questions et les comptes rendus déjà disponibles.'],
      next:'Si vous choisissez le dépistage, faites confirmer les délais des examens avec votre professionnel.'
    },
    echo1:{
      intro:'Cette échographie précise le terme et permet une première observation du développement de la grossesse.',
      topics:[['Les points observés','Le professionnel observe notamment la vitalité, le nombre de fœtus et leurs mesures. La clarté nucale fait partie des éléments du dépistage proposé.'],['Vos questions','Demandez que les mots du compte rendu vous soient expliqués, ainsi que les éventuelles suites à organiser.']],
      bring:['Les documents demandés par le cabinet et vos examens précédents.'],
      next:'Conservez le compte rendu. Si le terme est confirmé ou corrigé, renseignez-le dans « Mes repères » pour actualiser votre calendrier.'
    },
    declaration:{
      intro:'Cette démarche informe les organismes qui gèrent vos droits de maternité. Elle se prépare avec le médecin ou la sage-femme après le premier examen prénatal.',
      topics:[['Qui la transmet ?','Demandez si le professionnel l’a envoyée en ligne ou vous remet un formulaire papier à transmettre.'],['À qui ?','Vérifiez les démarches auprès de l’Assurance Maladie et de la CAF, ou de la MSA selon votre régime.'],['Comment vérifier ?','Consultez vos espaces personnels ou contactez vos organismes pour confirmer la réception et obtenir votre calendrier de suivi.']],
      bring:['Votre carte Vitale et les informations administratives demandées.'],
      next:'Cochez cette étape quand la démarche est faite. L’échographie du premier trimestre n’est pas un préalable systématique à la déclaration.'
    },
    maternity:{
      intro:'Cette étape pratique sert à choisir un lieu de naissance et à connaître ses modalités d’inscription.',
      topics:[['Les disponibilités','Demandez quand vous inscrire, quels documents transmettre et comment confirmer votre inscription.'],['L’organisation','Qui assure les consultations ? Où aller le jour de l’accouchement ? Quels sont les contacts, l’accès et les possibilités pour le coparent ?'],['Vos besoins','Parlez de vos souhaits avec votre équipe pour vérifier que l’établissement correspond au suivi dont vous avez besoin.']],
      bring:['Votre terme estimé ou confirmé et vos questions sur le séjour.'],
      next:'Conservez les coordonnées et les consignes de votre maternité. Les délais d’inscription varient selon l’établissement.'
    },
    'early-talk':{
      source:ameli+'preparation-parentalite',
      intro:'C’est un temps de parole avec une sage-femme ou un médecin, seule ou avec votre coparent, pour parler de vos besoins.',
      topics:[['Votre vécu','Vous pouvez aborder vos émotions, vos inquiétudes et les changements dans votre quotidien.'],['Votre entourage','Soutien à la maison, difficultés au travail, logement ou isolement : ces sujets ont leur place dans l’entretien.'],['Votre projet','Parlez de la naissance, de la préparation et de l’aide dont vous pourriez avoir besoin après.']],
      bring:['Quelques sujets que vous souhaitez aborder, même s’ils ne sont pas médicaux.'],
      next:'Demandez quels accompagnements et contacts peuvent vous aider. Ce rendez-vous est distinct du bilan de prévention.'
    },
    prevention:{
      intro:'C’est un échange avec une sage-femme pour faire le point sur votre quotidien et trouver des conseils adaptés à vos besoins.',
      topics:[['Alimentation et activité physique','Parlez de vos habitudes, de ce qui devient difficile et des ajustements possibles.'],['Tabac, alcool et autres consommations','Vous pouvez demander une aide ou un accompagnement, sans avoir à attendre de réussir seule.'],['Vaccinations et dents','Faites le point sur les vaccinations et le rendez-vous bucco-dentaire à organiser.']],
      bring:['Vos questions, votre carnet de vaccination si vous l’avez et les informations utiles sur votre suivi.'],
      next:'Notez les conseils retenus et les contacts proposés. Tous ces sujets ne nécessitent pas un nouvel examen.'
    },
    dental:{
      source:ameli+'femme-enceinte-soins-dentaire-mtdents',
      intro:'Le dentiste vérifie vos dents et vos gencives et vous explique comment en prendre soin pendant la grossesse.',
      topics:[['Ce qui vous gêne','Signalez douleurs, saignements ou difficultés au brossage, même si vous n’aviez pas prévu d’en parler.'],['L’examen','Le dentiste recherche les problèmes à prendre en charge et explique les soins éventuellement nécessaires.'],['Les conseils','Vous pouvez demander des conseils pour votre bouche et poser vos premières questions sur celle de votre enfant.']],
      bring:['Votre carte Vitale, votre justificatif de complémentaire et l’invitation de prise en charge si vous l’avez reçue.'],
      next:'Si des soins sont nécessaires, convenez des prochains rendez-vous directement avec le dentiste.'
    },
    echo2:{
      intro:'L’échographie morphologique examine le développement et l’anatomie du bébé.',
      topics:[['Les observations','Le professionnel étudie notamment les organes visibles, les mesures, le placenta et le liquide amniotique.'],['Le compte rendu','Demandez ce qui a pu être observé et si un contrôle est nécessaire. Une échographie ne peut pas repérer toutes les anomalies.'],['Vos préférences','Vous pouvez préciser si vous souhaitez connaître le sexe du bébé.']],
      bring:['Le compte rendu de la première échographie et les documents demandés.'],
      next:'Gardez le compte rendu pour votre prochaine consultation et notez les éventuels contrôles proposés.'
    },
    vaccines:{
      intro:'Ce point permet de préparer un calendrier de vaccination adapté à la grossesse, à la saison et à votre situation.',
      topics:[['Ce qui a déjà été fait','Apportez vos dates de vaccination, si vous les connaissez.'],['Ce qui peut être proposé','Coqueluche, grippe, Covid-19 et VRS suivent des recommandations et des périodes différentes. Le professionnel précise celles qui vous concernent.'],['L’organisation','Demandez les dates, le lieu, les bénéfices attendus et les précautions éventuelles.']],
      bring:['Votre carnet de vaccination ou les informations disponibles dans votre dossier de santé.'],
      next:'Enregistrez les dates réellement convenues. Aucun vaccin n’est programmé automatiquement par Poum.'
    },
    'birth-prep':{
      source:ameli+'preparation-parentalite',
      intro:'Les séances de préparation permettent de comprendre la naissance et de préparer les premiers jours avec votre enfant.',
      topics:[['L’accouchement','Vous pouvez aborder son déroulement, la respiration, les positions et le rôle de l’équipe.'],['Les premiers jours','Soins du bébé, alimentation, récupération et place du coparent peuvent être discutés.'],['Le format qui vous convient','Demandez le contenu des séances, les horaires et si elles ont lieu seule, en couple ou en groupe.']],
      bring:['Vos attentes et les questions que vous souhaitez travailler pendant les séances.'],
      next:'Réservez les séances avec votre sage-femme ou votre maternité ; leurs dates dépendent de l’organisation locale.'
    },
    'blood-six':{
      intro:'Cette étape sert à réaliser et retrouver les analyses prévues au sixième mois, selon votre ordonnance.',
      topics:[['Les analyses à confirmer','Les repères nationaux comprennent notamment une numération sanguine et l’antigène HBs. D’autres recherches dépendent de votre situation.'],['Vos résultats précédents','Apportez-les pour éviter de perdre le fil des contrôles ou de confondre deux prescriptions.'],['La relecture','Demandez qui recevra les résultats et quand vous pourrez en parler.']],
      bring:['L’ordonnance et les anciens résultats demandés.'],
      next:'Ajoutez le suivi du bilan dans « Mes examens ». Ne déduisez pas de cette liste que votre ordonnance doit être identique.'
    },
    echo3:{
      intro:'Cette échographie fait le point sur la croissance et la position du bébé en fin de grossesse.',
      topics:[['Les observations','Les mesures, la présentation du bébé et le placenta contribuent à préparer la suite du suivi.'],['Les prochaines étapes','Demandez si le compte rendu nécessite une consultation ou un contrôle supplémentaire.']],
      bring:['Les précédents comptes rendus et les documents demandés par le cabinet.'],
      next:'Transmettez le compte rendu à l’équipe qui vous suit et faites préciser les prochaines dates.'
    },
    anesthesia:{
      source:'https://www.chu-lyon.fr/analgesie-peridurale-obstetricale',
      intro:'La consultation d’anesthésie prépare la prise en charge de la douleur et les éventuels besoins d’anesthésie pour la naissance, même sans projet de péridurale.',
      topics:[['Votre dossier','Signalez vos antécédents, allergies, traitements et expériences d’anesthésie.'],['Vos questions sur la douleur','Demandez comment se passe une péridurale, ses bénéfices, ses limites et les alternatives possibles.'],['Les consignes','L’équipe précise les examens et documents nécessaires. Ne modifiez aucun traitement sans ses instructions.']],
      bring:['Les ordonnances, résultats et documents demandés par la maternité.'],
      next:'Conservez les consignes données et demandez qui contacter si votre situation change avant la naissance.'
    },
    bag:{
      intro:'Un repère pratique pour rassembler vos affaires et les retrouver facilement le jour du départ.',
      topics:[['Les papiers','Regroupez les documents de votre suivi et ceux demandés par la maternité.'],['Pour vous et votre bébé','Partez de la liste de l’établissement : vêtements, toilette et affaires utiles pendant le séjour.'],['L’accès au sac','Convenez avec votre proche de l’endroit où il sera rangé et de ce qu’il restera à ajouter au dernier moment.']],
      bring:['La liste fournie par votre maternité.'],
      next:'Cochez quand cela vous convient. Il s’agit d’une aide à l’organisation, sans échéance médicale.'
    },
    home:{
      intro:'Cette étape pratique aide à organiser le soutien dont vous pourriez avoir besoin après la naissance.',
      topics:[['Le suivi','Demandez à votre équipe comment organiser les rendez-vous après la sortie.'],['Le quotidien','Identifiez qui peut aider pour les repas, les courses, les autres enfants ou les trajets.'],['Vos contacts','Gardez les numéros utiles et demandez à qui adresser vos questions une fois à la maison.']],
      bring:['Une liste des personnes que vous pouvez solliciter et de vos besoins.'],
      next:'Partagez les tâches avec votre entourage et ajustez cette organisation après la naissance.'
    }
  };
  const monthlyFocus={
    4:'C’est l’occasion de reprendre les résultats du début de grossesse et les rendez-vous encore à organiser.',
    5:'Vous pouvez faire le point sur l’échographie du deuxième trimestre, selon la date à laquelle elle est prévue.',
    6:'Pensez à demander quelles analyses sont prévues et à quelle consultation leurs résultats seront discutés.',
    7:'Vous pouvez parler de la préparation à la naissance et de l’organisation des rendez-vous de fin de grossesse.',
    8:'Vérifiez avec votre équipe que la consultation d’anesthésie et les prochaines étapes sont organisées.',
    9:'Demandez les consignes de votre maternité pour la naissance et la conduite à tenir si le terme est atteint.'
  };
  function get(t){
    if(guides[t.id])return guides[t.id];
    if(/^visit[4-9]$/.test(t.id))return {
      intro:'Ce rendez-vous régulier permet de suivre votre santé, l’évolution de la grossesse et les résultats récents.',
      topics:[['Comment vous allez','Parlez de vos symptômes, de votre moral et de ce qui a changé depuis la dernière fois.'],['Le suivi clinique','Le professionnel contrôle notamment la tension, le poids et la croissance de l’utérus. Il adapte les examens à votre situation.'],['Ce mois-ci',monthlyFocus[t.id.slice(-1)]]],
      bring:['Les résultats et comptes rendus récents, vos ordonnances et vos questions.'],
      next:'Avant de partir, faites préciser les examens attendus et la prochaine date. Demandez quels signes doivent vous faire contacter l’équipe sans attendre ce rendez-vous.'
    };
    if(/^toxo[2-9]$/.test(t.id))return {
      source:'https://www.ameli.fr/assure/sante/themes/toxoplasmose/bons-reflexes-cas-faut-consulter',
      intro:'Ce contrôle concerne le suivi mensuel lorsque votre professionnel a confirmé que vous n’êtes pas immunisée contre la toxoplasmose.',
      topics:[['La date du prélèvement','Faites-la confirmer à partir de l’ordonnance et du contrôle précédent. Le mois indiqué ici est un repère.'],['Le résultat','Il doit être relu par le professionnel qui vous suit. Ne déduisez pas votre immunisation des seuls chiffres du compte rendu.'],['Vos questions','Profitez du suivi pour demander les précautions adaptées à votre quotidien.']],
      bring:['L’ordonnance et le résultat du contrôle précédent.'],
      next:'Notez la réception du résultat dans « Mes examens » et confirmez le prochain contrôle.'
    };
    return {intro:t.description,topics:[['Vos questions','Notez ce que vous souhaitez aborder et les informations à transmettre à votre interlocuteur.']],bring:['Les documents qui vous ont été demandés.'],next:'Après le rendez-vous, conservez vos notes et cochez « Fait ».'};
  }
  const api={get};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PoumPregnancyGuide=api;
})(typeof window!=='undefined'?window:globalThis);
