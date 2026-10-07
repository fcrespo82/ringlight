process.env.DEBUG_PRINT_LIMIT='1200';
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
afterEach(()=>{cleanup();vi.restoreAllMocks()})
Object.defineProperty(window,'matchMedia',{writable:true,value:vi.fn(()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}))})
globalThis.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}}
HTMLElement.prototype.scrollIntoView=()=>{}
HTMLElement.prototype.hasPointerCapture=()=>false
HTMLElement.prototype.setPointerCapture=()=>{}
HTMLElement.prototype.releasePointerCapture=()=>{}
