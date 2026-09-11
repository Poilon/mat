'use strict';
const Diet=require('../js/diet.js');
const {database}=require('./db.cjs');
async function accountDiet(user){if(!user?.id)return Diet.clean();const sql=database();const [row]=await sql`SELECT data FROM miette_notebooks WHERE user_id = ${user.id}`;return Diet.clean(row?.data?.diet);}
module.exports={accountDiet};
