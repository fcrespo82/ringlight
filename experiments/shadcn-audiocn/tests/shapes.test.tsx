import { expect, it } from 'vitest'
import { SHAPES, shapeMasks, randomLightSettings } from '../src/lib/shapes.js'

it('triangle and hexagon preserve regular proportions and use their natural bounds',()=>{
  for(const shape of ['triangle','hexagon']){
    const points=SHAPES[shape].match(/points="([^"]+)"/)![1].split(' ').map(p=>p.split(',').map(Number));
    const lengths=points.map((p,i)=>Math.hypot(p[0]-points[(i+1)%points.length][0],p[1]-points[(i+1)%points.length][1]));
    expect(Math.max(...lengths)-Math.min(...lengths)).toBeLessThan(0.00001);
    expect(shapeMasks(shape,'',29).aspect).toBeCloseTo(Math.sqrt(3)/2,6);
  }
});
it('adjusted shapes use the same constant-distance inset for light and camera at all thicknesses',()=>{
  const decode=(uri:string)=>decodeURIComponent(uri.slice(uri.indexOf(',')+1,-2));
  for(const shape of ['triangle','hexagon','flower','heart','star'])for(const thickness of [5,29,70]){
    const masks=shapeMasks(shape,'',thickness),ring=decode(masks.ring),center=decode(masks.center);
    const xml=new DOMParser().parseFromString(ring,'image/svg+xml');expect(xml.querySelector('parsererror')).toBeNull();
    const stroke=Number(xml.querySelector('mask#inner g')!.getAttribute('stroke-width'));expect(stroke).toBeGreaterThan(0);
    expect(center).toContain(`stroke-width="${stroke}"`);
    expect(masks.fullCenter).toBe(true);
    const cameraXml=new DOMParser().parseFromString(center,'image/svg+xml');
    expect(cameraXml.documentElement.getAttribute('viewBox')).toBe(xml.documentElement.getAttribute('viewBox'));
    expect(cameraXml.querySelector('svg > g')!.hasAttribute('transform')).toBe(false);
    expect(cameraXml.querySelector('#inner')!.outerHTML).toBe(xml.querySelector('#inner')!.outerHTML);
  }
});

it('star is symmetric with five equal outer radii and uses matching camera bounds',()=>{
  const points=SHAPES.star.match(/points="([^"]+)"/)![1].split(' ').map(p=>p.split(',').map(Number));
  const outer=500/Math.cos(Math.PI/10);
  for(let i=0;i<10;i++)expect(Math.hypot(points[i][0]-500,points[i][1]-outer)).toBeCloseTo(i%2?outer*(3-Math.sqrt(5))/2:outer,5);
  expect(shapeMasks('star','',29).fullCenter).toBe(true);
});

it('random selects every mode and every built-in ring shape without changing camera',()=>{
  const sample={mode:'ring',shape:'circle',cameraEnabled:true};
  expect(randomLightSettings(sample,()=>0).mode).toBe('full');
  expect(randomLightSettings(sample,()=>0.999).mode).toBe('sides');
  const seen=new Set();
  for(let i=0;i<Object.keys(SHAPES).length;i++){
    const values=[0,0,0,0,0,0,0,0,(i+.1)/Object.keys(SHAPES).length];let n=0;
    const next=randomLightSettings({...sample,mode:'full',shape:'custom'},()=>values[n++]??0);
    expect(next.mode).toBe('ring');expect(next).not.toHaveProperty('cameraEnabled');seen.add(next.shape);
  }
  expect(seen.size).toBe(Object.keys(SHAPES).length);
});
