// Set NEUROSCAN_PLAYWRIGHT_MODULE if Playwright is installed outside this project.
const { chromium } = require(process.env.NEUROSCAN_PLAYWRIGHT_MODULE || 'playwright');
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const report = { uploads: [], errors: [], checks: [] };
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: [
    '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
    `--use-file-for-fake-audio-capture=${path.join(root,'test_samples/healthy_voice_1.wav')}`,
  ] });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ['microphone'] });
    for (const [route,kind,button,extension,endpoint] of [
      ['spiral','spiral','Submit Image','png','drawing'],
      ['wave','wave','Submit Image','png','wave'],
      ['voice','voice','Analyze Voice','wav','voice'],
    ]) {
      const page = await context.newPage();
      page.on('pageerror', error => report.errors.push(error.message));
      await page.goto(`http://localhost:5173/${route}`);
      const classes = new Set();
      for (const label of ['healthy','parkinson']) {
        for (const number of [1,2]) {
          const sample = `${label}_${kind}_${number}.${extension}`;
          await page.locator('input[type=file]').setInputFiles(path.join(root,'test_samples',sample));
          const responsePromise = page.waitForResponse(res => res.url().endsWith(`/predict/${endpoint}`));
          await page.getByRole('button',{name:button,exact:true}).click();
          const response = await responsePromise;
          const result = await response.json();
          assert.equal(response.status(),200,JSON.stringify(result));
          await page.locator('.result-card').waitFor({state:'visible'});
          await page.waitForTimeout(1150);
          const text = await page.locator('.result-card').innerText();
          assert.ok(text.toLowerCase().includes(result.prediction.toLowerCase()));
          assert.ok(text.includes((result.confidence*100).toFixed(1)+'%'));
          assert.equal(await page.locator('.analysis-error').count(),0);
          classes.add(result.status);
          report.uploads.push({sample,...result,dataset_label:label});
          if (label==='healthy' && number===1) await page.screenshot({path:path.join(root,'reports',`${route}-working.png`),fullPage:true});
          // Resubmit the same file with an existing result, then clear it.
          if (label==='healthy' && number===1) {
            const repeat = page.waitForResponse(res=>res.url().endsWith(`/predict/${endpoint}`));
            await page.getByRole('button',{name:button,exact:true}).click();
            assert.equal((await repeat).status(),200);
            await page.waitForTimeout(300);
          }
          await page.getByRole('button',{name:'Clear',exact:true}).click();
          assert.equal(await page.locator('.result-card').count(),0);
        }
      }
      assert.equal(classes.size,2,`${kind} must produce both classifications`);
      report.checks.push(`${kind}: initial upload, existing-result resubmit, clear, both classes rendered`);
      if (route==='spiral') {
        await page.route('**/predict/drawing',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({detail:'The spiral model is unavailable.'})}));
        await page.locator('input[type=file]').setInputFiles(path.join(root,'test_samples/healthy_spiral_1.png'));
        await page.getByRole('button',{name:button,exact:true}).click();
        await page.getByRole('alert').filter({hasText:'The spiral model is unavailable.'}).waitFor();
        assert.equal(await page.locator('.result-card').count(),0);
        assert.ok(await page.getByRole('heading',{name:'Spiral Drawing Test'}).isVisible());
        report.checks.push('Missing-model response displays an inline error with no fabricated result');
      }
      if (route==='voice') {
        await page.getByRole('button',{name:'Start Recording',exact:true}).click();
        await page.getByRole('button',{name:/Stop/}).waitFor();
        await page.getByText(/Recording ready \(10s\)/).waitFor({timeout:16000});
        const recordedResponse=page.waitForResponse(res=>res.url().endsWith('/predict/voice'));
        await page.getByRole('button',{name:'Analyze Voice',exact:true}).click();
        assert.equal((await recordedResponse).status(),200);
        await page.locator('.result-card').waitFor({state:'visible'});
        report.checks.push('Microphone capture with a synthetic browser device, 10-second automatic stop, WebM upload and real inference');
        await page.setViewportSize({width:390,height:844});
        await page.waitForTimeout(1500);
        await page.screenshot({path:path.join(root,'reports/voice-mobile.png'),fullPage:true});
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
        assert.ok(await page.locator('.nav-links').evaluate(element => element.getBoundingClientRect().right <= window.innerWidth));
        report.checks.push('Voice page fits a 390px mobile viewport');
      }
      await page.close();
    }
    const page=await context.newPage();
    page.on('pageerror',error=>report.errors.push(error.message));
    for (const route of ['/','/about']) { await page.goto('http://localhost:5173'+route); await page.waitForTimeout(500); }
    assert.equal(report.errors.length,0,JSON.stringify(report.errors));
    report.checks.push('No uncaught browser errors across all five pages');
  } finally {
    fs.writeFileSync(path.join(root,'reports/browser-check.json'),JSON.stringify(report,null,2));
    await browser.close();
  }
  console.log(JSON.stringify({uploads:report.uploads.length,checks:report.checks,errors:report.errors},null,2));
})().catch(error=>{console.error(error);process.exitCode=1});
