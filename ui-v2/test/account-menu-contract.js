// Run with playwright-cli run-code --filename test/account-menu-contract.js.
// Isolated browser fixture only: never touches the user's launcher catalog.
async (page) => {
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  const base = 'http://127.0.0.1:5174/';
  const trigger = () => page.locator('[data-opus-home-action="accounts"]');
  const panel = () => page.getByRole('dialog', {name: 'Account menu', exact: true});
  let opens = 0;
  const open = async () => {
    opens += 1;
    await trigger().click();
    try { await panel().waitFor({timeout: 1500}); }
    catch { throw new Error(`Account menu did not open (#${opens}) at ${page.url()} (${JSON.stringify(page.viewportSize())}, expanded=${await trigger().getAttribute('aria-expanded')})`); }
  };
  await page.setViewportSize({width:1280,height:720});
  await page.goto(`${base}#/title`);
  // Navigating to the same fragment is not a document reload. Reset mocks
  // explicitly so repeating this contract cannot reuse a previous selection.
  await page.reload();
  await page.getByRole('button', {name: 'Account: zvwgvx', exact: true}).waitFor();
  const video = await page.locator('video').elementHandle();
  await open();
  check(page.url().endsWith('#/title'), 'Opening accounts must not navigate/reload Home');
  check(await video.evaluate(el => el.isConnected && el === document.querySelector('video')),
    'Opening accounts must preserve the mounted Home video');
  check(await trigger().getAttribute('aria-expanded') === 'true', 'Trigger must expose expanded state');
  check(await panel().locator('.account-menu__identity .account-ign').textContent() === 'zvwgvx', 'IGN must retain exact case');
  await page.keyboard.press('Escape');
  check(await panel().count() === 0, 'Escape must dismiss only the popover');
  check(await trigger().evaluate(el => el === document.activeElement), 'Escape must return focus to the trigger');
  await page.keyboard.press('Enter');
  await panel().waitFor();
  await page.locator('.home__brand').click();
  check(await panel().count() === 0 && page.url().endsWith('#/title'), 'Outside click must dismiss without navigating');
  await trigger().focus();
  await page.keyboard.press('Space');
  await panel().waitFor();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Shift+Tab');
  await page.waitForFunction(() => document.querySelector('[data-opus-home-action="accounts"]')?.getAttribute('aria-expanded') === 'false', null, {timeout:500});
  check(await panel().count() === 0, 'Moving focus out must dismiss rather than cover a focused Home control');

  for (const [width, height] of [[1280,720], [854,480], [900,600], [427,240], [375,667]]) {
    await page.setViewportSize({width,height});
    await open();
    const rect = await panel().boundingBox();
    check(rect.x >= 0 && rect.y >= 0 && rect.x+rect.width <= width+1 && rect.y+rect.height <= height+1,
      `${width}×${height}: panel must fit inside the viewport`);
    const anchor = await trigger().boundingBox();
    check(Math.abs(rect.x-anchor.x) < 2 && rect.y >= anchor.y+anchor.height,
      `${width}×${height}: panel must anchor below the account trigger`);
    for (const button of await panel().getByRole('button').all()) {
      await button.scrollIntoViewIfNeeded();
      check(await button.evaluate(el => {
        const r=el.getBoundingClientRect();
        const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
        return r.width>=24 && r.height>=24 && r.x>=0 && r.y>=0 && r.right<=innerWidth+1
          && r.bottom<=innerHeight+1 && el.contains(hit);
      }), `${width}×${height}: account control must remain reachable: ${await button.textContent()}`);
    }
    await page.keyboard.press('Escape');
  }
  await page.setViewportSize({width:1280,height:720});
  // Mock only the persistence boundary; interactions use real rendered React.
  await page.evaluate(async () => {
    const {bridge} = await import('/src/bridge/bridge.ts');
    const original = bridge.selectAccount;
    window.__accountTest = {calls: [], fail: false};
    bridge.selectAccount = async id => {
      window.__accountTest.calls.push(id);
      await new Promise(resolve => { window.__accountTest.release = resolve; });
      if (window.__accountTest.fail) throw new Error('Catalog write failed');
      return original(id);
    };
  });
  await open();
  const other = panel().locator('[data-opus-account-id="offline:opus"]');
  await other.click();
  check(await other.isDisabled(), 'Selecting must disable duplicate submission immediately');
  check(await panel().getByRole('status').textContent().then(text => text.includes('Saving')),
    'Pending selection must be explained inline');
  await page.evaluate(() => window.__accountTest.release());
  await page.waitForFunction(() => document.querySelector('[data-opus-account-id="offline:opus"]')?.getAttribute('aria-pressed') === 'true');
  check(await page.evaluate(() => window.__accountTest.calls.length) === 1, 'One click must send one exact account id');
  check(await trigger().textContent().then(text => text.includes('zvwgvx')), 'Next-launch selection must not impersonate the active session');
  check(await panel().getByRole('status').textContent().then(text => text.includes('opus_') && text.includes('next launch')),
    'Success must name the selected account and next-launch scope');
  await panel().getByRole('button', {name: 'Manage Accounts', exact: true}).click();
  await page.locator('[data-opus-route="accounts"]').waitFor();
  check(await page.locator('[data-opus-account-current]').textContent().then(text => text.includes('zvwgvx')),
    'Manager must distinguish the active session from next-launch selection');
  await page.evaluate(() => {window.__accountTest.fail = true;});
  await page.locator('[data-opus-account-id="microsoft:zvwgvx"]').click();
  await page.evaluate(() => window.__accountTest.release());
  await page.getByRole('alert').waitFor();
  check(await page.locator('[data-opus-account-id="offline:opus"]').getAttribute('aria-pressed') === 'true',
    'A failed write must preserve the last selected account');
  await page.getByRole('button', {name: 'Add account', exact: true}).click();
  await page.getByRole('heading', {name: 'Add in Opus Launcher', exact: true}).waitFor();
  check(await page.getByText('Your current game session stays unchanged.', {exact:true}).count() === 1,
    'Add must explicitly delegate sign-in to Launcher, not fake an in-game switch');
  await page.getByRole('button', {name:'Back to accounts', exact:true}).click();
  await page.getByRole('button', {name:'Back', exact:true}).click();
  await open();
  await panel().getByRole('button', {name: 'Account Settings', exact: true}).click();
  await page.getByRole('heading', {name: 'Account Settings', exact:true}).waitFor();
  check(await page.locator('[data-opus-account-current]').textContent().then(text => text.includes('zvwgvx')),
    'Account Settings must describe the actual current session');
  return 'Account menu contract PASS: same-document popover, literal identity, keyboard/dismissal, 5 sizes, async selection/failure, manager/settings/Launcher add flow';
}
