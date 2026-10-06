// Run through playwright-cli run-code --filename test/visual-contract.js.
// Exercises the real browser fixture; no Minecraft-owned write is sent.
async (page) => {
  const requireState = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  const base = 'http://127.0.0.1:5174/';
  await page.goto(`${base}#/title`);
  await page.locator('[data-opus-home-action="singleplayer"]').waitFor();
  const material = await page.locator('[data-opus-home-action="singleplayer"]').evaluate(el => {
    const style = getComputedStyle(el);
    return { image: style.backgroundImage, fill: style.backgroundColor };
  });
  requireState(material.image === 'none' && !material.fill.startsWith('rgba'),
    `Play controls must keep an opaque, quiet surface over moving video: ${JSON.stringify(material)}`);

  for (const [width, height] of [[1280, 720], [854, 480], [900, 600], [427, 240]]) {
    await page.setViewportSize({width, height});
    await page.goto(`${base}#/title`);
    const controls = page.locator('[data-opus-home-action]');
    await controls.first().waitFor();
    const misses = await controls.evaluateAll(elements => elements.flatMap(el => {
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return r.x < 0 || r.y < 0 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1
        || r.width < 24 || r.height < 24 || !hit || !el.contains(hit)
        ? [el.textContent.trim()] : [];
    }));
    requireState(misses.length === 0, `${width}×${height}: unreachable Home controls: ${misses}`);
    for (const [play, setting] of [['singleplayer', 'minecraft-settings'], ['multiplayer', 'client-settings']]) {
      const alignment = await page.locator(`[data-opus-home-action="${setting}"]`).evaluate((button, upperId) => {
        const upper = document.querySelector(`[data-opus-home-action="${upperId}"]`);
        const icon = button.querySelector('svg').getBoundingClientRect();
        const upperIcon = upper.querySelector('.home__button-icon svg').getBoundingClientRect();
        const label = button.querySelector('span').getBoundingClientRect();
        const upperLabel = upper.querySelector('.home__button-copy strong').getBoundingClientRect();
        const bounds = button.getBoundingClientRect();
        return {iconDelta: icon.x + icon.width / 2 - upperIcon.x - upperIcon.width / 2,
          labelDelta: label.x - upperLabel.x, textAlign: getComputedStyle(button).textAlign,
          labelFits: label.x >= bounds.x && label.right <= bounds.right};
      }, play);
      requireState(Math.abs(alignment.iconDelta) < 1 && Math.abs(alignment.labelDelta) < 1
        && alignment.textAlign === 'left' && alignment.labelFits,
        `${width}×${height}: ${setting} icon/text must align left with ${play}: ${JSON.stringify(alignment)}`);
    }
    await page.locator('[data-opus-home-action="multiplayer"]').click();
    await page.locator('[data-opus-server-id]').first().waitFor();
    requireState((await page.locator('.route-header__identity').textContent()).trim() === 'Multiplayer',
      'The section header must show only its current title, without repeating the Opus brand');
    const actions = page.locator('[data-opus-server-direct-open], [data-opus-server-add-open], [data-opus-server-connect]');
    const actionMisses = await actions.evaluateAll(elements => elements.flatMap(el => {
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return r.right > innerWidth + 1 || r.bottom > innerHeight + 1 || !hit || !el.contains(hit)
        ? [el.textContent.trim()] : [];
    }));
    requireState(actionMisses.length === 0, `${width}×${height}: hidden server actions: ${actionMisses}`);
    await page.locator('[data-opus-server-add-open]').click();
    await page.locator('[data-opus-server-address]').waitFor();
    const save = page.locator('[data-opus-server-save]');
    requireState(await save.isDisabled(), 'A blank address must not be savable');
    await page.locator('[data-opus-server-name]').fill('Visual contract');
    await page.locator('[data-opus-server-address]').fill('test.example.invalid');
    requireState(await save.isEnabled(), 'A valid address must enable Save');
    await page.getByRole('button', {name: 'Close', exact: true}).click();
    // React reinstalls the trigger before the next frame restores its focus.
    await page.waitForFunction(() => document.activeElement?.hasAttribute('data-opus-server-add-open'),
      null, {timeout: 500});
    requireState(await page.locator('[data-opus-server-add-open]').evaluate(el => el === document.activeElement),
      'Closing the composer must restore keyboard focus');
  }

  await page.setViewportSize({width:1280, height:720});
  await page.goto(`${base}#/game_menu`);
  const overlay = await page.locator('[data-opus-route="game_menu"]').evaluate(el => ({
    background: getComputedStyle(el).backgroundColor,
    videoCount: el.querySelectorAll('video').length,
    panel: el.querySelector('.pause-menu').getBoundingClientRect().toJSON(),
  }));
  requireState(overlay.background === 'rgba(0, 0, 0, 0)' && overlay.videoCount === 0,
    'Pause must composite over the game, not the title background');
  requireState(Math.abs(overlay.panel.x + overlay.panel.width / 2 - 640) < 2,
    'Pause panel must stay centered');
  await page.goto(`${base}#/title`);
  const homeVideo = await page.locator('video').elementHandle();
  await page.waitForFunction(() => !document.querySelector('video').paused);
  await page.locator('[data-opus-home-action="client-settings"]').click();
  await page.locator('[data-opus-route="settings"]').waitFor();
  requireState(await page.locator('video').count() === 0 && await homeVideo.evaluate(el => el.paused),
    'Leaving Home must remove and stop ambient video, not keep decoding behind data pages');
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto(`${base}#/title`);
  requireState(await page.locator('video').evaluate(el => el.paused), 'Reduced motion must pause video');
  await page.emulateMedia({reducedMotion:'no-preference'});
  return 'Client visual contract PASS: material, 4 sizes, settings icon/text left alignment, hit testing, composer guards/focus, pause transparency, media lifecycle, reduced motion';
}
