import { readFileSync } from 'node:fs'
import { expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'

it('original native sections collapse independently without replacing controls',async()=>{
  const html=readFileSync('../../index.html','utf8');
  const parsed=new DOMParser().parseFromString(html,'text/html');
  const panel=document.importNode(parsed.querySelector('#panel')!,true);document.body.append(panel);
  try{
    const user=userEvent.setup();const sections=panel.querySelectorAll<HTMLDetailsElement>('.panel-section');
    expect(sections.length).toBe(2);expect([...sections].every(s=>s.open)).toBe(true);
    expect(sections[0].querySelector('#intensity')).not.toBeNull();expect(sections[0].querySelector('#toggle-camera')).not.toBeNull();
    expect(sections[1].querySelector('#preset-form')).not.toBeNull();expect(panel.querySelector('.shortcuts')!.closest('.panel-section')).toBeNull();
    const name=panel.querySelector<HTMLInputElement>('#preset-name')!;await user.type(name,'Rascunho');
    await user.click(sections[0].querySelector('summary')!);expect(sections[0].open).toBe(false);expect(sections[1].open).toBe(true);
    await user.click(sections[1].querySelector('summary')!);expect(sections[1].open).toBe(false);
    await user.click(sections[1].querySelector('summary')!);expect(panel.querySelector('#preset-name')).toBe(name);expect(name.value).toBe('Rascunho');
  }finally{panel.remove()}
});

it('original sections animate closing before hiding content and animate reopening',async()=>{
  const html=readFileSync('../../index.html','utf8');
  const parsed=new DOMParser().parseFromString(html,'text/html');
  const panel=document.importNode(parsed.querySelector('#panel')!,true);document.body.append(panel);
  const section=panel.querySelector<HTMLDetailsElement>('.panel-section')!,summary=section.querySelector('summary')!;
  let finish!:()=>void;
  const cancel=vi.fn();
  const animate=vi.fn(()=>({finished:new Promise<void>(resolve=>{finish=resolve}),cancel}));
  Object.defineProperty(section,'animate',{value:animate,configurable:true});
  try{
    new Function('window','document',readFileSync('../../ui.js','utf8'))(window,document);
    summary.click();expect(animate).toHaveBeenCalledTimes(1);expect(section.open).toBe(true);expect(summary.getAttribute('aria-expanded')).toBe('false');
    finish();await Promise.resolve();expect(section.open).toBe(false);
    summary.click();expect(animate).toHaveBeenCalledTimes(2);expect(summary.getAttribute('aria-expanded')).toBe('true');finish();await Promise.resolve();expect(section.open).toBe(true);
  }finally{panel.remove()}
});
