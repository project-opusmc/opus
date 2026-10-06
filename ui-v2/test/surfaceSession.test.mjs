import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyHostNavigation,
  shouldPlayAmbientVideo,
  syncAmbientVideo,
} from "../src/surfaceSession.ts";

function navigation(revision, id, connection) {
  return {
    revision,
    current: { id },
    canGoBack: false,
    canCloseToGame: id === "game_menu",
    ...(connection === undefined ? {} : { connection }),
  };
}

test("prewarm revision zero and a later close both park the React session", () => {
  assert.deepEqual(classifyHostNavigation(navigation(0, "none"), 0), {
    kind: "closed", revision: 0,
  });
  assert.deepEqual(classifyHostNavigation(navigation(5, "none"), 4), {
    kind: "closed", revision: 5,
  });
});

test("an older async host response cannot revive a closed session", () => {
  assert.deepEqual(classifyHostNavigation(navigation(4, "game_menu"), 5), {
    kind: "ignored",
  });
});

test("a same-hash pause-menu reopen is a new route that must be ACKed", () => {
  const state = navigation(7, "game_menu");
  assert.deepEqual(classifyHostNavigation(state, 6), {
    kind: "route", revision: 7, route: state.current,
  });
  // Re-reading the same revision after reconnect must also be ACK-safe.
  assert.deepEqual(classifyHostNavigation(state, 7), {
    kind: "route", revision: 7, route: state.current,
  });
});

test("same-route connection revisions carry the newest native payload", () => {
  const connecting = {
    phase: "connecting",
    title: "Connecting to server",
    detail: "Negotiating with the remote host…",
    serverName: "Hypixel",
    serverAddress: "mc.hypixel.net",
    canCancel: true,
  };
  const loading = {
    ...connecting,
    phase: "loading",
    title: "Loading terrain",
    detail: "Joining world…",
    canCancel: false,
  };

  assert.deepEqual(classifyHostNavigation(navigation(8, "connection", connecting), 7), {
    kind: "route",
    revision: 8,
    route: { id: "connection" },
    connection: connecting,
  });
  assert.deepEqual(classifyHostNavigation(navigation(9, "connection", loading), 8), {
    kind: "route",
    revision: 9,
    route: { id: "connection" },
    connection: loading,
  });
});

test("invalid or uncommitted routes are never ACK candidates", () => {
  assert.deepEqual(classifyHostNavigation(navigation(0, "game_menu"), 0), {
    kind: "ignored",
  });
  assert.deepEqual(classifyHostNavigation(navigation(2, "unknown"), 1), {
    kind: "ignored",
  });
});

test("hidden, inactive, and reduced-motion states pause media", async () => {
  const video = {
    paused: false,
    pauseCalls: 0,
    playCalls: 0,
    pause() { this.pauseCalls++; this.paused = true; },
    play() { this.playCalls++; this.paused = false; return Promise.resolve(); },
  };

  for (const [active, visible, reducedMotion] of [
    [false, true, false],
    [true, false, false],
    [true, true, true],
  ]) {
    const shouldPlay = shouldPlayAmbientVideo(active, visible, reducedMotion);
    assert.equal(shouldPlay, false);
    syncAmbientVideo(video, shouldPlay);
  }
  assert.equal(video.pauseCalls, 3);
  assert.equal(video.playCalls, 0);

  assert.equal(shouldPlayAmbientVideo(true, true, false), true);
  syncAmbientVideo(video, true);
  assert.equal(video.playCalls, 1);

  // CEF can reject autoplay; the rejection must be consumed by the helper.
  video.play = () => Promise.reject(new Error("autoplay blocked"));
  video.paused = true;
  syncAmbientVideo(video, true);
  await Promise.resolve();
});
