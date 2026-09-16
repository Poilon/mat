const {test}=require('node:test'),assert=require('node:assert/strict');
const P=require('../js/pregnancy.js'),N=require('../js/notebook.js'),Diet=require('../js/diet.js');
const {validateNotebook}=require('../server/notebook.cjs');
const journey=()=>({...P.empty(),profile:{...P.empty().profile,date:'2026-06-01',consent:true}});
test('Pregnancy dating distinguishes LMP estimates and confirmed terms and preserves scheduled dates',()=>{
 const j=journey();assert.equal(P.dates(j,'2026-09-16').due,'2027-03-15');assert.equal(P.dates(j,'2026-09-16').week,15);
 j.tasks.echo2={date:'2026-11-01',time:'10:30',status:'scheduled',note:'Ma question',assignee:'me'};
 const before=P.timeline(j).find(t=>t.id==='echo2');j.profile.basis='term';j.profile.date='2027-03-20';const after=P.timeline(j).find(t=>t.id==='echo2');assert.equal(after.date,before.date);assert.equal(after.note,before.note);assert.notEqual(after.start,before.start);assert.equal(P.dates(j).estimated,false);
 j.profile.basis='lmp';j.profile.date='2026-06-01';j.profile.cycle=32;assert.equal(P.dates(j).due,'2027-03-19');
});
test('Unknown dates, paused follow-up and consent withdrawal do not produce medical scheduling',()=>{
 assert.equal(P.dates(P.empty()),null);const j=journey();j.profile.paused=true;assert.deepEqual(P.timeline(j),[]);j.profile.consent=false;assert.deepEqual(P.clean(j),P.empty());assert.throws(()=>P.validate(j));assert.equal(P.validDate('2026-02-30'),false);assert.equal(P.validDate('2028-02-29'),true);
});
test('Only clinician-confirmed nonimmunity adds toxoplasmosis controls; age does not prescribe markers',()=>{
 const j=journey();j.profile.birthDate='1985-12-01';assert.equal(P.dates(j).age,41);assert.equal(P.timeline(j).filter(t=>t.id.startsWith('toxo')).length,0);j.profile.toxo='nonimmune';assert.equal(P.timeline(j).filter(t=>t.id.startsWith('toxo')).length,8);j.profile.toxo='immune';assert.equal(P.timeline(j).filter(t=>t.id.startsWith('toxo')).length,0);
});
test('Independent appointments and questions merge between devices, conflicting edits remain explicit',()=>{
 const b={...N.empty(),journey:journey()},a=structuredClone(b),c=structuredClone(b);
 a.journey.tasks.echo1={status:'scheduled',date:'2026-08-20',time:'',note:'',assignee:'me',title:''};c.journey.questions.push({id:'question-1',text:'Ma question',done:false});
 const merged=N.merge(b,a,c);assert.equal(merged.conflicts.length,0);assert.equal(merged.notebook.journey.tasks.echo1.date,'2026-08-20');assert.equal(merged.notebook.journey.questions.length,1);
 c.journey.tasks.echo1={...a.journey.tasks.echo1,date:'2026-08-22'};assert(N.merge(b,a,c).conflicts.includes('journey-task:echo1'));
 a.journey=P.empty();assert.deepEqual(N.merge(b,a,c).notebook.journey,P.empty());
});
test('Notebook validation preserves new data and rejects invalid or unconsented health records',()=>{
 const j=journey();j.exams=[{id:'test',title:'Bilan',date:'',note:'',items:[{id:'nfs',label:'NFS',status:'expected',evidence:'',document:'',page:1}]}];assert.deepEqual(validateNotebook({...N.empty(),journey:j}).journey,j);
 j.exams[0].items.push({...j.exams[0].items[0]});assert.throws(()=>P.validate(j));assert.throws(()=>P.validate({...journey(),tasks:JSON.parse('{"__proto__":{}}')}));
 assert.deepEqual(validateNotebook({diet:Diet.clean(),name:'',vegetarian:false,favorites:[],products:[],menus:{},shopping:[]}).journey,P.empty());
});
test('Document matching returns evidence with its page, never interprets numeric values or marks absent exams done',()=>{
 const items=[{id:'1',label:'NFS'},{id:'2',label:'RAI'},{id:'3',label:'Ferritine'},{id:'4',label:'CRP'}];
 const pages=[{page:1,text:'Hémogramme\nFerritine : 999 ng/mL'},{page:2,text:'Recherche d’agglutinines irrégulières : en attente\nCRP : 2 mg/L'}];
 const found=P.compare(items,pages);assert(found.every(r=>r.found));assert.equal(found[1].page,2);assert.match(found[1].excerpt,/attente/);assert.equal(found[2].status,undefined);assert.equal(P.compare([{id:'5',label:'TSH'}],pages)[0].found,false);
 assert.equal(P.compare([{id:'5',label:'CRP'}],[{page:1,text:'antiCRP'}])[0].found,false);
});
test('Calendar exports preserve appointments, include reminders, escape text and redact partner health details',()=>{
 const j=journey();j.tasks.echo2={status:'scheduled',date:'2026-11-01',time:'10:30',note:'Une note médicale privée',assignee:'partner'};const ics=P.calendar(j,{at:'2026-09-16'});assert.match(ics,/BEGIN:VALARM/);assert.match(ics,/DTSTART:20261101T103000/);assert(!ics.includes('Une note médicale privée'));
 const shared=P.calendar(j,{partnerOnly:true,at:'2026-09-16'});assert.match(shared,/Une chose à prévoir/);assert(!shared.includes('échographie'));assert.equal((shared.match(/BEGIN:VEVENT/g)||[]).length,1);
});
test('Temporary dislikes expire independently of persistent allergies and preferences',()=>{
 const recipe={ingredients:[{name:'Saumon et lait'}],allergens:'Poisson, lait'},d={...Diet.clean(),allergies:['milk'],consent:true,avoid:'champignon',temporary:{text:'poisson',until:'2000-01-01'}};
 assert.equal(Diet.temporary(d,'2026-09-16'),'');assert.equal(Diet.allows(recipe,d),false);
 d.temporary.until='2099-01-01';const merged=Diet.merge(d,Diet.clean());assert(merged.allergies.includes('milk'));assert.match(merged.avoid,/champignon/);assert.match(Diet.temporary(merged),/poisson/);
});
test('Legacy notebook saves preserve pregnancy and temporary preferences without blocking explicit withdrawal',()=>{
 const {preserveLegacyFields}=require('../server/notebook.cjs');const previous={...N.empty(),journey:journey()};previous.diet.temporary={text:'poisson',until:'2026-09-20'};const old={...N.empty()};delete old.journey;delete old.diet.temporary;
 const saved=validateNotebook(preserveLegacyFields(old,previous));assert.deepEqual(saved.journey,previous.journey);assert.deepEqual(saved.diet.temporary,previous.diet.temporary);assert.equal(old.journey,undefined);
 const withdrawn=validateNotebook(preserveLegacyFields(N.empty(),previous));assert.deepEqual(withdrawn.journey,P.empty());assert.equal(withdrawn.diet.temporary.text,'');
});
test('Combining temporary exclusions with an empty account never removes their expiry',()=>{
 const a={...Diet.clean(),temporary:{text:'poisson',until:'2099-09-20'}};const combined=Diet.merge(a,Diet.clean());assert.equal(combined.temporary.until,'2099-09-20');assert.equal(Diet.temporary(combined,'2099-09-21'),'');
});

