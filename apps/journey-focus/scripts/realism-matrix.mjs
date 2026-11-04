import fs from 'node:fs/promises';
import {connectPage,waitFor,sleep} from './cdp.mjs';
import {buildRoute,positionAt} from '../src/route.mjs';
const frontRevision=process.argv.includes('--front-revision');
const out=frontRevision?'../../tmp/realism-comparison-front':'../../tmp/realism-comparison';await fs.mkdir(out,{recursive:true});
if(frontRevision)for(const file of ['01-original','02-grade','03-ao','07-ai-concept','08-pbr','09-ibl'])await fs.copyFile(`../../tmp/realism-comparison/${file}.png`,`${out}/${file}.png`);
const materialMode=process.argv.includes('--materials');
const iblOnly=process.argv.includes('--ibl-only');
const frontLight=process.argv.includes('--front-light');
const shape=JSON.parse(await fs.readFile('public/data/seongsu-konkuk.json','utf8'));
const route=buildRoute([{name:shape.from,...shape.points[0]},{name:shape.to,...shape.points.at(-1)}],shape.from,shape.to,shape);
const position=positionAt(route,.5);
const p=await connectPage({fresh:true});
try{
 await p.send('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});
 await p.send('Page.navigate',{url:'http://localhost:5173/map'});
 if(!await waitFor(p,`!!window.ws3d?.viewer?.scene?.globe&&!!document.querySelector('#scene-style')`,45000))throw new Error('SDK unavailable');
 await sleep(9000);
 await p.evaluate(`(()=>{document.querySelector('#style-filter').style.display='none';window.postMessage({type:'jf:visual',settings:{height:30,pitch:-4,heading:90,fov:65,buildings:'textured'}},location.origin);window.postMessage({type:'jf:position',position:${JSON.stringify(position)},snap:true},location.origin);window.postMessage({type:'jf:geometry',rail:true},location.origin);})()`);
 await sleep(9000);
 await p.evaluate(`window.postMessage({type:'jf:position',position:${JSON.stringify(position)},snap:true},location.origin)`);
 await sleep(2000);
 const original=await p.evaluate(`(()=>{const v=ws3d.viewer,C=window.Cesium||ws3d.common;window.studyBaseline={camera:v.camera.position.clone(),direction:v.camera.direction.clone(),up:v.camera.up.clone(),time:v.clock.currentTime.clone(),light:v.scene.light,terrainLighting:v.scene.globe.enableLighting,shadow:v.shadows,ao:v.scene.postProcessStages.ambientOcclusion.enabled};return {version:C.VERSION,ao:C.PostProcessStageLibrary.isAmbientOcclusionSupported(v.scene),shadow:!!v.scene.shadowMap,sunLight:!!C.SunLight,customShader:!!C.CustomShader,ibl:!!C.ImageBasedLighting,position:${JSON.stringify(position)},height:v.camera.positionCartographic.height}})()`);
 console.log(JSON.stringify(original));
 const results=[];
 const variants=frontRevision?[
 ['04-light','카메라 정면광1.2 · 그림자 끔',false,false,true],
 ['05-ao-light','HBAO + 카메라 정면광1.2 · 그림자 끔',false,true,true],
 ['06-combined','HBAO + 정면광1.2 + 기존 필터 · 그림자 끔',true,true,true],
 ['10-material-combined','재질 + 환경광 + AO + 정면광1.2 · 그림자 끔',false,true,true],
 ]:frontLight?[
 ['11-front-soft','카메라 정면광 · 약하게',false,false,false],
 ['12-front-medium','카메라 정면광 · 보통',false,false,false],
 ['13-front-shadow','카메라 정면광 + 그림자',false,false,true],
 ['14-front-high','카메라 위쪽 사선광',false,false,true],
 ]:iblOnly?[
 ['09-ibl','환경광·반사 계수 단독 시험',false,false,false],
 ]:materialMode?[
  ['08-pbr','PBR 재질 파라미터 시험',false,false,false],
  ['09-ibl','PBR + 환경광·반사 계수 시험',false,false,false],
  ['10-material-combined','재질 + 환경광 + AO + 조명',false,true,true],
 ]:[
  ['01-original','원본',false,false,false],
  ['02-grade','기존 색감·안개 필터',true,false,false],
  ['03-ao','HBAO 접점 음영',false,true,false],
  ['04-light','태양광·그림자',false,false,true],
  ['05-ao-light','HBAO + 태양광·그림자',false,true,true],
  ['06-combined','HBAO + 조명 + 기존 필터',true,true,true],
 ];
 for(const [id,label,grade,ao,light]of variants){
  await p.evaluate(`(()=>{const v=ws3d.viewer,C=window.Cesium||ws3d.common,b=studyBaseline;v.camera.setView({destination:b.camera,orientation:{direction:b.direction,up:b.up}});v.clock.shouldAnimate=false;v.clock.currentTime=C.JulianDate.fromIso8601('2026-11-04T02:00:00Z');const s=document.querySelector('#scene-style');s.value=${grade}?'realistic':'original';s.dispatchEvent(new Event('change'));v.scene.postProcessStages.ambientOcclusion.enabled=${ao};if(${ao}){const u=v.scene.postProcessStages.ambientOcclusion.uniforms;u.intensity=2;u.bias=.1;u.lengthCap=1;u.stepCount=16;}v.shadows=${light};v.scene.shadowMap.enabled=${light};v.scene.globe.enableLighting=${light};v.scene.light=${light}&&C.SunLight?new C.SunLight({intensity:1.2}):b.light;v.scene.requestRender();})()`);
  if(materialMode||(frontRevision&&id==='10-material-combined'))console.log(JSON.stringify(await p.evaluate(`(()=>{const v=ws3d.viewer,C=window.Cesium||ws3d.common;return ['facility_build','facility_build_lod3'].map(id=>{const t=v.map.getElementById(id)._tileset;if(!t||!('customShader' in t))return {id,supported:false};t.customShader=new C.CustomShader({lightingModel:C.LightingModel.PBR,fragmentShaderText:'void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) { material.roughness = 0.55; material.specular = vec3(0.04); }'});if(t.imageBasedLighting)t.imageBasedLighting.imageBasedLightingFactor=new C.Cartesian2(${id==='08-pbr'?1:1.7},${id==='08-pbr'?1:1.5});return {id,supported:true,shaderAttached:!!t.customShader};})})()`)));
  if(iblOnly)console.log(JSON.stringify(await p.evaluate(`(()=>{const v=ws3d.viewer,C=window.Cesium||ws3d.common;return ['facility_build','facility_build_lod3'].map(id=>{const t=v.map.getElementById(id)._tileset;if(t?.imageBasedLighting)t.imageBasedLighting.imageBasedLightingFactor=new C.Cartesian2(1.7,1.5);return {id,factor:t?.imageBasedLighting?.imageBasedLightingFactor}})})()`)));
  if(frontLight)await p.evaluate(`(()=>{const v=ws3d.viewer,C=window.Cesium||ws3d.common;const direction=v.camera.directionWC.clone();if(${id==='14-front-high'}){const vertical=C.Cartesian3.multiplyByScalar(v.camera.upWC,-.5,new C.Cartesian3());C.Cartesian3.add(direction,vertical,direction);}C.Cartesian3.normalize(direction,direction);v.scene.light=new C.DirectionalLight({direction,intensity:${id==='11-front-soft'?.8:1.2},color:C.Color.WHITE});v.scene.globe.enableLighting=true;v.scene.requestRender();})()`);
  if(frontRevision)await p.evaluate(`(()=>{const v=ws3d.viewer,C=window.Cesium||ws3d.common;v.scene.light=new C.DirectionalLight({direction:C.Cartesian3.normalize(v.camera.directionWC,new C.Cartesian3()),intensity:1.2,color:C.Color.WHITE});v.shadows=false;v.scene.shadowMap.enabled=false;v.scene.globe.enableLighting=true;v.scene.requestRender();})()`);
  await sleep(3500);
  const state=await p.evaluate(`(()=>{const v=ws3d.viewer;return {ao:v.scene.postProcessStages.ambientOcclusion.enabled,shadows:v.scene.shadowMap.enabled,lightIntensity:v.scene.light.intensity,lightDirection:v.scene.light.direction,terrainLighting:v.scene.globe.enableLighting,mapError:document.querySelector('#map-error').textContent,camera:{lon:v.camera.positionCartographic.longitude,lat:v.camera.positionCartographic.latitude,height:v.camera.positionCartographic.height},shaderReady:v.scene.postProcessStages.ready}})()`);
  await p.screenshot(`${out}/${id}.png`);results.push({id,label,...state});console.log(JSON.stringify(results.at(-1)));
 }
 await fs.writeFile(`${out}/results${frontLight?'-front-light':iblOnly?'-ibl':materialMode?'-materials':''}.json`,JSON.stringify({conditions:original,variants:results},null,2));
}finally{p.close();}
