const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'shapes.js'), 'utf8') + '\n' + fs.readFileSync(path.join(root, 'app.js'), 'utf8');
function boot({ saved, storageError = false, getUserMedia, fullscreenEnabled = false, presetView = 'summary' } = {}) {
  class Element {
    constructor() { this.value = ''; this.hidden = false; this.attributes = {}; this.events = {}; this.children = []; this.dataset = {}; this.classes = new Set(); this.style = { setProperty: (key, value) => this.attributes[key] = value }; this.classList = { add: (key) => this.classes.add(key), remove: (key) => this.classes.delete(key), toggle: (key, value) => value ? this.classes.add(key) : this.classes.delete(key) }; }
    addEventListener(type, callback) { this.events[type] = callback; }
    setAttribute(key, value) { this.attributes[key] = value; }
    replaceChildren() { this.children = []; }
    append(...children) { this.children.push(...children); }
    focus() {}
    select() {}
    blur() { return this.fire('blur'); }
    click() { return this.fire('click'); }
    play() { return Promise.resolve(); }
    fire(type, value) { if (value !== undefined) this.value = value; return this.events[type]?.({ target: this, preventDefault() {} }); }
  }
  const ids = [...fs.readFileSync(path.join(root, 'index.html'), 'utf8').matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
  const elements = Object.fromEntries(ids.map((id) => [id, new Element()]));
  let stored = saved ?? JSON.stringify({ presetView });
  const documentEvents = {};
  const windowEvents = {};
  let fullscreenRequests = 0;
  const context = vm.createContext({ document: { getElementById(id) { assert.ok(elements[id], `Missing element ${id}`); return elements[id]; }, querySelectorAll: () => [], createElement: () => new Element(), addEventListener(name, fn) { documentEvents[name] = fn; }, fullscreenEnabled, documentElement: { async requestFullscreen() { fullscreenRequests++; context.document.fullscreenElement = this; } }, async exitFullscreen() { context.document.fullscreenElement = null; } }, localStorage: { getItem: () => stored ?? null, setItem: (_, value) => { if (storageError) throw new Error('Full'); stored = value; } }, navigator: { mediaDevices: getUserMedia ? { getUserMedia } : undefined }, window: { addEventListener(name, fn) { windowEvents[name] = fn; }, dispatchEvent() {} }, Event: class Event {}, console });
  vm.runInContext(source, context);
  return { elements, pagehide: () => windowEvents.pagehide(), saved: () => stored, fullscreenRequests: () => fullscreenRequests, key(key, overrides = {}) { return documentEvents.keydown({ key, preventDefault() {}, ...overrides }); } };
}
test('lighting updates and 0% renders black', () => {
  const { elements: e } = boot();
  assert.equal(e.light.attributes['--light'], 'rgb(255,255,255)');
  e.intensity.fire('input', '0');
  assert.equal(e.light.attributes['--light'], 'rgb(0,0,0)');
  e.intensity.fire('input', '50');
  e.color.fire('input', '#ff0000');
  assert.equal(e.light.attributes['--light'], 'rgb(128,0,0)');
  e['full-mode'].fire('click');
  assert.ok(e.light.classes.has('full'));
  assert.equal(e['toggle-camera'].disabled, true);
});
test('presets save safely, restore, apply and delete', () => {
  const app = boot(); const e = app.elements;
  e['preset-name'].value = '<img onerror=alert(1)>';
  e['preset-form'].fire('submit');
  assert.equal(e.presets.children[0].children[0].children[0].children[1].textContent, '<img onerror=alert(1)>');
  const restored = boot({ saved: app.saved() }).elements;
  restored.intensity.fire('input', '0');
  restored.presets.children[0].children[0].fire('click');
  assert.equal(restored.intensity.value, 100);
  restored.presets.children[0].children[1].fire('click');
  assert.equal(restored.presets.children.length, 0);
});
test('invalid saved data and unavailable storage keep controls usable', () => {
  assert.equal(boot({ saved: '{broken' }).elements.intensity.value, 100);
  const { elements: e } = boot({ storageError: true });
  e.intensity.fire('input', '25');
  assert.equal(e.intensity.value, 25);
  assert.match(e.status.textContent, /não foi possível salvá-los/);
});
test('camera permission denial preserves lighting', async () => {
  const { elements: e } = boot({ getUserMedia: async () => { throw { name: 'NotAllowedError' }; } });
  await e['toggle-camera'].fire('click');
  assert.match(e.status.textContent, /negada/);
  assert.equal(e['toggle-camera'].textContent, 'Ativar câmera');
});
test('full light hides camera without stopping it and returning keeps the stream', async () => {
  let stopped = 0; let requests = 0;
  const track = { stop() { stopped++; }, addEventListener() {} };
  const { elements: e } = boot({ getUserMedia: async (options) => { requests++; assert.equal(options.audio, false); return { getTracks: () => [track], getVideoTracks: () => [track] }; } });
  await e['toggle-camera'].fire('click');
  assert.ok(e.camera.classes.has('active'));
  e['full-mode'].fire('click');
  assert.equal(stopped, 0);
  assert.ok(e.camera.srcObject);
  e['ring-mode'].fire('click');
  assert.equal(requests, 1);
  assert.equal(e['toggle-camera'].textContent, 'Desligar câmera');
});
test('camera acquired after cancellation is immediately stopped', async () => {
  let resolve; let stopped = 0;
  const { elements: e } = boot({ getUserMedia: () => new Promise((r) => resolve = r) });
  const pending = e['toggle-camera'].fire('click');
  e['toggle-camera'].fire('click');
  resolve({ getTracks: () => [{ stop() { stopped++; } }] });
  await pending;
  assert.equal(stopped, 1);
  assert.equal(e.camera.srcObject, null);
});
test('offline asset list and manifest point to existing local files', () => {
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  const assets = [...sw.match(/const ASSETS = \[(.*?)\]/s)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  assets.forEach((asset) => assert.ok(fs.existsSync(path.join(root, asset)), asset));
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8'));
  assert.equal(manifest.display, 'standalone');
  manifest.icons.forEach((icon) => {
    const bytes = fs.readFileSync(path.join(root, icon.src));
    assert.equal(`${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`, icon.sizes);
  });
});
test('presets restore camera on and off, including after reloading', async () => {
  let requests = 0; let stopped = 0;
  const getUserMedia = async () => {
    requests++;
    const track = { stop() { stopped++; }, addEventListener() {} };
    return { getTracks: () => [track], getVideoTracks: () => [track] };
  };
  const app = boot({ getUserMedia }); const e = app.elements;
  e['preset-name'].value = 'Sem câmera';
  e['preset-form'].fire('submit');
  await e['toggle-camera'].fire('click');
  e['preset-name'].value = 'Com câmera';
  e['preset-form'].fire('submit');
  const saved = JSON.parse(app.saved());
  assert.equal(saved.presets[0].cameraEnabled, false);
  assert.equal(saved.presets[1].cameraEnabled, true);
  await e.presets.children[0].children[0].fire('click');
  assert.equal(e.camera.srcObject, null);
  assert.equal(stopped, 1);
  const reloaded = boot({ saved: app.saved(), getUserMedia }).elements;
  assert.equal(requests, 1, 'reloading must not request camera');
  await reloaded.presets.children[1].children[0].fire('click');
  assert.equal(requests, 2);
  assert.ok(reloaded.camera.classes.has('active'));
  await reloaded.presets.children[0].children[0].fire('click');
  assert.equal(reloaded.camera.srcObject, null);
  assert.equal(stopped, 2);
});
test('legacy presets disable the camera and permission denial leaves preset lighting applied', async () => {
  const settings = { mode: 'ring', color: '#ff0000', intensity: 50 };
  const saved = JSON.stringify({ presets: [{ id: 'old', name: 'Antiga', ...settings }, { id: 'new', name: 'Câmera', ...settings, cameraEnabled: true }] });
  let requests = 0;
  const { elements: e } = boot({ saved, getUserMedia: async () => { requests++; throw { name: 'NotAllowedError' }; } });
  await e.presets.children[0].children[0].fire('click');
  assert.equal(requests, 0);
  await e.presets.children[1].children[0].fire('click');
  assert.equal(requests, 1);
  assert.equal(e.light.attributes['--light'], 'rgb(128,0,0)');
  assert.match(e.status.textContent, /negada/);
});
test('fun shapes change both masks and persist in presets across reloads', async () => {
  const app = boot(); const e = app.elements;
  const circle = e.light.attributes['--ring-mask'];
  e.shape.fire('change', 'heart');
  assert.notEqual(e.light.attributes['--ring-mask'], circle);
  const heartMask = e.light.attributes['--ring-mask'];
  assert.match(decodeURIComponent(e['camera-frame'].attributes['--center-mask']), /<path/);
  e['preset-name'].value = 'Coração';
  e['preset-form'].fire('submit');
  e.shape.fire('change', 'star');
  assert.match(decodeURIComponent(e.light.attributes['--ring-mask']), /<polygon/);
  const restored = boot({ saved: app.saved() }).elements;
  assert.equal(restored.shape.value, 'star');
  await restored.presets.children[0].children[0].fire('click');
  assert.equal(restored.shape.value, 'heart');
  assert.equal(restored.light.attributes['--ring-mask'], heartMask);
  restored['full-mode'].fire('click');
  assert.equal(restored.shape.disabled, true);
  restored['ring-mode'].fire('click');
  assert.equal(restored.shape.value, 'heart');
});
test('SVG import rejects oversized files without changing the current shape', async () => {
  const { elements: e } = boot();
  e.shape.fire('change', 'custom');
  assert.equal(e['svg-upload'].hidden, false);
  e['svg-file'].files = [{ size: 200001 }];
  await e['svg-file'].fire('change');
  assert.equal(e.shape.value, 'circle');
  assert.match(e.status.textContent, /200 KB/);
});
test('gradient adjusts both colors, direction and intensity in either lighting mode', () => {
  const { elements: e } = boot();
  e['gradient-color'].fire('click');
  e.color.fire('input', '#ff0000');
  e['color-end'].fire('input', '#0000ff');
  e['gradient-angle'].fire('input', '180');
  e.intensity.fire('input', '50');
  assert.equal(e.light.attributes['--light'], 'linear-gradient(180deg, rgb(128,0,0) 40%, rgb(0,0,128) 60%)');
  assert.equal(e['gradient-controls'].hidden, false);
  e['full-mode'].fire('click');
  assert.equal(e.light.attributes['--light'], 'linear-gradient(180deg, rgb(128,0,0) 40%, rgb(0,0,128) 60%)');
  e.intensity.fire('input', '0');
  assert.equal(e.light.attributes['--light'], 'linear-gradient(180deg, rgb(0,0,0) 40%, rgb(0,0,0) 60%)');
  e['solid-color'].fire('click');
  assert.equal(e.light.attributes['--light'], 'rgb(0,0,0)');
  assert.equal(e['gradient-controls'].hidden, true);
});
test('gradient presets preserve settings after reload and legacy presets use solid colors', async () => {
  const app = boot(); const e = app.elements;
  e['gradient-color'].fire('click');
  e['color-end'].fire('input', '#00ff00');
  e['gradient-angle'].fire('input', '270');
  e['preset-name'].value = 'Gradiente';
  e['preset-form'].fire('submit');
  const reloaded = boot({ saved: app.saved() }).elements;
  assert.equal(reloaded['gradient-controls'].hidden, false);
  reloaded['solid-color'].fire('click');
  await reloaded.presets.children[0].children[0].fire('click');
  assert.equal(reloaded['color-end'].value, '#00ff00');
  assert.equal(reloaded['gradient-angle'].value, 270);
  assert.match(reloaded.light.attributes['--light'], /^linear-gradient/);
  const legacy = boot({ saved: JSON.stringify({ presets: [{ id: 'old', name: 'Antiga', mode: 'ring', color: '#ffffff', intensity: 100 }] }) }).elements;
  legacy['gradient-color'].fire('click');
  await legacy.presets.children[0].children[0].fire('click');
  assert.equal(legacy.light.attributes['--light'], 'rgb(255,255,255)');
  assert.equal(legacy['gradient-controls'].hidden, true);
});

test('default gradient uses vivid colors while custom colors are preserved', () => {
  const { elements: e } = boot();
  e['gradient-color'].fire('click');
  assert.equal(e.color.value, '#ff007f');
  assert.equal(e['color-end'].value, '#00cfff');
  assert.equal(e.light.attributes['--light'], 'linear-gradient(90deg, rgb(255,0,127) 40%, rgb(0,207,255) 60%)');
  e.color.fire('input', '#00ff00');
  e['solid-color'].fire('click');
  e['gradient-color'].fire('click');
  assert.equal(e.color.value, '#00ff00');
});
test('side fill lights support gradient and preserve camera when switching from ring', async () => {
  let stopped = 0;
  const track = { stop() { stopped++; }, addEventListener() {} };
  const { elements: e } = boot({ getUserMedia: async () => ({ getTracks: () => [track], getVideoTracks: () => [track] }) });
  await e['toggle-camera'].fire('click');
  e['sides-mode'].fire('click');
  assert.ok(e.light.classes.has('sides'));
  assert.equal(e['sides-mode'].attributes['aria-pressed'], 'true');
  assert.equal(e['ring-mode'].attributes['aria-pressed'], 'false');
  assert.equal(e['toggle-camera'].disabled, false);
  assert.equal(e.shape.disabled, true);
  assert.equal(stopped, 0);
  e['gradient-color'].fire('click');
  assert.match(e.light.attributes['--light'], /^linear-gradient/);
  e['full-mode'].fire('click');
  assert.equal(e.light.classes.has('sides'), false);
  assert.equal(stopped, 0);
});
test('side presets persist mode and restore their saved camera state', async () => {
  let requests = 0;
  const track = { stop() {}, addEventListener() {} };
  const getUserMedia = async () => { requests++; return { getTracks: () => [track], getVideoTracks: () => [track] }; };
  const app = boot({ getUserMedia }); const e = app.elements;
  e['sides-mode'].fire('click');
  await e['toggle-camera'].fire('click');
  e['preset-name'].value = 'Preenchimento';
  e['preset-form'].fire('submit');
  const saved = JSON.parse(app.saved());
  assert.equal(saved.presets[0].mode, 'sides');
  assert.equal(saved.presets[0].cameraEnabled, true);
  const restored = boot({ saved: app.saved(), getUserMedia }).elements;
  assert.ok(restored.light.classes.has('sides'));
  assert.equal(requests, 2);
  restored['full-mode'].fire('click');
  await restored.presets.children[0].children[0].fire('click');
  assert.ok(restored.light.classes.has('sides'));
  assert.ok(restored.camera.classes.has('active'));
  assert.equal(requests, 2);
});

test('panel toggle restores controls and context-specific fields remain relevant', () => {
  const { elements: e } = boot();
  e['hide-panel'].fire('click');
  assert.equal(e['panel-body'].hidden, true);
  assert.equal(e['show-panel'].hidden, false);
  e['show-panel'].fire('click');
  assert.equal(e['panel-body'].hidden, false);
  e['full-mode'].fire('click');
  assert.equal(e['shape-controls'].hidden, true);
  assert.equal(e['camera-controls'].hidden, true);
  e['sides-mode'].fire('click');
  assert.equal(e['camera-controls'].hidden, false);
  assert.equal(e['shape-controls'].hidden, true);
  e['ring-mode'].fire('click');
  assert.equal(e['shape-controls'].hidden, false);
});
test('both color palettes share suggestions and apply colors independently', () => {
  const { elements: e } = boot();
  const first = e['color-swatches']; const second = e['color-end-swatches'];
  assert.equal(first.children.length, 8);
  assert.deepEqual(first.children.map((b) => b.dataset.color), second.children.map((b) => b.dataset.color));
  assert.match(first.children[0].attributes['aria-label'], /Luz branca/);
  assert.match(first.children[1].attributes['aria-label'], /Luz neutra/);
  second.children[2].fire('click');
  assert.equal(e['color-end'].value, '#ffe0ac');
  assert.equal(e.color.value, '#ffffff');
  assert.equal(first.children[0].dataset.color, '#ffffff');
  assert.equal(second.children[0].attributes['aria-pressed'], 'true');
  assert.equal(first.children[0].attributes['aria-pressed'], 'true');
  assert.equal(first.children[2].attributes['aria-pressed'], 'false');
  first.children[2].fire('click');
  assert.equal(e.color.value, '#ffe0ac');
  assert.equal(first.children[0].attributes['aria-pressed'], 'true');
});
test('recent color histories are independent, deduplicated, limited and restored after reload', () => {
  const app = boot(); const e = app.elements;
  e.color.fire('input', '#123456');
  assert.deepEqual(JSON.parse(app.saved()).recentColors.color, [], 'live picker changes must not fill history');
  e.color.fire('change', '#123456');
  e['color-end'].fire('change', '#abcdef');
  e.color.fire('change', '#ABCDEF');
  assert.deepEqual(JSON.parse(app.saved()).recentColors.color, ['#abcdef', '#123456']);
  const restored = boot({ saved: app.saved() }).elements;
  assert.equal(restored['color-swatches'].children[0].dataset.color, '#abcdef');
  assert.equal(restored['color-end-swatches'].children[0].dataset.color, '#abcdef');
  assert.equal(restored['color-end-swatches'].children.some((button) => button.dataset.color === '#123456'), false);
  assert.deepEqual(JSON.parse(app.saved()).recentColors.colorEnd, ['#abcdef']);
  for (let i = 0; i < 10; i++) e.color.fire('change', `#00000${i}`);
  assert.equal(JSON.parse(app.saved()).recentColors.color.length, 8);
  assert.equal(e['color-swatches'].children.length, 8);
});

test('choosing a color never reorders or updates the other palette', () => {
  const app = boot(); const e = app.elements;
  const first = e['color-swatches'].children;
  e['color-end'].fire('change', '#123abc');
  assert.equal(e['color-swatches'].children, first);
  assert.equal(e.color.value, '#ffffff');
  const second = e['color-end-swatches'].children;
  e.color.fire('change', '#ab1234');
  assert.equal(e['color-end-swatches'].children, second);
  assert.equal(e['color-end'].value, '#123abc');
  assert.deepEqual(JSON.parse(app.saved()).recentColors, { color: ['#ab1234'], colorEnd: ['#123abc'] });
});

test('thickness slider keeps independent mode values and presets restore both', async () => {
  const app = boot(); const e = app.elements;
  const original = e.light.attributes['--ring-mask'];
  e['light-width'].fire('input', '50');
  assert.notEqual(e.light.attributes['--ring-mask'], original);
  assert.equal(e['camera-frame'].attributes['--center-size'], 'min(50vw,50dvh)');
  e['sides-mode'].fire('click');
  assert.equal(e['light-width'].value, 20);
  assert.equal(e['light-width'].max, 40);
  e['light-width'].fire('input', '35');
  assert.equal(e.light.attributes['--side-width'], '35%');
  assert.equal(e.light.attributes['--side-start'], '65%');
  assert.equal(e['camera-frame'].attributes['--side-center'], '30vw');
  e['preset-name'].value = 'Larguras';
  e['preset-form'].fire('submit');
  const restored = boot({ saved: app.saved() }).elements;
  assert.equal(restored['light-width'].value, 35);
  restored['light-width'].fire('input', '10');
  await restored.presets.children[0].children[0].fire('click');
  assert.equal(restored['light-width'].value, 35);
  restored['ring-mode'].fire('click');
  assert.equal(restored['light-width'].value, 50);
  restored['full-mode'].fire('click');
  assert.equal(restored['width-controls'].hidden, true);
});
test('keyboard shortcuts toggle fullscreen, panel, lighting modes and gradient', () => {
  const app = boot({ fullscreenEnabled: true }); const e = app.elements;
  app.key('F');
  assert.equal(app.fullscreenRequests(), 1);
  app.key('p');
  assert.equal(e['panel-body'].hidden, true);
  app.key('p');
  assert.equal(e['panel-body'].hidden, false);
  app.key('3');
  assert.ok(e.light.classes.has('sides'));
  app.key('2');
  assert.ok(e.light.classes.has('full'));
  app.key('1');
  assert.equal(e.light.classes.has('full'), false);
  app.key('g');
  assert.equal(e['gradient-controls'].hidden, false);
  app.key('-');
  assert.equal(e.intensity.value, 95);
  app.key('+');
  assert.equal(e.intensity.value, 100);
  app.key('+');
  assert.equal(e.intensity.value, 100);
});
test('shortcuts do not interfere with editing, modifiers or repeated toggles', () => {
  const app = boot({ fullscreenEnabled: true });
  app.key('f', { target: { closest: () => ({}) } });
  app.key('f', { ctrlKey: true });
  app.key('f', { metaKey: true });
  app.key('f', { altKey: true });
  app.key('f', { isComposing: true });
  app.key('f', { target: { isContentEditable: true } });
  app.key('f', { repeat: true });
  assert.equal(app.fullscreenRequests(), 0);
  app.key('f');
  assert.equal(app.fullscreenRequests(), 1);
});

test('last complete configuration and active camera restore when reopening', async () => {
  let requests = 0; let stopped = 0;
  const getUserMedia = async () => {
    requests++;
    const track = { stop() { stopped++; }, addEventListener() {} };
    return { getTracks: () => [track], getVideoTracks: () => [track] };
  };
  const app = boot({ getUserMedia }); const e = app.elements;
  e['sides-mode'].fire('click');
  e['light-width'].fire('input', '33');
  e['gradient-color'].fire('click');
  e['color-end'].fire('change', '#123abc');
  e.intensity.fire('input', '65');
  await e['toggle-camera'].fire('click');
  app.pagehide();
  assert.equal(stopped, 1);
  assert.equal(JSON.parse(app.saved()).settings.cameraEnabled, true);
  const restored = boot({ saved: app.saved(), getUserMedia });
  await new Promise(setImmediate);
  assert.equal(requests, 2);
  assert.ok(restored.elements.camera.classes.has('active'));
  assert.equal(restored.elements['light-width'].value, 33);
  assert.equal(restored.elements.intensity.value, 65);
  assert.equal(restored.elements['color-end'].value, '#123abc');
  await restored.elements['toggle-camera'].fire('click');
  assert.equal(JSON.parse(restored.saved()).settings.cameraEnabled, false);
  boot({ saved: restored.saved(), getUserMedia });
  assert.equal(requests, 2);
});
test('camera keeps the same stream across ring and sides using buttons or shortcuts', async () => {
  let requests = 0; let stopped = 0;
  const track = { stop() { stopped++; }, addEventListener() {} };
  const acquired = { getTracks: () => [track], getVideoTracks: () => [track] };
  const app = boot({ getUserMedia: async () => { requests++; return acquired; } });
  const e = app.elements;
  await e['toggle-camera'].fire('click');
  for (const mode of ['sides-mode', 'ring-mode', 'sides-mode', 'ring-mode']) {
    e[mode].fire('click');
    assert.equal(e.camera.srcObject, acquired);
    assert.ok(e.camera.classes.has('active'));
    assert.equal(e['toggle-camera'].attributes['aria-pressed'], 'true');
    assert.equal(JSON.parse(app.saved()).settings.cameraEnabled, true);
  }
  app.key('3'); app.key('1');
  assert.equal(e.camera.srcObject, acquired);
  assert.equal(requests, 1);
  assert.equal(stopped, 0);
});
test('switching between ring and sides while requesting camera does not cancel access', async () => {
  let resolve; let stopped = 0;
  const { elements: e } = boot({ getUserMedia: () => new Promise((r) => resolve = r) });
  const pending = e['toggle-camera'].fire('click');
  e['sides-mode'].fire('click'); e['ring-mode'].fire('click'); e['sides-mode'].fire('click');
  const track = { stop() { stopped++; }, addEventListener() {} };
  const acquired = { getTracks: () => [track], getVideoTracks: () => [track] };
  resolve(acquired);
  await pending;
  assert.equal(e.camera.srcObject, acquired);
  assert.ok(e.camera.classes.has('active'));
  assert.equal(stopped, 0);
});
test('passing through full light preserves camera preference, sizes, shape and colors after reload', async () => {
  let requests = 0; let stopped = 0;
  const track = { stop() { stopped++; }, addEventListener() {} };
  const acquired = { getTracks: () => [track], getVideoTracks: () => [track] };
  const getUserMedia = async () => { requests++; return acquired; };
  const app = boot({ getUserMedia }); const e = app.elements;
  e.shape.fire('change', 'heart');
  e['light-width'].fire('input', '45');
  e['gradient-color'].fire('click');
  e['color-end'].fire('change', '#abcdef');
  await e['toggle-camera'].fire('click');
  e['full-mode'].fire('click');
  assert.equal(JSON.parse(app.saved()).settings.cameraEnabled, true);
  assert.equal(stopped, 0);
  e['ring-mode'].fire('click');
  assert.equal(e.camera.srcObject, acquired);
  assert.equal(e.shape.value, 'heart');
  assert.equal(e['light-width'].value, 45);
  assert.equal(e['color-end'].value, '#abcdef');
  assert.equal(requests, 1);
  e['full-mode'].fire('click');
  app.pagehide();
  const restored = boot({ saved: app.saved(), getUserMedia });
  assert.equal(requests, 1, 'full light startup keeps preference without opening camera');
  restored.elements['sides-mode'].fire('click');
  await new Promise(setImmediate);
  assert.ok(restored.elements.camera.classes.has('active'));
  assert.equal(requests, 2);
});

test('unnamed presets get unique generated names and metadata visible before applying', () => {
  const app = boot(); const e = app.elements;
  e['preset-name'].value = '   ';
  e['preset-form'].fire('submit');
  e['preset-form'].fire('submit');
  const saved = JSON.parse(app.saved());
  assert.equal(saved.presets.length, 2);
  assert.ok(saved.presets[0].name.trim());
  assert.notEqual(saved.presets[0].name, saved.presets[1].name);
  assert.ok(Number.isFinite(Date.parse(saved.presets[0].metadata.savedAt)));
  const restored = boot({ saved: app.saved() }).elements;
  const card = restored.presets.children[0].children[0];
  const badges = card.children[1].children;
  const descriptions = badges.map((badge) => badge.attributes['aria-label']).join(' ');
  assert.match(descriptions, /Anel: Círculo.*Espessura 29%/);
  assert.match(descriptions, /Intensidade 100%.*Câmera desligada/);
  assert.equal(badges.some((badge) => badge.children.some((child) => /#/.test(child.textContent || ''))), false);
  assert.match(card.children.at(-1).title, /Salva em/);
  assert.equal(card.children.at(-1).dateTime, saved.presets[0].metadata.savedAt);
});
test('visual preset cards render saved lighting and retain the summary option', () => {
  const app = boot(); const e = app.elements;
  e['preset-name'].value = 'Visual'; e['preset-form'].fire('submit');
  const savedSettings = JSON.parse(app.saved()).settings;
  e['presets-visual'].fire('click');
  assert.ok(e.presets.classes.has('visual-presets'));
  const card = e.presets.children[0].children[0];
  assert.equal(card.children[0].className, 'preset-scene ring');
  assert.equal(card.children[0].attributes['--preview-light'], 'rgb(255,255,255)');
  assert.equal(card.children[1].className, 'preset-overlay');
  assert.deepEqual(JSON.parse(app.saved()).settings, savedSettings);
  const restored = boot({ saved: app.saved() }).elements;
  assert.ok(restored.presets.classes.has('visual-presets'));
  restored['presets-summary'].fire('click');
  assert.equal(restored.presets.classes.has('visual-presets'), false);
  assert.equal(restored.presets.children[0].children[0].children[0].className, 'preset-heading');
});

test('visual cards are the default and an explicit summary preference is preserved', () => {
  const app = boot({ saved: '{}' });
  assert.ok(app.elements.presets.classes.has('visual-presets'));
  app.elements['presets-summary'].fire('click');
  const restored = boot({ saved: app.saved() });
  assert.equal(restored.elements.presets.classes.has('visual-presets'), false);
});

test('double-clicking values resets their defaults and persists the result', () => {
  const app = boot(); const e = app.elements;
  e.intensity.fire('input', '30');
  e['intensity-label'].fire('dblclick');
  assert.equal(e.intensity.value, 100);
  e['light-width'].fire('input', '60');
  e['light-width-label'].fire('dblclick');
  assert.equal(e['light-width'].value, 29);
  e['sides-mode'].fire('click');
  e['light-width'].fire('input', '40');
  e['light-width-label'].fire('dblclick');
  assert.equal(e['light-width'].value, 20);
  e['gradient-angle'].fire('input', '270');
  e['gradient-angle-label'].fire('dblclick');
  assert.equal(e['gradient-angle'].value, 90);
  e.color.fire('input', '#123456');
  e['color-label'].fire('dblclick');
  assert.equal(e.color.value, '#ffffff');
  e['color-end'].fire('input', '#abcdef');
  e['color-end-label'].fire('dblclick');
  assert.equal(e['color-end'].value, '#00cfff');
  const saved = JSON.parse(app.saved()).settings;
  assert.equal(saved.intensity, 100);
  assert.equal(saved.ringThickness, 29);
  assert.equal(saved.sideWidth, 20);
  assert.equal(saved.gradientAngle, 90);
});

test('values can be typed and committed while invalid input and Escape preserve settings', () => {
  const app = boot(); const e = app.elements;
  const intensity = e['intensity-label'].children[0];
  intensity.value = '42%';
  intensity.events.keydown({ key: 'Enter', preventDefault() {} });
  assert.equal(e.intensity.value, 42);
  assert.equal(JSON.parse(app.saved()).settings.intensity, 42);
  intensity.value = '999';
  intensity.fire('blur');
  assert.equal(e.intensity.value, 42);
  assert.equal(intensity.value, '42');
  intensity.value = '12';
  intensity.events.keydown({ key: 'Escape', preventDefault() {} });
  assert.equal(e.intensity.value, 42);
  const color = e['color-label'].children[0];
  color.value = 'abcdef'; color.fire('blur');
  assert.equal(e.color.value, '#abcdef');
  color.value = 'invalid'; color.fire('blur');
  assert.equal(e.color.value, '#abcdef');
  e['sides-mode'].fire('click');
  const width = e['light-width-label'].children[0];
  width.value = '35'; width.fire('blur');
  assert.equal(e['light-width'].value, 35);
  e['ring-mode'].fire('click');
  assert.equal(width.value, '29');
});

test('percentage and degree units stay outside numeric inputs', () => {
  const { elements: e } = boot();
  for (const [id, unit, initial] of [['intensity-label', '%', '100'], ['light-width-label', '%', '29'], ['gradient-angle-label', '°', '90']]) {
    assert.equal(e[id].children[0].value, initial);
    assert.equal(e[id].children[1].textContent, unit);
  }
  e.intensity.fire('input', '55');
  assert.equal(e['intensity-label'].children[0].value, '55');
  assert.equal(e['intensity-label'].children[1].textContent, '%');
});

test('clicking adjustment labels resets defaults and shows contextual tooltips', () => {
  const app = boot(); const e = app.elements;
  e.intensity.fire('input', '25');
  e['intensity-title'].fire('click');
  assert.equal(e.intensity.value, 100);
  assert.match(e['intensity-title'].title, /Clique.*padrão.*100%/);
  e['sides-mode'].fire('click');
  e['light-width'].fire('input', '35');
  assert.match(e['light-width-title'].title, /20%/);
  e['light-width-title'].fire('click');
  assert.equal(e['light-width'].value, 20);
  e['ring-mode'].fire('click');
  assert.match(e['light-width-title'].title, /29%/);
  e.shape.fire('change', 'star');
  e['shape-title'].fire('click');
  assert.equal(e.shape.value, 'circle');
  e.color.fire('input', '#ff0000');
  e['color-title'].events.keydown({ key: 'Enter', preventDefault() {} });
  assert.equal(e.color.value, '#ffffff');
});

test('additional shapes render and persist in saved presets', async () => {
  const app = boot(); const e = app.elements;
  for (const shape of ['square', 'diamond', 'triangle', 'hexagon', 'octagon', 'flower']) {
    e.shape.fire('change', shape);
    assert.equal(e.shape.value, shape);
    assert.ok(e.light.attributes['--ring-mask'].includes('data:image/svg+xml'));
    e['preset-name'].value = shape; e['preset-form'].fire('submit');
  }
  const restored = boot({ saved: app.saved() }).elements;
  await restored.presets.children[0].children[0].fire('click');
  assert.equal(restored.shape.value, 'square');
});

test('random configuration changes mode, preserves camera and saves valid independent colors', async () => {
  const stop = () => {}; let calls = 0;
  const app = boot({ getUserMedia: async () => { calls++; return { getTracks: () => [{ stop }], getVideoTracks: () => [] }; } });
  const e = app.elements;
  await e['toggle-camera'].fire('click');
  e['sides-mode'].fire('click');
  e['random-config'].fire('click');
  const saved = JSON.parse(app.saved());
  assert.notEqual(saved.settings.mode, 'sides');
  assert.equal(saved.settings.cameraEnabled, true);
  assert.equal(calls, 1);
  assert.notEqual(saved.settings.color, saved.settings.colorEnd);
  assert.ok(saved.settings.intensity >= 40 && saved.settings.intensity <= 100);
  assert.ok(saved.settings.sideWidth >= 10 && saved.settings.sideWidth <= 30);
  assert.equal(saved.presets.length, 0);
});
