import {createBoarding} from '/boarding.mjs';
import {SWISS_STOPS,SWISS_PASS_KEY,makeSwissPass,validSwissPass} from '/src/swiss-journey.mjs';

const $=id=>document.getElementById(id);
let duration=300,from=SWISS_STOPS[0],boarding;
try{const saved=JSON.parse(sessionStorage.getItem(SWISS_PASS_KEY));if(validSwissPass(saved)){duration=saved.duration;from=saved.from;}}catch{}
const to=()=>SWISS_STOPS.find(name=>name!==from);
function context(){return {from,to:to(),duration,ready:true,error:null,statusText:'5분마다 방향을 바꾸며, 선택한 시간만큼 같은 호숫길을 왕복해요.',recommendation:{from,to:to(),stopCount:1,stops:[from,to()]}};}
function update(){
 $('from').value=from;$('to').value=to();
 document.querySelectorAll('[data-duration]').forEach(b=>{const active=Number(b.dataset.duration)===duration;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));});
 boarding?.update();
}
for(const id of ['from','to']){const select=$(id);select.replaceChildren(...SWISS_STOPS.map(name=>new Option(name,name)));select.disabled=false;select.onchange=()=>{from=id==='from'?select.value:SWISS_STOPS.find(name=>name!==select.value);update();};}
$('from').parentElement.firstChild.textContent='출발 지점';$('to').parentElement.firstChild.textContent='반대편 지점';
$('swap').disabled=false;$('swap').onclick=()=>{from=to();update();};
$('route-summary').textContent='라고 비앙코 · 실제 선로 약 1.6km · 북쪽 ↔ 남쪽 왕복 (실제 역명이 아닌 구간 지점)';
document.querySelector('.header-center').textContent='스위스 · 호수 옆에서 보내는 나만의 시간';
document.querySelector('.ticket-header-tools').hidden=true;
document.querySelectorAll('[data-duration]').forEach(b=>b.onclick=()=>{duration=Number(b.dataset.duration);update();});
boarding=createBoarding({host:$('boarding-screen'),context,
 edition:{id:'swiss',name:'스위스',label:'BERNINA · CH',art:'/images/swiss-ticket.svg',kind:'자유석 · 왕복',routeArrow:'↔',unlimitedKind:'자유석 · 무제한 왕복',unlimitedDestination:'호숫길 왕복',unlimitedHeading:'LAKESIDE SHUTTLE',unlimitedSummary:'∞ 무제한 왕복'},
 makePass:makeSwissPass,onDurationChange:value=>{duration=value;update();},onApplyRecommendation:()=>update(),
 pickerPresentation:({host,context:c})=>{
  host.querySelector('#recommended-title').textContent='호숫길 왕복';host.querySelector('#recommended-count').textContent=c.duration===null?'∞':`${Math.ceil(c.duration/300)}구간${c.duration%300?' (일부)':''}`;
  host.querySelector('#recommended-route').textContent=`${c.from} ↔ ${c.to}`;
  host.querySelector('#recommend-apply').textContent='✓ 오른쪽 창가 · 같은 선로 왕복';
  host.querySelector('.loop-preview>small').textContent='5분마다 이동 방향이 바뀌어요';
  host.querySelector('.loop-orbit>span').textContent='↔';
  host.querySelector('.infinity-dial>small').textContent='같은 호숫길을, 원하는 만큼.';
  host.querySelector('#pace-note').textContent='편도 약 5분 · 속도는 일정해요. 5분 미만은 구간 도중, 목표시간에 마쳐요.';
 },
 onBoarded:async(pass,{signal,onProgress})=>{
  if(signal.aborted)throw new DOMException('Cancelled','AbortError');
  sessionStorage.setItem(SWISS_PASS_KEY,JSON.stringify(pass));
  onProgress({progress:10,stage:'cabin',label:'스위스 열차로 이동하고 있어요.'});
  location.assign('/alpine-pilot/?boarding=swiss&ticket='+encodeURIComponent(pass.id));
  await new Promise(()=>{});
 }
});
update();
