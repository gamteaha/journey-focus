// Local GPU colour/depth treatment, not AI reconstruction or detail recovery.
const shader=`
uniform sampler2D colorTexture;
uniform sampler2D depthTexture;
uniform float strength;
varying vec2 v_textureCoordinates;
void main(){
  vec2 uv=v_textureCoordinates;
  vec3 source=texture2D(colorTexture,uv).rgb;
  vec2 px=1.0/czm_viewport.zw;
  vec3 neighbours=(texture2D(colorTexture,uv+vec2(px.x,0.0)).rgb+
    texture2D(colorTexture,uv-vec2(px.x,0.0)).rgb+
    texture2D(colorTexture,uv+vec2(0.0,px.y)).rgb+
    texture2D(colorTexture,uv-vec2(0.0,px.y)).rgb)*0.25;
  vec3 colour=clamp(source+(source-neighbours)*0.22,0.0,1.0);
  float luminance=dot(colour,vec3(0.2126,0.7152,0.0722));
  colour=mix(vec3(luminance),colour,0.88);
  // Lift crushed shadows without making white walls brighter.
  colour+=vec3(0.028,0.032,0.022)*pow(1.0-luminance,2.0);
  colour=(colour-0.5)*1.035+0.5;
  float depth=czm_readDepth(depthTexture,uv);
  if(depth>0.0&&depth<0.999999){
    vec4 eye=czm_windowToEyeCoordinates(gl_FragCoord.xy,depth);
    float distanceToCamera=length(eye.xyz/eye.w);
    float haze=0.25*(1.0-exp(-max(distanceToCamera-180.0,0.0)/3000.0));
    colour=mix(colour,vec3(0.64,0.72,0.74),haze);
  }
  gl_FragColor=vec4(mix(source,clamp(colour,0.0,1.0),strength),1.0);
}`;

export function createStyleFilter(viewer,C){
  const panel=document.createElement('div');panel.id='style-filter';
  panel.style.cssText='position:absolute;left:12px;top:94px;z-index:1000;max-width:calc(100% - 100px);background:#183b30ed;color:white;padding:10px;border:1px solid #ffffff66;border-radius:8px;font:12px sans-serif;display:grid;gap:8px';
  panel.innerHTML=`<label>풍경 스타일 <select id="scene-style" aria-label="풍경 스타일"><option value="cinematic">실사풍 · 6번</option><option value="original">원본</option><option value="realistic">색감·안개만</option></select></label><label style="display:flex;align-items:center;gap:6px">강도 <input id="scene-style-strength" aria-label="실사풍 강도" type="range" min="0" max="100" value="70" style="width:100px"><output id="scene-style-value">70%</output></label><small id="scene-style-status" role="status">6번 스타일 준비 중</small>`;
  const host=window.parent.document.getElementById('landscape-tools');
  if(host){panel.style.cssText='display:flex;align-items:center;flex-wrap:wrap;gap:10px 18px';host.append(panel);}else document.body.append(panel);
  const select=panel.querySelector('select'),range=panel.querySelector('input'),status=panel.querySelector('small'),output=panel.querySelector('output');
  let stage=null;
  const scene=viewer.scene,ao=scene.postProcessStages.ambientOcclusion;
  const baseline={light:scene.light,lighting:scene.globe.enableLighting,shadows:viewer.shadows,shadowEnabled:scene.shadowMap?.enabled,aoEnabled:ao?.enabled,
    aoUniforms:ao?{intensity:ao.uniforms.intensity,bias:ao.uniforms.bias,lengthCap:ao.uniforms.lengthCap,stepCount:ao.uniforms.stepCount}:null};
  const aoSupported=Boolean(C.PostProcessStageLibrary?.isAmbientOcclusionSupported(scene));
  let frontLight=null,cinematicActive=false;
  const removeLightUpdate=scene.preRender.addEventListener(()=>{
    if(cinematicActive&&frontLight){
      C.Cartesian3.normalize(viewer.camera.directionWC,frontLight.direction);
      // The provider can reset AO while applying its initial map preset.
      // Keep the selected treatment active after that asynchronous setup.
      if(aoSupported)ao.enabled=true;
    }
  });
  function restoreLighting(){
    cinematicActive=false;scene.light=baseline.light;scene.globe.enableLighting=baseline.lighting;
    viewer.shadows=baseline.shadows;if(scene.shadowMap)scene.shadowMap.enabled=baseline.shadowEnabled;
    if(ao){ao.enabled=baseline.aoEnabled;Object.assign(ao.uniforms,baseline.aoUniforms);}
  }
  try{
    if(!C.PostProcessStage||!viewer.scene.postProcessStages||!viewer.scene.context.depthTexture)throw new Error('Unsupported');
    stage=viewer.scene.postProcessStages.add(new C.PostProcessStage({name:'journey-realistic-study',fragmentShader:shader,uniforms:{strength:.7}}));
    stage.enabled=false;
  }catch{select.value='original';select.disabled=true;range.disabled=true;status.textContent='현재 기기에서 필터를 지원하지 않아요.';}
  function apply(){
    if(!stage)return;
    const amount=Number(range.value)/100;
    const cinematic=select.value==='cinematic'&&amount>0;
    stage.uniforms.strength=amount;stage.enabled=select.value!=='original'&&amount>0;
    if(cinematic){
      frontLight??=new C.DirectionalLight({direction:viewer.camera.directionWC.clone(),intensity:1.2,color:C.Color.WHITE});
      C.Cartesian3.normalize(viewer.camera.directionWC,frontLight.direction);
      cinematicActive=true;scene.light=frontLight;scene.globe.enableLighting=true;
      viewer.shadows=false;if(scene.shadowMap)scene.shadowMap.enabled=false;
      if(aoSupported){ao.enabled=true;Object.assign(ao.uniforms,{intensity:2,bias:.1,lengthCap:1,stepCount:16});}
    }else restoreLighting();
    range.disabled=select.value==='original';output.value=`${range.value}%`;
    status.textContent=cinematic?`정면광1.2 · 그림자 끔 · ${aoSupported?'AO':'AO 미지원'} · 색감 보정`:stage.enabled?'색감 · 거리 안개 · 약한 선명도 보정':'원본 화면 · 필터 꺼짐';
    viewer.scene.requestRender?.();
  }
  select.onchange=apply;range.oninput=apply;apply();
  return {dispose(){removeLightUpdate();if(!scene.isDestroyed()){restoreLighting();if(stage)scene.postProcessStages.remove(stage);}panel.remove();}};
}
