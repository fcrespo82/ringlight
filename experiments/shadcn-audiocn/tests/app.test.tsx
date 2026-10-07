import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../src/App'
import { STORAGE_KEY } from '../src/lib/model.mjs'
import { sanitizeShapeSvg } from '../src/lib/shapes.js'
beforeEach(()=>localStorage.clear())
describe('interface shadcn + audiocn',()=>{
  it('uses actual library components and saves unnamed visual presets',async()=>{
    const user=userEvent.setup(), {container}=render(<App/>);
    expect(container.querySelector('[data-slot="knob-dial"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="slider"]')).toBeNull();
    await user.click(screen.getByRole('button',{name:'Salvar'}));
    const state=JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(state.presets[0].name).toBeTruthy();expect(state.presetView).toBe('visual');
    expect(container.querySelector('.light-stage.mini')).not.toBeNull();
  });
  it('types numeric values, resets defaults and retains values when switching mode',async()=>{
    const user=userEvent.setup();render(<App/>);
    const intensity=screen.getByRole('textbox',{name:'Intensidade'});
    await user.clear(intensity);await user.type(intensity,'45{Enter}');
    await waitFor(()=>expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).settings.intensity).toBe(45));
    await user.click(screen.getByText('Luz inteira'));await user.click(screen.getByText('Laterais'));
    expect((screen.getByRole('textbox',{name:'Intensidade'}) as HTMLInputElement).value).toBe('45');
    await user.click(screen.getByRole('button',{name:'Intensidade'}));
    await waitFor(()=>expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).settings.intensity).toBe(100));
  });
  it('separates the recent color histories',async()=>{
    const user=userEvent.setup();render(<App/>);await user.click(screen.getByText('Gradiente'));
    const second=screen.getByRole('textbox',{name:'Código da segunda cor'});
    await user.clear(second);await user.type(second,'#112233{Enter}');
    await waitFor(()=>{const h=JSON.parse(localStorage.getItem(STORAGE_KEY)!).recentColors;expect(h.colorEnd).toEqual(['#112233']);expect(h.color).toEqual([])});
  });
  it('keeps camera stream active through full light and restores its preview',async()=>{
    const user=userEvent.setup(), stop=vi.fn(), request=vi.fn().mockResolvedValue({getTracks:()=>[{stop}],getVideoTracks:()=>[{addEventListener:vi.fn()}]});
    Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:request}});
    vi.spyOn(HTMLMediaElement.prototype,'play').mockResolvedValue();
    const {container}=render(<App/>);await user.click(screen.getByRole('switch',{name:/Câmera/}));
    await waitFor(()=>expect(container.querySelector('video')!.className).not.toContain('invisible'));
    await user.click(screen.getByRole('button',{name:'Configurações'}));expect(stop).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button',{name:'Configurações'}));
    await user.click(screen.getByText('Luz inteira'));await user.click(screen.getByText('Laterais'));
    expect(request).toHaveBeenCalledTimes(1);expect(stop).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).settings.cameraEnabled).toBe(true);
  });
  it('collapses the same panel while keeping its header available',async()=>{
    const user=userEvent.setup(),{container}=render(<App/>);const panel=container.querySelector('.lab-window');
    await user.click(screen.getByRole('button',{name:'Minimizar painel'}));
    expect(container.querySelector('.lab-window')).toBe(panel);expect(panel!.className).toContain('collapsed');
    await user.click(screen.getByRole('button',{name:'Expandir painel'}));expect(panel!.className).not.toContain('collapsed');
  });
  it('collapses sections independently and preserves drafts and section state through minimization',async()=>{
    const user=userEvent.setup();render(<App/>);
    const config=screen.getByRole('button',{name:'Configurações'}),presets=screen.getByRole('button',{name:'Predefinições'});
    const name=screen.getByRole('textbox',{name:'Nome da predefinição (opcional)'});
    await user.type(name,'Em edição');
    await user.click(presets);expect(presets.getAttribute('aria-expanded')).toBe('false');expect(config.getAttribute('aria-expanded')).toBe('true');
    await user.click(config);expect(config.getAttribute('aria-expanded')).toBe('false');
    await user.click(screen.getByRole('button',{name:'Minimizar painel'}));await user.click(screen.getByRole('button',{name:'Expandir painel'}));
    expect(config.getAttribute('aria-expanded')).toBe('false');expect(presets.getAttribute('aria-expanded')).toBe('false');
    await user.click(presets);expect(screen.getByRole('textbox',{name:'Nome da predefinição (opcional)'})).toBe(name);expect((name as HTMLInputElement).value).toBe('Em edição');
    await user.click(screen.getByRole('button',{name:'Salvar'}));
    await user.click(screen.getByRole('button',{name:/Aplicar Em edição/}));
    expect(config.getAttribute('aria-expanded')).toBe('false');
    await user.click(config);expect(screen.getByRole('textbox',{name:'Intensidade'})).toBeTruthy();
  });
  it('slides section height on both close and open while retaining its controls',async()=>{
    const user=userEvent.setup(),{container}=render(<App/>);
    const content=container.querySelector<HTMLDivElement>('.group-content')!;
    const control=screen.getByRole('textbox',{name:'Intensidade'});
    let finish!:()=>void;const cancel=vi.fn();
    const animate=vi.fn(()=>({finished:new Promise<void>(resolve=>{finish=resolve}),cancel}));
    Object.defineProperty(content,'animate',{value:animate});
    vi.spyOn(content,'getBoundingClientRect').mockReturnValue({height:120} as DOMRect);
    Object.defineProperty(content.firstElementChild,'scrollHeight',{value:120});
    await user.click(screen.getByRole('button',{name:'Configurações'}));
    expect(animate.mock.calls[0][0]).toEqual([{height:'120px'},{height:'0px'}]);
    expect(content.contains(control)).toBe(true);finish();await Promise.resolve();
    expect(content.style.height).toBe('0px');
    vi.spyOn(content,'getBoundingClientRect').mockReturnValue({height:0} as DOMRect);
    await user.click(screen.getByRole('button',{name:'Configurações'}));
    expect(animate.mock.calls[1][0]).toEqual([{height:'0px'},{height:'120px'}]);
    finish();await Promise.resolve();expect(content.style.height).toBe('auto');
  });
  it('randomizes mode while collapsed without creating a preset',async()=>{
    const user=userEvent.setup();render(<App/>);vi.spyOn(Math,'random').mockReturnValue(0);
    await user.click(screen.getByText('Laterais'));
    const config=screen.getByRole('button',{name:'Configurações'});await user.click(config);
    await user.click(screen.getByRole('button',{name:'Sortear configurações'}));
    const state=JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(config.getAttribute('aria-expanded')).toBe('false');expect(state.settings.mode).toBe('ring');expect(state.settings.shape).toBe('square');
    expect(state.settings.intensity).toBe(40);expect(state.settings.sideWidth).toBe(10);
    expect(state.settings.color).not.toBe(state.settings.colorEnd);expect(state.presets).toEqual([]);
    expect(state.recentColors.color).toEqual([state.settings.color]);expect(state.recentColors.colorEnd).toEqual([state.settings.colorEnd]);
  });
  it('sanitizes SVG geometry, strips event attributes and rejects active content',()=>{
    const safe=sanitizeShapeSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M0 0 L100 0 L50 100Z" onclick="alert(1)"/></svg>');
    expect(safe).toContain('path');expect(safe).not.toContain('onclick');
    expect(()=>sanitizeShapeSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><script>alert(1)</script></svg>')).toThrow();
  });
});
