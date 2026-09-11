'use strict';
const D = require('../js/data.js');
const { HttpError } = require('./http.cjs');
// Stable IDs keep the introductory selection and the seven-dinner example free.
const freeIDs = new Set(['sunny-bowl', 'lemon-salmon', 'green-pasta', 'morning-porridge', 'lentil-soup', 'roasted-chickpeas', 'spinach-frittata', 'apple-oat', 'cod-rice', 'tomato-pasta', 'gnocchis-pesto', 'poke-saumon-cuit', 'dhal-coco', 'tacos-cabillaud', 'lasagnes-epinards-ricotta', 'pancakes-citron-ricotta', 'pancakes-banane-avoine', 'brownie-chocolat-noisette', 'houmous-betterave', 'cookies-avoine-chocolat']);
function publicRecipe(recipe) {
  return { ...recipe, premium: !freeIDs.has(recipe.id), steps: freeIDs.has(recipe.id) ? recipe.steps : [], guide: freeIDs.has(recipe.id) ? recipe.guide : null };
}
function recipeSteps(ids) {
  return [...new Set(ids)].map(id => { const r = D.recipes.find(r => r.id === id); return { id: r.id, steps: r.steps, guide: r.guide }; });
}
async function readRecipe(id, { config, user, repo }) {
  const recipe = D.recipes.find(r => r.id === id);
  if (!recipe) throw new HttpError(404, 'Cette recette est introuvable.');
  if (!freeIDs.has(id) && config.configured) {
    if (!user?.id) throw new HttpError(401, 'Connectez-vous pour retrouver vos recettes Plus.', { code: 'recipe_premium' });
    if (!(await repo.access(user.id, config.live)).active) throw new HttpError(402, 'Cette recette complète fait partie de Plus.', { code: 'recipe_premium' });
  }
  return { recipes: recipeSteps([id]), access: freeIDs.has(id) ? 'free' : config.configured ? 'plus' : 'launch' };
}
module.exports = { freeIDs, publicRecipe, recipeSteps, readRecipe };
