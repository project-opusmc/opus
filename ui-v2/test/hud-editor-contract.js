// Rendered product editor with the native HTTP boundary intercepted. No OS input.
async (page) => {
  await page.goto("about:blank");
  await page.unrouteAll({ behavior: "wait" });
  const check = (ok, why) => { if (!ok) throw new Error(why); };
  let state = { revision: 81, current: { id: "hud_editor" }, canGoBack: false, canCloseToGame: true };
  const history = [], actions = [], regions = [];
  const modules = [{ id: "fps", name: "Performance overlay", enabled: true, settings: [] },
    { id: "keystrokes", name: "Keystrokes", enabled: true, settings: [] }];
  await page.route("http://127.0.0.1:31312/api/v1/**", async route => {
    const req = route.request(), path = new URL(req.url()).pathname;
    const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type" };
    const json = body => route.fulfill({ status: 200, contentType: "application/json", headers, body: JSON.stringify(body) });
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (path === "/api/v1/client") return json({ version: "fixture", minecraft: "1.8.9", runtime: "test", account: "fixture",
      accountKind: "unofficial", session: "online" });
    if (path.endsWith("/ui-state")) return json(state);
    if (path.endsWith("/ui-state/ack")) return route.fulfill({ status: 204, headers });
    if (path.endsWith("/ui-input-region")) { regions.push(req.postDataJSON()); return route.fulfill({ status: 204, headers }); }
    if (path.endsWith("/ui-actions")) {
      const action = req.postDataJSON(); actions.push(action);
      check(action.revision === state.revision, "Editor sent a stale action revision");
      if (action.action === "navigate") { history.push(state.current); state = { ...state, revision: state.revision + 1,
        current: action.route, canGoBack: true }; }
      else if (action.action === "back") { state = { ...state, revision: state.revision + 1, current: history.pop(), canGoBack: history.length > 0 }; }
      else if (action.action === "close") { state = { ...state, revision: state.revision + 1, current: { id: "none" }, canCloseToGame: false }; }
      return json(state);
    }
    if (path.endsWith("/modules")) return json({ modules });
    if (path.endsWith("/worlds")) return json({ worlds: [] });
    if (path.endsWith("/servers")) return json({ servers: [] });
    if (path.endsWith("/accounts")) return json({ accounts: [] });
    throw new Error(`Unexpected HUD API ${path}`);
  });
  await page.setViewportSize({ width: 820, height: 580 });
  await page.goto("http://127.0.0.1:5174/?port=31312#/hud_editor");
  await page.getByRole("button", { name: "Open Mods" }).waitFor({ timeout: 3000 });
  await page.waitForFunction(() => document.querySelector('[data-opus-route="hud_editor"]'));
  for (const viewport of [{ width: 900, height: 600 }, { width: 427, height: 240 },
    { width: 1440, height: 900 }, { width: 640, height: 360 }]) {
    const reported = page.waitForResponse(response => { const req = response.request();
      return req.url().endsWith("/ui-input-region") && req.method() === "POST"
        && req.postDataJSON().width === viewport.width && req.postDataJSON().height === viewport.height;
    });
    await page.setViewportSize(viewport);
    await reported;
    const region = regions.at(-1);
    check(region.revision === 81 && region.x === 0 && region.y === 0
      && region.width === viewport.width && region.height === viewport.height, "HUD is not the full current game viewport");
    const result = await page.evaluate(() => {
      const root = document.querySelector('[data-opus-route="hud_editor"]');
      const before = getComputedStyle(root, "::before");
      const mods = document.querySelector('[aria-label="Open Mods"]').getBoundingClientRect();
      const done = document.querySelector('[aria-label="Done editing HUD"]').getBoundingClientRect();
      return { blur: before.backdropFilter, content: before.content, background: before.backgroundColor,
        mods: { x: mods.x, y: mods.y, width: mods.width, height: mods.height },
        done: { x: done.x, y: done.y, width: done.width, height: done.height },
        video: document.querySelectorAll("video").length, scroll: document.documentElement.scrollHeight > innerHeight };
    });
    check(result.video === 0 && !result.scroll, "Editor substituted a wallpaper or a scrollable panel for the game");
    check(result.content === "none" || (result.blur === "none" && result.background === "rgba(0, 0, 0, 0)"),
      "HUD editor blurred or dimmed the actual game background");
    for (const rect of [result.mods, result.done]) {
      check(rect.width >= 28 && rect.height >= 28 && rect.x >= 0 && rect.y >= 0
        && rect.x + rect.width <= viewport.width && rect.y + rect.height <= viewport.height, "Editor control clipped on resize");
      const cx = rect.x + rect.width / 2, cy = rect.y + rect.height / 2;
      check(region.exclusions?.some(hole => cx >= hole.x && cy >= hole.y
        && cx < hole.x + hole.width && cy < hole.y + hole.height), "Native HUD can steal a CEF chrome click");
    }
  }
  const logo = page.getByRole("img", { name: "Opus" });
  check(await logo.evaluate(el => el.complete && el.naturalWidth > 0
    && new URL(el.src).pathname === "/brand/opus-mark-user.png"), "Editor used the wrong Opus logo");
  await page.getByRole("button", { name: "Open Mods" }).click();
  await page.locator('[data-opus-module-id="keystrokes"]').waitFor();
  check(actions.at(-1)?.route?.id === "mods_catalog", "Mods button did not navigate to real module catalog");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Open Mods" }).waitFor();
  check(actions.at(-1)?.action === "back", "Settings escaped past the HUD editor");
  const closing = page.waitForResponse(response => { const req = response.request();
    return req.url().endsWith("/ui-actions") && req.postDataJSON().action === "close";
  });
  await page.keyboard.press("Escape");
  await closing;
  check(actions.at(-1)?.action === "close", "Root HUD editor ignored Escape");
  return { hudEditor: "PASS", viewports: 4, noBlur: true, cefExclusions: true, modsAndEscape: true };
}
