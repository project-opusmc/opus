import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { bridge } from '../bridge/bridge';
import type { GameOption } from '../bridge/types';
import { classifyMinecraftOption, filterMinecraftOptions, minecraftPages } from './settingsModel';
import { OPUS_LOGO } from './PrecisionFrame';
import { minecraftKeyCode } from './keyCapture';
import { NativeCollection } from './NativeCollection';

const navigation=['overview','display','audio','controls','chat','language','packs','skin','privacy'];
const video=['display','details','quality','performance','animations','shaders','other'];

function OptionControl({option,busy,onSave,conflicts}: {option:GameOption;busy:boolean;onSave:(option:GameOption,value?:number)=>Promise<void>;conflicts?:string[]}) {
  const [draft,setDraft]=useState(option.value),[capture,setCapture]=useState(false),[lock,setLock]=useState(false),editing=useRef(false),mouseCaptured=useRef(false);
  useEffect(()=>{if(!editing.current)setDraft(option.value);},[option.value]);
  const meta=classifyMinecraftOption(option),disabled=busy||option.available===false;
  const valueLabel=option.formatted??(option.type==='float'?`${Math.round(draft*100)}%`:option.value?'On':'Off');
  async function commit(){editing.current=false;await onSave(option,draft);}
  return <div className={`mc-setting${option.type==='float'?' mc-setting--range':''}${capture?' mc-setting--capturing':''}`}>
    <label className="mc-setting-label" htmlFor={`mc-${option.key}`}>{meta.label}{conflicts?.length?<small className="mc-key-conflict">Also: {conflicts.join(', ')}</small>:null}</label>
    {option.key.startsWith('KEY:')?<div className="mc-key-control"><button id={`mc-${option.key}`} className="mc-native-cycle" type="button" aria-label={`Bind ${meta.label}`} disabled={disabled} onClick={()=>{if(mouseCaptured.current){mouseCaptured.current=false;return;}setCapture(true);}} onKeyDown={e=>{
      if(!capture)return;e.preventDefault();e.stopPropagation();
      if(e.key==='Escape'){setCapture(false);return;}
      const code=minecraftKeyCode(e);if(code!==null){setCapture(false);void onSave(option,code);}
    }} onMouseDown={e=>{if(!capture)return;e.preventDefault();e.stopPropagation();mouseCaptured.current=true;setCapture(false);void onSave(option,-100+(e.button===1?2:e.button===2?1:0));}} onContextMenu={e=>e.preventDefault()} onBlur={()=>setCapture(false)}>{capture?'Press a key…':valueLabel}</button><button className="text-button" type="button" disabled={disabled||option.value===0} aria-label={`Unbind ${meta.label}`} onClick={()=>void onSave(option,0)}>×</button></div>
    :option.key==='WORLD:LOCK'?<div className="mc-key-control">{lock?<><span>Lock permanently?</span><button className="text-button" type="button" disabled={disabled} onClick={()=>{setLock(false);void onSave(option);}}>Lock</button><button className="text-button" type="button" onClick={()=>setLock(false)}>Cancel</button></>:<button className="mc-native-cycle" type="button" disabled={disabled} onClick={()=>setLock(true)}>{valueLabel}</button>}</div>
    :option.type==='float'?<><input id={`mc-${option.key}`} type="range" aria-label={meta.label} min={option.min} max={option.max} step={option.step} value={draft} disabled={disabled} style={{'--range-fill':`${draft*100}%`} as CSSProperties} onPointerDown={()=>{editing.current=true;}} onChange={e=>setDraft(Number(e.target.value))} onPointerUp={()=>void commit()} onPointerCancel={()=>{editing.current=false;setDraft(option.value);}} onKeyUp={e=>{if(['ArrowLeft','ArrowRight','Home','End','PageUp','PageDown'].includes(e.key))void commit();}} onBlur={()=>{if(draft!==option.value)void commit();}}/><output htmlFor={`mc-${option.key}`}>{editing.current?`${Math.round(draft*100)}%`:valueLabel}</output></>
    :option.type==='boolean'?<button id={`mc-${option.key}`} className="switch" type="button" role="switch" aria-label={meta.label} aria-checked={option.value!==0} disabled={disabled} onClick={()=>void onSave(option)}><span/></button>
    :<button id={`mc-${option.key}`} className="mc-native-cycle" type="button" aria-label={`${meta.label}: ${valueLabel}`} disabled={disabled} title="Click to change" onClick={()=>void onSave(option)}>{valueLabel}</button>}
  </div>;
}

