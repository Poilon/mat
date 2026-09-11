'use strict';
const {database}=require('./db.cjs');
const {HttpError}=require('./http.cjs');
function tonightStore(sql=database()) {
  return {
    async profile(owner) {
      await sql`INSERT INTO poum_tonight_profiles(owner) VALUES(${owner}) ON CONFLICT DO NOTHING`;
      return (await sql`SELECT * FROM poum_tonight_profiles WHERE owner=${owner}`)[0];
    },
    async adopt(guest, owner) {
      // Only an explicit owner request after login adopts this browser's guest dinners.
      await sql.transaction([
        sql`INSERT INTO poum_tonight_profiles(owner,preferences,trial_meal,current_meal) SELECT ${owner},preferences,trial_meal,current_meal FROM poum_tonight_profiles WHERE owner=${guest}
          ON CONFLICT(owner) DO UPDATE SET trial_meal=COALESCE(poum_tonight_profiles.trial_meal,EXCLUDED.trial_meal),current_meal=COALESCE(poum_tonight_profiles.current_meal,EXCLUDED.current_meal),
          preferences=CASE WHEN poum_tonight_profiles.preferences='{}'::jsonb THEN EXCLUDED.preferences ELSE poum_tonight_profiles.preferences END`,
        sql`UPDATE poum_tonight_meals SET owner=${owner} WHERE owner=${guest}`,
        sql`UPDATE poum_tonight_profiles SET current_meal=NULL,preferences='{}'::jsonb WHERE owner=${guest}`
      ]);
    },
    async preferences(owner, value) { await sql`UPDATE poum_tonight_profiles SET preferences=${JSON.stringify(value)}::jsonb,updated_at=now() WHERE owner=${owner}`; },
    async meal(owner,id) { return (await sql`SELECT * FROM poum_tonight_meals WHERE owner=${owner} AND id=${id}::uuid`)[0]; },
    async recent(owner) { return sql`SELECT id,recipe_id,created_at,status FROM poum_tonight_meals WHERE owner=${owner} ORDER BY created_at DESC LIMIT 12`; },
    async erase(owner) {
      await sql.transaction([
        sql`DELETE FROM poum_tonight_meals WHERE owner=${owner}`,
        sql`UPDATE poum_tonight_profiles SET preferences='{}'::jsonb,current_meal=NULL WHERE owner=${owner}`
      ]);
    },
    async create(owner,id,recipe,servings,paid) {
      // The conditional UPDATE locks the profile row: concurrent free claims cannot both win.
      const [row]=await sql`WITH claimed AS (
        UPDATE poum_tonight_profiles SET trial_meal=COALESCE(trial_meal,${id}::uuid),current_meal=${id}::uuid,updated_at=now()
        WHERE owner=${owner} AND (trial_meal IS NULL OR ${paid}) RETURNING owner
      ) INSERT INTO poum_tonight_meals(id,owner,recipe_id,servings) SELECT ${id}::uuid,owner,${recipe},${servings} FROM claimed RETURNING *`;
      if(!row)throw new HttpError(402,'Votre premier dîner est offert. Retrouvez les suivants avec Poum Plus.',{code:'tonight_premium'});
      return row;
    },
    async shared(hash) { return (await sql`SELECT * FROM poum_tonight_meals WHERE share_hash=${hash} AND share_expires>now()`)[0]; },
    async share(owner,id,hash) { return (await sql`UPDATE poum_tonight_meals SET share_hash=${hash},share_expires=now()+interval '30 days',revision=revision+1 WHERE owner=${owner} AND id=${id}::uuid RETURNING *`)[0]; },
    async revoke(owner,id) { return (await sql`UPDATE poum_tonight_meals SET share_hash=NULL,share_expires=NULL,revision=revision+1 WHERE owner=${owner} AND id=${id}::uuid RETURNING *`)[0]; },
    async patch({owner,id,hash}, field, value) {
      // Authorization is checked again by the mutation so revocation wins over an in-flight read.
      const allowed=hash?sql`share_hash=${hash} AND share_expires>now()`:sql`owner=${owner}`;
      const update=field==='status'?sql`status=${value}`:sql`checked=jsonb_set(checked,ARRAY[${String(field)}],${JSON.stringify(value)}::jsonb,true)`;
      return (await sql`UPDATE poum_tonight_meals SET ${update},revision=revision+1 WHERE id=${id}::uuid AND ${allowed} RETURNING *`)[0];
    }
  };
}
module.exports={tonightStore};
