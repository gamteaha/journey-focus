import {connectPage, sleep} from './cdp.mjs';
import {mkdir, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const out = new URL('../../../tmp/building-layer-check/', import.meta.url);
await mkdir(out, {recursive:true});
const p = await connectPage();
const results=[];
try {
  await p.evaluate(`(()=>{const f=document.querySelector('#map-frame');f.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;z-index:99999';f.contentWindow.postMessage({type:'jf:position',position:{lon:127.5891698,lat:37.8307979,heading:115},snap:true},location.origin)})()`);
  await sleep(3000);
  for (const [name, selected] of Object.entries({all:['facility_build_all'],lod3:['facility_build_lod3'],lod4:['facility_build'],lod34:['facility_build_lod3','facility_build']})) {
    await p.evaluate(`(()=>{const v=document.querySelector('#map-frame').contentWindow.ws3d.viewer;for(const id of ['facility_build_all','facility_build_lod1','facility_build_lod2','facility_build_lod3','facility_build']){const layer=v.map.getElementById(id);if(layer){if(${JSON.stringify(selected)}.includes(id))layer.show();else layer.hide();}}v.scene.requestRender();})()`);
    await sleep(10000);
    const state=await p.evaluate(`(()=>{const v=document.querySelector('#map-frame').contentWindow.ws3d.viewer;return {layers:['facility_build_all','facility_build_lod1','facility_build_lod2','facility_build_lod3','facility_build'].map(id=>({id,visible:v.map.getElementById(id)?.visible})),camera:{longitude:v.camera.positionCartographic.longitude,latitude:v.camera.positionCartographic.latitude,height:v.camera.positionCartographic.height},terrainLoaded:v.scene.globe.tilesLoaded}})()`);
    await p.screenshot(fileURLToPath(new URL(name+'.png',out)));
    results.push({name,...state});
    console.log(JSON.stringify({name,...state}));
  }
} finally {
  await p.evaluate(`(()=>{const f=document.querySelector('#map-frame');f.style.cssText='';f.contentWindow.postMessage({type:'jf:visual',settings:{height:30,pitch:-4,heading:-90,fov:65,buildings:'all'}},location.origin);const v=f.contentWindow.ws3d.viewer;for(const id of ['facility_build_lod3','facility_build'])v.map.getElementById(id)?.hide();v.map.getElementById('facility_build_all')?.show();})()`).catch(()=>{});
  p.close();
  await writeFile(new URL('results.json',out),JSON.stringify(results,null,2));
}
