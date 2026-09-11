(function (root) {
  'use strict';
  const slug = value => String(value).toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/&/g, ' et ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const routes = { slug, food: food => '/aliments/' + slug(food.name) + '-enceinte/', recipe: recipe => '/recettes-grossesse/' + slug(recipe.title) + '/' };
  if (typeof module !== 'undefined' && module.exports) module.exports = routes;
  root.PoumRoutes = routes;
})(typeof window !== 'undefined' ? window : globalThis);
