import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

async function renderConnection(connection, canGoBack) {
  const screenModule = await import("../src/components/ConnectionScreen.ts").catch(() => null);
  assert.equal(
    typeof screenModule?.ConnectionScreen,
    "function",
    "the dedicated ConnectionScreen component must be available",
  );
  return renderToStaticMarkup(createElement(screenModule.ConnectionScreen, {
    connection,
    canGoBack,
    onBack() {},
  }));
}

test("disconnected renders the native multiline reason as safe text with a Back action", async () => {
  const markup = await renderConnection({
    phase: "disconnected",
    title: "Disconnected",
    detail: "Internal Exception: connection reset\n<script>alert('untrusted')</script>",
    serverName: "Example Network",
    serverAddress: "play.example.net",
    canCancel: false,
  }, true);

  assert.match(markup, /Internal Exception: connection reset/);
  assert.match(markup, /&lt;script&gt;alert\(&#x27;untrusted&#x27;\)&lt;\/script&gt;/);
  assert.doesNotMatch(markup, /<script>/);
  assert.match(markup, /data-opus-connection-action="back"/);
  assert.match(markup, />Back<\/button>/);
});

test("connecting exposes one Cancel action without stealing initial focus", async () => {
  const markup = await renderConnection({
    phase: "connecting",
    title: "Connecting",
    detail: "Contacting server…",
    serverName: "Example Network",
    serverAddress: "play.example.net",
    canCancel: true,
  }, true);

  assert.match(markup, /data-opus-connection-action="cancel"/);
  assert.doesNotMatch(markup, /autofocus=/);
  assert.match(markup, />Cancel<\/button>/);
});

test("an empty native detail keeps its layout row without a textarea-like tab stop", async () => {
  const markup = await renderConnection({
    phase: "connecting",
    title: "Connecting",
    detail: "",
    serverName: "Local test",
    serverAddress: "127.0.0.1:25565",
    canCancel: true,
  }, true);

  assert.match(markup, /data-opus-connection-detail="true"/);
  assert.match(markup, /data-opus-connection-detail-empty="true"/);
  assert.match(markup, /aria-hidden="true"/);
  assert.doesNotMatch(markup, /tabindex=/);
  assert.match(markup, /data-opus-connection-action="cancel"/);
});

test("loading terrain has no action even if stale navigation says back is available", async () => {
  const markup = await renderConnection({
    phase: "loading",
    title: "Loading terrain",
    detail: "Joining world…",
    serverName: "Example Network",
    serverAddress: "play.example.net",
    canCancel: false,
  }, true);

  assert.doesNotMatch(markup, /data-opus-connection-action=/);
  assert.doesNotMatch(markup, /<button/);
});
