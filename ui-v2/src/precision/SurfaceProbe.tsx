import { useEffect } from 'react';

// Opt-in CEF harness observations. Only fixed control identifiers and geometry
// and native HUD layout geometry are emitted: never account names, server
// addresses, tokens or arbitrary field values.
const controls:Record<string,string> = {
  'account-trigger':'.account-trigger',
  'account-select':'.account-option:not(:disabled)',
  'account-manage':'[data-opus-account-manage]',
  'home-singleplayer':'[data-opus-home-action="singleplayer"]',
  'home-multiplayer':'[data-opus-home-action="multiplayer"]',
  'home-options':'[data-opus-home-action="minecraft-settings"]',
  'home-modules':'[data-opus-home-action="client-settings"]',
  'client-close':'[aria-label="Close client settings"]',
  'client-hud':'.client-hud-link,.client-header-hud',
  'module-fps':'[data-opus-module-id="fps"]',
  'module-armor':'[data-opus-module-id="armor-status"]',
  'toggle-fps':'[role="switch"][aria-label="Enable FPS"]',
  'toggle-armor':'[role="switch"][aria-label="Enable Armor Status"]',
  'fps-scale':'#fps-range-scale',
  'fps-order':'[role="switch"][aria-label="Reverse Order"]',
  'armor-scale':'input[type="number"][aria-label="Scale"]',
  'armor-durability':'[role="switch"][aria-label="Durability"]',
  'connection-action':'[data-opus-connection-action]',
  'pause-topbar':'.precision-workspace .topbar',
  'pause-heading':'#pause-title',
  'pause-resume':'.pause-grid .resume',
  'pause-hud':'.pause-module-link button:last-child',
  'pause-disconnect':'[data-opus-pause-action="disconnect"]',
  'hud-widgets':'.hud-tool-group>button:first-child',
  'hud-select-fps':'.editor-module-select[data-opus-widget="fps"]',
  'hud-x':'[aria-label="Widget X position"]',
  'hud-scale':'[aria-label="Widget scale"]',
  'hud-undo':'.editor-undo',
};

export function SurfaceProbe({route,revision}:{route:string;revision:number}) {
  useEffect(()=>{
    if(new URLSearchParams(location.search).get('opusMediaProbe')!=='1')return;
    let queued=0,last='';
    const emit=()=>{
      queued=0;
      const items:Record<string,{rect:number[];enabled:boolean}>={};
      const editor=document.querySelector<HTMLElement>('.native-hud-overlay');
      const hud=editor?.dataset.widgetX===undefined?null:{x:Number(editor.dataset.widgetX),y:Number(editor.dataset.widgetY),scale:Number(editor.dataset.widgetScale)};
      let focused='';
      for(const [id,selector] of Object.entries(controls)) {
        const element=Array.from(document.querySelectorAll<HTMLElement>(selector)).find(item=>item.getClientRects().length>0);
        if(!element||element.getClientRects().length===0)continue;
        const bounds=element.getBoundingClientRect();
        items[id]={rect:[bounds.x,bounds.y,bounds.width,bounds.height],enabled:!element.matches(':disabled')};
        if(element===document.activeElement)focused=id;
      }
      const data=JSON.stringify({route,revision,viewport:[innerWidth,innerHeight],focused,hud,items});
      if(data!==last){
        last=data;
        const common={route,revision,viewport:[innerWidth,innerHeight],focused,hud};
        // Native helper logs are bounded to 512 bytes per line.
        console.info(`OPUS_CONTROL_GEOMETRY ${JSON.stringify({...common,reset:true,items:{}})}`);
        for(const [id,item] of Object.entries(items))console.info(`OPUS_CONTROL_GEOMETRY ${JSON.stringify({...common,items:{[id]:item}})}`);
      }
    };
    const schedule=()=>{if(!queued)queued=requestAnimationFrame(emit);};
    const observer=new MutationObserver(schedule);
    observer.observe(document.getElementById('root')!,{childList:true,subtree:true,attributes:true});
    document.addEventListener('focusin',schedule);window.addEventListener('resize',schedule);document.addEventListener('scroll',schedule,true);
    schedule();
    return()=>{cancelAnimationFrame(queued);observer.disconnect();document.removeEventListener('focusin',schedule);window.removeEventListener('resize',schedule);document.removeEventListener('scroll',schedule,true);};
  },[route,revision]);
  return null;
}
