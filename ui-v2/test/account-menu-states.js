// Rendered edge states with isolated, in-memory bridge fixtures only.
async (page) => {
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  const base = 'http://127.0.0.1:5174/';
  const errors = [];
  const onError = error => errors.push(error.message);
  page.on('pageerror', onError);
  try {
    await page.setViewportSize({width:1280,height:720});
    await page.goto(`${base}#/title`);
    await page.reload();
    await page.getByRole('button', {name:'Account: zvwgvx',exact:true}).waitFor();
    await page.locator('[data-opus-home-action="accounts"]').click();
    await page.getByRole('button', {name:'Manage Accounts',exact:true}).click();
    await page.evaluate(async () => {
      const {bridge}=await import('/src/bridge/bridge.ts');
      window.__accountsFixture=[];
      window.__accountsReadFails=false;
      bridge.getAccounts=async () => {
        if(window.__accountsReadFails) throw new Error('Fixture catalog unavailable');
        return window.__accountsFixture;
      };
    });
    await page.getByRole('button', {name:'Refresh',exact:true}).click();
    await page.getByText('No saved accounts. Add one in Opus Launcher, then refresh this list.',{exact:true}).waitFor();
    await page.getByRole('button', {name:'Back',exact:true}).click();
    await page.locator('[data-opus-home-action="accounts"]').click();
    await page.getByText('No other accounts yet. Add one in Opus Launcher.',{exact:true}).waitFor();
    check(await page.locator('.home__profile-name').textContent()==='zvwgvx', 'An empty catalog must keep the live session IGN');
    await page.keyboard.press('Escape');
    await page.locator('[data-opus-home-action="accounts"]').click();
    await page.getByRole('button', {name:'Manage Accounts',exact:true}).click();
    await page.evaluate(() => {
      window.__accountsFixture=[{id:'lower',username:'zvwgvx',kind:'microsoft',badge:'official',current:true,selected:true}];
    });
    await page.getByRole('button',{name:'Refresh',exact:true}).click();
    await page.locator('[data-opus-account-id="lower"]').waitFor();
    check(await page.locator('[data-opus-account-id]').count()===1,'Single-account manager must show exactly one account');
    await page.evaluate(() => {
      window.__accountsFixture=Array.from({length:9},(_,i)=>({id:`fixture:${i}`,username:i===0?'Zvwgvx':`Profile_${i}_abcxyz`,
        kind:'offline',badge:'unofficial',current:false,selected:i===0}));
    });
    await page.getByRole('button',{name:'Refresh',exact:true}).click();
    await page.locator('[data-opus-account-id="fixture:8"]').waitFor();
    await page.getByRole('button',{name:'Back',exact:true}).click();
    await page.setViewportSize({width:427,height:240});
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.locator('[data-opus-home-action="accounts"]').click();
    const panel=page.getByRole('dialog',{name:'Account menu',exact:true});
    check(await page.locator('.home__profile-name').textContent()==='zvwgvx','A differently-cased next-launch IGN must not rename the current session');
    check(await panel.locator('[data-opus-account-id="fixture:0"] .account-ign').textContent()==='Zvwgvx','Stored mixed-case IGN must remain literal');
    await panel.locator('[data-opus-account-id="fixture:8"]').scrollIntoViewIfNeeded();
    check(await panel.locator('[data-opus-account-id="fixture:8"]').evaluate(el=>{
      const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));
    }), 'A long account list must scroll under the pinned footer, not behind it');
    await page.evaluate(async()=>{const {bridge}=await import('/src/bridge/bridge.ts');bridge.selectAccount=async()=>{throw new Error('Fixture selection failed');};});
    await panel.locator('[data-opus-account-id="fixture:8"]').click();
    await panel.getByRole('alert').waitFor();
    check(await panel.locator('[data-opus-account-id="fixture:0"]').getAttribute('aria-pressed')==='true','Failed popover selection must preserve the previous selection');
    await panel.getByRole('button',{name:'Manage Accounts',exact:true}).click();
    await page.setViewportSize({width:1280,height:720});
    await page.evaluate(()=>{window.__accountsReadFails=true;});
    await page.getByRole('button',{name:'Refresh',exact:true}).click();
    await page.getByRole('alert').waitFor();
    check(await page.locator('[data-opus-account-id]').count()===9,'A failed refresh must retain the last list');
    await page.getByRole('button',{name:'Add account',exact:true}).click();
    await page.getByRole('heading',{name:'Add in Opus Launcher',exact:true}).waitFor();
    await page.keyboard.press('Escape');
    await page.getByRole('heading',{name:'Accounts',exact:true}).waitFor();
    check(page.url().endsWith('#/accounts'),'Escape from the add guide must return to accounts, not skip to Home');
    check(errors.length===0,`Account flows must not throw uncaught errors: ${errors}`);
    return 'Account state contract PASS: empty/single/9 accounts, case-distinct identity, compact scroll/footer, reduced motion, failed selection/refresh, add Escape, no page errors';
  } finally {page.off('pageerror',onError); await page.emulateMedia({reducedMotion:'no-preference'});}
}
