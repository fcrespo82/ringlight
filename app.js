'use strict';
const $ = (id) => document.getElementById(id);
const valueEditors = {};
function displayValue(id, text) {
  const editor = valueEditors[id];
  if (editor) {
    if (document.activeElement !== editor) editor.value = text.replace(/[%°]$/, '');
  } else $(id).textContent = text;
}
const STORAGE_KEY = 'ringlight.v1';
const defaults = { mode: 'ring', color: '#ffffff', intensity: 100, shape: 'circle', customSvg: '', colorMode: 'solid', colorEnd: '#00cfff', gradientAngle: 90, ringThickness: 29, sideWidth: 20, cameraEnabled: false };
let settings = { ...defaults };
let presets = [];
let presetView = 'visual';
let recentColors = { color: [], colorEnd: [] };
const SUGGESTED_COLORS = [
  ['#ffffff', 'Luz branca'], ['#fff4e5', 'Luz neutra'],
  ['#ffe0ac', 'Luz quente média'], ['#d2e8ff', 'Luz fria'],
  ['#ff007f', 'Rosa vivo'], ['#00cfff', 'Azul-ciano'],
  ['#c8bcff', 'Lilás'], ['#ffc078', 'Luz âmbar']
];
const COLOR_LIMIT = 8;
let stream = null;
let cameraPending = false;
let cameraGeneration = 0;
const validSettings = (value) => value && ['ring', 'full', 'sides'].includes(value.mode) && /^#[0-9a-f]{6}$/i.test(value.color) && Number.isFinite(value.intensity) && value.intensity >= 0 && value.intensity <= 100;
function gradientSettings(value) {
  return {
    colorMode: value?.colorMode === 'gradient' ? 'gradient' : 'solid',
    colorEnd: /^#[0-9a-f]{6}$/i.test(value?.colorEnd) ? value.colorEnd : '#00cfff',
    gradientAngle: Number.isFinite(value?.gradientAngle) && value.gradientAngle >= 0 && value.gradientAngle <= 360 ? value.gradientAngle : 90
  };
}
function sizeSettings(value) {
  return {
    ringThickness: Number.isFinite(value?.ringThickness) && value.ringThickness >= 5 && value.ringThickness <= 70 ? value.ringThickness : 29,
    sideWidth: Number.isFinite(value?.sideWidth) && value.sideWidth >= 5 && value.sideWidth <= 40 ? value.sideWidth : 20
  };
}
const status = (message) => { $('status').textContent = message; };
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
  presetView = saved?.presetView === 'summary' ? 'summary' : 'visual';
  const cleanHistory = (values) => Array.isArray(values) ? [...new Set(values.filter((color) => typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color)).map((color) => color.toLowerCase()))].slice(0, COLOR_LIMIT) : [];
  recentColors = {
    color: cleanHistory(Array.isArray(saved?.recentColors) ? saved.recentColors : saved?.recentColors?.color),
    colorEnd: cleanHistory(saved?.recentColors?.colorEnd)
  };
  if (validSettings(saved?.settings)) settings = { mode: saved.settings.mode, color: saved.settings.color, intensity: saved.settings.intensity, ...shapeSettings(saved.settings), ...gradientSettings(saved.settings), ...sizeSettings(saved.settings), cameraEnabled: saved.settings.cameraEnabled === true };
  if (Array.isArray(saved?.presets)) presets = saved.presets.filter((p) => typeof p.id === 'string' && typeof p.name === 'string' && p.name.trim() && validSettings(p)).map((p) => ({ id: p.id, name: p.name.slice(0, 40), mode: p.mode, color: p.color, intensity: p.intensity, ...shapeSettings(p), ...gradientSettings(p), ...sizeSettings(p), cameraEnabled: p.cameraEnabled === true, metadata: { savedAt: typeof p.metadata?.savedAt === 'string' && Number.isFinite(Date.parse(p.metadata.savedAt)) ? p.metadata.savedAt : null } }));
} catch { status('Não foi possível recuperar os ajustes salvos.'); }
function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ settings, presets, recentColors, presetView })); }
  catch { status('Os ajustes funcionam, mas não foi possível salvá-los neste navegador.'); }
}
function cameraButton() {
  $('toggle-camera').textContent = cameraPending ? 'Cancelar câmera' : stream ? 'Desligar câmera' : 'Ativar câmera';
  $('toggle-camera').setAttribute('aria-pressed', String(Boolean(stream)));
  $('toggle-camera').disabled = settings.mode === 'full';
}
function stopCamera(remember = true) {
  cameraGeneration++;
  cameraPending = false;
  stream?.getTracks().forEach((track) => track.stop());
  stream = null;
  $('camera').srcObject = null;
  $('camera').classList.remove('active');
  cameraButton();
  if (remember) { settings.cameraEnabled = false; persist(); }
}
function rememberColor(field, color) {
  if (typeof color !== 'string' || !/^#[0-9a-f]{6}$/i.test(color)) return;
  color = color.toLowerCase();
  recentColors[field] = [color, ...recentColors[field].filter((entry) => entry !== color)].slice(0, COLOR_LIMIT);
}
const lastPaletteKeys = { color: '', colorEnd: '' };
function renderSwatches() {
  for (const [id, field] of [['color-swatches', 'color'], ['color-end-swatches', 'colorEnd']]) {
    const palette = [...new Set([...recentColors[field], ...SUGGESTED_COLORS.map(([color]) => color)])].slice(0, COLOR_LIMIT);
    const key = palette.join(',');
    const container = $(id);
    if (key !== lastPaletteKeys[field]) {
      container.replaceChildren();
      palette.forEach((color) => {
        const button = document.createElement('button');
        const name = SUGGESTED_COLORS.find(([value]) => value === color)?.[1] || 'Cor recente';
        button.type = 'button';
        button.dataset.color = color;
        button.style.setProperty('--swatch', color);
        button.title = `${name} · ${color.toUpperCase()}`;
        button.setAttribute('aria-label', button.title);
        button.addEventListener('click', () => {
          update({ [field]: color }, true);
          Array.from($(id).children).find((item) => item.dataset.color === color)?.focus();
        });
        container.append(button);
      });
    }
    lastPaletteKeys[field] = key;
    Array.from(container.children).forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.color === settings[field].toLowerCase())));
  }
}
let lastShapeKey = '';
function render() {
  const shapeKey = settings.shape + settings.customSvg + settings.ringThickness;
  if (shapeKey !== lastShapeKey) {
    const masks = shapeMasks(settings.shape, settings.customSvg, settings.ringThickness);
    $('light').style.setProperty('--ring-mask', masks.ring);
    $('camera-frame').style.setProperty('--center-mask', masks.center);
    const width = `min(100vw, ${100 / masks.aspect}dvh)`;
    const height = `min(${100 * masks.aspect}vw, 100dvh)`;
    $('light').style.setProperty('--shape-width', width);
    $('light').style.setProperty('--shape-height', height);
    $('camera-frame').style.setProperty('--camera-width', masks.fullCenter ? width : `min(${100-settings.ringThickness}vw, ${100-settings.ringThickness}dvh)`);
    $('camera-frame').style.setProperty('--camera-height', masks.fullCenter ? height : `min(${100-settings.ringThickness}vw, ${100-settings.ringThickness}dvh)`);
    lastShapeKey = shapeKey;
  }
  const inner = 100 * (1 - settings.ringThickness / 100);
  $('camera-frame').style.setProperty('--center-size', `min(${inner}vw,${inner}dvh)`);
  $('light').style.setProperty('--side-width', `${settings.sideWidth}%`);
  $('light').style.setProperty('--side-start', `${100 - settings.sideWidth}%`);
  $('camera-frame').style.setProperty('--side-center', `${100 - 2 * settings.sideWidth}vw`);
  const isSides = settings.mode === 'sides';
  $('width-controls').hidden = settings.mode === 'full';
  $('light-width-title').textContent = isSides ? 'Largura das laterais' : 'Espessura do anel';
  $('light-width-title').title = `Clique para restaurar o padrão (${isSides ? defaults.sideWidth : defaults.ringThickness}%)`;
  $('light-width').max = isSides ? 40 : 70;
  $('light-width').value = isSides ? settings.sideWidth : settings.ringThickness;
  valueEditors['light-width-label']?.setAttribute('aria-label', isSides ? 'Largura das laterais' : 'Espessura do anel');
  displayValue('light-width-label', `${$('light-width').value}%`);
  $('shape').value = settings.shape;
  $('shape').disabled = settings.mode !== 'ring';
  $('shape-controls').hidden = settings.mode !== 'ring';
  $('camera-controls').hidden = settings.mode === 'full';
  $('svg-upload').hidden = settings.shape !== 'custom' || settings.mode !== 'ring';
  const dimmedColor = (color) => `rgb(${color.slice(1).match(/../g).map((hex) => Math.round(parseInt(hex, 16) * settings.intensity / 100)).join(',')})`;
  const light = settings.colorMode === 'gradient'
    ? `linear-gradient(${settings.gradientAngle}deg, ${dimmedColor(settings.color)} 40%, ${dimmedColor(settings.colorEnd)} 60%)`
    : dimmedColor(settings.color);
  $('light').style.setProperty('--light', light);
  $('solid-color').setAttribute('aria-pressed', String(settings.colorMode === 'solid'));
  $('gradient-color').setAttribute('aria-pressed', String(settings.colorMode === 'gradient'));
  $('gradient-controls').hidden = settings.colorMode !== 'gradient';
  $('color-title').textContent = settings.colorMode === 'gradient' ? 'Primeira cor' : 'Cor da luz';
  $('color-end').value = settings.colorEnd;
  displayValue('color-end-label', settings.colorEnd.toUpperCase());
  $('gradient-angle').value = settings.gradientAngle;
  displayValue('gradient-angle-label', `${settings.gradientAngle}°`);
  $('light').classList.toggle('full', settings.mode === 'full');
  $('light').classList.toggle('sides', settings.mode === 'sides');
  $('sides-mode').setAttribute('aria-pressed', String(settings.mode === 'sides'));
  $('ring-mode').setAttribute('aria-pressed', String(settings.mode === 'ring'));
  $('full-mode').setAttribute('aria-pressed', String(settings.mode === 'full'));
  $('color').value = settings.color;
  displayValue('color-label', settings.color.toUpperCase());
  $('intensity').value = settings.intensity;
  displayValue('intensity-label', `${settings.intensity}%`);
  renderSwatches();
  cameraButton();
}
function update(changes, rememberColors = false) {
  if (rememberColors) {
    if (changes.color) rememberColor('color', changes.color);
    if (changes.colorEnd) rememberColor('colorEnd', changes.colorEnd);
  }
  settings = { ...settings, ...changes };
  status('');
  if (changes.cameraEnabled === false) stopCamera();
  render();
  persist();
  if (settings.cameraEnabled && settings.mode !== 'full') return startCamera();
}
$('shape').addEventListener('change', (event) => {
  if (event.target.value === 'custom' && !settings.customSvg) {
    $('svg-upload').hidden = false;
    status('Importe um SVG para usar esta forma.');
    return;
  }
  update({ shape: event.target.value });
});
let svgImportGeneration = 0;
$('svg-file').addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  const generation = ++svgImportGeneration;
  try {
    if (file.size > 200000) throw new Error('O SVG deve ter no máximo 200 KB.');
    const svg = sanitizeShapeSvg(await file.text());
    if (generation !== svgImportGeneration) return;
    update({ shape: 'custom', customSvg: svg });
  } catch (error) {
    if (generation === svgImportGeneration) { render(); status(error.message); }
  } finally { event.target.value = ''; }
});
$('random-config')?.addEventListener('click', (event) => { event?.preventDefault?.(); event?.stopPropagation?.(); update(randomLightSettings(settings), true); });
$('ring-mode').addEventListener('click', () => update({ mode: 'ring' }));
$('full-mode').addEventListener('click', () => update({ mode: 'full' }));
$('sides-mode').addEventListener('click', () => update({ mode: 'sides' }));
$('solid-color').addEventListener('click', () => update({ colorMode: 'solid' }));
$('gradient-color').addEventListener('click', () => {
  const useVividDefaults = settings.color.toLowerCase() === '#ffffff' && ['#c8bcff', '#00cfff'].includes(settings.colorEnd.toLowerCase());
  update({ colorMode: 'gradient', ...(useVividDefaults ? { color: '#ff007f', colorEnd: '#00cfff' } : {}) });
});
$('color-end').addEventListener('input', (event) => update({ colorEnd: event.target.value }));
$('gradient-angle').addEventListener('input', (event) => update({ gradientAngle: Number(event.target.value) }));
$('color').addEventListener('input', (event) => update({ color: event.target.value }));
$('intensity').addEventListener('input', (event) => update({ intensity: Number(event.target.value) }));
$('light-width').addEventListener('input', (event) => {
  if (settings.mode === 'full') return;
  update({ [settings.mode === 'sides' ? 'sideWidth' : 'ringThickness']: Number(event.target.value) });
});
for (const [id, field] of [['color', 'color'], ['color-end', 'colorEnd']]) {
  $(id).addEventListener('change', (event) => update({ [field]: event.target.value }, true));
}
function setPanel(visible) {
  if (window.ringlightPanel) return window.ringlightPanel.setVisible(visible);
  $('panel-body').hidden = !visible;
  $('panel').classList.toggle('collapsed', !visible);
  $('hide-panel').hidden = !visible;
  $('show-panel').hidden = visible;
  $('show-panel').setAttribute('aria-expanded', String(visible));
  if (visible) window.dispatchEvent(new Event('resize'));
  (visible ? $('hide-panel') : $('show-panel')).focus();
}
$('hide-panel').addEventListener('click', () => setPanel(false));
$('show-panel').addEventListener('click', () => setPanel(true));
let cameraTask = null;
function startCamera() {
  if (cameraPending) return cameraTask;
  if (stream) return Promise.resolve();
  cameraTask = openCamera();
  return cameraTask;
}
async function openCamera() {
  if (stream || cameraPending) return;
  if (settings.mode === 'full') return;
  status('');
  if (!navigator.mediaDevices?.getUserMedia) { status('Câmera indisponível. Acesse por HTTPS ou localhost em um navegador compatível.'); return; }
  settings.cameraEnabled = true;
  persist();
  const generation = ++cameraGeneration;
  cameraPending = true;
  cameraButton();
  try {
    const acquired = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
    if (generation !== cameraGeneration || !settings.cameraEnabled) { acquired.getTracks().forEach((track) => track.stop()); return; }
    stream = acquired;
    $('camera').srcObject = stream;
    await $('camera').play();
    if (generation !== cameraGeneration) return;
    $('camera').classList.add('active');
    stream.getVideoTracks().forEach((track) => track.addEventListener('ended', () => { if (stream === acquired) { stopCamera(); status('A câmera foi desconectada.'); } }));
  } catch (error) {
    if (generation !== cameraGeneration) return;
    stopCamera(false);
    status(error.name === 'NotAllowedError' ? 'Permissão da câmera negada. Você pode continuar usando a luz.' : 'Não foi possível abrir a câmera. Verifique se ela está disponível.');
  } finally {
    if (generation === cameraGeneration) { cameraPending = false; cameraButton(); }
  }
}
function toggleCamera() {
  if (stream || cameraPending) { stopCamera(); return; }
  return startCamera();
}
$('toggle-camera').addEventListener('click', toggleCamera);
$('fullscreen').hidden = !document.fullscreenEnabled;
async function toggleFullscreen() {
  if (!document.fullscreenEnabled) { status('Tela cheia indisponível neste navegador.'); return; }
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch { status('Não foi possível ativar a tela cheia neste navegador.'); }
}
$('fullscreen').addEventListener('click', toggleFullscreen);
document.addEventListener('fullscreenchange', () => { $('fullscreen').textContent = document.fullscreenElement ? 'Sair da tela cheia ↙' : 'Tela cheia ↗'; });
function randomPresetName() {
  const names = ['Aurora', 'Brisa', 'Estrela', 'Lua', 'Sol', 'Prisma', 'Vênus', 'Cometa'];
  const tones = ['Suave', 'Radiante', 'Serena', 'Viva', 'Dourada', 'Azul'];
  const pick = (values) => values[Math.floor(Math.random() * values.length)];
  const base = `${pick(names)} ${pick(tones)} ${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  let name = base;
  let suffix = 2;
  while (presets.some((preset) => preset.name === name)) name = `${base} ${suffix++}`;
  return name;
}
function presetBadges(preset) {
  const mode = ({ ring: 'Anel', full: 'Luz inteira', sides: 'Laterais' })[preset.mode];
  const shape = ({ circle: ['◉', 'Círculo'], heart: ['♥', 'Coração'], star: ['★', 'Estrela'], square: ['▢', 'Quadrado arredondado'], diamond: ['◇', 'Losango'], triangle: ['△', 'Triângulo'], hexagon: ['⬡', 'Hexágono'], octagon: ['⯃', 'Octógono'], flower: ['✿', 'Flor'], custom: ['◇', 'SVG personalizado'] })[preset.shape] || ['◉', 'Círculo'];
  const badges = [{ icon: preset.mode === 'ring' ? shape[0] : preset.mode === 'sides' ? '▥' : '▣', value: '', label: preset.mode === 'ring' ? `${mode}: ${shape[1]}` : mode }];
  if (preset.mode !== 'full') badges.push({ icon: '↔', value: `${preset.mode === 'ring' ? preset.ringThickness : preset.sideWidth}%`, label: preset.mode === 'ring' ? `Espessura ${preset.ringThickness}%` : `Largura ${preset.sideWidth}% por lado` });
  badges.push({ icon: '☀', value: `${preset.intensity}%`, label: `Intensidade ${preset.intensity}%` });
  badges.push({ icon: '📷', value: '', label: preset.cameraEnabled ? (preset.mode === 'full' ? 'Câmera ligada (oculta)' : 'Câmera ligada') : 'Câmera desligada', className: preset.cameraEnabled ? 'camera-on' : 'camera-off' });
  if (preset.colorMode === 'gradient') badges.push({ icon: '◐', value: `${preset.gradientAngle}°`, label: `Gradiente: direção ${preset.gradientAngle}°` });
  return badges;
}
function presetScene(preset) {
  const scene = document.createElement('span');
  scene.className = `preset-scene ${preset.mode}`;
  scene.setAttribute('aria-hidden', 'true');
  const dim = (color) => `rgb(${color.slice(1).match(/../g).map((hex) => Math.round(parseInt(hex, 16) * preset.intensity / 100)).join(',')})`;
  const light = preset.colorMode === 'gradient' ? `linear-gradient(${preset.gradientAngle}deg, ${dim(preset.color)} 40%, ${dim(preset.colorEnd)} 60%)` : dim(preset.color);
  scene.style.setProperty('--preview-light', light);
  if (preset.mode === 'ring') {
    const masks = shapeMasks(preset.shape, preset.customSvg, preset.ringThickness);
    scene.style.setProperty('--preview-ring', masks.ring);
    scene.style.setProperty('--preview-center', masks.center);
    scene.style.setProperty('--preview-shape-height', `${100*masks.aspect}%`);
    scene.style.setProperty('--preview-shape-width', '100%');
    scene.style.setProperty('--preview-camera-height', `${(masks.fullCenter?100:100-preset.ringThickness)*masks.aspect}%`);
    scene.style.setProperty('--preview-camera-width', `${masks.fullCenter?100:100-preset.ringThickness}%`);
    scene.style.setProperty('--preview-inner', `${100 - preset.ringThickness}%`);
    scene.style.setProperty('--preview-inner-width', `${(100 - preset.ringThickness) * .625}%`);
  }
  scene.style.setProperty('--preview-side-width', `${preset.sideWidth}%`);
  scene.style.setProperty('--preview-side-start', `${100 - preset.sideWidth}%`);
  scene.style.setProperty('--preview-side-center', `${100 - 2 * preset.sideWidth}%`);
  if (preset.cameraEnabled && preset.mode !== 'full') {
    const camera = document.createElement('span');
    camera.className = 'preset-camera';
    camera.textContent = '📷';
    scene.append(camera);
  }
  return scene;
}
for (const [id, view] of [['presets-summary', 'summary'], ['presets-visual', 'visual']]) {
  $(id).addEventListener('click', () => { presetView = view; renderPresets(); persist(); });
}
function renderPresets() {
  $('presets-summary').setAttribute('aria-pressed', String(presetView === 'summary'));
  $('presets-visual').setAttribute('aria-pressed', String(presetView === 'visual'));
  $('presets').classList.toggle('visual-presets', presetView === 'visual');
  $('presets').replaceChildren();
  presets.forEach((preset) => {
    const item = document.createElement('li');
    const apply = document.createElement('button');
    apply.className = 'apply-preset';
    const name = document.createElement('span');
    name.className = 'preset-name';
    name.textContent = preset.name;
    const preview = document.createElement('span');
    preview.className = 'preset-preview';
    preview.setAttribute('role', 'img');
    preview.setAttribute('aria-label', preset.colorMode === 'gradient' ? `Gradiente ${preset.color} para ${preset.colorEnd}` : `Cor ${preset.color}`);
    preview.style.background = preset.colorMode === 'gradient' ? `linear-gradient(${preset.gradientAngle}deg, ${preset.color} 40%, ${preset.colorEnd} 60%)` : preset.color;
    const heading = document.createElement('span');
    heading.className = 'preset-heading';
    heading.append(preview, name);
    apply.append(heading);
    const badges = presetBadges(preset);
    const metadata = document.createElement('span');
    metadata.className = 'preset-badges';
    badges.forEach(({ icon, value, label, className = '' }) => {
      const badge = document.createElement('span');
      badge.className = `preset-badge ${className}`;
      badge.title = label;
      badge.setAttribute('aria-label', label);
      const symbol = document.createElement('span');
      symbol.className = 'badge-icon';
      symbol.setAttribute('aria-hidden', 'true');
      symbol.textContent = icon;
      badge.append(symbol);
      if (value) {
        const number = document.createElement('span');
        number.textContent = value;
        badge.append(number);
      }
      metadata.append(badge);
    });
    apply.append(metadata);
    if (preset.metadata?.savedAt) {
      const time = document.createElement('time');
      time.className = 'preset-date';
      time.dateTime = preset.metadata.savedAt;
      const formatted = new Date(preset.metadata.savedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
      time.textContent = `◷ ${formatted}`;
      time.title = `Salva em ${formatted}`;
      apply.append(time);
    }
    if (presetView === 'visual') {
      const overlay = document.createElement('span');
      overlay.className = 'preset-overlay';
      overlay.append(...Array.from(apply.children));
      apply.replaceChildren();
      apply.append(presetScene(preset), overlay);
    }
    apply.setAttribute('aria-label', `Aplicar ${preset.name}. ${badges.map((badge) => badge.label).join('. ')}. ${preset.colorMode === 'gradient' ? `Gradiente ${preset.color} para ${preset.colorEnd}` : `Cor ${preset.color}`}`);
    apply.title = `${preset.name} · ${badges.map((badge) => badge.label).join(' · ')}`;
    apply.addEventListener('click', async () => {
      await update({ mode: preset.mode, color: preset.color, intensity: preset.intensity, shape: preset.shape, customSvg: preset.customSvg, ...gradientSettings(preset), ...sizeSettings(preset), cameraEnabled: preset.cameraEnabled === true }, true);
      if (!preset.cameraEnabled) stopCamera();
    });
    const remove = document.createElement('button');
    remove.className = 'delete-preset';
    remove.textContent = '✕';
    remove.setAttribute('aria-label', `Excluir ${preset.name}`);
    remove.addEventListener('click', () => {
      presets = presets.filter((p) => p.id !== preset.id);
      status('Predefinição excluída.');
      persist();
      renderPresets();
      $('preset-name').focus();
    });
    item.append(apply, remove);
    $('presets').append(item);
  });
}
$('preset-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const name = $('preset-name').value.trim() || randomPresetName();
  presets.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, name, ...settings, cameraEnabled: settings.cameraEnabled, metadata: { savedAt: new Date().toISOString() } });
  $('preset-name').value = '';
  status('Predefinição adicionada.');
  persist();
  renderPresets();
});
window.addEventListener('pagehide', () => stopCamera(false));
window.addEventListener('pageshow', (event) => {
  if (event.persisted && settings.cameraEnabled && settings.mode !== 'full') startCamera();
});
render();
renderPresets();
if (settings.cameraEnabled && settings.mode !== 'full') startCamera();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => status('O modo offline não pôde ser ativado. A iluminação continua disponível.'));

document.addEventListener('keydown', (event) => {
  if (event.defaultPrevented || event.isComposing || event.ctrlKey || event.metaKey || event.altKey || event.target?.isContentEditable || event.target?.closest?.('input, textarea, select, [contenteditable], [role="textbox"]')) return;
  const key = event.key.toLowerCase();
  const actions = {
    f: toggleFullscreen,
    p: () => setPanel(window.ringlightPanel ? !window.ringlightPanel.isVisible() : $('panel-body').hidden),
    c: toggleCamera,
    g: () => $(settings.colorMode === 'gradient' ? 'solid-color' : 'gradient-color').click(),
    '1': () => update({ mode: 'ring' }),
    '2': () => update({ mode: 'full' }),
    '3': () => update({ mode: 'sides' }),
    '+': () => update({ intensity: Math.min(100, settings.intensity + 5) }),
    '=': () => update({ intensity: Math.min(100, settings.intensity + 5) }),
    '-': () => update({ intensity: Math.max(0, settings.intensity - 5) })
  };
  if (!Object.hasOwn(actions, key)) return;
  event.preventDefault();
  if (event.repeat && !['+', '=', '-'].includes(key)) return;
  actions[key]();
});

const resetValues = {
  'intensity-label': () => ({ intensity: defaults.intensity }),
  'light-width-label': () => settings.mode === 'sides' ? { sideWidth: defaults.sideWidth } : { ringThickness: defaults.ringThickness },
  'gradient-angle-label': () => ({ gradientAngle: defaults.gradientAngle }),
  'color-label': () => ({ color: defaults.color }),
  'color-end-label': () => ({ colorEnd: defaults.colorEnd })
};
const editableValues = {
  'intensity-label': () => ({ field: 'intensity', label: 'Intensidade', min: 0, max: 100, unit: '%' }),
  'light-width-label': () => settings.mode === 'sides'
    ? { field: 'sideWidth', label: 'Largura das laterais', min: 5, max: 40, unit: '%' }
    : { field: 'ringThickness', label: 'Espessura do anel', min: 5, max: 70, unit: '%' },
  'gradient-angle-label': () => ({ field: 'gradientAngle', label: 'Direção do gradiente', min: 0, max: 360, unit: '°' }),
  'color-label': () => ({ field: 'color', label: 'Primeira cor', color: true }),
  'color-end-label': () => ({ field: 'colorEnd', label: 'Segunda cor', color: true })
};
for (const [id, descriptor] of Object.entries(editableValues)) {
  const container = $(id);
  const editor = document.createElement('input');
  const info = descriptor();
  editor.type = 'text';
  editor.className = `value-editor${info.color ? ' hex-editor' : ''}`;
  editor.inputMode = info.color ? 'text' : 'numeric';
  editor.autocomplete = 'off';
  editor.spellcheck = false;
  editor.maxLength = info.color ? 7 : 4;
  editor.title = 'Clique para editar; duplo clique restaura o padrão';
  editor.setAttribute('aria-label', info.label);
  valueEditors[id] = editor;
  container.replaceChildren();
  container.append(editor);
  if (!info.color) {
    const unit = document.createElement('span');
    unit.className = 'value-unit';
    unit.textContent = info.unit;
    unit.setAttribute('aria-hidden', 'true');
    container.append(unit);
  }
  const restoreDisplay = () => {
    const current = descriptor();
    editor.value = current.color ? settings[current.field].toUpperCase() : String(settings[current.field]);
    editor.setAttribute('aria-label', current.label);
    editor.setAttribute('aria-invalid', 'false');
  };
  const commit = () => {
    const current = descriptor();
    const text = editor.value.trim();
    let parsed;
    if (current.color) {
      parsed = (text.startsWith('#') ? text : `#${text}`).toLowerCase();
      if (!/^#[0-9a-f]{6}$/.test(parsed)) {
        restoreDisplay();
        status('Use uma cor com seis dígitos, como #FFFFFF.');
        return false;
      }
    } else {
      const number = text.replace(/[%°]$/, '').trim();
      parsed = Number(number);
      if (!/^\d+$/.test(number) || parsed < current.min || parsed > current.max) {
        restoreDisplay();
        status(`${current.label}: digite um valor entre ${current.min} e ${current.max}.`);
        return false;
      }
    }
    update({ [current.field]: parsed }, Boolean(current.color));
    restoreDisplay();
    return true;
  };
  editor.addEventListener('focus', () => editor.select());
  editor.addEventListener('blur', commit);
  editor.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (commit()) editor.blur();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      restoreDisplay();
      editor.blur();
    }
  });
  const reset = () => { update(resetValues[id]()); restoreDisplay(); };
  container.addEventListener('dblclick', reset);
  restoreDisplay();
}

const resetLabels = {
  'intensity-title': { changes: resetValues['intensity-label'], hint: '100%' },
  'light-width-title': { changes: resetValues['light-width-label'], hint: '29%' },
  'gradient-angle-title': { changes: resetValues['gradient-angle-label'], hint: '90°' },
  'color-title': { changes: resetValues['color-label'], hint: 'branco' },
  'color-end-title': { changes: resetValues['color-end-label'], hint: 'azul-ciano' },
  'shape-title': { changes: () => ({ shape: defaults.shape }), hint: 'círculo' }
};
for (const [id, { changes, hint }] of Object.entries(resetLabels)) {
  const label = $(id);
  if (id !== 'light-width-title') label.title = `Clique para restaurar o padrão (${hint})`;
  label.classList.add('reset-label');
  label.tabIndex = 0;
  label.setAttribute('role', 'button');
  const reset = (event) => {
    event.preventDefault();
    update(changes());
  };
  label.addEventListener('click', reset);
  label.addEventListener('keydown', (event) => {
    if ((event.key === 'Enter' || event.key === ' ') && !event.repeat) reset(event);
  });
}
