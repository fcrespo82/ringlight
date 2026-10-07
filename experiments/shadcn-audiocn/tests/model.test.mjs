import { test } from 'node:test'
import assert from 'node:assert/strict'
import { defaults, normalizeSettings, normalizeSaved, rememberColor, lightBackground, createPreset, palette } from '../src/lib/model.mjs'
test('mode changes preserve camera and independent widths',()=>{
 const s=normalizeSettings({...defaults,cameraEnabled:true,ringThickness:50,sideWidth:35})
 for(const mode of ['full','sides','ring']) { const next=normalizeSettings({...s,mode});assert.equal(next.cameraEnabled,true);assert.equal(next.ringThickness,50);assert.equal(next.sideWidth,35) }
})
test('color histories are independent and limited',()=>{
 let h={color:[],colorEnd:[]};for(let i=0;i<10;i++)h=rememberColor(h,'color',`#00000${i}`)
 assert.equal(h.color.length,8);assert.deepEqual(h.colorEnd,[]);assert.equal(palette(h.colorEnd)[0],'#ffffff')
})
test('preset snapshots and generated names survive normalization',()=>{
 const s=normalizeSettings({...defaults,mode:'sides',colorMode:'gradient',intensity:55,cameraEnabled:true})
 const p=createPreset(s,'',[]);assert.ok(p.name);assert.ok(p.metadata.savedAt)
 const restored=normalizeSaved({settings:s,presets:[p]});assert.equal(restored.presetView,'visual');assert.equal(restored.presets[0].cameraEnabled,true);assert.equal(restored.settings.intensity,55)
})
test('invalid saved values fall back and gradient intensity dims both colors',()=>{
 assert.equal(normalizeSettings({intensity:999}).intensity,100)
 assert.equal(lightBackground({...defaults,color:'#ff0000',colorEnd:'#0000ff',colorMode:'gradient',intensity:50}), 'linear-gradient(90deg, rgb(128,0,0) 40%, rgb(0,0,128) 60%)')
})
