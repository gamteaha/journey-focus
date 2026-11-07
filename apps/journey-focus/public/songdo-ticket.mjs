import {createBoarding} from '/boarding.mjs';
import {SONGDO_STOPS,SONGDO_PASS_KEY,makeSongdoPass,validSongdoPass,recommendSongdo} from '/src/songdo-journey.mjs';
const $=id=>document.getElementById(id);
let from=SONGDO_STOPS[0],duration=1500,to=recommendSongdo(from,duration).to,boarding;
try{const saved=JSON.parse(sessionStorage.getItem(SONGDO_PASS_KEY));if(validSongdoPass(saved))({from,to,duration}=saved);}catch{}
function context(){return {from,to,duration,ready:true,statusText:'송도를 상상한 일러스트 여행 · 정거장과 풍경은 가상이에요.',recommendation:recommendSongdo(from,duration)};}
function update(){
 $('from').value=from;$('to').value=to;
 $('route-summary').textContent='SONGDO GARDEN LINE · 가상 정거장 7곳';
 document.querySelectorAll('[data-duration]').forEach(b=>{const active=Number(b.dataset.duration)===duration;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));});
 boarding?.update();
}
for(const id of ['from','to']){
 const select=$(id);select.replaceChildren(...SONGDO_STOPS.map(name=>new Option(name,name)));select.disabled=false;
 select.onchange=()=>{if(id==='from'){from=select.value;to=recommendSongdo(from,duration).to;}else to=select.value;update();};
}
$('swap').disabled=false;$('swap').onclick=()=>{[from,to]=[to,from];update();};
document.querySelector('.header-center').textContent='인천 송도 · 상상 속 수변 정원으로';
document.querySelector('.ticket-header-tools').hidden=true;
function changeDuration(value){duration=value;to=recommendSongdo(from,duration).to;update();}
document.querySelectorAll('[data-duration]').forEach(b=>b.onclick=()=>changeDuration(Number(b.dataset.duration)));
boarding=createBoarding({host:$('boarding-screen'),context,makePass:makeSongdoPass,
 edition:{id:'songdo',name:'송도',label:'GARDEN · IMAGINED',art:'/songdo/input/window-panorama-v2.png',kind:'가상 여행 · 자유석',unlimitedKind:'가상 여행 · 무제한 왕복',unlimitedDestination:'정원길 왕복',unlimitedHeading:'GARDEN SHUTTLE',unlimitedSummary:'∞ 무제한 왕복'},
 onDurationChange:changeDuration,onApplyRecommendation:()=>{to=recommendSongdo(from,duration).to;update();},
 pickerPresentation:({host,context:c})=>{
  host.querySelector('#recommended-title').textContent=c.duration===null?'정원길 왕복':'추천 가상 정거장';
  if(c.duration===null)host.querySelector('#recommended-route').textContent=c.from+' 출발 · 정원길 왕복';
  host.querySelector('.loop-preview>small').textContent='정거장 사이 5분 · 양 끝에서 되돌아가요';
  host.querySelector('.infinity-dial>small').textContent='상상 속 풍경을, 원하는 만큼.';
  host.querySelector('#pace-note').textContent='창밖은 일정한 속도로 흘러요. 여정 표시는 선택한 집중시간에 맞춰 도착해요.';
 },
 onBoarded:async(pass,{signal,onProgress})=>{
  if(signal.aborted)throw new DOMException('Cancelled','AbortError');
  sessionStorage.setItem(SONGDO_PASS_KEY,JSON.stringify(pass));
  onProgress({progress:10,stage:'cabin',label:'송도 정원 열차로 이동하고 있어요.'});
  location.assign('/songdo/?ticket='+encodeURIComponent(pass.id));await new Promise(()=>{});
 }
});
document.querySelector('.boarding-station .station-line').textContent='03';
document.querySelector('.boarding-characters legend span').textContent='횃불이와 함께할 색상';
document.querySelector('.pass-stub>span:not(.boarding-eyebrow)').textContent='횃불이 · 좌석 테마 선택';
update();
