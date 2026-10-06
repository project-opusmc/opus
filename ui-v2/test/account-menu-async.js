// Real React interactions, isolated bridge/network fixtures. No user catalog writes.
async (page) => {
  const failures = [];
  const passed = [];
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  const row = id => page.locator(`[data-opus-account-id="${id}"]`);
  const panel = () => page.getByRole('dialog', {name:'Account menu', exact:true});
  const reset = async () => {
    await page.goto('http://127.0.0.1:5174/#/title');
    await page.reload();
    await page.setViewportSize({width:1280,height:720});
    await page.getByRole('button', {name:'Account: zvwgvx',exact:true}).waitFor();
  };
  const manage = async () => {
    await page.locator('[data-opus-home-action="accounts"]').click();
    await panel().getByRole('button', {name:'Manage Accounts',exact:true}).click();
    await page.getByRole('heading', {name:'Accounts',exact:true}).waitFor();
  };
  const idle = async () => {
    await page.waitForFunction(() => ![...document.querySelectorAll('.account-feedback')]
      .some(el => el.textContent.startsWith('Saving ')));
  };
  const run = async (name, test) => {
    try { await reset(); await test(); passed.push(name); }
    catch (error) { failures.push(`${name}: ${error.message}`); }
  };

  await run('Persisted selection with lost POST response', async () => {
    await page.evaluate(async () => {
      const {bridge} = await import('/src/bridge/bridge.ts');
      const write = bridge.selectAccount;
      const read = bridge.getAccounts;
      window.__accountAsync = {reads:0};
      bridge.selectAccount = async id => { await write(id); throw new Error('Response lost after persistence'); };
      bridge.getAccounts = async () => { window.__accountAsync.reads++; return read(); };
    });
    await manage();
    await row('offline:opus').click();
    await idle();
    check(await row('offline:opus').getAttribute('aria-pressed') === 'true',
      'Re-read persistence before presenting a selection result');
    check(await page.evaluate(() => window.__accountAsync.reads) === 1,
      'A failed POST requires one reconciliation GET');
    check((await page.getByRole('status').textContent()).includes('next launch'),
      'A confirmed persisted selection must explain next-launch scope');
    check((await page.locator('[data-opus-account-current]').textContent()).includes('zvwgvx'),
      'Reconciliation must not change the live session identity');
  });

  await run('Unconfirmed selection and explicit recovery', async () => {
    await page.evaluate(async () => {
      const {bridge} = await import('/src/bridge/bridge.ts');
      const write = bridge.selectAccount;
      const read = bridge.getAccounts;
      window.__accountAsync = {readFails:true};
      bridge.selectAccount = async id => { await write(id); throw new Error('Response lost'); };
      bridge.getAccounts = async () => {
        if (window.__accountAsync.readFails) throw new Error('Read unavailable');
        return read();
      };
    });
    await manage();
    await row('offline:opus').click();
    await idle();
    const message = await page.getByRole('alert').textContent();
    check(!message.includes('previous choice was kept') && message.includes('confirm') && message.includes('Refresh'),
      'Do not guarantee the previous saved choice when both responses failed');
    check(await page.locator('[data-opus-account-id][aria-pressed="true"]').count() === 0,
      'A last-read snapshot must not claim a confirmed next-launch selection');
    check(await row('offline:opus').isDisabled(), 'Prevent another selection until Refresh confirms persistence');
    await page.evaluate(() => {window.__accountAsync.readFails = false;});
    await page.getByRole('button', {name:'Refresh',exact:true}).click();
    await page.waitForFunction(() => document.querySelector('[data-opus-account-id="offline:opus"]')?.getAttribute('aria-pressed') === 'true');
  });

  await run('Keyboard focus during manager selection', async () => {
    await manage();
    await page.evaluate(async () => {
      const {bridge} = await import('/src/bridge/bridge.ts');
      const write = bridge.selectAccount;
      bridge.selectAccount = async id => {
        await new Promise(resolve => {window.__accountRelease = resolve;});
        return write(id);
      };
    });
    await row('offline:opus').focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('[data-opus-account-id="offline:opus"]')?.disabled);
    const stable = await page.locator('.accounts-page').evaluate(el => el.contains(document.activeElement)
      && !document.activeElement.matches(':disabled'));
    await page.evaluate(() => window.__accountRelease());
    await idle();
    check(stable, 'Move focus to a stable accounts element before disabling the activated row');
  });

  await run('Guide refresh focus and Escape', async () => {
    await manage();
    await page.getByRole('button', {name:'Add account',exact:true}).click();
    await page.evaluate(async () => {
      const {bridge} = await import('/src/bridge/bridge.ts');
      const read = bridge.getAccounts;
      bridge.getAccounts = async () => {
        await new Promise(resolve => {window.__accountRelease = resolve;});
        return read();
      };
    });
    await page.getByRole('button', {name:'Refresh accounts',exact:true}).focus();
    await page.keyboard.press('Enter');
    await page.getByRole('button', {name:'Refreshing…',exact:true}).waitFor();
    const stable = await page.locator('.accounts-page').evaluate(el => el.contains(document.activeElement)
      && !document.activeElement.matches(':disabled'));
    await page.keyboard.press('Escape');
    const keptAccounts = page.url().endsWith('#/accounts')
      && await page.getByRole('heading', {name:'Accounts',exact:true}).count() === 1;
    await page.evaluate(() => window.__accountRelease());
    check(stable, 'Move focus before disabling Refresh so Escape stays inside accounts');
    check(keptAccounts, 'Escape during guide Refresh must return to the account list, not skip to Home');
  });

  await run('Late Refresh preserves newer navigation', async () => {
    await manage();
    await page.evaluate(async () => {
      const {bridge} = await import('/src/bridge/bridge.ts');
      const read = bridge.getAccounts;
      bridge.getAccounts = async () => {
        await new Promise(resolve => {window.__accountRelease = resolve;});
        return read();
      };
    });
    await page.getByRole('button', {name:'Refresh',exact:true}).click();
    await page.getByRole('button', {name:'Add account',exact:true}).click();
    await page.getByRole('heading', {name:'Add in Opus Launcher',exact:true}).waitFor();
    await page.evaluate(() => window.__accountRelease());
    await page.getByText('Saved accounts refreshed.', {exact:true}).waitFor();
    check(await page.getByRole('heading', {name:'Add in Opus Launcher',exact:true}).count() === 1,
      'A delayed data response must not undo the user\'s newer Add navigation');
    check(await page.getByRole('heading', {name:'Add in Opus Launcher',exact:true})
      .evaluate(el => document.activeElement === el), 'Refresh completion must not steal guide focus');
  });

  // Initial effect uses the actual HTTP bridge against a fully intercepted,
  // closed fixture address. It never contacts or writes the user's accounts.
  const origin = 'http://127.0.0.1:55999';
  let catalogUnavailable = true;
  let navigation = {revision:1,current:{id:'title'},canGoBack:false,canCloseToGame:false};
  const handler = async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const headers = {'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'Content-Type',
      'Access-Control-Allow-Methods':'GET, POST, OPTIONS'};
    if (request.method() === 'OPTIONS') return route.fulfill({status:204,headers});
    let body;
    let status = 200;
    if (path === '/api/v1/client/accounts') {
      status=catalogUnavailable ? 503 : 200;
      body=catalogUnavailable ? {error:'Fixture account catalog unavailable'} : {accounts:[]};
    }
    else if (path === '/api/v1/client') body={version:'fixture',minecraft:'1.8.9',session:'zvwgvx',accountKind:'official'};
    else if (path === '/api/v1/client/ui-state') body=navigation;
    else if (path === '/api/v1/client/ui-actions') {
      const action = request.postDataJSON();
      navigation={...navigation,revision:navigation.revision+1,current:action.route,canGoBack:true};
      body=navigation;
    } else if (path.endsWith('/ui-state/ack')) return route.fulfill({status:204,headers});
    else if (path.endsWith('/worlds')) body={worlds:[]};
    else if (path.endsWith('/servers')) body={servers:[]};
    else if (path.endsWith('/modules')) body={modules:[]};
    else throw new Error(`Unexpected fixture request: ${path}`);
    return route.fulfill({status,headers,contentType:'application/json',body:JSON.stringify(body)});
  };
  await page.route(`${origin}/**`,handler);
  try {
    await page.goto('http://127.0.0.1:5174/?port=55999#/title');
    await page.getByRole('button', {name:'Account: zvwgvx',exact:true}).waitFor();
    await page.locator('[data-opus-home-action="accounts"]').click();
    await panel().getByRole('alert').waitFor();
    check(await panel().getByText('Saved accounts unavailable. Open Manage Accounts to refresh.',{exact:true}).count() === 1,
      'Show a concrete recovery path for the unread catalog');
    check(await page.getByText('No other accounts yet. Add one in Opus Launcher.',{exact:true}).count() === 0,
      'Unread catalog is unavailable, not an empty account list');
    await panel().getByRole('button', {name:'Account Settings',exact:true}).click();
    await page.getByRole('heading', {name:'Account Settings',exact:true}).waitFor();
    check(await page.getByText('Not selected',{exact:true}).count() === 0,
      'Unknown next-launch selection is not the same as Not selected');
    check(await page.getByText('Unavailable — refresh saved accounts',{exact:true}).count() === 1,
      'Account Settings must explain the unknown next-launch value');
    await page.getByRole('button', {name:'Manage Accounts',exact:true}).click();
    check(await page.getByText('Saved accounts unavailable. Refresh to try again.',{exact:true}).count() === 1,
      'The manager must retain the unread-catalog state');
    catalogUnavailable = false;
    await page.getByRole('button', {name:'Refresh',exact:true}).click();
    await page.getByText('No saved accounts. Add one in Opus Launcher, then refresh this list.',{exact:true}).waitFor();
    passed.push('Unavailable initial catalog');
  } catch (error) {failures.push(`Unavailable initial catalog: ${error.message}`);}
  finally {await page.unroute(`${origin}/**`,handler); await reset();}
  if (failures.length) throw new Error(`Account async regressions FAILED (${failures.length}):\n${failures.join('\n')}\nPassed: ${passed.join(', ')}`);
  return `Account async contract PASS: ${passed.join(', ')}`;
}
