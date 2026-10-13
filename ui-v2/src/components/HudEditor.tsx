import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { bridge } from '../bridge/bridge';
import type { HudEditorOperation, HudEditorState, HudEditorWidget, OpusModule } from '../bridge/types';
import { OPUS_LOGO } from '../precision/PrecisionFrame';
import { UiIcon } from './ui/UiIcon';

const initialState:HudEditorState={editing:true,grid:false,snap:true,canUndo:false};
type ToolAction='hud-edit'|'hud-preview'|'hud-grid'|'hud-snap'|'hud-undo';
type Edit=(operation:HudEditorOperation,id:string,x?:number,y?:number)=>Promise<void>;

function EditorSwitch({label,checked,disabled,onClick}:{label:string;checked:boolean;disabled:boolean;onClick:()=>void}) {
  return <button className="switch" type="button" role="switch" aria-label={label} aria-checked={checked} disabled={disabled} onClick={onClick}/>;
}

function WidgetProperties({widget,name,canvasWidth,canvasHeight,pending,onEdit,onSettings}:{widget:HudEditorWidget;name:string;canvasWidth:number;canvasHeight:number;pending:boolean;onEdit:Edit;onSettings:()=>void}) {
  const [x,setX]=useState(String(widget.x)),[y,setY]=useState(String(widget.y)),[scale,setScale]=useState(widget.scale);
  const xInput=useRef<HTMLInputElement>(null),yInput=useRef<HTMLInputElement>(null);
  useEffect(()=>{if(document.activeElement!==xInput.current)setX(String(widget.x));if(document.activeElement!==yInput.current)setY(String(widget.y));},[widget.id,widget.x,widget.y]);
  useEffect(()=>setScale(widget.scale),[widget.id,widget.scale]);
  const position=()=>{
    const nextX=Math.round(Number(x)),nextY=Math.round(Number(y));
    if(x.trim()&&y.trim()&&Number.isFinite(nextX)&&Number.isFinite(nextY)&&(nextX!==widget.x||nextY!==widget.y))void onEdit('position',widget.id,nextX,nextY);
  };
  const applyScale=(input:HTMLInputElement)=>{const next=Number(input.value);if(next!==widget.scale)void onEdit('scale',widget.id,next);};
  return <div className="selected-widget-controls" data-module={widget.id}>
    <div className="selected-widget-title"><span>SELECTED WIDGET</span><h2>{name}</h2></div>
    {widget.enabled ? <>
      <div className="layout-position-fields">
        <label>X<input ref={xInput} type="number" min="0" max={Math.max(0,canvasWidth-widget.width)} step="1" value={x} aria-label="Widget X position" disabled={pending} onChange={e=>setX(e.target.value)} onBlur={position} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}}/></label>
        <label>Y<input ref={yInput} type="number" min="0" max={Math.max(0,canvasHeight-widget.height)} step="1" value={y} aria-label="Widget Y position" disabled={pending} onChange={e=>setY(e.target.value)} onBlur={position} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}}/></label>
      </div>
      <div className="layout-scale-row"><label htmlFor="layout-scale">Scale</label><output id="layout-scale-value">{(scale/100).toFixed(2)}×</output>
        <input id="layout-scale" type="range" min={widget.minScale} max={widget.maxScale} step="1" value={scale} disabled={pending} aria-label="Widget scale" onChange={e=>setScale(Number(e.target.value))} onPointerUp={e=>applyScale(e.currentTarget)} onKeyUp={e=>applyScale(e.currentTarget)} onBlur={e=>applyScale(e.currentTarget)} style={{'--range-fill':`${(scale-widget.minScale)/(widget.maxScale-widget.minScale)*100}%`} as CSSProperties}/>
      </div>
      <div className="layout-size-readout"><span>Frame</span><output>{widget.width} × {widget.height} px</output></div>
      <p className="layout-keyboard-note"><kbd>↑↓←→</kbd> Nudge <span>Shift × 10</span></p>
    </> : <p className="widget-hidden-message">This widget is hidden. Enable it in Widgets to arrange it on your HUD.</p>}
    <div className="selected-widget-actions"><button className="text-button" type="button" onClick={onSettings}>Module settings <span className="icon"><UiIcon name="chevron"/></span></button>{widget.enabled&&<button className="text-button" type="button" disabled={pending} onClick={()=>void onEdit('reset',widget.id)}>Reset placement</button>}</div>
  </div>;
}

