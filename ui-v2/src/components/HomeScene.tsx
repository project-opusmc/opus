import { useEffect, useRef, useState, type ReactNode } from "react";
import { shouldPlayAmbientVideo, syncAmbientVideo } from "../surfaceSession";

const AMBIENT_WIDTH = 160;
const AMBIENT_HEIGHT = 90;
const AMBIENT_FRAME_INTERVAL_MS = 125;

type AmbientState = "moving" | "static";

export function HomeScene({
  active,
  reduceMotion,
  isInnerRoute = false,
  children,
}: {
  active: boolean;
  reduceMotion: boolean;
  isInnerRoute?: boolean;
  children?: ReactNode;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ambientState, setAmbientState] = useState<AmbientState>("static");

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const context = canvas.getContext("2d", { alpha: true, desynchronized: true });
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let sampling = false;
    let frameCallbackId: number | null = null;
    let fallbackTimerId: number | null = null;
    let lastPaintTime = -AMBIENT_FRAME_INTERVAL_MS;

    const clearSample = () => {
      context?.clearRect(0, 0, canvas.width, canvas.height);
    };

    const drawSample = () => {
      if (!context || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA
          || video.videoWidth === 0 || video.videoHeight === 0) return;

      const overscan = 8;
      context.save();
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "low";
      context.filter = "blur(3px) saturate(0.95) brightness(1.6)";
      context.drawImage(
        video,
        -overscan,
        -overscan,
        canvas.width + overscan * 2,
        canvas.height + overscan * 2,
      );
      context.restore();
    };

    const scheduleSample = () => {
      if (!sampling || frameCallbackId !== null || fallbackTimerId !== null) return;

      if (typeof video.requestVideoFrameCallback === "function") {
        frameCallbackId = video.requestVideoFrameCallback((now) => {
          frameCallbackId = null;
          if (!sampling) return;
          if (now - lastPaintTime >= AMBIENT_FRAME_INTERVAL_MS) {
            drawSample();
            lastPaintTime = now;
          }
          scheduleSample();
        });
        return;
      }

      fallbackTimerId = window.setTimeout(() => {
        fallbackTimerId = null;
        if (!sampling) return;
        drawSample();
        scheduleSample();
      }, AMBIENT_FRAME_INTERVAL_MS);
    };

    const stopSampling = () => {
      sampling = false;
      if (frameCallbackId !== null && typeof video.cancelVideoFrameCallback === "function") {
        video.cancelVideoFrameCallback(frameCallbackId);
        frameCallbackId = null;
      }
      if (fallbackTimerId !== null) {
        window.clearTimeout(fallbackTimerId);
        fallbackTimerId = null;
      }
    };

    const updatePlayback = () => {
      const shouldPlay = shouldPlayAmbientVideo(
        active,
        !document.hidden,
        reduceMotion || motionPreference.matches,
      );

      if (shouldPlay) {
        setAmbientState("moving");
        syncAmbientVideo(video, true);
        sampling = true;
        scheduleSample();
      } else {
        setAmbientState("static");
        stopSampling();
        syncAmbientVideo(video, false);
        clearSample();
      }

      if (new URLSearchParams(window.location.search).has("opusMediaProbe")) {
        console.info(`OPUS_MEDIA_STATE active=${active} paused=${video.paused} hidden=${document.hidden}`);
      }
    };

    updatePlayback();
    document.addEventListener("visibilitychange", updatePlayback);
    motionPreference.addEventListener("change", updatePlayback);

    return () => {
      document.removeEventListener("visibilitychange", updatePlayback);
      motionPreference.removeEventListener("change", updatePlayback);
      stopSampling();
      video.pause();
      clearSample();
    };
  }, [active, reduceMotion]);

  return (
    <div
      className={`home__scene ${isInnerRoute ? "home__scene--inner" : ""}`}
      data-opus-home-scene
      data-ambient-state={ambientState}
      data-inner-route={isInnerRoute ? "true" : undefined}
    >
      <div className="home__ambient" data-opus-home-ambient aria-hidden="true">
        <canvas
          ref={canvasRef}
          className="home__ambient-canvas"
          data-opus-home-ambient-canvas
          width={AMBIENT_WIDTH}
          height={AMBIENT_HEIGHT}
        />
      </div>

      <div className="home__hero">
        <div className="home__backdrop" aria-hidden="true">
          <video
            ref={videoRef}
            data-opus-home-video
            muted
            loop
            playsInline
            preload="auto"
            poster="/media/opus-night-sky-poster-v1.jpg"
            tabIndex={-1}
          >
            <source src="/media/opus-night-sky-v1.webm" type="video/webm" />
            <source src="/media/opus-night-sky-v1.mp4" type="video/mp4" />
          </video>
        </div>
        {children}
      </div>
    </div>
  );
}
