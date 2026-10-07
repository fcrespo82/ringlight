'use strict';
(() => {
  const panel = document.getElementById('panel');
  const handle = document.getElementById('panel-handle');
  const dragRegion = document.getElementById('panel-drag-region');
  const minimized = document.getElementById('show-panel');
  const body = document.getElementById('panel-body');
  const hide = document.getElementById('hide-panel');
  const fullscreen = document.getElementById('fullscreen');
  const fullscreenAvailable = !fullscreen.hidden;
  let expandedWidth = panel.style.width;
  let drag = null;
  let visible = !panel.hidden;
  let animation = null;
  let transition = 0;
  // Keep native details open during their closing animation so content stays mounted.
  for (const section of document.querySelectorAll?.('.panel-section, .shortcuts') || []) {
    const summary = section.querySelector('summary');
    const content = section.querySelector('.section-content, dl');
    if (!summary || !content) continue;
    section.classList.add('animated-details');
    let motion = null, sequence = 0, expanded = section.open;
    summary.setAttribute('aria-expanded', String(expanded));
    summary.addEventListener('click', async (event) => {
      event.preventDefault();
      const version = ++sequence;
      const from = section.getBoundingClientRect().height;
      motion?.cancel();
      expanded = !expanded;
      section.open = true;
      content.inert = !expanded;
      summary.setAttribute('aria-expanded', String(expanded));
      const target = expanded ? section.getBoundingClientRect().height : summary.getBoundingClientRect().height + (section.classList.contains('panel-section') ? 2 : 13);
      if (!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches && section.animate) {
        motion = section.animate([{height: `${from}px`}, {height: `${target}px`}], {duration: 240, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'both'});
        try { await motion.finished; } catch { return; }
        if (version !== sequence) return;
        motion.cancel();
        motion = null;
      }
      if (version === sequence) section.open = expanded;
    });
  }
  function place(left, top) {
    const viewport = window.visualViewport;
    const width = viewport?.width ?? window.innerWidth;
    const height = viewport?.height ?? window.innerHeight;
    const offsetLeft = viewport?.offsetLeft ?? 0;
    const offsetTop = viewport?.offsetTop ?? 0;
    const rect = panel.getBoundingClientRect();
    const margin = 12;
    const x = Math.max(offsetLeft + margin, Math.min(left, offsetLeft + width - rect.width - margin));
    const y = Math.max(offsetTop + margin, Math.min(top, offsetTop + height - rect.height - margin));
    panel.style.left = `${x}px`;
    panel.style.top = `${y}px`;
    panel.style.right = 'auto';
  }
  dragRegion.addEventListener('pointerdown', (event) => {
    const control = event.target?.closest?.('button');
    if (event.button !== 0 || drag || (control && control !== handle)) return;
    const rect = panel.getBoundingClientRect();
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
    handle.setPointerCapture(event.pointerId);
    event.preventDefault();
    handle.focus();
  });
  dragRegion.addEventListener('pointermove', (event) => {
    if (!drag || drag.id !== event.pointerId) return;
    place(drag.left + event.clientX - drag.x, drag.top + event.clientY - drag.y);
  });
  function endDrag(event) {
    if (drag?.id !== event.pointerId) return;
    drag = null;
    if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
  }
  dragRegion.addEventListener('pointerup', endDrag);
  dragRegion.addEventListener('pointercancel', endDrag);
  dragRegion.addEventListener('lostpointercapture', () => { drag = null; });
  handle.addEventListener('keydown', (event) => {
    const steps = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const direction = steps[event.key];
    if (!direction) return;
    event.preventDefault();
    const rect = panel.getBoundingClientRect();
    const amount = event.shiftKey ? 40 : 16;
    place(rect.left + direction[0] * amount, rect.top + direction[1] * amount);
  });
  async function setVisible(next) {
    if (visible === next) return;
    visible = next;
    const version = ++transition;
    const from = panel.getBoundingClientRect();
    animation?.cancel();
    animation = null;
    if (!next) expandedWidth = panel.style.width;
    panel.classList.toggle('collapsed', !next);
    minimized.setAttribute('aria-expanded', String(next));
    minimized.hidden = next;
    hide.hidden = !next;
    fullscreen.hidden = !next || !fullscreenAvailable;
    body.hidden = false;
    body.inert = !next;
    panel.style.width = next ? expandedWidth : '184px';
    panel.style.height = '';
    const fullHeight = panel.getBoundingClientRect().height;
    const targetHeight = next ? fullHeight : dragRegion.getBoundingClientRect().height + 2;
    const targetWidth = panel.getBoundingClientRect().width;
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!reducedMotion && panel.animate) {
      const full = 'polygon(0% 0%,100% 0%,100% 50%,100% 100%,0% 100%,0% 50%)';
      animation = panel.animate([
        { width: `${from.width}px`, height: `${from.height}px`, clipPath: full },
        { width: `${(from.width + targetWidth) / 2}px`, height: `${(from.height + targetHeight) / 2}px`, clipPath: 'polygon(0% 0%,100% 0%,85% 50%,75% 100%,0% 100%,10% 50%)', offset: .55 },
        { width: `${targetWidth}px`, height: `${targetHeight}px`, clipPath: full }
      ], { duration: 320, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'both' });
      try { await animation.finished; } catch { return; }
      if (version !== transition) return;
      animation.cancel();
      animation = null;
    }
    if (version !== transition) return;
    body.hidden = !next;
    body.inert = !next;
    panel.style.height = '';
    keepVisible();
    (next ? handle : minimized).focus();
  }
  window.ringlightPanel = { setVisible, isVisible: () => visible };
  function keepVisible() {
    const rect = panel.getBoundingClientRect();
    panel.style.maxHeight = `${Math.max(80, (window.visualViewport?.height ?? window.innerHeight) - 24)}px`;
    place(rect.left, rect.top);
  }
  window.addEventListener('resize', keepVisible);
  window.visualViewport?.addEventListener('resize', keepVisible);
  window.visualViewport?.addEventListener('scroll', keepVisible);
})();
