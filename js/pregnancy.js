/* Shared pregnancy organiser. Dates are planning references, never prescriptions. */
(function (root) {
  'use strict';
  const DAY = 86400000;
  const sources = {
    first: 'https://www.ameli.fr/assure/sante/devenir-parent/grossesse/grossesse-en-bonne-sante/grossesse/grossesse-soins-dentaires-dentiste-consultation',
    follow: 'https://www.ameli.fr/assure/sante/devenir-parent/grossesse/grossesse-en-bonne-sante/grossesse/consultation-suivi-mensuel',
    official: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F963',
    declaration: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F968',
    screening: 'https://www.has-sante.fr/jcms/c_2899277/fr/depistage-de-la-trisomie-21',
    vaccines: 'https://professionnels.vaccination-info-service.fr/Recommandations-vaccinales-specifiques/Personnes-exposees-a-des-risques-specifiques/Femmes-enceintes'
  };
  const validDate = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v + 'T12:00:00Z')) && new Date(v + 'T12:00:00Z').toISOString().slice(0, 10) === v;
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
  const add = (v, days) => new Date(Date.parse(v + 'T12:00:00Z') + days * DAY).toISOString().slice(0, 10);
  const text = (v, n) => typeof v === 'string' ? v.trim().slice(0, n) : '';
  const idOK = v => typeof v === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(v) && !['__proto__', 'constructor', 'prototype'].includes(v);
  const profileEmpty = () => ({ basis: 'lmp', date: '', cycle: 28, birthDate: '', toxo: 'unknown', consent: false, paused: false });
  const empty = () => ({ profile: profileEmpty(), tasks: {}, questions: [], exams: [] });
  function clean(raw) {
    const result = empty();
    if (!raw || typeof raw !== 'object' || !raw.profile?.consent) return result;
    const p = raw.profile;
    result.profile = { basis: p.basis === 'term' ? 'term' : 'lmp', date: validDate(p.date) ? p.date : '', cycle: Number.isInteger(p.cycle) && p.cycle >= 21 && p.cycle <= 40 ? p.cycle : 28, birthDate: validDate(p.birthDate) ? p.birthDate : '', toxo: ['unknown','immune','nonimmune'].includes(p.toxo) ? p.toxo : 'unknown', consent: true, paused: p.paused === true };
    for (const [id, t] of Object.entries(raw.tasks || {}).slice(0, 100)) if (idOK(id) && t && typeof t === 'object') result.tasks[id] = { title: text(t.title, 100), status: ['todo','scheduled','done','skip'].includes(t.status) ? t.status : 'todo', date: validDate(t.date) ? t.date : '', time: /^([01]\d|2[0-3]):[0-5]\d$/.test(t.time) ? t.time : '', note: text(t.note, 700), assignee: t.assignee === 'partner' ? 'partner' : 'me' };
    result.questions = (Array.isArray(raw.questions) ? raw.questions : []).filter(q => q && idOK(q.id) && text(q.text,400)).slice(0,40).map(q => ({ id:q.id,text:text(q.text,400),done:q.done===true }));
    result.exams = (Array.isArray(raw.exams) ? raw.exams : []).filter(e => e && idOK(e.id)).slice(0,12).map(e => ({ id:e.id, title:text(e.title,100), date:validDate(e.date)?e.date:'', note:text(e.note,700), items:(Array.isArray(e.items)?e.items:[]).filter(i=>i && idOK(i.id) && text(i.label,100)).slice(0,30).map(i=>({id:i.id,label:text(i.label,100),status:['expected','pending','received','discussed'].includes(i.status)?i.status:'expected',evidence:text(i.evidence,240),document:text(i.document,100),page:Number.isInteger(i.page)&&i.page>0&&i.page<=10?i.page:1})) }));
    return result;
  }
  function validate(raw) {
    if (raw === undefined) return empty();
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw Error('Le suivi est illisible.');
    const c = clean(raw), p = raw.profile;
    if (!p || typeof p !== 'object' || !['lmp','term'].includes(p.basis) || typeof p.consent !== 'boolean' || typeof p.paused !== 'boolean' || (p.date && !validDate(p.date)) || (p.birthDate && !validDate(p.birthDate)) || !Number.isInteger(p.cycle) || p.cycle<21 || p.cycle>40 || !['unknown','immune','nonimmune'].includes(p.toxo)) throw Error('Vérifiez les informations de grossesse.');
    if (!p.consent && (p.date || p.birthDate || p.toxo !== 'unknown' || Object.keys(raw.tasks||{}).length || raw.questions?.length || raw.exams?.length)) throw Error('Votre accord est nécessaire pour enregistrer ce suivi.');
    if (p.consent) {
      if (!raw.tasks || Array.isArray(raw.tasks) || typeof raw.tasks!=='object' || !Array.isArray(raw.questions) || !Array.isArray(raw.exams) || JSON.stringify(raw).length>140000) throw Error('Le suivi est trop volumineux ou incomplet.');
      if (Object.keys(raw.tasks).length!==Object.keys(c.tasks).length || raw.questions.length!==c.questions.length || raw.exams.length!==c.exams.length) throw Error('Le suivi contient trop d’éléments ou des identifiants invalides.');
      for (const list of [raw.questions,raw.exams,...raw.exams.map(e=>e.items)]) {
        if (!Array.isArray(list) || new Set(list.map(i=>i?.id)).size!==list.length) throw Error('Des éléments du suivi sont dupliqués.');
      }
      for (const e of raw.exams) if (e.items.length>30 || e.items.length !== c.exams.find(x=>x.id===e.id).items.length) throw Error('Limitez chaque bilan à 30 analyses.');
    }
    return c;
  }
  function dates(raw, at = today()) {
    const p = clean(raw).profile;
    if (!p.date || !p.consent || !validDate(at)) return null;
    const due = p.basis === 'term' ? p.date : add(p.date, 287 + p.cycle - 28);
    const start = add(due,-287), days = Math.floor((Date.parse(at+'T12:00:00Z')-Date.parse(start+'T12:00:00Z'))/DAY);
    const age = p.birthDate ? new Date(due).getUTCFullYear()-new Date(p.birthDate).getUTCFullYear()-(due.slice(5)<p.birthDate.slice(5)?1:0) : null;
    return { due,start,days,week:Math.floor(days/7),day:((days%7)+7)%7,trimester:days<98?1:days<196?2:3,progress:Math.max(0,Math.min(100,days/287*100)),age,estimated:p.basis!=='term' };
  }
  // SA windows and calendar months deliberately remain distinct. A planning
  // range never becomes an appointment unless the person enters a date.
  function addMonths(value, months) {
    const d = new Date(value + 'T12:00:00Z'), day = d.getUTCDate();
    d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + months);
    const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth()+1, 0)).getUTCDate();
    d.setUTCDate(Math.min(day,last)); return d.toISOString().slice(0,10);
  }
  const milestones = [
    {id:'first',title:'Le premier rendez-vous',category:'rendezvous',kind:'deadline',months:[0,3],timing:'Avant la fin du 3e mois',
      description:'Prenez contact dès que vous savez que vous êtes enceinte. Ce premier examen confirme la grossesse et organise le suivi.',
      prepare:'La consultation et l’échographie du premier trimestre sont deux étapes distinctes. Apportez vos antécédents, traitements et résultats disponibles.',source:'first'},
    {id:'blood-first',title:'Faire le point sur le premier bilan',category:'examens',kind:'flexible',months:[0,3],after:'first',timing:'Après la consultation · sur ordonnance',
      description:'Les prises de sang et analyses d’urines sont prescrites selon votre situation, avec leurs délais propres.',
      prepare:'Rassemblez votre ordonnance et les résultats déjà disponibles. Demandez quels prélèvements sont attendus et quand les faire ; le calendrier ne remplace pas la prescription.',source:'first'},
    {id:'screening',title:'Parler du dépistage prénatal',category:'rendezvous',kind:'flexible',months:[0,3],after:'first',timing:'À aborder au premier trimestre',
      description:'Discutez tôt des possibilités de dépistage et de votre choix. Le parcours combine plusieurs informations, dont l’âge, les marqueurs et l’échographie.',
      prepare:'Si vous choisissez le dépistage, faites confirmer les créneaux de prise de sang et d’échographie. L’âge seul ne constitue pas une prescription.',source:'screening'},
    {id:'echo1',title:'L’échographie du premier trimestre',category:'rendezvous',kind:'window',days:[77,97],timing:'11 SA à 13 SA + 6 jours',
      description:'Cette échographie précise la datation et le terme. Une échographie plus précoce peut être proposée selon la situation ; elle ne remplace pas ce rendez-vous.',
      prepare:'Faites confirmer la date par votre professionnel et actualisez vos repères avec le terme communiqué.',source:'first'},
    {id:'declaration',title:'Vérifier ma déclaration de grossesse',category:'demarches',kind:'deadline',months:[0,3],after:'first',timing:'Avant la fin du 3e mois',
      description:'Après le premier examen prénatal, le médecin ou la sage-femme établit la déclaration. Vérifiez avec votre professionnel quand transmettre les éléments.',
      prepare:'Vérifiez la transmission à l’Assurance Maladie et à la CAF/MSA. Les textes ne font pas de l’échographie du premier trimestre un préalable systématique. Suivez le calendrier communiqué par vos organismes ; aucun jour précis n’est fixé par Poum.',source:'declaration'},
    {id:'maternity',title:'Choisir ma maternité',category:'pratique',kind:'flexible',timing:'Se renseigner dès que possible',
      description:'Contactez les maternités qui vous intéressent : les modalités et délais d’inscription varient selon l’établissement.',
      prepare:'Demandez les disponibilités, les documents et les contacts utiles directement à votre maternité.',source:null},
    {id:'early-talk',title:'L’entretien prénatal précoce',category:'rendezvous',kind:'flexible',after:'declaration',timing:'Le plus tôt possible',
      description:'Un entretien pour parler de vos besoins et préparer votre accompagnement, à organiser dès la déclaration de grossesse.',
      prepare:'Il peut avoir lieu dès le début du suivi. Vous pouvez venir avec le coparent.',source:'first'},
    {id:'prevention',title:'Le bilan prénatal de prévention',category:'rendezvous',kind:'deadline',days:[0,167],after:'declaration',timing:'Si possible avant 24 SA',
      description:'Ce bilan avec une sage-femme peut être réalisé dès la déclaration de grossesse.',
      prepare:'Faites le point sur l’alimentation, les habitudes de vie, les vaccinations et la santé bucco-dentaire. « Avant 24 SA » est une période conseillée, pas un rendez-vous fixé.',source:'follow'},
    {id:'dental',title:'Mon rendez-vous chez le dentiste',category:'rendezvous',kind:'window',months:[3,9],timing:'À partir du 4e mois',
      description:'Organisez votre examen bucco-dentaire à partir du quatrième mois. Il n’a pas besoin d’être fixé à une semaine précise par Poum.',
      prepare:'Retrouvez les modalités de prise en charge dans votre espace Ameli. Le dispositif se prolonge jusqu’au sixième mois après l’accouchement.',source:'first'},
    {id:'echo2',title:'L’échographie du deuxième trimestre',category:'rendezvous',kind:'window',days:[140,168],timing:'Entre 20 et 24 SA',
      description:'Prévoyez l’échographie morphologique avec votre professionnel dans cette période.',
      prepare:'Apportez le précédent compte rendu et vos questions.',source:'follow'},
    {id:'vaccines',title:'Faire le point sur les vaccinations',category:'rendezvous',kind:'flexible',after:'first',timing:'Dès le premier rendez-vous',
      description:'Les vaccinations n’ont pas toutes la même période : abordez-les dès le début du suivi, selon la saison et votre situation.',
      prepare:'Coqueluche : à chaque grossesse, de préférence entre 20 et 36 SA. VRS : entre 32 et 36 SA pendant la campagne, selon les recommandations en vigueur. Grippe et Covid-19 : discussion selon la campagne, sans attendre 20 SA. Votre professionnel fixe le calendrier adapté.',source:'vaccines'},
    {id:'birth-prep',title:'Préparer la naissance, à mon rythme',category:'pratique',kind:'flexible',after:'declaration',timing:'À organiser avec ma sage-femme',
      description:'Organisez vos séances de préparation dès que vous le souhaitez avec l’équipe qui vous suit.',
      prepare:'Les séances ont souvent lieu à partir du septième mois, mais il n’existe pas de créneau unique imposé. Demandez les disponibilités et les formats proposés.',source:'official'},
    {id:'blood-six',title:'Retrouver mon bilan du 6e mois',category:'examens',kind:'window',months:[5,6],timing:'Au cours du 6e mois',
      description:'Rassemblez les examens prescrits pour le sixième mois et prévoyez leur réalisation avec votre professionnel.',
      prepare:'Les repères nationaux prévoient notamment la numération globulaire et l’antigène HBs ; la RAI dépend notamment du rhésus et des antécédents de transfusion. Votre ordonnance précise ce qui vous concerne.',source:'official'},
    {id:'echo3',title:'L’échographie du troisième trimestre',category:'rendezvous',kind:'window',days:[210,245],timing:'Entre 30 et 35 SA',
      description:'Organisez ce rendez-vous selon la datation retenue et les indications de votre équipe.',
      prepare:'La période présentée reprend le repère Ameli. Le créneau donné par la maternité reste prioritaire.',source:'follow'},
    {id:'anesthesia',title:'La consultation d’anesthésie',category:'rendezvous',kind:'window',months:[7,8],timing:'Au cours du 8e mois',
      description:'La consultation est prévue au huitième mois, même sans projet de péridurale.',
      prepare:'La maternité fixe le rendez-vous et précise les documents à apporter.',source:'official'},
    {id:'bag',title:'Préparer le sac de maternité',category:'pratique',kind:'flexible',months:[7,9],timing:'À votre rythme',
      description:'Un repère pratique Poum : rassemblez les essentiels quand cela vous convient.',
      prepare:'Demandez la liste de votre maternité. Ce n’est pas une échéance médicale.',source:null},
    {id:'home',title:'Organiser les premiers jours à la maison',category:'pratique',kind:'flexible',months:[8,9],timing:'Avant la naissance',
      description:'Anticipez l’aide au quotidien et prenez contact avec le professionnel qui assurera le suivi après la naissance.',
      prepare:'Votre équipe peut vous orienter pour le retour à domicile.',source:'follow'}
  ];
  function timeline(raw, at=today()) {
    const j=clean(raw), d=dates(j,at);if(!d || j.profile.paused)return [];
    const conception=add(d.start,14), definitions=[...milestones];
    for(let month=4;month<=9;month++) definitions.push({id:'visit'+month,title:`Ma consultation du ${month}e mois`,category:'rendezvous',kind:'window',months:[month-1,month],timing:`Au cours du ${month}e mois`,description:'Une consultation par mois à partir du quatrième mois, après le premier examen prénatal.',prepare:'Les limites des mois ci-dessous sont estimées depuis votre repère de grossesse. Faites confirmer vos dates avec le calendrier de suivi reçu de l’Assurance Maladie.',source:'official'});
    // Monthly monitoring must not silently begin only in the fourth month.
    if(j.profile.toxo==='nonimmune') for(let month=2;month<=9;month++) definitions.push({id:'toxo'+month,title:`Toxoplasmose · suivi du ${month}e mois`,category:'examens',kind:'window',months:[month-1,month],timing:`Chaque mois · repère du ${month}e mois`,description:'Après confirmation de la non-immunisation, le contrôle est mensuel, dès le début du suivi.',prepare:'Ces plages ne fixent pas le jour du prélèvement : suivez l’ordonnance et la date du précédent contrôle. Si cette période précède votre premier bilan, indiquez « Non prévu avec mon professionnel ».',source:'follow'});
    const items=definitions.map((m,order)=>{
      const start=m.days?add(d.start,m.days[0]):m.months?addMonths(conception,m.months[0]):conception;
      const end=m.days?add(d.start,m.days[1]):m.months?add(addMonths(conception,m.months[1]),-1):d.due;
      return {...m,order,start,end,source:sources[m.source]||null,...j.tasks[m.id],title:j.tasks[m.id]?.title||m.title};
    });
    for(const t of items) if(t.after && j.tasks[t.after]?.date && !t.date) t.start = [t.start,j.tasks[t.after].date].sort().at(-1);
    for(const [id,t] of Object.entries(j.tasks)) if(id.startsWith('custom-'))items.push({id,kind:'personal',category:'personnel',description:'Votre rendez-vous personnel.',prepare:'',source:null,start:t.date||at,end:t.date||at,...t,order:items.length});
    return items.map(t=>({...t,status:t.status||'todo',when:t.date||t.start,phase:t.date?(t.date<at?'past':t.date>at?'future':'now'):t.end<at?'past':t.start>at?'future':'now'})).sort((a,b)=>a.when.localeCompare(b.when)||a.order-b.order);
  }
  const aliases = [
    ['Groupe sanguin',/\b(?:groupe sanguin|groupage|abo)\b/],['Rhésus',/\b(?:rhesus|rhd|rh d)\b/],['RAI',/\b(?:rai|agglutinines irregulieres|anticorps irreguliers)\b/],
    ['Toxoplasmose',/\b(?:toxoplasmose|toxoplasma|toxo)\b/],['Rubéole',/\b(?:rubeole|rubella)\b/],['Hépatite B',/\b(?:hepatite b|antigene hbs|ag hbs|hbsag)\b/],['VIH',/\b(?:vih|hiv)\b/],['Syphilis',/\b(?:syphilis|treponem|tpha|vdrl)/],
    ['NFS',/\b(?:nfs|hemogramme|numeration formule|numeration sanguine)\b/],['Ferritine',/\bferritine\b/],['Glycémie',/\b(?:glycemie|glucose)\b/],['HGPO',/\b(?:hgpo|hyperglycemie provoquee)\b/],['CMV',/\b(?:cmv|cytomegalovirus)\b/],['TSH',/\b(?:tsh|thyreostimuline)\b/],['PAPP-A',/\bpapp[ -]?a\b/],['β-hCG libre',/\b(?:beta hcg libre|hcg libre|free beta hcg)\b/]
  ];
  const normalize=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/β/g,'beta ').toLowerCase().replace(/[^a-z0-9\n]/g,' ').replace(/[^\S\n]+/g,' ').trim();
  function recognised(pages) {
    const result=[];
    for(const [label,pattern] of aliases){const found=findLine(pages,line=>pattern.test(normalize(line)));if(found)result.push({label,...found});}
    return result;
  }
  function findLine(pages,match){for(const p of pages||[])for(const line of String(p.text||'').split('\n'))if(match(line))return {excerpt:line.trim().slice(0,240),page:p.page||1};return null;}
  function compare(items,pages) {
    return items.map(item=>{const n=normalize(item.label),known=aliases.find(([label])=>normalize(label)===n);const found=findLine(pages,line=>known?known[1].test(normalize(line)):n.length>=3&&(' '+normalize(line)+' ').includes(' '+n+' '));return {id:item.id,label:item.label,found:Boolean(found),...(found||{})};});
  }
  function calendar(raw,{partnerOnly=false,at=today()}={}) {
    const escape=v=>String(v||'').replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
    const events=timeline(raw,at).filter(t=>!['done','skip'].includes(t.status)&&t.date&&t.date>=at&&(!partnerOnly||t.assignee==='partner'));
    const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Poum//Mon calendrier//FR','CALSCALE:GREGORIAN','METHOD:PUBLISH'];
    for(const t of events){const date=t.when.replace(/-/g,''),dateTime=t.time?date+'T'+t.time.replace(':','')+'00':null;lines.push('BEGIN:VEVENT',`UID:${typeof module!=='undefined'&&module.exports?require('node:crypto').createHash('sha256').update(t.id+dates(raw,at).due).digest('hex').slice(0,32):t.id}@poum.app`,`DTSTAMP:${at.replace(/-/g,'')}T120000Z`,dateTime?`DTSTART:${dateTime}`:`DTSTART;VALUE=DATE:${date}`,`SUMMARY:${escape(partnerOnly?'Poum · Une chose à prévoir':t.title)}`,`DESCRIPTION:${escape(partnerOnly?'Une tâche partagée depuis Poum. Retrouvez les détails avec la personne qui vous a envoyé ce calendrier.':(t.date?'Rendez-vous enregistré. ':'Repère indicatif à confirmer. ')+t.description)}`,'CLASS:PRIVATE','BEGIN:VALARM',dateTime?'TRIGGER:-P1D':'TRIGGER:-PT15H','ACTION:DISPLAY','DESCRIPTION:Rappel Poum','END:VALARM','END:VEVENT');}
    lines.push('END:VCALENDAR');
    // RFC 5545 folds at 75 UTF-8 octets without cutting a code point.
    const fold=line=>{let out='',length=0;for(const char of line){const size=new TextEncoder().encode(char).length;if(length+size>75){out+='\r\n ';length=1;}out+=char;length+=size;}return out;};
    return lines.map(fold).join('\r\n')+'\r\n';
  }
  const api={empty,clean,validate,dates,timeline,today,add,addMonths,validDate,sources,recognised,compare,calendar};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PoumPregnancy=api;
})(typeof window!=='undefined'?window:globalThis);
