import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectPage, waitFor, sleep } from './cdp.mjs';

// Diagnostic only: private tileset statistics are never used by product code.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const page = await connectPage({ fresh: true });
try {
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1700, height: 1120, deviceScaleFactor: 1, mobile: false });
  await page.send('Page.navigate', { url: 'http://localhost:5173/' });
  if (!await waitFor(page, `document.querySelector('#scene')?.classList.contains('map-ready') && !document.querySelector('#compare-toggle').disabled`, 55000)) throw new Error('Map unavailable');
  await page.evaluate(`document.querySelector('#compare-toggle').click();document.querySelector('#lab-default').click()`);
  const results = [];
  for (const mode of ['all', 'lod4']) {
    await page.evaluate(`(()=>{const s=document.querySelector('#lab-buildings');s.value='${mode}';s.dispatchEvent(new Event('change'));const p=document.querySelector('#lab-progress');p.value=0;p.dispatchEvent(new Event('input'));})()`);
    await waitFor(page, `document.querySelector('#map-frame').contentWindow.ws3d.viewer.scene.globe.tilesLoaded`, 20000);
    await sleep(4000);
    const snapshot = await page.evaluate(`(()=>{const w=document.querySelector('#map-frame').contentWindow,v=w.ws3d.viewer;const c=v.camera.positionCartographic;const id='${mode}'==='all'?'facility_build_all':'facility_build';const l=v.map.getElementById(id),s=l?._tileset?._statistics;return {mode:'${mode}',longitude:w.Cesium.Math.toDegrees(c.longitude),latitude:w.Cesium.Math.toDegrees(c.latitude),altitude:c.height,pitch:w.Cesium.Math.toDegrees(v.camera.pitch),fov:w.Cesium.Math.toDegrees(v.camera.frustum.fov),layerVisible:l.visible,tilesLoaded:l?._tileset?.tilesLoaded,selectedFeatures:s?.numberOfFeaturesSelected,selectedTiles:s?.selected};})()`);
    results.push(snapshot);
    const clip = await page.evaluate(`(()=>{const r=document.querySelector('#scene').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,scale:1}})()`);
    const image = await page.send('Page.captureScreenshot', { format: 'png', clip });
    await writeFile(path.join(root, `tmp/journey-focus-layer-${mode}.png`), Buffer.from(image.data, 'base64'));
  }
  await page.evaluate(`document.querySelector('#lab-default').click()`);
  await mkdir('docs', { recursive: true });
  await writeFile('docs/layer-investigation.json', JSON.stringify({ dateKST: '2026-11-03', note: 'One camera viewpoint near Baegyang-ri. Selected feature count is a private SDK diagnostic, not a building census or proof of complete regional coverage.', results }, null, 2));
  console.log(JSON.stringify({ results, pageErrorCount: page.errors.length }));
} catch (error) { console.log(JSON.stringify({ error: error.message })); process.exitCode = 1; }
finally { page.close(); }
