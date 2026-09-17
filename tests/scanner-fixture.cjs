async function paidScanner(page) {
 await page.route('**/api/config',r=>r.fulfill({json:{accounts:true}}));
 await page.route('**/api/auth/get-session',r=>r.fulfill({json:{user:{id:'scanner-member',email:'scanner@example.test'}}}));
 await page.route('**/api/notebook',r=>r.fulfill({json:{notebook:null,revision:0}}));
 await page.route('**/api/billing',r=>r.fulfill({json:{configured:true,mode:'live',access:{active:true,plan:'pass'},signedIn:true}}));
}
module.exports={paidScanner};