export function MinecraftSettings({onClose,onClient}: {onClose:()=>void;onClient:()=>void}) {
  const [page,setPage]=useState('overview'),[query,setQuery]=useState(''),[options,setOptions]=useState<GameOption[]>([]),[busy,setBusy]=useState(false),[message,setMessage]=useState('Reading Minecraft settings…'),[error,setError]=useState(false);
  const root=useRef<HTMLElement>(null),inFlight=useRef(false);
  useEffect(()=>{let active=true;bridge.getGameOptions().then(next=>{if(active){setOptions(next);setMessage('Changes save automatically to Minecraft.');}}).catch(()=>{if(active){setError(true);setMessage('Could not read Minecraft settings. Close and try again.');}});root.current?.focus();return()=>{active=false;};},[]);
  async function save(option:GameOption,value?:number) {
    if(inFlight.current)return;
    inFlight.current=true;setBusy(true);setError(false);
    try {if(value===undefined)await bridge.adjustGameOption(option.key,1);else await bridge.setGameOptionFloat(option.key,value);setOptions(await bridge.getGameOptions());setMessage(`${classifyMinecraftOption(option).label} saved.`);}
    catch {setError(true);setMessage('Could not confirm the change. Read settings again before editing.');try{setOptions(await bridge.getGameOptions());}catch{/* Keep last confirmed controls. */}}
    finally{inFlight.current=false;setBusy(false);}
  }
  async function saveCollection(kind:'language'|'packs'|'shaders',ids:string[]){
    if(inFlight.current)throw new Error('Another setting is being saved');
    inFlight.current=true;setBusy(true);setError(false);
    try{await bridge.setGameSettingChoices(kind,ids);setOptions(await bridge.getGameOptions());setMessage('Minecraft resources updated.');}
    catch{setError(true);setMessage('Minecraft could not apply that selection. Check compatibility and try again.');throw new Error('Collection update failed');}
    finally{inFlight.current=false;setBusy(false);}
  }
  function trap(event:KeyboardEvent<HTMLElement>){if(event.key!=='Tab')return;const items=Array.from(root.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled)')??[]).filter(el=>el.getClientRects().length);const first=items[0],last=items.at(-1);if(event.shiftKey&&(document.activeElement===first||document.activeElement===root.current)){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}
  const filtered=filterMinecraftOptions(options,page,query),groups=[...new Set(filtered.map(o=>classifyMinecraftOption(o).section))];
  const title=query?'Search settings':minecraftPages[page]?.[0]??page;
  return <div className="precision-overlay"><section ref={root} tabIndex={-1} className="client-window mc-window precision-minecraft" role="dialog" aria-modal="true" aria-label="Minecraft settings" onKeyDown={trap}>
    <header className="client-window-heading"><div className="client-window-brand"><img src={OPUS_LOGO} alt=""/><span><strong>OPUS</strong>Minecraft settings</span></div><nav><button className="text-button" type="button" onClick={onClient}>Client settings</button></nav><button type="button" className="client-window-close" aria-label="Close Minecraft settings" onClick={onClose}>×</button></header>
    <div className="client-layout"><aside className="client-rail"><label className="search-field"><input type="search" aria-label="Search Minecraft settings" placeholder="Find a setting" value={query} onChange={e=>setQuery(e.target.value)}/></label><nav className="client-nav" aria-label="Minecraft settings sections">{navigation.map(id=><button className="nav-button" type="button" key={id} aria-current={page===id&&!query?'page':undefined} onClick={()=>{setPage(id);setQuery('');}}>{minecraftPages[id]?.[0]}</button>)}</nav><div className="client-rail-bottom"><button type="button" className="settings-owner-link" onClick={onClient}>Opus client settings →</button><span>MINECRAFT / 1.8.9</span></div></aside>
      <main className="client-main"><header className="client-main-heading"><div><span className="client-breadcrumb">MINECRAFT SETTINGS</span><h1>{title}</h1><p>{query?`${filtered.length} settings found`:minecraftPages[page]?.[1]}</p></div></header>
        {video.includes(page)&&!query&&<nav className="mc-video-tabs" aria-label="Video sections">{video.map(id=><button type="button" key={id} aria-current={page===id?'page':undefined} onClick={()=>setPage(id)}>{id==='display'?'General':minecraftPages[id]?.[0]}</button>)}</nav>}
        <div className={`client-body mc-scroll mc-page--${page}`}>
          {page==='overview'&&!query&&<div className="mc-directory">{navigation.slice(1).map(id=><button type="button" key={id} onClick={()=>setPage(id)}><span><strong>{minecraftPages[id]?.[0]}</strong><small>{minecraftPages[id]?.[1]}</small></span><span>→</span></button>)}</div>}
          {(page==='language'||page==='packs'||page==='shaders')&&<NativeCollection kind={page} query={query} busy={busy} onApply={saveCollection}/>}
          <div className={`mc-sections-grid${page==='audio'?' mc-audio-grid':''}`}>{groups.map(group=><section className="mc-section" key={group}><h2>{group}</h2><div className="mc-section-controls">{filtered.filter(o=>classifyMinecraftOption(o).section===group).map(option=><OptionControl key={option.key} option={option} busy={busy} onSave={save} conflicts={option.key.startsWith('KEY:')&&option.value!==0?options.filter(o=>o.key.startsWith('KEY:')&&o.key!==option.key&&o.value===option.value).map(o=>o.label):undefined}/>)}</div></section>)}</div>
          {!error&&!filtered.length&&!['overview','language','packs','shaders'].includes(page)&&<p className="mc-quiet-note">{query?'No settings match your search.':'This host reports no settings in this section.'}</p>}
        </div><div className="mc-feedback" role={error?'alert':'status'}>{busy?'Saving…':message}</div><footer className="client-main-footer"><span>Minecraft preferences</span><button className="text-button" type="button" onClick={onClose}>Done</button></footer>
      </main></div>
  </section></div>;
}
