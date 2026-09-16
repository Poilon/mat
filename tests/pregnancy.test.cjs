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
 const j=journey();j.profile.birthDate='1985-12-01';assert.equal(P.dates(j).age,41);assert.equal(P.timeline(j).filter(t=>t.id.startsWith('toxo')).length,0);j.profile.toxo='nonimmune';assert.equal(P.timeline(j).filter(t=>t.id.startsWith('toxo')).length,6);j.profile.toxo='immune';assert.equal(P.timeline(j).filter(t=>t.id.startsWith('toxo')).length,0);
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
