const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || 'playwright');

(async () => {
  const root = __dirname;
  const url = pathToFileURL(path.join(root, 'settings-preview.html')).href;
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.setOffline(true);
  const page = await context.newPage();
  const failures = [], requests = [], checks = [];
  page.on('pageerror', e => failures.push(e.message));
  page.on('request', r => { if (/^https?:/.test(r.url())) requests.push(r.url()); });
  await page.addInitScript(() => {
    window.__sensitiveAccess = [];
    for (const key of ['localStorage', 'sessionStorage', 'indexedDB', 'caches']) {
      Object.defineProperty(window, key, { get() { window.__sensitiveAccess.push(key); throw Error('Preview accessed ' + key); } });
    }
  });
  await page.goto(url);
  await page.locator('[data-action="preferences"]').waitFor();
  assert.equal(await page.title(), 'Clover · Settings design preview');
  checks.push('Loads from a local file with the browser offline');
  const apps = ['inspections','prospects','review','rental','service','intelligence','costs','routes'];
  for (const app of apps) {
    await page.selectOption('#appSelect', app);
    for (const persona of ['kevin','team','management']) {
      await page.selectOption('#personaSelect', persona);
      assert.equal(await page.locator('[data-action="usage"]').count(), persona === 'kevin' ? 1 : 0, app + ' usage visibility');
      assert.equal(await page.locator('[data-action="testing"]').count(), persona === 'kevin' && app === 'prospects' ? 1 : 0, app + ' testing visibility');
      await page.locator('[data-action="account"]').click();
      assert.equal(await page.locator('[data-action="device"]').count(), 1);
      await page.locator('[data-action="back"]').click();
    }
  }
  checks.push('All eight menus and three sample personas; Kevin-only usage and test controls');
  await page.selectOption('#appSelect','inspections');
  await page.selectOption('#personaSelect','kevin');
  await page.locator('[data-action="storage"]').click();
  assert.match(await page.locator('#content').innerText(), /no server sync/);
  assert.match(await page.locator('#content').innerText(), /photos and videos excluded/);
  await page.locator('[data-action="clear-cache"]').click();
  assert.match(await page.locator('#dialogCopy').innerText(), /pending edits/);
  await page.locator('#dialogConfirm').click();
  assert.match(await page.locator('.legend').innerText(), /Cache: 0 MB/);
  assert.equal(await page.locator('.line-item').first().innerText(), 'Pending local changes\n2');
  checks.push('Sample cache action preserves pending edits and states Inspection media backup limits');
  await page.selectOption('#appSelect','routes');
  await page.locator('[data-action="preferences"]').click();
  await page.selectOption('#zone','manual');
  await page.selectOption('#manualZone','America/Chicago');
  await page.selectOption('#language','es');
  assert.equal(await page.locator('#pageTitle').innerText(), 'Preferencias');
  assert.equal(await page.locator('#manualZone').inputValue(),'America/Chicago');
  await page.selectOption('#appearance','light');
  assert.equal(await page.locator('body').getAttribute('data-theme'),'light');
  await page.selectOption('#language','en');
  await page.selectOption('#appearance','dark');
  checks.push('English/Spanish, light/dark and manual timezone interactions');
  await page.selectOption('#appSelect','prospects');
  await page.locator('[data-action="home"]').click();
  await page.locator('[data-action="management"]').click();
  await page.locator('[data-toggle="Jacqui"][data-value="yes"]').click();
  assert.equal(await page.locator('[data-toggle="Jacqui"][data-value="yes"]').getAttribute('aria-pressed'),'true');
  await page.selectOption('#personaSelect','team');
  await page.locator('[data-action="home"]').click();
  assert.equal(await page.locator('[data-action="management"]').count(),0);
  checks.push('Management allocation is outside Settings; team persona cannot open it');
  await page.selectOption('#appSelect','inspections');
  await page.selectOption('#personaSelect','kevin');
  await page.locator('[data-action="usage"]').click();
  const all = await page.locator('.stats-grid .stat strong').first().innerText();
  await page.selectOption('#reportUser','team');
  const team = await page.locator('.stats-grid .stat strong').first().innerText();
  assert.notEqual(all,team);
  checks.push('Usage starts with all users and filters illustrative values');
  await page.selectOption('#period','30');
  await page.locator('[data-action="usage-export"]').click();
  await page.locator('[data-action="preview-report"]').click();
  const report=JSON.parse(await page.locator('#reportJson').inputValue());
  assert.equal(report.data_mode,'sample');
  assert.equal(report.app.id,'inspections');
  assert.equal(report.scope.period_days,30);
  assert.equal(report.scope.user_filter,'team');
  assert.equal(report.scope.includes_all_users,false);
  assert.equal(report.summary[0].value,15);
  assert.equal(report.coverage.status,'not_connected');
  assert.equal(report.completion.rate,null);
  assert.equal(report.app.app_version,null);
  assert.deepEqual(report.events,[]);
  await page.locator('[data-action="back"]').click();
  assert.equal(await page.locator('#pageTitle').innerText(),'Usage & usability');
  checks.push('Sample export honors app, period and user filters; unknown coverage and rates remain null');
  for (const width of [320,390,768]) {
    await page.setViewportSize({width,height:844});
    for (const lang of ['en','es']) {
      await page.selectOption('#appSelect','routes');
      await page.locator('[data-action="preferences"]').click();
      await page.selectOption('#language',lang);
      await page.locator('[data-action="back"]').click();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),true, 'page overflow '+width+' '+lang);
      assert.equal(await page.evaluate(() => { const p=document.getElementById('content'); return p.scrollWidth <= p.clientWidth; }),true,'content overflow '+width+' '+lang);
      const close=await page.locator('[data-action="home"]').boundingBox();
      assert.ok(close && close.x>=0 && close.x+close.width<=width);
    }
  }
  checks.push('320, 390 and 768 px: English/Spanish layouts have no horizontal overflow and close remains reachable');
  await page.setViewportSize({width:390,height:844});
  await page.selectOption('#appSelect','inspections');
  await page.locator('[data-action="preferences"]').click();
  await page.selectOption('#language','en');
  await page.locator('[data-action="back"]').click();
  const qa=path.join(root,'qa');fs.mkdirSync(qa,{recursive:true});
  await page.screenshot({path:path.join(qa,'inspection-settings-dark.png')});
  await page.locator('[data-action="usage"]').click();
  await page.screenshot({path:path.join(qa,'inspection-usage-dark.png')});
  assert.deepEqual(failures,[],'browser errors');
  assert.deepEqual(requests,[],'network requests');
  assert.deepEqual(await page.evaluate(()=>window.__sensitiveAccess),[],'production storage reads/writes');
  checks.push('No browser errors, HTTP requests or sensitive storage access');
  const inline=fs.readFileSync(path.join(root,'settings-preview-inline.html'),'utf8');
  const inlinePage=await context.newPage();
  inlinePage.on('pageerror',e=>failures.push(e.message));
  inlinePage.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
  for(const hostTheme of ['dark','light']){
    const hostColor=hostTheme==='dark'?'#eeeeee':'#222222';
    await inlinePage.setContent(`<!doctype html><html style="color-scheme:${hostTheme}"><head><style>body{margin:0;color:${hostColor}}h1,h2,h3,label,select{color:${hostColor};-webkit-text-fill-color:${hostColor}}</style></head><body>${inline}</body></html>`);
    await inlinePage.locator('[data-action="preferences"]').click();
    for(const theme of ['light','dark']){
      await inlinePage.selectOption('#appearance',theme);
      const low=await inlinePage.evaluate(()=>{
        const luminance=c=>{const rgb=c.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4});return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2]};
        return [...document.querySelectorAll('#pageTitle,.form-field>span,.form-field>small,.form-field>select')].map(el=>{
          const style=getComputedStyle(el);let bg=style.backgroundColor,p=el;
          while(bg==='rgba(0, 0, 0, 0)'&&p.parentElement){p=p.parentElement;bg=getComputedStyle(p).backgroundColor}
          const text=luminance(style.webkitTextFillColor||style.color),back=luminance(bg);
          return {label:el.textContent.slice(0,60),contrast:(Math.max(text,back)+.05)/(Math.min(text,back)+.05)};
        }).filter(x=>x.contrast<4.5);
      });
      assert.deepEqual(low,[],'Inline contrast: host '+hostTheme+', app '+theme);
    }
  }
  await inlinePage.selectOption('#appearance','light');
  await inlinePage.screenshot({path:path.join(qa,'inline-preferences-light.png'),fullPage:true});
  await inlinePage.locator('[data-action="back"]').click();
  await inlinePage.locator('[data-action="usage"]').click();
  await inlinePage.locator('[data-action="usage-export"]').click();
  await inlinePage.locator('[data-action="preview-report"]').click();
  const inlineReport=JSON.parse(await inlinePage.locator('#reportJson').inputValue());
  assert.equal(inlineReport.scope.includes_all_users,true);
  assert.equal(inlineReport.data_mode,'sample');
  await inlinePage.setViewportSize({width:320,height:844});
  assert.equal(await inlinePage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Inline export fits 320px');
  await inlinePage.setViewportSize({width:390,height:844});
  await inlinePage.screenshot({path:path.join(qa,'inline-usage-export-light.png'),fullPage:true});
  await inlinePage.selectOption('#personaSelect','team');
  assert.equal(await inlinePage.locator('[data-action="usage"]').count(),0);
  assert.equal(await inlinePage.locator('[data-action="usage-export"]').count(),0);
  assert.deepEqual(failures,[],'all browser errors');
  assert.deepEqual(requests,[],'all network requests');
  checks.push('Inline light/dark text contrasts >=4.5 in both host themes, including text-fill inheritance');
  checks.push('Inline sample export is readable at 320px and stays hidden from the team persona');
  fs.writeFileSync(path.join(qa,'verification.json'),JSON.stringify({preview:'0.1.2',engine:'Chromium',checks,status:'passed',limitations:['Sample visibility is not backend authorization','Local file and simulated host preview; not an iPhone installed-PWA test','No live account, reports or inspection workflows changed']},null,2)+'\n');
  console.log(JSON.stringify({status:'passed',checks},null,2));
  await browser.close();
})().catch(error=>{console.error(error);process.exit(1)});
