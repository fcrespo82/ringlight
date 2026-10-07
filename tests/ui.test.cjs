const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
function setup({ animate = false } = {}) {
  const events = {}; const windowEvents = {}; let captured = null;
  const body = { hidden: false };
  const hide = { hidden: false };
  const fullscreen = { hidden: false };
  const classes = new Set();
  const panel = { classList: { toggle(key, value) { value ? classes.add(key) : classes.delete(key); } }, hidden: false, style: {}, getBoundingClientRect() { return { left: parseFloat(this.style.left ?? 420), top: parseFloat(this.style.top ?? 20), width: Math.min(parseFloat(this.style.width || 360), win.innerWidth - 24), height: Math.min(body.hidden ? 54 : 500, parseFloat(this.style.maxHeight ?? 500)) }; } };
  const handle = { getBoundingClientRect: () => ({ height: 52 }), addEventListener: (name, fn) => events[name] = fn, setPointerCapture: (id) => captured = id, hasPointerCapture: (id) => captured === id, releasePointerCapture: () => captured = null, focus() {} };
  const minimized = { hidden: true, style: {}, attributes: {}, setAttribute(key, value) { this.attributes[key] = value; }, focus() {}, getBoundingClientRect() { return { left: parseFloat(this.style.left ?? 420), top: parseFloat(this.style.top ?? 20), width: 110, height: 40 }; } };
  const animations = [];
  if (animate) panel.animate = (frames, options) => { animations.push({ frames, options }); return { finished: Promise.resolve(), cancel() {} }; };
  const win = { matchMedia: () => ({ matches: !animate }), innerWidth: 800, innerHeight: 600, addEventListener: (name, fn) => windowEvents[name] = fn };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'ui.js'), 'utf8'), { document: { getElementById: (id) => id === 'panel' ? panel : id === 'show-panel' ? minimized : id === 'panel-body' ? body : id === 'hide-panel' ? hide : id === 'fullscreen' ? fullscreen : handle }, window: win });
  const fire = (name, event = {}) => events[name]({ preventDefault() {}, ...event });
  return { panel, body, minimized, animations, win, fire, resize: () => windowEvents.resize() };
}
test('panel dragging stays inside viewport and stops after cancellation', () => {
  const { panel, fire } = setup();
  fire('pointerdown', { button: 0, pointerId: 1, clientX: 430, clientY: 30 });
  fire('pointermove', { pointerId: 1, clientX: 9999, clientY: 9999 });
  assert.equal(panel.style.left, '428px');
  assert.equal(panel.style.top, '88px');
  fire('pointermove', { pointerId: 1, clientX: -9999, clientY: -9999 });
  assert.equal(panel.style.left, '12px');
  assert.equal(panel.style.top, '12px');
  fire('pointercancel', { pointerId: 1 });
  fire('pointermove', { pointerId: 1, clientX: 500, clientY: 500 });
  assert.equal(panel.style.left, '12px');
});
test('panel can be moved with keyboard and adapts to viewport resize', () => {
  const { panel, win, fire, resize } = setup();
  fire('keydown', { key: 'ArrowLeft' });
  assert.equal(panel.style.left, '404px');
  fire('keydown', { key: 'ArrowLeft', shiftKey: true });
  assert.equal(panel.style.left, '364px');
  win.innerWidth = 320; win.innerHeight = 260;
  resize();
  assert.equal(panel.style.left, '12px');
  assert.equal(panel.style.top, '12px');
  assert.equal(panel.style.maxHeight, '236px');
});

test('minimization keeps the same component and has no fade', async () => {
  const { panel, body, minimized, animations, win, fire } = setup({ animate: true });
  fire('keydown', { key: 'ArrowLeft' });
  await win.ringlightPanel.setVisible(false);
  assert.equal(panel.hidden, false);
  assert.equal(body.hidden, true);
  assert.equal(minimized.hidden, false);
  assert.equal(panel.style.left, '404px');
  assert.equal(panel.style.top, '20px');
  assert.equal(panel.style.width, '184px');
  assert.equal(body.inert, true);
  assert.equal(animations[0].frames.at(-1).height, '54px');
  assert.ok(animations[0].frames.every((frame) => !('opacity' in frame)));
  await win.ringlightPanel.setVisible(true);
  assert.equal(panel.hidden, false);
  assert.equal(body.hidden, false);
  assert.equal(minimized.hidden, true);
  assert.equal(body.inert, false);
  assert.equal(animations[1].frames[0].width, '184px');
  assert.equal(animations[1].frames.at(-1).width, '360px');
});
test('reduced motion minimizes immediately and header action buttons never start dragging', async () => {
  const { panel, body, win, fire } = setup();
  const initial = panel.getBoundingClientRect().left;
  fire('pointerdown', { button: 0, pointerId: 1, clientX: 430, clientY: 30, target: { closest: () => ({}) } });
  fire('pointermove', { pointerId: 1, clientX: 100, clientY: 100 });
  assert.equal(panel.getBoundingClientRect().left, initial);
  await win.ringlightPanel.setVisible(false);
  assert.equal(panel.hidden, false);
  assert.equal(body.hidden, true);
});
