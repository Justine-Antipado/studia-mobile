/** Scroll an element into view and play the `.flash` CSS animation on it (restarts if already playing). */
export function flashElement(el) {
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.remove('flash');
  void el.offsetWidth; // force reflow so the animation restarts
  el.classList.add('flash');
  el.addEventListener('animationend', () => el.classList.remove('flash'), { once: true });
}
