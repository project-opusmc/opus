import { useEffect, useRef, type ReactNode } from "react";
import { shouldPlayAmbientVideo, syncAmbientVideo } from "../surfaceSession";

export function HomeScene({active, reduceMotion, isInnerRoute=false, children}: {
  active:boolean; reduceMotion:boolean; isInnerRoute?:boolean; children?:ReactNode;
}) {
  const videoRef=useRef<HTMLVideoElement>(null);
  useEffect(()=>{
    const video=videoRef.current;
    if(!video)return;
    const preference=matchMedia("(prefers-reduced-motion: reduce)");
    const update=()=>syncAmbientVideo(video,shouldPlayAmbientVideo(active,!document.hidden,reduceMotion||preference.matches));
    const observe=()=>{if(new URLSearchParams(location.search).get('opusMediaProbe')==='1')console.info(`OPUS_MEDIA_STATE active=${active} paused=${video.paused} hidden=${document.hidden}`);};
    video.addEventListener('play',observe);video.addEventListener('pause',observe);
    update(); document.addEventListener("visibilitychange",update);preference.addEventListener("change",update);
    observe();
    return()=>{document.removeEventListener("visibilitychange",update);preference.removeEventListener("change",update);video.pause();video.removeEventListener('play',observe);video.removeEventListener('pause',observe);};
  },[active,reduceMotion]);
  return <div className="precision-wallpaper" data-opus-home-scene data-inner-route={isInnerRoute?"true":undefined} aria-hidden="true">
    <video ref={videoRef} data-opus-home-video muted loop playsInline preload="metadata" poster="/media/opus-night-sky-poster-v1.jpg" tabIndex={-1}>
      <source src="/media/opus-night-sky-v1.webm" type="video/webm"/><source src="/media/opus-night-sky-v1.mp4" type="video/mp4"/>
    </video>{children}</div>;
}
