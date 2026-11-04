import { SessionClock,formatTime } from '/src/session.mjs';
import { makePilot,pilotPosition } from '/src/scenery.mjs';
const $=id=>document.getElementById(id);
export function createScenery(api){
 let active=false,ready=false,pilot=null,progress=0,raf=0,lastFrame=0;
 const clock=new SessionClock();
 $('scenery-panel').innerHTML=`<div><span class="eyebrow">SCENERY STUDY / 300 METERS</span><h2>집과 나무를 더한 창밖 풍경.</h2><p>선로·지형은 실제 데이터, 집·나무·전봇대의 배치는 재구성 시안입니다.</p></div><div class="scenery-actions"><button id="scenery-play" disabled>30초 이동</button><button id="scenery-reset" disabled>처음으로</button><button id="scenery-retry" hidden>다시 불러오기</button><button id="scenery-close">원래 지도로</button><strong id="scenery-time">00:30</strong></div><input id="scenery-progress" aria-label="풍경 시안 위치" type="range" min="0" max="1000" value="0" disabled><p id="scenery-status" role="status">입체 모델을 준비합니다.</p><small>높이를 안정화한 창가 시점 · 실제 선로 높이/현장 배치 미검증 · 모델: Poly Haven CC0 / 주택 형상: 직접 제작</small>`;
 function seek(snap=false){if(pilot)api.seek(pilotPosition(pilot,progress),snap);$('scenery-progress').value=Math.round(progress*1000);}
 function setReady(value){ready=value;for(const id of ['scenery-play','scenery-reset','scenery-progress'])$(id).disabled=!value;}
 function motion(running){api.post('scenery-motion',{running});api.sound?.(running);}
 function close(){
  if(!active)return;active=false;api.sound?.(false);setReady(false);clock.reset();cancelAnimationFrame(raf);api.post('scenery-clear');
  document.body.classList.remove('scenery-active');$('scenery-panel').hidden=true;$('scenery-toggle').setAttribute('aria-pressed','false');
  api.controls(false);api.restore();
 }
 function open(){
  try{pilot=makePilot(api.route());}catch{api.toast('먼저 백양리 → 강촌 여정을 선택해 주세요.');return;}
  api.pause();api.closeComparison();active=true;progress=0;clock.reset();setReady(false);
  document.body.classList.add('scenery-active');$('scenery-panel').hidden=false;$('scenery-toggle').setAttribute('aria-pressed','true');
  $('scenery-play').textContent='30초 이동';$('scenery-time').textContent='00:30';$('scenery-status').textContent='입체 나무와 주택 재질을 불러오는 중입니다. 첫 실행에는 시간이 걸릴 수 있어요.';
  $('scenery-retry').hidden=true;api.controls(true);api.post('lock',{locked:true});api.post('scenery-load',{objects:pilot.objects});seek();
 }
 function tick(now){
  if(!active)return;
  const s=clock.snapshot();progress=s.progress;seek();$('scenery-time').textContent=formatTime(s.duration-s.elapsed);
  if(s.state==='running'){raf=requestAnimationFrame(tick);}
  else if(s.state==='completed'){motion(false);$('scenery-play').textContent='다시 보기';$('scenery-status').textContent='300m 풍경 시안을 모두 보았습니다. 집과 나무의 배치는 현장 재현이 아닌 시안입니다.';}
 }
 $('scenery-retry').onclick=()=>{close();open();};
 $('scenery-toggle').onclick=()=>active?close():open();$('scenery-close').onclick=close;
 $('scenery-play').onclick=()=>{
  if(!ready)return;
  if(clock.state==='running'){clock.pause();motion(false);cancelAnimationFrame(raf);$('scenery-play').textContent='이어 보기';return;}
  if(clock.state==='paused')clock.resume();else{if(clock.state==='completed'||progress>=1){progress=0;seek(true);}clock.start(30);if(progress>0&&progress<1){clock.startedAt-=progress*30000;}}
  motion(true);$('scenery-play').textContent='일시정지';raf=requestAnimationFrame(tick);
 };
 $('scenery-reset').onclick=()=>{clock.reset();motion(false);cancelAnimationFrame(raf);progress=0;seek(true);$('scenery-time').textContent='00:30';$('scenery-play').textContent='30초 이동';};
 $('scenery-progress').oninput=()=>{clock.reset();motion(false);cancelAnimationFrame(raf);progress=Number($('scenery-progress').value)/1000;seek(true);$('scenery-time').textContent=formatTime(30*(1-progress));$('scenery-play').textContent='여기서 이동';};
 return{
  get active(){return active;},get running(){return clock.state==='running';},get remaining(){const s=clock.snapshot();return s.duration?Math.max(0,s.duration-s.elapsed):30;},close,
  mapReady:()=>{if(active){close();api.toast('지도가 다시 연결되어 풍경 시안을 종료했습니다. 다시 열 수 있어요.');}},
  message:data=>{
   if(!active)return;
   if(data.type==='jf:scenery-progress')$('scenery-status').textContent=`입체 모델 ${data.loaded} / ${data.total}개 준비 중`;
   if(data.type==='jf:scenery-ready'){setReady(true);$('scenery-status').textContent=`풍경이 준비됐습니다. 지형에 맞춘 주택 ${data.houses}채와 풀·나무를 볼 수 있어요.${data.houses<5?' 급경사 자리는 주택 배치에서 제외했습니다.':''} 30초 이동을 눌러 보세요.`;seek(true);}
   if(data.type==='jf:scenery-error'){setReady(false);$('scenery-retry').hidden=false;$('scenery-status').textContent=data.message||'풍경을 불러오지 못했습니다. 원래 지도로 돌아간 뒤 다시 열어 주세요.';}
  },
 };
}
