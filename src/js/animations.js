const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function animateExit(element, keyframes, options = {}) {
  if (!element) return Promise.resolve();
  if (reducedMotion() || typeof element.animate !== 'function') return Promise.resolve();
  return element.animate(keyframes, { duration: 180, easing: 'ease-in', fill: 'forwards', ...options }).finished.catch(() => {});
}

export function animateEnter(element, keyframes, options = {}) {
  if (!element) return Promise.resolve();
  if (reducedMotion() || typeof element.animate !== 'function') return Promise.resolve();
  return element.animate(keyframes, { duration: 240, easing: 'cubic-bezier(.2,.75,.25,1)', ...options }).finished.catch(() => {});
}
