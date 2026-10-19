/* Shared form and range chrome. Feature state belongs to the feature modules. */
document.querySelectorAll('form').forEach(form => form.addEventListener('submit', event => event.preventDefault()));
document.querySelectorAll('input[type="range"]').forEach(input => {
  const paint = () => {
    const min = Number(input.min) || 0, max = Number(input.max) || 100;
    input.style.setProperty('--range-progress', (100 * (Number(input.value) - min) / Math.max(.001, max - min)) + '%');
  };
  input.addEventListener('input', paint);
  input.addEventListener('change', paint);
  paint();
});
