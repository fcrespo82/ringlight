'use strict';
const SHAPES = {
  square: '<rect width="1000" height="1000" rx="150"/>',
  diamond: '<polygon points="500,0 1000,500 500,1000 0,500"/>',
  triangle: '<polygon points="500,66.987298 1000,933.012702 0,933.012702"/>',
  hexagon: '<polygon points="250,66.987298 750,66.987298 1000,500 750,933.012702 250,933.012702 0,500"/>',
  octagon: '<polygon points="293,0 707,0 1000,293 1000,707 707,1000 293,1000 0,707 0,293"/>',
  flower: `<path d="${Array.from({ length: 7 }, (_, i) => {
    const angle = (i * 60 - 30) * Math.PI / 180;
    const radius = 300 * Math.cos(Math.PI / 6) + Math.sqrt(200 ** 2 - 150 ** 2);
    const point = `${(500 + radius * Math.cos(angle)).toFixed(3)} ${(500 + radius * Math.sin(angle)).toFixed(3)}`;
    return `${i === 0 ? 'M' : 'A200 200 0 0 1'}${point}`;
  }).join(' ')}Z"/>`,
  circle: '<circle cx="500" cy="500" r="500"/>',
  heart: '<path d="M500 1000 C420 920 0 630 0 350 C0 150 100 0 250 0 C360 0 450 80 500 180 C550 80 640 0 750 0 C900 0 1000 150 1000 350 C1000 630 580 920 500 1000Z"/>',
  star: `<polygon points="${Array.from({ length: 10 }, (_, i) => {
    const angle = -Math.PI / 2 + i * Math.PI / 5;
    const outer = 500 / Math.cos(Math.PI / 10);
    const radius = i % 2 ? outer * (3 - Math.sqrt(5)) / 2 : outer;
    return `${(500 + radius * Math.cos(angle)).toFixed(6)},${(outer + radius * Math.sin(angle)).toFixed(6)}`;
  }).join(' ')}"/>`
};
// Randomize mode and visual settings without changing camera preference.
function randomLightSettings(settings, random = Math.random) {
  const pick = (values) => values[Math.floor(random() * values.length)];
  const integer = (min, max) => min + Math.floor(random() * (max - min + 1));
  const colors = ['#ffffff', '#fff4e5', '#ffe0ac', '#d2e8ff', '#ff007f', '#00cfff', '#c8bcff', '#ffc078', '#76ffb0'];
  const mode = pick(['ring', 'full', 'sides'].filter(value => value !== settings.mode));
  const color = pick(colors);
  const changes = { mode, ringThickness: integer(10, 45), sideWidth: integer(10, 30), color, colorEnd: pick(colors.filter(value => value !== color)), colorMode: random() < .5 ? 'solid' : 'gradient', gradientAngle: integer(0, 360), intensity: integer(40, 100) };
  if (mode === 'ring') Object.assign(changes, { shape: pick(Object.keys(SHAPES).filter(value => value !== settings.shape)), customSvg: '' });
  return changes;
}
// Rebuild imported SVGs from geometry only; never insert uploaded markup into the page.
function sanitizeShapeSvg(text) {
  if (typeof text !== 'string' || text.length > 200000 || /<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error('SVG inválido ou maior que 200 KB.');
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const root = doc.documentElement;
  if (root.localName !== 'svg' || doc.querySelector('parsererror')) throw new Error('Arquivo SVG inválido.');
  const box = root.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number);
  if (!box || box.length !== 4 || !box.every(Number.isFinite) || box[2] <= 0 || box[3] <= 0) throw new Error('O SVG precisa de um viewBox válido.');
  const attributes = {
    g: ['transform'], path: ['d', 'transform', 'fill-rule'],
    polygon: ['points', 'transform', 'fill-rule'],
    rect: ['x', 'y', 'width', 'height', 'rx', 'ry', 'transform'],
    circle: ['cx', 'cy', 'r', 'transform'], ellipse: ['cx', 'cy', 'rx', 'ry', 'transform']
  };
  let geometryCount = 0;
  const escape = (value) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  function geometry(node) {
    if (['title', 'desc', 'metadata'].includes(node.localName)) return '';
    const allowed = attributes[node.localName];
    if (!allowed || node.namespaceURI !== 'http://www.w3.org/2000/svg') throw new Error('Use um SVG simples com formas preenchidas, sem imagens, textos, estilos ou scripts.');
    if (node.localName !== 'g') geometryCount++;
    if (geometryCount > 500) throw new Error('O SVG tem formas demais (máximo 500).');
    const props = allowed.filter((name) => node.hasAttribute(name)).map((name) => {
      const value = node.getAttribute(name);
      if (/url\s*\(|[<>]/i.test(value)) throw new Error('SVG com referência inválida.');
      return ` ${name}="${escape(value)}"`;
    }).join('');
    return `<${node.localName}${props}>${Array.from(node.children).map(geometry).join('')}</${node.localName}>`;
  }
  const body = Array.from(root.children).map(geometry).join('');
  if (!geometryCount) throw new Error('O SVG não contém formas preenchidas.');
  const scale = 1000 / Math.max(box[2], box[3]);
  const x = (1000 - box[2] * scale) / 2;
  const y = (1000 - box[3] * scale) / 2;
  const normalized = box[0] === 0 && box[1] === 0 && box[2] === 1000 && box[3] === 1000 ? body : `<g transform="translate(${x} ${y}) scale(${scale}) translate(${-box[0]} ${-box[1]})">${body}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">${normalized}</svg>`;
}
function shapeSettings(value) {
  if (value?.shape === 'custom') {
    try { return { shape: 'custom', customSvg: sanitizeShapeSvg(value.customSvg) }; }
    catch { return { shape: 'circle', customSvg: '' }; }
  }
  return { shape: Object.hasOwn(SHAPES, value?.shape) ? value.shape : 'circle', customSvg: '' };
}
function shapeMasks(shape, customSvg, thickness = 29) {
  const body = shape === 'custom' ? customSvg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '') : SHAPES[shape] || SHAPES.circle;
  const bounds = { triangle: [66.987298, 866.025404], hexagon: [66.987298, 866.025404], flower: [40.192379, 919.615242], star: [0, 951.056516] }[shape] || [0, 1000];
  const aspect = bounds[1] / 1000;
  const svg = (content) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 ${bounds[0]} 1000 ${bounds[1]}">${content}</svg>`;
  const uri = (content) => `url("data:image/svg+xml,${encodeURIComponent(svg(content))}")`;
  const ratio = 1 - thickness / 100;
  const offset = (1000 - 1000 * ratio) / 2;
  // An inset stroke follows the boundary at a constant distance, including curves.
  // Scale distance by the available inner radius so 70% still leaves an opening.
  const insetRadius = { triangle: 288.675134, hexagon: 433.012702, flower: 392.095969, heart: 250, star: 200.811416 }[shape];
  if (insetRadius) {
    const distance = insetRadius * thickness / 100;
    const inner = `<defs><mask id="inner" maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="1000"><g fill="white" stroke="black" stroke-width="${2 * distance}" stroke-linejoin="round" stroke-linecap="round">${body}</g></mask></defs>`;
    const opening = `<rect width="1000" height="1000" mask="url(#inner)"/>`;
    return {
      ring: uri(`${inner}<defs><mask id="ring" maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="1000"><g fill="white">${body}</g><g fill="black">${opening}</g></mask></defs><rect width="1000" height="1000" fill="white" mask="url(#ring)"/>`),
      center: uri(`${inner}<g fill="white">${opening}</g>`),
      aspect, fullCenter: true
    };
  }
  return {
    ring: uri(`<defs><mask id="ring" maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="1000"><g fill="white">${body}</g><g fill="black" transform="translate(${offset} ${offset}) scale(${ratio})">${body}</g></mask></defs><rect width="1000" height="1000" fill="white" mask="url(#ring)"/>`),
    center: uri(`<g fill="white">${body}</g>`),
    aspect, fullCenter: false
  };
}
