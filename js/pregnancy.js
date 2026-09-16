/* Shared pregnancy organiser. Dates are planning references, never prescriptions. */
(function (root) {
  'use strict';
  const DAY = 86400000;
  const sources = {
    first: 'https://www.ameli.fr/assure/sante/devenir-parent/grossesse/grossesse-en-bonne-sante/grossesse/grossesse-soins-dentaires-dentiste-consultation',
    follow: 'https://www.ameli.fr/assure/sante/devenir-parent/grossesse/grossesse-en-bonne-sante/grossesse/consultation-suivi-mensuel',
    official: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F963',
    declaration: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F968',
    screening: 'https://www.has-sante.fr/jcms/c_2899277/fr/depistage-de-la-trisomie-21'
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
  const milestones = [
    ['first',5,13,'Le premier rendez-vous','rendezvous','Confirmer la datation et préparer votre parcours avec une sage-femme ou un médecin.','Vos antécédents, traitements et questions ; vos documents déjà disponibles.','first'],
    ['blood-first',6,13,'Faire le point sur le premier bilan','examens','Retrouver les analyses prescrites et leurs résultats. Le contenu est défini avec votre professionnel.','Apportez votre ordonnance et vos anciens résultats. Les consignes du laboratoire font référence.','first'],
    ['screening',9,13,'Parler du dépistage prénatal','rendezvous','Comprendre les possibilités de dépistage et faire votre choix. L’âge seul ne détermine pas le parcours.','Quelles étapes me sont proposées ? Quels documents et quels délais prévoir ?','screening'],
    ['echo1',11,13.857142857,'La première échographie','rendezvous','La datation retenue permet d’actualiser votre calendrier.','Notez le terme communiqué dans « Ma grossesse ».','first'],
    ['declaration',8,15,'Vérifier ma déclaration de grossesse','demarches','Vérifier avec le professionnel la déclaration à l’Assurance Maladie et à la CAF.','Suivez le délai indiqué par vos organismes ; retrouvez leurs confirmations.','declaration'],
    ['maternity',10,20,'Choisir ma maternité','pratique','Se renseigner sur l’inscription, les modalités d’accueil et les contacts.','Les délais dépendent de la maternité. Cette période est un repère d’organisation Poum.','official'],
    ['early-talk',14,20,'L’entretien prénatal précoce','rendezvous','Un temps pour parler de vos besoins, de vos questions et de votre accompagnement.','Vous pouvez venir avec le coparent si vous le souhaitez.','follow'],
    ['prevention',14,23,'Le bilan de prévention','rendezvous','Faire le point avec une sage-femme sur votre quotidien et vos besoins.','Rassembler les sujets que vous souhaitez aborder.','follow'],
    ['dental',16,23,'Mon rendez-vous chez le dentiste','rendezvous','Prévoir le bilan bucco-dentaire proposé pendant la grossesse.','Retrouver les modalités de prise en charge dans votre espace Ameli.','follow'],
    ['echo2',20,24,'La deuxième échographie','rendezvous','Prévoir l’échographie morphologique dans la période indiquée par votre professionnel.','Votre précédent compte rendu et vos questions.','follow'],
    ['vaccines',20,36,'Faire le point sur les vaccinations','rendezvous','Échanger sur les vaccinations adaptées à votre situation et à la saison.','Apportez votre carnet de vaccination ; le professionnel définit le calendrier.','follow'],
    ['birth-prep',22,32,'Préparer la naissance, à mon rythme','pratique','Organiser les séances de préparation et réfléchir à vos souhaits.','Respiration, accueil du bébé, alimentation, retour à la maison : choisissez vos questions.','follow'],
    ['blood-six',24,28,'Retrouver mon bilan de suivi','examens','Faire le point sur les examens prescrits à cette étape, selon votre situation.','Les examens et répétitions dépendent notamment des résultats antérieurs.','follow'],
    ['echo3',30,34,'La troisième échographie','rendezvous','Prévoir le rendez-vous selon les indications de votre équipe.','Votre dossier de suivi et vos questions pour la naissance.','follow'],
    ['anesthesia',32,36,'La consultation d’anesthésie','rendezvous','Prévoir la consultation avec votre maternité, même sans projet de péridurale.','La maternité précise la date, les documents et examens nécessaires.','official'],
    ['bag',32,37,'Préparer le sac de maternité','pratique','Rassembler tranquillement les essentiels et les documents.','Demandez la liste de votre maternité. Repère pratique Poum, à adapter.','official'],
    ['home',34,38,'Organiser les premiers jours à la maison','pratique','Répartir les courses, les repas et les aides dont vous aurez envie.','Prévoir les contacts pour le suivi après la naissance.','follow']
  ];
  function timeline(raw, at=today()) {
    const j=clean(raw), d=dates(j,at);if(!d || j.profile.paused)return [];
    const definitions=[...milestones];
    for(let month=4;month<=9;month++)definitions.push(['visit'+month,14+(month-4)*4.35,18+(month-4)*4.35,`Ma consultation du ${month}e mois`,'rendezvous','Un rendez-vous mensuel avec votre sage-femme ou médecin.','Vos questions, les résultats reçus et les rendez-vous à venir.','follow']);
    if(j.profile.toxo==='nonimmune')for(let n=4;n<=9;n++)definitions.push(['toxo'+n,14+(n-4)*4.35,18+(n-4)*4.35,`Toxoplasmose · suivi du ${n}e mois`,'examens','Retrouver le contrôle mensuel prescrit, selon la non-immunisation confirmée par votre professionnel.','Vérifiez l’ordonnance et les modalités avec le laboratoire.','follow']);
    const items=definitions.map(([id,from,to,title,category,description,prepare,source])=>({id,title,category,description,prepare,source:sources[source],start:add(d.start,Math.round(from*7)),end:add(d.start,Math.round(to*7)),...j.tasks[id]}));
    for(const [id,t] of Object.entries(j.tasks))if(id.startsWith('custom-'))items.push({id,category:'personnel',description:'Votre rendez-vous personnel.',prepare:'',source:null,start:t.date||at,end:t.date||at,...t});
    return items.map(t=>({...t,title:t.title||definitions.find(x=>x[0]===t.id)?.[3]||'Mon rendez-vous',status:t.status||'todo',when:t.date||t.start,phase:(t.date||t.end)<at?'past':t.start>at?'future':'now'})).sort((a,b)=>a.when.localeCompare(b.when)||a.id.localeCompare(b.id));
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
    const events=timeline(raw,at).filter(t=>!['done','skip'].includes(t.status)&&t.when>=at&&(!partnerOnly||t.assignee==='partner'));
    const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Poum//Mon calendrier//FR','CALSCALE:GREGORIAN','METHOD:PUBLISH'];
    for(const t of events){const date=t.when.replace(/-/g,''),dateTime=t.time?date+'T'+t.time.replace(':','')+'00':null;lines.push('BEGIN:VEVENT',`UID:${typeof module!=='undefined'&&module.exports?require('node:crypto').createHash('sha256').update(t.id+dates(raw,at).due).digest('hex').slice(0,32):t.id}@poum.app`,`DTSTAMP:${at.replace(/-/g,'')}T120000Z`,dateTime?`DTSTART:${dateTime}`:`DTSTART;VALUE=DATE:${date}`,`SUMMARY:${escape(partnerOnly?'Poum · Une chose à prévoir':t.title)}`,`DESCRIPTION:${escape(partnerOnly?'Une tâche partagée depuis Poum. Retrouvez les détails avec la personne qui vous a envoyé ce calendrier.':(t.date?'Rendez-vous enregistré. ':'Repère indicatif à confirmer. ')+t.description)}`,'CLASS:PRIVATE','BEGIN:VALARM',dateTime?'TRIGGER:-P1D':'TRIGGER:-PT15H','ACTION:DISPLAY','DESCRIPTION:Rappel Poum','END:VALARM','END:VEVENT');}
    lines.push('END:VCALENDAR');
    // RFC 5545 folds at 75 UTF-8 octets without cutting a code point.
    const fold=line=>{let out='',length=0;for(const char of line){const size=new TextEncoder().encode(char).length;if(length+size>75){out+='\r\n ';length=1;}out+=char;length+=size;}return out;};
    return lines.map(fold).join('\r\n')+'\r\n';
  }
  const api={empty,clean,validate,dates,timeline,today,add,validDate,sources,recognised,compare,calendar};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PoumPregnancy=api;
})(typeof window!=='undefined'?window:globalThis);
