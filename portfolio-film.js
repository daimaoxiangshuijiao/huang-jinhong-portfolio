/* Load the film only after a real play action; use native media controls. */
(() => {
  'use strict';
  const video = document.getElementById('film-video');
  const play = document.getElementById('film-play');
  const reset = document.getElementById('film-reset');
  const status = document.getElementById('film-status');
  const stage = video?.closest('.film-stage');
  if (!(video instanceof HTMLVideoElement) || !play || !reset || !status || !stage) return;
  let generation = 0;
  let requested = false;
  const pause = () => { if (!video.paused) video.pause(); };
  const recover = message => {
    stage.dataset.filmState = 'error';
    play.hidden = false;
    play.querySelector('span').textContent = '重新播放';
    status.textContent = message;
  };
  play.hidden = false;
  play.addEventListener('click', () => {
    const current = ++generation;
    requested = true;
    stage.dataset.filmState = 'loading';
    play.hidden = true;
    reset.hidden = false;
    status.textContent = '正在载入视频…';
    video.controls = true;
    if (!video.getAttribute('src') || video.error) {
      video.src = video.dataset.src;
      video.load();
    }
    video.focus({ preventScroll: true });
    video.closest('.film-project')?.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    const started = video.play();
    started?.catch(error => {
      if (current !== generation || error.name === 'AbortError') return;
      recover('视频暂时无法播放，可重试或单独打开视频。');
    });
  });
  video.addEventListener('playing', () => {
    if (!requested) { pause(); return; }
    stage.dataset.filmState = 'active';
    play.hidden = true;
    status.textContent = '';
  });
  video.addEventListener('error', () => {
    if (requested) recover('视频暂时无法播放，可重试或单独打开视频。');
  });
  reset.addEventListener('click', () => {
    generation++;
    requested = false;
    pause();
    video.removeAttribute('src');
    video.controls = false;
    video.load();
    stage.dataset.filmState = 'idle';
    reset.hidden = true;
    play.hidden = false;
    play.querySelector('span').textContent = '播放短片';
    status.textContent = '';
    play.focus({ preventScroll: true });
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  window.addEventListener('pagehide', pause);
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      if (entries[0]?.isIntersecting || document.fullscreenElement || video.webkitDisplayingFullscreen) return;
      pause();
    });
    observer.observe(video);
  }
  const modalObserver = new MutationObserver(() => {
    if (document.querySelector('dialog[open]')) pause();
  });
  document.querySelectorAll('dialog').forEach(dialog => modalObserver.observe(dialog, { attributes: true, attributeFilter: ['open'] }));
})();
