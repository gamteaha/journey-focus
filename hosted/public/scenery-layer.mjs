import {createLoadScope} from '../src/loading.mjs';
import {createFrameWork} from '../src/frame-work.mjs';
import {houseCandidates,houseFootprint,houseSupport} from '../src/scenery.mjs';
const MODELS={grass:'/assets/grass/model.gltf',tree:'/assets/pine_sapling_lod/model.gltf',shrub:'/assets/shrub_sorrel_01/model.gltf',house:'/assets/house/house.gltf'};
export function createSceneryLayer(viewer,C,notify,onMode){
  let generation=0,group=null,entities=[],snapshot=null,anchors=[],layoutLocked=false,activeLoad=null,removeTerrainListener=null;
  const terrainWork=createFrameWork(()=>terrainUpdates());
  const matrixFor=(object,height)=>C.Transforms.headingPitchRollToFixedFrame(C.Cartesian3.fromDegrees(object.lon,object.lat,height),new C.HeadingPitchRoll(C.Math.toRadians(object.heading),0,0));
  function placeHouse(anchor,support){
    // Omit a plot that would require a retaining wall taller than a rural house plinth.
    const visible=support.range<=2.5;
    anchor.model.show=visible;anchor.foundation.show=visible;
    anchor.height=support.base;
    anchor.depth=support.depth;anchor.locationDirty=false;
    anchor.model.modelMatrix=matrixFor(anchor.object,support.base);
    anchor.foundation.position=C.Cartesian3.fromDegrees(anchor.object.lon,anchor.object.lat,(support.base+support.bottom)/2);
    anchor.foundation.box.dimensions=new C.Cartesian3(11,10,support.depth);
  }
  function* terrainUpdates(){
    let changed=false;
    const ordered=[...anchors],camera=viewer.camera?.positionCartographic;
    if(camera){const lon=camera.longitude*180/Math.PI,lat=camera.latitude*180/Math.PI,cos=Math.cos(camera.latitude);const distance=a=>Math.hypot((a.object.lon-lon)*cos,a.object.lat-lat);ordered.sort((a,b)=>distance(a)-distance(b));}
    for(const anchor of ordered){
      if(anchor.foundation){
        const heights=[];for(const point of anchor.footprint){heights.push(viewer.scene.globe.getHeight(point));yield;}
        let support=houseSupport(heights);
        if(!layoutLocked&&support&&support.range>1.8){
          const alternatives=anchor.plots.map(p=>({...p,support:houseSupport(p.footprint.map(c=>viewer.scene.globe.getHeight(c)))}))
            .filter(p=>p.support&&p.support.range<support.range-.3&&anchors.every(a=>!a.foundation||a===anchor||Math.hypot((a.object.lon-p.object.lon)*111320*Math.cos(p.object.lat*Math.PI/180),(a.object.lat-p.object.lat)*111320)>18));
          alternatives.sort((a,b)=>a.support.range-b.support.range);
          if(alternatives.length){
            const plot=alternatives[0];anchor.object=plot.object;anchor.footprint=plot.footprint;support=plot.support;anchor.locationDirty=true;
            const origin=C.Cartesian3.fromDegrees(anchor.object.lon,anchor.object.lat,support.base);
            anchor.foundation.orientation=C.Transforms.headingPitchRollQuaternion(origin,new C.HeadingPitchRoll(C.Math.toRadians(anchor.object.heading),0,0));
          }
        }
        if(support&&(anchor.locationDirty||Math.abs(support.base-anchor.height)>.03||Math.abs(support.depth-anchor.depth)>.05||(support.range<=2.5)!==anchor.model.show)){placeHouse(anchor,support);changed=true;}
        continue;
      }
      const h=viewer.scene.globe.getHeight(anchor.cartographic);
      yield;
      if(!Number.isFinite(h)||Math.abs(h-anchor.height)<.05)continue;
      anchor.height=h;changed=true;
      if(anchor.entity)anchor.entity.position=C.Cartesian3.fromDegrees(anchor.object.lon,anchor.object.lat,h+4.5);
      else if(!anchor.model.isDestroyed())anchor.model.modelMatrix=matrixFor(anchor.object,h+(['grass','shrub'].includes(anchor.object.kind)?-.03:-.15));
    }
    // Grass/tree origins must not pass through a reconstructed house after plot selection.
    const houses=anchors.filter(a=>a.foundation&&a.model.show);
    for(const anchor of anchors){
      if(!anchor.model||anchor.foundation)continue;
      const clearance=anchor.object.kind==='grass'?10:anchor.object.kind==='tree'?(anchor.object.variant==='leafy'?12:10):9;
      const visible=houses.every(h=>Math.hypot((h.object.lon-anchor.object.lon)*111320*Math.cos(anchor.object.lat*Math.PI/180),(h.object.lat-anchor.object.lat)*111320)>clearance);
      if(anchor.model.show!==visible){anchor.model.show=visible;changed=true;}
    }
    if(changed)viewer.scene.requestRender?.();
  }
  function anchorToRenderedTerrain(){const updates=terrainUpdates();while(!updates.next().done){ /* Initial placement is completed before enabling playback. */ }}
  function dispose(restore=true){
    terrainWork.cancel();
    removeTerrainListener?.();removeTerrainListener=null;
    if(group){if(!group.isDestroyed())viewer.scene.primitives.remove(group);group=null;}
    for(const e of entities)viewer.entities.remove(e);entities=[];anchors=[];layoutLocked=false;
    if(restore&&snapshot){for(const [id,visible]of snapshot){const layer=viewer.map.getElementById(id);if(layer)visible?layer.show():layer.hide();}snapshot=null;}
    if(restore)onMode(false);
  }
  function clear(){generation++;activeLoad?.cancel();activeLoad=null;dispose();notify('scenery-cleared');}
  async function load(objects){
    const token=++generation;activeLoad?.cancel();activeLoad=null;dispose();
    if(!Array.isArray(objects)||objects.length>120||objects.some(o=>!Number.isFinite(o.lon)||!Number.isFinite(o.lat)||o.lon<127.58||o.lon>127.64||o.lat<37.80||o.lat>37.84||!['tree','shrub','house','pole','grass'].includes(o.kind)))throw new Error('Invalid pilot layout');
    notify('scenery-loading');
    const scope=createLoadScope();activeLoad=scope;
    removeTerrainListener=viewer.scene.globe.tileLoadProgressEvent.addEventListener(count=>{if(count===0&&layoutLocked)terrainWork.request();});
    try{
      onMode(true);
      // Sample several nearby plots in one request, including all plot corners.
      const positions=objects.map(o=>C.Cartographic.fromDegrees(o.lon,o.lat));
      const plots=objects.map(o=>o.kind==='house'?houseCandidates(o).map(object=>({object,footprint:houseFootprint(object).map(p=>C.Cartographic.fromDegrees(p.lon,p.lat))})):[]);
      const samples=[...positions,...plots.flatMap(candidates=>candidates.flatMap(p=>p.footprint))];
      let heights;
      let timeout,sampled=false;
      try{
        await scope.wait(Promise.race([C.sampleTerrain(viewer.terrainProvider,14,samples),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error('Terrain timeout')),15000);})]));
        sampled=true;
      }catch(error){if(scope.cancelled)throw error; /* Use currently rendered terrain when provider sampling is unavailable. */ }
      finally{clearTimeout(timeout);}
      // Plot selection uses the near camera's terrain LOD, not the initial overview mesh.
      const deadline=Date.now()+3000;
      while(token===generation&&!viewer.scene.globe.tilesLoaded&&Date.now()<deadline)await scope.delay(100);
      const heightAt=p=>{const shown=viewer.scene.globe.getHeight(p);return Number.isFinite(shown)?shown:sampled?p.height:undefined;};
      heights=positions.map(heightAt);
      const chosen=[];
      const supports=plots.map((candidates,i)=>{
        const ranked=candidates.map(plot=>({...plot,support:houseSupport(plot.footprint.map(heightAt))})).filter(p=>p.support&&chosen.every(other=>Math.hypot((other.object.lon-p.object.lon)*111320*Math.cos(p.object.lat*Math.PI/180),(other.object.lat-p.object.lat)*111320)>18));
        const distance=p=>Math.hypot((p.object.lon-objects[i].lon)*111320*Math.cos(p.object.lat*Math.PI/180),(p.object.lat-objects[i].lat)*111320);
        ranked.sort((a,b)=>(a.support.range+distance(a)*.015)-(b.support.range+distance(b)*.015));
        if(ranked[0])chosen.push(ranked[0]);
        return ranked[0];
      });
      if(token!==generation)return;
      if(heights.some(h=>!Number.isFinite(h)))throw new Error('Terrain heights unavailable');
      if(objects.some((o,i)=>o.kind==='house'&&!supports[i]))throw new Error('House footprint heights unavailable');
      const ids=['facility_build_all','facility_build','facility_build_lod1','facility_build_lod2','facility_build_lod3'];
      snapshot=ids.map(id=>[id,Boolean(viewer.map.getElementById(id)?.visible)]);
      for(const id of ids)viewer.map.getElementById(id)?.hide();
      group=viewer.scene.primitives.add(new C.PrimitiveCollection());
      const owner=group;
      let loaded=0;
      const jobs=objects.map((original,i)=>async()=>{
        if(token!==generation)return;
        const plot=supports[i],object=plot?.object??original;
        const position=C.Cartesian3.fromDegrees(object.lon,object.lat,plot?plot.support.base:heights[i]+(['grass','shrub'].includes(object.kind)?-.03:-.15));
        if(object.kind==='pole'){
          const p=C.Cartesian3.fromDegrees(object.lon,object.lat,heights[i]+4.5);
          const e=viewer.entities.add({position:p,cylinder:{length:9,topRadius:.09,bottomRadius:.16,material:C.Color.fromCssColorString('#756d58')}});entities.push(e);anchors.push({entity:e,object,cartographic:positions[i],height:heights[i]});return;
        }
        const matrix=C.Transforms.headingPitchRollToFixedFrame(position,new C.HeadingPitchRoll(C.Math.toRadians(object.heading),0,0));
        const url=object.kind==='tree'&&object.variant==='leafy'?'/assets/leafy_tree_lod/model.gltf':MODELS[object.kind];
        let model=C.Model.fromGltf({id:`jf-scenery-${object.kind}-${i}`,url,modelMatrix:matrix,scale:object.scale,allowPicking:false,asynchronous:true});
        if(model?.then){
          const creation=Promise.resolve(model).then(created=>{
            if(token!==generation||scope.cancelled){if(!created.isDestroyed?.())created.destroy?.();}
            return created;
          });
          model=await scope.wait(creation);
        }
        if(token!==generation){model.destroy?.();return;}
        owner.add(model);
        const anchor={model,object,cartographic:positions[i],height:heights[i]};
        if(plot){
          const foundation=viewer.entities.add({id:`jf-foundation-${i}`,position,
            orientation:C.Transforms.headingPitchRollQuaternion(position,new C.HeadingPitchRoll(C.Math.toRadians(object.heading),0,0)),
            box:{dimensions:new C.Cartesian3(11,10,plot.support.depth),material:C.Color.fromCssColorString('#766f5b')}});
          entities.push(foundation);Object.assign(anchor,{foundation,footprint:plot.footprint,plots:plots[i]});placeHouse(anchor,plot.support);
        }
        anchors.push(anchor);
        await scope.wait(model.readyPromise);
        if(token===generation){loaded++;notify('scenery-progress',{loaded,total:objects.filter(o=>o.kind!=='pole').length});}
      });
      let cursor=0;
      await Promise.all(Array.from({length:4},async()=>{while(cursor<jobs.length){const index=cursor++;await jobs[index]();}}));
      if(token!==generation)return;
      anchorToRenderedTerrain();layoutLocked=true;viewer.scene.requestRender?.();notify('scenery-ready',{models:loaded,poles:objects.filter(o=>o.kind==='pole').length,houses:anchors.filter(a=>a.foundation&&a.model.show).length});
    }catch{
      if(token!==generation)return;
      generation++;scope.cancel();dispose();notify('scenery-error',{message:'풍경 모델 또는 지형 높이를 불러오지 못했습니다. 원래 지도로 돌아온 뒤 다시 시도해 주세요.'});
    }finally{scope.cancel();if(activeLoad===scope)activeLoad=null;}
  }
  return{load,clear};
}
