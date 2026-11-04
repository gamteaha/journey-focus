// Optional visual reconstruction. These trees are not surveyed forest records.
export function createForestStudy(viewer, C) {
  const button=document.createElement('button');
  button.textContent='산 숲 비교 · 켜기';button.setAttribute('aria-pressed','false');
  button.style.cssText='position:absolute;left:12px;top:12px;z-index:1000;background:#183b30ed;color:white;border:1px solid #ffffff66;border-radius:8px;padding:10px;cursor:pointer';
  const label=document.createElement('div');label.textContent='숲 보강 시안 · 실제 수목 위치 아님';
  label.style.cssText='position:absolute;left:12px;top:56px;z-index:1000;background:#183b30db;color:white;padding:6px;font:12px sans-serif';label.hidden=true;
  const host=window.parent.document.getElementById('landscape-tools');
  if(host){
    const group=window.parent.document.createElement('div');group.className='forest-controls';
    button.style.cssText='';label.style.cssText='font-size:11px;color:#657365';
    group.append(button,label);host.append(group);
  }else document.body.append(button,label);
  let collection=null,disposed=false,busy=false,visible=false;
  let seed=219;const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
  function sprite(){
    const canvas=document.createElement('canvas');canvas.width=128;canvas.height=160;
    const ctx=canvas.getContext('2d');
    ctx.fillStyle='#514735';ctx.fillRect(61,95,6,63);
    // Layered, shaded clusters retain an irregular silhouette without large meshes.
    for(let i=0;i<95;i++){
      const angle=random()*Math.PI*2,r=Math.sqrt(random());
      const x=64+Math.cos(angle)*r*44,y=64+Math.sin(angle)*r*48;
      const radius=9+random()*15;
      const gradient=ctx.createRadialGradient(x-4,y-5,1,x,y,radius);
      gradient.addColorStop(0,`rgb(${49+Math.floor(random()*24)},${77+Math.floor(random()*27)},${37+Math.floor(random()*17)})`);
      gradient.addColorStop(1,'#203a24');ctx.fillStyle=gradient;
      ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.fill();
    }
    return canvas;
  }
  const images=Array.from({length:4},sprite);
  async function build(){
    const points=[];
    // Small hillside patch north-east of the default Baegyangri camera.
    for(let row=0;row<56;row++)for(let col=0;col<82;col++){
      const lon=127.586+col*.00023+(random()-.5)*.00020;
      const lat=37.834+row*.00017+(random()-.5)*.00015;
      points.push(C.Cartographic.fromDegrees(lon,lat));
    }
    let timer,sampled;
    try{sampled=await Promise.race([
      C.sampleTerrain(viewer.terrainProvider,14,points),
      new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('terrain timeout')),20000);}),
    ]);}finally{clearTimeout(timer);}
    if(disposed)return;
    const next=new C.BillboardCollection({scene:viewer.scene});
    try{
      for(let i=0;i<sampled.length;i++){
        const point=sampled[i];
        // Avoid the low river/plain. Exact vegetation coverage is not asserted.
        if(!Number.isFinite(point.height)||point.height<95||point.height>650)continue;
        const position=C.Cartesian3.fromRadians(point.longitude,point.latitude,point.height-.7);
        const height=13+random()*7;
        next.add({position,image:images[i%4],width:height*1.1,height,sizeInMeters:true,
          verticalOrigin:C.VerticalOrigin.BOTTOM,
          alignedAxis:C.Ellipsoid.WGS84.geodeticSurfaceNormal(position),
          color:C.Color.fromCssColorString(['#ffffff','#d4dfce','#e2e7d4'][i%3]),
          distanceDisplayCondition:new C.DistanceDisplayCondition(0,5000)});
      }
      viewer.scene.primitives.add(next);collection=next;collection.show=visible;
      label.textContent=`산비탈 숲 ${next.length}그루 · 재구성 시안 / 실제 배치 아님`;
    }catch(error){next.destroy();throw error;}
  }
  button.onclick=async()=>{
    if(busy||disposed)return;
    visible=!visible;label.hidden=!visible;button.setAttribute('aria-pressed',String(visible));
    button.textContent=visible?'산 숲 비교 · 끄기':'산 숲 비교 · 켜기';
    if(visible&&!collection){
      busy=true;button.disabled=true;label.textContent='산 지형에 맞춰 숲을 준비하는 중…';
      try{await build();}catch{visible=false;button.setAttribute('aria-pressed','false');button.textContent='산 숲 비교 · 다시 시도';label.textContent='지형을 불러오지 못했어요. 다시 눌러 주세요.';}
      finally{busy=false;button.disabled=false;}
    }
    if(collection)collection.show=visible;
    viewer.scene.requestRender?.();
  };
  return {dispose(){disposed=true;if(collection&&!collection.isDestroyed())viewer.scene.primitives.remove(collection);button.remove();label.remove();}};
}
