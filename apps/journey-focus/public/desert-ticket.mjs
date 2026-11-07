import {createBoarding} from '/boarding.mjs';
import * as journeys from '/src/desert-journey.mjs';
import {isUnlocked} from '/passport.mjs';
const oasis=new URLSearchParams(location.search).get('destination')==='oasis',destination=oasis?'oasis':'desert';
if(!isUnlocked(destination)){location.replace('/?locked='+destination);await new Promise(()=>{});}
const DESERT_STOPS=oasis?journeys.OASIS_STOPS:journeys.DESERT_STOPS,DESERT_PASS_KEY=oasis?journeys.OASIS_PASS_KEY:journeys.DESERT_PASS_KEY,makeDesertPass=oasis?journeys.makeOasisPass:journeys.makeDesertPass,validDesertPass=oasis?journeys.validOasisPass:journeys.validDesertPass,recommendDesert=oasis?journeys.recommendOasis:journeys.recommendDesert;
const $=id=>document.getElementById(id);
let from=DESERT_STOPS[0],duration=1500,to=recommendDesert(from,duration).to,boarding;
try{const saved=JSON.parse(sessionStorage.getItem(DESERT_PASS_KEY));if(validDesertPass(saved))({from,to,duration}=saved);}catch{}
function context(){return {from,to,duration,ready:true,statusText:oasis?'달빛 오아시스 여행 · 정거장과 풍경은 가상이에요.':'도트로 그린 사막 열차 여행 · 정거장과 풍경은 가상이에요.',recommendation:recommendDesert(from,duration)};}
function update(){
 $('from').value=from;$('to').value=to;
 $('route-summary').textContent=oasis?'MOON OASIS · 가상 정거장 5곳':'DUNE EXPRESS · 가상 정거장 7곳';
 document.querySelectorAll('[data-duration]').forEach(b=>{const active=Number(b.dataset.duration)===duration;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));});
 boarding?.update();
}
for(const id of ['from','to']){
 const select=$(id);select.replaceChildren(...DESERT_STOPS.map(name=>new Option(name,name)));select.disabled=false;
 select.onchange=()=>{if(id==='from'){from=select.value;to=recommendDesert(from,duration).to;}else to=select.value;update();};
}
$('swap').disabled=false;$('swap').onclick=()=>{[from,to]=[to,from];update();};
document.querySelector('.header-center').textContent=oasis?'달빛 오아시스 · 도장으로 열린 여행':'사막 · 모래언덕 너머의 작은 여행';
document.querySelector('.ticket-header-tools').hidden=true;
function changeDuration(value){duration=value;to=recommendDesert(from,duration).to;update();}
document.querySelectorAll('[data-duration]').forEach(b=>b.onclick=()=>changeDuration(Number(b.dataset.duration)));
boarding=createBoarding({host:$('boarding-screen'),context,makePass:makeDesertPass,
 edition:{id:'desert',name:oasis?'달빛 오아시스':'사막',label:oasis?'MOON OASIS · BONUS WORLD':'DUNE · PIXEL WORLD',art:oasis?'/desert/oasis-postcard.svg':'/desert/postcard.svg',kind:'가상 여행 · 자유석',unlimitedKind:'가상 여행 · 무제한 왕복',unlimitedDestination:oasis?'호숫길 왕복':'사막길 왕복',unlimitedHeading:oasis?'MOONLIGHT SHUTTLE':'DESERT SHUTTLE',unlimitedSummary:'∞ 무제한 왕복'},
 onDurationChange:changeDuration,onApplyRecommendation:()=>{to=recommendDesert(from,duration).to;update();},
 pickerPresentation:({host,context:c})=>{
  host.querySelector('#recommended-title').textContent=c.duration===null?(oasis?'호숫길 왕복':'사막길 왕복'):'추천 가상 정거장';
  if(c.duration===null)host.querySelector('#recommended-route').textContent=c.from+(oasis?' 출발 · 호숫길 왕복':' 출발 · 사막길 왕복');
  host.querySelector('.loop-preview>small').textContent='정거장 사이 5분 · 양 끝에서 되돌아가요';
  host.querySelector('.infinity-dial>small').textContent='상상 속 풍경을, 원하는 만큼.';
  host.querySelector('#pace-note').textContent='창밖은 일정한 속도로 흘러요. 여정 표시는 선택한 집중시간에 맞춰 도착해요.';
 },
 onBoarded:async(pass,{signal,onProgress})=>{
  if(signal.aborted)throw new DOMException('Cancelled','AbortError');
  sessionStorage.setItem(DESERT_PASS_KEY,JSON.stringify(pass));
  onProgress({progress:10,stage:'cabin',label:oasis?'달빛 열차로 이동하고 있어요.':'사막 열차로 이동하고 있어요.'});
  location.assign('/desert/?ticket='+encodeURIComponent(pass.id)+(oasis?'&world=oasis':''));await new Promise(()=>{});
 }
});
document.querySelector('.boarding-station .station-line').textContent=oasis?'05':'04';
document.querySelector('.boarding-characters legend span').textContent='횃불이와 함께할 색상';
document.querySelector('.pass-stub>span:not(.boarding-eyebrow)').textContent='횃불이 · 좌석 테마 선택';
update();
