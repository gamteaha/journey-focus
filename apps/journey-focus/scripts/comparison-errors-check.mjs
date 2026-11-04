import assert from 'node:assert/strict';
import { connectPage, waitFor } from './cdp.mjs';
const page = await connectPage({ fresh: true });
try {
  await page.send('Page.navigate', { url: 'http://localhost:5173/' });
  assert.ok(await waitFor(page, `!document.querySelector('#compare-toggle')?.disabled && document.querySelector('#scene')?.classList.contains('map-ready')`, 55000));
  await page.evaluate(`document.querySelector('#start').click();document.querySelector('#compare-toggle').click();document.querySelector('#stop').click();document.querySelector('#dialog-close').click()`);
  assert.ok(await page.evaluate(`document.body.classList.contains('comparison-active')`));
  assert.equal(await page.evaluate(`document.querySelector('#map-frame').contentWindow.ws3d.viewer.scene.screenSpaceCameraController.enableInputs`), false, 'Stopping a session preserves comparison camera lock');
  // Drop only the ready notification around the real player to reproduce an
  // initialization timeout after an iframe exists. No production test hook.
  await page.evaluate(`new Promise((resolve,reject)=>{if(window.YT?.Player){resolve();return;}const s=document.createElement('script');s.src='https://www.youtube.com/iframe_api';window.onYouTubeIframeAPIReady=resolve;s.onerror=reject;document.head.append(s);})`);
  await page.evaluate(`window.qaOriginalPlayer=YT.Player;YT.Player=function(id,options){return new window.qaOriginalPlayer(id,{...options,events:{...options.events,onReady:()=>{}}});}`);
  await page.evaluate(`document.querySelector('#load-reference').click()`);
  assert.ok(await waitFor(page, `!document.querySelector('#video-placeholder').hidden && !document.querySelector('#load-reference').disabled && document.querySelector('#reference-status').textContent.includes('연결하지')`, 25000), 'Blocked player restores the retry UI');
  assert.equal(await page.evaluate(`Boolean(document.querySelector('iframe#reference-player'))`), false);
  await page.evaluate(`YT.Player=window.qaOriginalPlayer;delete window.qaOriginalPlayer`);
  await page.evaluate(`document.querySelector('#load-reference').click()`);
  assert.ok(await waitFor(page, `Boolean(document.querySelector('iframe#reference-player'))`, 10000), 'Retry creates a new player after failure');
  assert.ok(await waitFor(page, `!document.querySelector('#read-reference-time').disabled`, 15000), 'Retried real player reaches ready state');
  console.log(JSON.stringify({ passed: ['stop preserves comparison lock', 'player timeout fallback', 'player retry reaches ready'], pageErrorCount: page.errors.length }));
} catch (error) { console.log(JSON.stringify({ failed: error.message, state: await page.evaluate(`({message:document.querySelector('#reference-status').textContent,placeholderHidden:document.querySelector('#video-placeholder').hidden,loadDisabled:document.querySelector('#load-reference').disabled,iframe:!!document.querySelector('iframe#reference-player')})`).catch(()=>null) })); process.exitCode = 1; }
finally { page.close(); }