// The approved preview's chrome surrounds the real native game HUD. CEF never
// substitutes a sample FPS, key state, widget frame, hotbar, or game background.
export function HudEditor({revision,onMods,onModuleSettings,onDone,modules,onToggle}:{
  revision:number;onMods:()=>void;onModuleSettings:(id:string)=>void;onDone:()=>void;modules:OpusModule[];onToggle:(id:string,enabled:boolean)=>Promise<void>;
}) {
  const [state,setState]=useState(initialState),[palette,setPalette]=useState(false),[pending,setPending]=useState(false),[error,setError]=useState('');
  const busy=useRef(false),active=useRef(true);
  const canvas=useRef<HTMLElement>(null),centerButton=useRef<HTMLButtonElement>(null),actions=useRef<HTMLDivElement>(null),tools=useRef<HTMLDivElement>(null),properties=useRef<HTMLElement>(null),paletteRef=useRef<HTMLElement>(null);
  const selected=state.selected;
  const inspecting=state.editing&&Boolean(state.inspecting&&selected)&&!state.pointerCaptured;
  const read=async()=>{const next=await bridge.getHudEditorState();if(active.current)setState(next);};
  useEffect(()=>{
    active.current=true;let reading=false;
    const poll=()=>{if(reading||busy.current)return;reading=true;void read().catch(()=>{}).finally(()=>{reading=false;});};
    poll();const timer=setInterval(poll,180);
    return()=>{active.current=false;clearInterval(timer);};
  },[revision]);
  async function run(task:()=>Promise<void>) {
    if(busy.current)return;
    busy.current=true;setPending(true);setError('');
    try {await task();await read();} catch {if(active.current)setError('Could not save the HUD change. Try again.');}
    finally {busy.current=false;if(active.current)setPending(false);}
  }
  const edit:Edit=async(operation,id,x=0,y=0)=>{await run(()=>bridge.updateHudEditor(revision,operation,id,x,y));};
  const tool=(action:ToolAction)=>void run(()=>bridge.performAction(action,revision));
  useEffect(()=>{
    if(!state.editing||!selected?.enabled)return;
    const nudge=(event:KeyboardEvent)=>{
      if(event.ctrlKey||event.metaKey||event.altKey||event.target instanceof HTMLInputElement||event.target instanceof HTMLTextAreaElement||event.target instanceof HTMLSelectElement)return;
      const delta=event.shiftKey?10:1;
      const offsets:Record<string,[number,number]>={ArrowLeft:[-delta,0],ArrowRight:[delta,0],ArrowUp:[0,-delta],ArrowDown:[0,delta]};
      const value=offsets[event.key];if(!value)return;
      event.preventDefault();void edit('nudge',selected.id,...value);
    };
    window.addEventListener('keydown',nudge);return()=>window.removeEventListener('keydown',nudge);
  },[state.editing,selected?.id,selected?.enabled,revision]);
  useLayoutEffect(()=>{
    if(!inspecting||!properties.current||!selected)return;
    const panel=properties.current,width=panel.offsetWidth,height=panel.offsetHeight;
    const right=selected.x+selected.width+18,left=selected.x-width-18;
    panel.style.left=`${innerWidth<=640?12:Math.max(12,Math.min(innerWidth-width-12,right+width<innerWidth-12?right:left))}px`;
    panel.style.top=`${innerWidth<=640?Math.max(74,innerHeight-height-133):Math.max(74,Math.min(innerHeight-height-92,selected.y))}px`;
  },[inspecting,selected?.id,selected?.x,selected?.y,selected?.width,selected?.height,selected?.enabled]);
  useLayoutEffect(()=>{
    if(revision<1)return;
    let disposed=false,frame=0;
    const rect=(element:HTMLElement)=>{const b=element.getBoundingClientRect();return {x:Math.floor(b.left),y:Math.floor(b.top),width:Math.ceil(b.right)-Math.floor(b.left),height:Math.ceil(b.bottom)-Math.floor(b.top)};};
    const report=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{
      if(disposed||!canvas.current)return;
      const exclusions=[state.editing&&!inspecting?centerButton.current:null,actions.current,state.editing?tools.current:null,properties.current,paletteRef.current].filter((element):element is HTMLElement=>element!==null&&!element.hidden&&element.getBoundingClientRect().width>0);
      void bridge.reportHudEditorCanvas(revision,{...rect(canvas.current),exclusions:exclusions.map(rect)}).catch(()=>{});
    });};
    const observer=new ResizeObserver(report);
    [canvas.current,centerButton.current,actions.current,tools.current,properties.current,paletteRef.current].forEach(element=>{if(element)observer.observe(element);});
    window.addEventListener('resize',report);report();
    return()=>{disposed=true;cancelAnimationFrame(frame);observer.disconnect();window.removeEventListener('resize',report);};
  },[revision,state.editing,inspecting,palette,selected?.x,selected?.y,selected?.width,selected?.height]);

  return <section ref={canvas} className="screen hud-overlay native-hud-overlay" aria-label="Live HUD editor" data-inspecting={inspecting} data-palette={palette} data-mode={state.editing?'edit':'preview'} data-widget-x={selected?.x} data-widget-y={selected?.y} data-widget-scale={selected?.scale}>
    <header className="hud-overlay-heading"><div className="hud-overlay-actions" ref={actions}>
      <div className="segments" aria-label="HUD canvas mode"><button type="button" aria-pressed={state.editing} disabled={pending} onClick={()=>tool('hud-edit')}>Edit layout</button><button type="button" aria-pressed={!state.editing} disabled={pending} onClick={()=>tool('hud-preview')}>Game view</button></div>
      <button className="button editor-done" type="button" onClick={onDone} aria-label="Done editing HUD">Done <kbd>Esc</kbd></button>
    </div></header>
    <div className="hud-center-hub" hidden={!state.editing||inspecting}><img src={OPUS_LOGO} alt="Opus" draggable={false}/><strong>OPUS</strong><span>HUD LAYOUT</span><button ref={centerButton} className="button button--primary" type="button" data-accent="modules" onClick={onMods}>Modules & settings <span className="icon"><UiIcon name="chevron"/></span></button></div>
    {inspecting&&selected&&<aside ref={properties} className="hud-properties material" aria-label="Selected widget properties">
      <button type="button" className="icon-button properties-close" aria-label="Close widget properties" disabled={pending} onClick={()=>void edit('close-properties',selected.id)}><UiIcon name="close"/></button>
      <WidgetProperties key={selected.id} widget={selected} name={modules.find(module=>module.id===selected.id)?.name??selected.id} canvasWidth={state.canvasWidth??0} canvasHeight={state.canvasHeight??0} pending={pending} onEdit={edit} onSettings={()=>onModuleSettings(selected.id)}/>
    </aside>}
    {state.editing&&palette&&<aside ref={paletteRef} className="hud-widget-palette material" aria-label="HUD widgets"><div className="inspector-heading"><h2>On your HUD</h2><span>{modules.filter(module=>module.enabled).length} / {modules.length}</span></div>
      <div className="editor-module-list">{modules.map(module=><div className={`editor-module-row${selected?.id===module.id?' is-selected':''}`} key={module.id}><button className="editor-module-select" data-opus-widget={module.id} type="button" aria-pressed={selected?.id===module.id} disabled={pending} onClick={()=>{setPalette(false);void edit('select',module.id);}}><i className={`module-line-state${module.enabled?' is-on':''}`}/><span>{module.name}</span></button><EditorSwitch label={`Show ${module.name} on HUD`} checked={module.enabled} disabled={pending} onClick={()=>void run(()=>onToggle(module.id,!module.enabled))}/></div>)}</div>
      <button className="text-button" type="button" onClick={onMods}>All module settings <span className="icon"><UiIcon name="chevron"/></span></button>
    </aside>}
    <footer className="hud-edit-toolbar" hidden={!state.editing}><div ref={tools} className="hud-tool-group material"><button type="button" className="text-button" aria-expanded={palette} onClick={()=>setPalette(!palette)}>Widgets</button><span className="tool-divider"/><div><EditorSwitch label="Snap to edges" checked={state.snap} disabled={pending} onClick={()=>tool('hud-snap')}/><span>Snap</span></div><div><EditorSwitch label="Canvas grid" checked={state.grid} disabled={pending} onClick={()=>tool('hud-grid')}/><span>Grid</span></div><span className="tool-divider"/><button className="text-button editor-undo" type="button" disabled={pending||!state.canUndo} onClick={()=>tool('hud-undo')}>Undo</button></div>
      <p className="hud-edit-hint">Drag to move <i>·</i> Corner to resize <i>·</i> <kbd>↑↓←→</kbd> to nudge</p>
    </footer>
    {error&&<p className="precision-error" role="alert">{error}</p>}
    <span className="layout-status sr-only" role="status" aria-live="polite">Frame and content resize together</span>
  </section>;
}
