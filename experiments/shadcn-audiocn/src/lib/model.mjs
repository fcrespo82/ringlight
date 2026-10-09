import { SHAPES, sanitizeShapeSvg } from './shapes.js'
export const STORAGE_KEY = 'ringlight.lab.v1'
export const defaults = { mode:'ring', shape:'circle', customSvg:'', color:'#ffffff', colorEnd:'#00cfff', colorMode:'solid', gradientAngle:90, intensity:100, ringThickness:29, sideWidth:20, cameraEnabled:false, cameraSize:32 }
export const suggested = [['#ffffff','Branco'],['#fff4e5','Neutro'],['#ffe0ac','Quente médio'],['#d2e8ff','Frio'],['#ff007f','Rosa'],['#00cfff','Ciano'],['#c8bcff','Lilás'],['#ffc078','Âmbar']]
const hex = (v) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)
const number = (v, min, max, fallback) => Number.isFinite(v) && v >= min && v <= max ? v : fallback
export function normalizeSettings(value = {}) {
  const v = value && typeof value === 'object' ? value : {}
  let shape = Object.hasOwn(SHAPES,v.shape) ? v.shape : 'circle', customSvg = ''
  if (v.shape === 'custom') { try { customSvg = sanitizeShapeSvg(v.customSvg); shape='custom' } catch {} }
  return { mode:['ring','full','sides'].includes(v.mode)?v.mode:'ring', shape, customSvg,
    color:hex(v.color)?v.color.toLowerCase():defaults.color, colorEnd:hex(v.colorEnd)?v.colorEnd.toLowerCase():defaults.colorEnd,
    colorMode:v.colorMode==='gradient'?'gradient':'solid', gradientAngle:number(v.gradientAngle,0,360,90), intensity:number(v.intensity,0,100,100),
    ringThickness:number(v.ringThickness,5,70,29),sideWidth:number(v.sideWidth,5,40,20),cameraEnabled:v.cameraEnabled===true,cameraSize:number(v.cameraSize,10,80,32) }
}
export function normalizeHistory(values) { return Array.isArray(values) ? [...new Set(values.filter(hex).map(v=>v.toLowerCase()))].slice(0,8) : [] }
export function normalizeSaved(value) {
  const v=value && typeof value==='object'?value:{}
  return {settings:normalizeSettings(v.settings),presets:Array.isArray(v.presets)?v.presets.filter(p=>p&&typeof p.id==='string'&&typeof p.name==='string'&&p.name.trim()).map(p=>({...normalizeSettings(p),id:p.id,name:p.name.slice(0,40),metadata:{savedAt:typeof p.metadata?.savedAt==='string'&&Number.isFinite(Date.parse(p.metadata.savedAt))?p.metadata.savedAt:null}})):[],recentColors:{color:normalizeHistory(v.recentColors?.color),colorEnd:normalizeHistory(v.recentColors?.colorEnd)},presetView:v.presetView==='summary'?'summary':'visual'}
}
export function rememberColor(history, field, color) { return {...history,[field]:normalizeHistory([color,...history[field]])} }
export function palette(history) { return [...new Set([...history,...suggested.map(([c])=>c)])].slice(0,8) }
export function lightBackground(s) {
  const dim = color => `rgb(${color.slice(1).match(/../g).map(h=>Math.round(parseInt(h,16)*s.intensity/100)).join(',')})`
  return s.colorMode==='gradient'?`linear-gradient(${s.gradientAngle}deg, ${dim(s.color)} 40%, ${dim(s.colorEnd)} 60%)`:dim(s.color)
}
export function createPreset(settings,name,existing=[]) {
  const names=['Aurora','Brisa','Prisma','Lua','Cometa','Sol'], tones=['Suave','Viva','Serena','Radiante']
  const pick=a=>a[Math.floor(Math.random()*a.length)]
  const base=`${pick(names)} ${pick(tones)} ${Math.random().toString(36).slice(2,6).toUpperCase()}`
  let generated=base, suffix=2
  while(existing.some(p=>p.name===generated)) generated=`${base} ${suffix++}`
  return {...settings,id:crypto.randomUUID(),name:name.trim().slice(0,40)||generated,metadata:{savedAt:new Date().toISOString()}}
}
