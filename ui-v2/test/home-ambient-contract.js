// Run through playwright-cli run-code --filename test/home-ambient-contract.js.
// Exercises the real Home route in an isolated headless browser session.
async (page) => {
  const requireState = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  const base = "http://127.0.0.1:5174/";
  await page.unrouteAll({ behavior: "wait" });
  // Catches the original double-darkening bug in the composed output, not
  // a particular CSS opacity. Sample only the outer surround, not the hero.
  const requireVisibleSurround = async (state) => {
    const png = (await page.screenshot()).toString("base64");
    const pixels = await page.evaluate(async (base64) => {
      const image = new Image();
      image.src = `data:image/png;base64,${base64}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d");
      context.drawImage(image, 0, 0);
      const values = [];
      for (const x of [40, 80, 1200, 1240]) {
        for (let y = 120; y < 640; y += 40) {
          const [r, g, b] = context.getImageData(x, y, 1, 1).data;
          values.push((r + g + b) / 3);
        }
      }
      return { mean: values.reduce((sum, value) => sum + value, 0) / values.length,
        range: Math.max(...values) - Math.min(...values) };
    }, png);
    requireState(pixels.mean >= 30 && pixels.range >= 10,
      `${state} wallpaper must remain visibly present around the hero, not almost black: ${JSON.stringify(pixels)}`);
    return pixels;
  };

  await page.addInitScript(() => {
    const probe = {
      drawCount: 0,
      sharedSourceCount: 0,
      requestedFrameCallbacks: 0,
      cancelledFrameCallbacks: 0,
      pendingFrameCallbacks: 0,
      lastCanvasPixels: 0,
    };
    window.__opusHomeAmbientProbe = probe;

    const drawImage = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (source, ...args) {
      if (source instanceof HTMLVideoElement && source.matches("[data-opus-home-video]")) {
        probe.drawCount += 1;
        probe.sharedSourceCount += source === document.querySelector("[data-opus-home-video]") ? 1 : 0;
        probe.lastCanvasPixels = this.canvas.width * this.canvas.height;
      }
      return Reflect.apply(drawImage, this, [source, ...args]);
    };

    const requestFrame = HTMLVideoElement.prototype.requestVideoFrameCallback;
    const cancelFrame = HTMLVideoElement.prototype.cancelVideoFrameCallback;
    if (requestFrame && cancelFrame) {
      const pending = new Set();
      HTMLVideoElement.prototype.requestVideoFrameCallback = function (callback) {
        let callbackId = 0;
        callbackId = Reflect.apply(requestFrame, this, [function (...args) {
          pending.delete(callbackId);
          probe.pendingFrameCallbacks = pending.size;
          return Reflect.apply(callback, this, args);
        }]);
        pending.add(callbackId);
        probe.requestedFrameCallbacks += 1;
        probe.pendingFrameCallbacks = pending.size;
        return callbackId;
      };
      HTMLVideoElement.prototype.cancelVideoFrameCallback = function (callbackId) {
        if (pending.delete(callbackId)) probe.cancelledFrameCallbacks += 1;
        probe.pendingFrameCallbacks = pending.size;
        return Reflect.apply(cancelFrame, this, [callbackId]);
      };
    }
  });

  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("about:blank");
  // Force a new document so the sampling probe is installed even if the
  // caller already has Home open (a hash-only navigation does not do that).
  await page.goto(`${base}?homeAmbientContract#/title`);

  const scene = page.locator("[data-opus-home-scene]");
  const ambient = page.locator("[data-opus-home-ambient]");
  const canvas = page.locator("[data-opus-home-ambient-canvas]");
  const video = page.locator("[data-opus-home-video]");
  await scene.waitFor();
  await page.waitForFunction(() => window.__opusHomeAmbientProbe?.drawCount > 0);

  requireState(await video.count() === 1, "Home must use exactly one hero video decoder");
  requireState(await page.locator("[data-opus-home-scene] video").count() === 1,
    "The ambient surround must reuse the hero video, not mount a second video");

  const sharing = await page.evaluate(() => ({ ...window.__opusHomeAmbientProbe }));
  requireState(sharing.sharedSourceCount === sharing.drawCount && sharing.drawCount > 0,
    `Every ambient sample must come from the mounted hero video: ${JSON.stringify(sharing)}`);
  requireState(sharing.lastCanvasPixels > 0 && sharing.lastCanvasPixels <= 192 * 108,
    `Ambient sampling must stay on a bounded low-resolution canvas: ${sharing.lastCanvasPixels}`);

  const ambientLayer = await ambient.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const canvasStyle = getComputedStyle(element.querySelector("canvas"));
    return {
      width: bounds.width,
      height: bounds.height,
      pointerEvents: style.pointerEvents,
      canvasPointerEvents: canvasStyle.pointerEvents,
      backgroundImage: style.backgroundImage,
      fallbackFilter: getComputedStyle(element, "::before").filter,
    };
  });
  const viewport = page.viewportSize();
  requireState(viewport && ambientLayer.width >= viewport.width && ambientLayer.height >= viewport.height,
    `Ambient surround must cover Home without changing hero bounds: ${JSON.stringify(ambientLayer)}`);
  requireState(ambientLayer.pointerEvents === "none" && ambientLayer.canvasPointerEvents === "none",
    `Ambient layers must never intercept input: ${JSON.stringify(ambientLayer)}`);
  requireState(ambientLayer.backgroundImage.includes("opus-night-sky-poster-v1.jpg"),
    "Ambient surround must expose the existing poster as its static fallback");
  requireState(ambientLayer.fallbackFilter.includes("blur("),
    "The surround poster must remain blurred before playback and with reduced motion");
  const movingPixels = await requireVisibleSurround("Moving");
  await page.screenshot({ path: "/Users/zvwgvx/Project/Opus/output/playwright/ranked/client-visible-ambient.png" });

  const missedControls = await page.locator("[data-opus-home-action]").evaluateAll((elements) => elements.flatMap((element) => {
    const bounds = element.getBoundingClientRect();
    const hit = document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    return hit && element.contains(hit) ? [] : [element.getAttribute("data-opus-home-action")];
  }));
  requireState(missedControls.length === 0,
    `Ambient surround must remain below every Home control: ${missedControls.join(", ")}`);

  const mountedVideo = await video.elementHandle();
  await page.locator('[data-opus-home-action="client-settings"]').click();
  await page.locator('[data-opus-route="settings"]').waitFor();
  requireState(await page.locator("[data-opus-home-scene]").count() === 0,
    "Leaving Home must unmount the ambient scene");
  requireState(await mountedVideo.evaluate((element) => element.paused),
    "Leaving Home must stop the shared video decoder");
  const cleanup = await page.evaluate(() => ({ ...window.__opusHomeAmbientProbe }));
  requireState(cleanup.cancelledFrameCallbacks > 0 && cleanup.pendingFrameCallbacks === 0,
    `Unmount must cancel the pending video-frame callback: ${JSON.stringify(cleanup)}`);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`${base}#/title`);
  await scene.waitFor();
  requireState(await video.evaluate((element) => element.paused),
    "Reduced motion must keep the shared video paused");
  requireState(await scene.getAttribute("data-ambient-state") === "static",
    "Reduced motion must expose the static poster state");
  const reducedDrawCount = await page.evaluate(() => window.__opusHomeAmbientProbe.drawCount);
  await page.waitForTimeout(250);
  requireState(await page.evaluate(() => window.__opusHomeAmbientProbe.drawCount) === reducedDrawCount,
    "Reduced motion must not keep sampling video frames");
  requireState(await canvas.evaluate((element) => getComputedStyle(element).opacity) === "0",
    "Reduced motion must reveal the poster fallback instead of a stale sampled frame");
  const staticPixels = await requireVisibleSurround("Reduced-motion");

  await page.goto(`${base}#/game_menu`);
  const pause = page.locator('[data-opus-route="game_menu"]');
  await pause.waitFor();
  requireState(await pause.locator("video, canvas").count() === 0,
    "The game-transparent pause route must not contain title media");
  requireState(await pause.evaluate((element) => getComputedStyle(element).backgroundColor) === "rgba(0, 0, 0, 0)",
    "The pause route must remain transparent to the game");

  await page.emulateMedia({ reducedMotion: "no-preference" });
  return { result: "PASS", movingPixels, staticPixels,
    checks: "visible blurred surround, one decoder, shared low-res samples, input passthrough, cleanup, reduced motion, transparent pause" };
}