test('National pregnancy windows use SA and calendar months without manufacturing appointment dates',()=>{
 const j=journey();j.profile.date='2026-08-11';const map=Object.fromEntries(P.timeline(j,'2026-09-16').map(t=>[t.id,t]));
 assert.equal(map.echo1.start,'2026-10-27');assert.equal(map.echo1.end,'2026-11-16');
 assert.equal(map.echo2.start,P.add('2026-08-11',140));assert.equal(map.echo3.end,P.add('2026-08-11',245));
 assert.equal(map.declaration.kind,'deadline');assert.equal(map.declaration.timing,'Avant la fin du 3e mois');assert.equal(map.declaration.date,undefined);assert.notEqual(map.declaration.when,'2026-10-06');
 assert.equal(map.visit4.start,'2026-11-25');assert.equal(map.visit4.end,'2026-12-24');
 assert.equal(map.visit5.start,P.add(map.visit4.end,1));assert.equal(map.anesthesia.start,map.visit8.start);
 assert.equal(map['blood-six'].start,map.visit6.start);
 assert.equal(map.prevention.end,P.add('2026-08-11',167));assert.equal(map['early-talk'].kind,'flexible');
 assert.equal(P.addMonths('2028-01-31',1),'2028-02-29');assert.equal(P.addMonths('2026-01-31',1),'2026-02-28');
});
test('The first consultation anchors the declaration but the first trimester scan is not a mandatory prerequisite',()=>{
 const j=journey();j.tasks.first={status:'scheduled',date:'2026-07-12'};j.tasks.echo1={status:'scheduled',date:'2026-08-25'};
 let items=P.timeline(j);assert.equal(items.find(t=>t.id==='declaration').start,'2026-07-12');
 j.tasks.declaration={status:'scheduled',date:'2026-07-15',note:'Date convenue'};items=P.timeline(j);assert.equal(items.find(t=>t.id==='declaration').when,'2026-07-15');assert.equal(items.find(t=>t.id==='declaration').note,'Date convenue');
 j.profile.date='2026-06-05';assert.equal(P.timeline(j).find(t=>t.id==='declaration').date,'2026-07-15');
});
test('Calendar export includes only user-entered future dates, never estimated windows or deadlines',()=>{
 const j=journey();assert.equal((P.calendar(j,{at:'2026-06-10'}).match(/BEGIN:VEVENT/g)||[]).length,0);
 j.tasks.echo1={status:'scheduled',date:'2026-08-20'};j.tasks.declaration={status:'done',date:'2026-07-20'};j.tasks['custom-one']={title:'Mon rendez-vous',status:'todo',date:'2026-08-21',assignee:'partner'};
 const text=P.calendar(j,{at:'2026-06-10'});assert.equal((text.match(/BEGIN:VEVENT/g)||[]).length,2);assert.match(text,/DTSTART;VALUE=DATE:20260820/);assert(!text.includes('déclaration'));assert(!text.includes('Repère indicatif'));
 assert.equal((P.calendar(j,{at:'2026-06-10',partnerOnly:true}).match(/BEGIN:VEVENT/g)||[]).length,1);
 assert.equal((P.calendar(j,{at:'2026-09-01'}).match(/BEGIN:VEVENT/g)||[]).length,0);
});
