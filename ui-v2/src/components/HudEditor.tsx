import { useLayoutEffect, useRef } from "react";
import { bridge } from "../bridge/bridge";
import { UiIcon } from "./ui/UiIcon";
import "./HudEditor.css";

// Only editor chrome lives in CEF. The visible/interactive widgets are the
// same native HUD objects used during gameplay, never browser simulations.
export function HudEditor({ revision, onMods, onDone }: {
  revision: number; onMods: () => void; onDone: () => void;
}) {
  const canvas = useRef<HTMLDivElement>(null);
  const center = useRef<HTMLDivElement>(null);
  const done = useRef<HTMLButtonElement>(null);
  const help = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (revision < 1) return;
    let disposed = false, frame = 0;
    const rect = (element: HTMLElement) => {
      const bounds = element.getBoundingClientRect();
      return { x: Math.floor(bounds.left), y: Math.floor(bounds.top),
        width: Math.ceil(bounds.right) - Math.floor(bounds.left),
        height: Math.ceil(bounds.bottom) - Math.floor(bounds.top) };
    };
    const report = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (disposed || !canvas.current) return;
        void bridge.reportHudEditorCanvas(revision, { ...rect(canvas.current),
          exclusions: [center.current, done.current, help.current]
            .filter(element => element !== null).map(rect),
        }).catch(() => { /* Native input stays closed until a valid report lands. */ });
      });
    };
    const observer = new ResizeObserver(report);
    [canvas.current, center.current, done.current, help.current].forEach(element => {
      if (element) observer.observe(element);
    });
    window.addEventListener("resize", report);
    report();
    return () => { disposed = true; cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener("resize", report); };
  }, [revision]);

  return <div className="hud-editor" ref={canvas} aria-label="Live HUD editor">
    <button type="button" className="hud-editor__done" ref={done} aria-label="Done editing HUD" onClick={onDone}>
      <span>Done</span><kbd>Esc</kbd>
    </button>
    <div className="hud-editor__center" ref={center}>
      <img src="/brand/opus-mark-user.png" alt="Opus" width="96" height="96" draggable={false} />
      <span className="hud-editor__wordmark">OPUS</span>
      <span className="hud-editor__mode">HUD layout</span>
      <button type="button" className="hud-editor__mods" aria-label="Open Mods" onClick={onMods}>
        <UiIcon name="modules" /><span>Mods</span><UiIcon name="chevron" />
      </button>
    </div>
    <div className="hud-editor__help" ref={help}>
      <span><UiIcon name="hud" />Drag to move · Corner to resize</span>
      <span><UiIcon name="settings" />Widget settings</span>
      <span><UiIcon name="close" />Hide, not delete</span>
      <small>Enable HUD widgets in Mods.</small>
    </div>
  </div>;
}
