import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectPage, sleep, waitFor } from './cdp.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const secrets = (await readFile(path.join(root, '.env.local'), 'utf8')).split(/\r?\n/).filter(s => /API_KEY\s*=/.test(s)).map(s => s.slice(s.indexOf('=') + 1).trim()).filter(Boolean);
function print(data) {
  let text = JSON.stringify(data);
  for (const secret of secrets) text = text.replaceAll(secret, '[REDACTED]');
  text = text.replace(/(?:apiKey|apikey|key)=[^&\s"<>]+/gi, 'key=[REDACTED]');
  console.log(text);
}
const page = await connectPage({ fresh: true });
try {
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1080, deviceScaleFactor: 1, mobile: false });
  await page.send('Page.navigate', { url: 'http://localhost:5173/' });
  const ready = await waitFor(page, `document.querySelector('#scene')?.classList.contains('map-ready') && !document.querySelector('#start').disabled`, 55000);
  const snapshot = await page.evaluate(`(() => { const f = document.querySelector('#map-frame'); return { title: document.title, stations: document.querySelector('#from')?.options.length, mapReady: document.querySelector('#scene')?.classList.contains('map-ready'), mapStatus: document.querySelector('#map-status')?.textContent, mapDetail: document.querySelector('#map-detail')?.textContent, vworldValid: f?.contentWindow?.vworldIsValid, vwLoaded: Boolean(f?.contentWindow?.vw), cesiumLoaded: Boolean(f?.contentWindow?.Cesium), viewerLoaded: Boolean(f?.contentWindow?.ws3d?.viewer), canvasCount: f?.contentDocument?.querySelectorAll('canvas').length, bodyOverflow: document.documentElement.scrollWidth > innerWidth, fps: document.querySelector('#fps-label')?.textContent }; })()`);
  print({ phase: 'initial', ready, snapshot, errors: page.errors.slice(0, 8) });
  await page.screenshot(path.join(root, 'tmp/journey-focus-desktop.png'));
  assert.ok(ready, 'Real map must initialize before interaction tests');
  assert.ok(await page.evaluate(`document.querySelector('#route-summary').textContent.includes('OSM')`), 'Default route uses OSM rail geometry');
  const audioSilenced = await page.evaluate(`(async () => { const { TrainAudio } = await import('/audio.mjs'); const a = new TrainAudio(() => 0.15); a.setActive(true); await a.toggle(); await new Promise(r => setTimeout(r, 400)); const silent = a.gain.gain.value === 0; await a.context.close(); return silent; })()`);
  assert.ok(audioSilenced, 'Audio silences on its own timeline at the deadline');
  await page.evaluate(`document.querySelector('[data-duration="60"]').click(); document.querySelector('#start').click()`);
  await sleep(2200);
  await page.evaluate(`document.querySelector('#pause').click()`);
  const paused = await page.evaluate(`document.querySelector('#timer').textContent`);
  await sleep(1600);
  assert.equal(await page.evaluate(`document.querySelector('#timer').textContent`), paused, 'Timer stays still while paused');
  assert.equal(await page.evaluate(`document.querySelector('#from').disabled`), true);
  await page.evaluate(`document.querySelector('#pause').click()`);
  await sleep(1200);
  await page.evaluate(`document.querySelector('#stop').click()`);
  assert.equal(await page.evaluate(`document.querySelector('#info-dialog').open`), true);
  assert.ok(await page.evaluate(`Number(document.querySelector('#history-count').textContent) > 0`));
  await page.evaluate(`document.querySelector('#dialog-close').click(); document.querySelector('[data-duration="300"]').click()`);
  await sleep(500);
  assert.equal(await page.evaluate(`document.querySelector('#timer').textContent`), '05:00', 'Choosing a new duration clears the old stopped timer');
  if (process.argv.includes('--complete')) {
    await page.evaluate(`document.querySelector('[data-duration="60"]').click(); document.querySelector('#start').click()`);
    let backgroundTarget;
    if (process.argv.includes('--background')) {
      backgroundTarget = (await page.send('Target.createTarget', { url: 'about:blank' })).targetId;
      await page.send('Target.activateTarget', { targetId: backgroundTarget });
      print({ phase: 'background', hidden: await page.evaluate('document.hidden') });
    }
    print({ phase: 'completion', message: 'Waiting for a real 60-second session.' });
    assert.ok(await waitFor(page, `document.querySelector('#info-dialog').open`, 65000));
    assert.equal(await page.evaluate(`document.querySelector('#timer').textContent`), '00:00');
    assert.equal(await page.evaluate(`document.querySelector('#dialog-eyebrow').textContent`), 'JOURNEY COMPLETE');
    if (backgroundTarget) {
      assert.equal(await page.evaluate('document.hidden'), true, 'Completion was processed while the app tab stayed hidden');
      await page.send('Target.closeTarget', { targetId: backgroundTarget });
    }
    await page.evaluate(`document.querySelector('#dialog-close').click()`);
    print({ phase: 'completion', passed: true });
  }
  await page.evaluate(`document.querySelector('#overview-view').click(); document.querySelector('#focus-button').click()`);
  assert.equal(await page.evaluate(`document.body.classList.contains('focus-mode')`), true);
  await page.evaluate(`document.querySelector('#focus-button').click(); document.querySelector('#window-view').click()`);
  await page.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await sleep(500);
  assert.equal(await page.evaluate(`document.documentElement.scrollWidth > innerWidth`), false, 'Mobile layout does not overflow');
  await page.screenshot(path.join(root, 'tmp/journey-focus-mobile.png'));
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1080, deviceScaleFactor: 1, mobile: false });
  await page.evaluate(`document.querySelector('[data-duration="1500"]').click()`);
  await waitFor(page, `document.querySelector('#map-frame').contentWindow.ws3d.viewer.scene.globe.tilesLoaded`, 25000);
  await page.screenshot(path.join(root, 'tmp/journey-focus-desktop.png'));
  print({ phase: 'interactions', passed: ['start', 'pause', 'resume', 'stop', 'history', 'view switch', 'focus mode', 'mobile overflow'], errors: page.errors.slice(-8) });
} catch (error) { print({ failed: error.message, errors: page.errors.slice(-10) }); process.exitCode = 1; }
finally { page.close(); }
