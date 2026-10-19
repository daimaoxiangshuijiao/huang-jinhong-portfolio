(() => {
  'use strict';
  if (window.PortfolioInterfaceMotion) return;
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  const animations = new Set(), closings = new Map();
  let openingCount = 0, closingCount = 0;
  const allowed = () => !preference.matches && !document.hidden;
  const track = animation => {
    animations.add(animation);
    animation.finished.then(() => animations.delete(animation), () => animations.delete(animation));
    return animation;
  };
  const animate = (element, frames, options) => {
    if (!element?.animate || !allowed()) return null;
    return track(element.animate(frames, { duration: 440, easing: 'cubic-bezier(.16,1,.3,1)', ...options }));
  };
  const cancelIn = parent => {
    for (const animation of animations) {
      const target = animation.effect?.target;
      if (target === parent || parent.contains(target)) animation.cancel();
    }
  };
  function revealCharacter(container) {
    if (!allowed()) return;
    openingCount++;
    const mobile = innerWidth <= 820;
    animate(container.querySelector('.inspection-frame'), [
      { opacity: 0, clipPath: 'inset(0 0 18% 0)' },
      { opacity: 1, clipPath: 'inset(0 0 0% 0)' }
    ], { duration: 480 });
    const elements = container.querySelectorAll('.inspection-kicker, .inspection-copy h2, .inspection-line, .inspection-story, .inspection-features > div, .inspection-credits');
    elements.forEach((element, index) => animate(element, [
      { opacity: 0, transform: `translateY(${mobile ? 9 : 16}px)` },
      { opacity: 1, transform: 'translateY(0px)' }
    ], { delay: Math.min(index * 38, 240), duration: 440, fill: 'backwards' }));
    animate(container.querySelector('.character-controls'), [
      { opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0px)' }
    ], { delay: 140, duration: 360, fill: 'backwards' });
  }
  function revealMenu(menu) {
    if (!allowed()) return;
    openingCount++;
    animate(menu, [
      { opacity: .25, clipPath: 'inset(0 100% 0 0)' },
      { opacity: 1, clipPath: 'inset(0 0% 0 0)' }
    ], { duration: 430 });
    menu.querySelectorAll('nav a').forEach((link, index) => animate(link, [
      { opacity: 0, transform: 'translateX(-20px)' }, { opacity: 1, transform: 'translateX(0px)' }
    ], { delay: 65 + index * 42, duration: 430, fill: 'backwards' }));
  }
  function closeAnimated(dialog) {
    if (!dialog.open || closings.has(dialog)) return;
    cancelIn(dialog);
    if (!allowed()) { dialog.close(); return; }
    closingCount++;
    dialog.classList.add('ui-closing');
    const target = dialog.id === 'character-dialog' ? dialog.querySelector('.inspection-frame') : dialog;
    const animation = animate(target, [{ opacity: 1 }, { opacity: 0 }], { duration: 180, easing: 'cubic-bezier(.3,0,.8,.35)' });
    const finish = () => {
      if (!closings.has(dialog)) return;
      closings.delete(dialog);
      if (dialog.open) dialog.close();
      dialog.classList.remove('ui-closing');
      animation?.cancel();
    };
    closings.set(dialog, finish);
    if (animation) animation.finished.then(finish, () => {});
    else finish();
  }
  const observed = [];
  for (const id of ['character-dialog', 'site-menu']) {
    const dialog = document.getElementById(id);
    if (!(dialog instanceof HTMLDialogElement)) continue;
    let wasOpen = dialog.open;
    const observer = new MutationObserver(() => {
      if (dialog.open === wasOpen) return;
      wasOpen = dialog.open;
      if (dialog.open) id === 'character-dialog' ? revealCharacter(dialog) : revealMenu(dialog);
      else { cancelIn(dialog); closings.delete(dialog); dialog.classList.remove('ui-closing'); }
    });
    observer.observe(dialog, { attributes: true, attributeFilter: ['open'] });
    observed.push(observer);
    dialog.addEventListener('cancel', event => {
      if (!allowed()) return;
      event.preventDefault(); closeAnimated(dialog);
    });
    const button = dialog.querySelector(id === 'character-dialog' ? '#character-close' : '#menu-close');
    button?.addEventListener('click', event => {
      if (!allowed()) return;
      event.preventDefault(); event.stopImmediatePropagation(); closeAnimated(dialog);
    }, true);
  }
  const hold = document.getElementById('hold-inspection');
  if (hold) {
    let wasHidden = hold.hidden;
    const observer = new MutationObserver(() => {
      if (hold.hidden === wasHidden) return;
      wasHidden = hold.hidden;
      if (!hold.hidden) revealCharacter(hold); else cancelIn(hold);
    });
    observer.observe(hold, { attributes: true, attributeFilter: ['hidden'] });
    observed.push(observer);
  }
  const stop = () => {
    for (const finish of [...closings.values()]) finish();
    for (const animation of [...animations]) animation.cancel();
  };
  preference.addEventListener('change', () => { if (preference.matches) stop(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  window.addEventListener('pagehide', stop);
  window.PortfolioInterfaceMotion = Object.freeze({
    inspect: () => ({ reducedMotion: preference.matches, activeAnimations: animations.size, openingCount, closingCount, closingDialogs: closings.size })
  });
})();
