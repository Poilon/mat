const {handler,json,readJSON,HttpError}=require('../server/http.cjs');
const {requireUser}=require('../server/auth.cjs');
const {limit}=require('../server/db.cjs');
const {settings}=require('../server/billing.cjs');
const {billingStore}=require('../server/billing-store.cjs');
const P=require('../js/pregnancy.js');
module.exports=handler(async(req,res)=>{
  if(req.method!=='POST')throw new HttpError(405,'Méthode non autorisée.');
  const user=await requireUser(req);await limit('companion:'+user.id,20);
  const config=settings();
  if(!config.configured)throw new HttpError(503,'La vérification de Plus est indisponible. Votre calendrier reste dans Poum.');
  if(!(await billingStore().access(user.id,config.live)).active)throw new HttpError(402,'L’export vers votre agenda fait partie de Poum Plus. Votre calendrier reste accessible gratuitement dans Poum.');
  const body=await readJSON(req,160000);
  if(body?.action!=='calendar'||typeof body.partnerOnly!=='boolean')throw new HttpError(400,'Choisissez un export de calendrier.');
  let journey;try{journey=P.validate(body.journey);}catch(e){throw new HttpError(400,e.message);}
  if(!P.dates(journey)||journey.profile.paused)throw new HttpError(400,'Activez votre calendrier et renseignez un repère de grossesse.');
  json(res,200,{calendar:P.calendar(journey,{partnerOnly:body.partnerOnly})});
});
