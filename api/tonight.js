const {handler,json,readJSON,HttpError,ipKey,originOf}=require('../server/http.cjs');
const {getSession,sessionCookies}=require('../server/auth.cjs');
const {limit}=require('../server/db.cjs');
const {settings}=require('../server/billing.cjs');
const {billingStore}=require('../server/billing-store.cjs');
const {tonightStore}=require('../server/tonight-store.cjs');
const {operation,hash,token}=require('../server/tonight.cjs');
module.exports=handler(async(req,res)=>{
  if(req.method!=='POST')throw new HttpError(405,'Méthode non autorisée.');
  res.setHeader('X-Robots-Tag','noindex, nofollow');
  await limit('tonight:'+ipKey(req),100);
  const body=await readJSON(req,5000),repo=tonightStore();
  if(!body||typeof body!=='object'||Array.isArray(body))throw new HttpError(400,'La demande est illisible.');
  if(['shared-read','shared-patch'].includes(body?.action))return json(res,200,await operation(body,{repo}));
  let guest=String(req.headers.cookie||'').match(/(?:^|;\s*)poum-dinner=([-_a-zA-Z0-9]{43})(?:;|$)/)?.[1];
  if(!guest){guest=token();res.setHeader('Set-Cookie',`poum-dinner=${guest}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax${originOf(req).startsWith('https:')?'; Secure':''}`);}
  const guestOwner='g:'+hash(guest);
  const user=process.env.NEON_AUTH_BASE_URL&&sessionCookies(req.headers.cookie)?(await getSession(req))?.user:null;
  const owner=user?'u:'+user.id:guestOwner;
  if(body.action==='adopt') {
    if(!user)throw new HttpError(401,'Connectez-vous pour retrouver ce dîner.');
    await repo.adopt(guestOwner,owner); body.action='state';
  }
  const config=settings();
  const paid=Boolean(user&&config.configured&&(await billingStore().access(user.id,config.live)).active);
  const result=await operation(body,{repo,owner,paid});
  if(user&&body.action==='state')result.guestAvailable=Boolean((await repo.profile(guestOwner)).current_meal);
  json(res,200,result);
});
