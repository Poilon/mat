(() => {
  const form = document.querySelector('.seo-search');
  if (!form) return;
  form.hidden = false;
  const input = form.querySelector('input');
  const status = form.querySelector('[role=status]');
  const normalize = value => value.toLowerCase().replace(/œ/g,'oe').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const items = [...document.querySelectorAll('[data-food-name]')];
  const sections = [...document.querySelectorAll('section[data-food-section]')];
  form.addEventListener('submit', event => event.preventDefault());
  input.addEventListener('input', () => {
    const terms = normalize(input.value).trim().split(/\s+/).filter(Boolean);
    let count = 0;
    for (const item of items) { item.hidden = !terms.every(term => normalize(item.dataset.foodName).includes(term)); if (!item.hidden) count++; }
    sections.forEach(section => { section.hidden = !section.querySelector('[data-food-name]:not([hidden])'); });
    status.textContent = count ? `${count} aliment${count > 1 ? 's' : ''} trouvé${count > 1 ? 's' : ''}` : 'Aucun aliment trouvé. Essayez un nom plus simple.';
  });
})();
