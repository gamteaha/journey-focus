import {WORLD_ORDER} from '/src/passport.mjs';
import {DESTINATIONS,readPassport,passportSummary,ensureTravelStyle,showPassport} from '/passport.mjs';
import {createBoardingPass} from '/src/boarding.mjs';
import {makeSwissPass,SWISS_PASS_KEY} from '/src/swiss-journey.mjs';
import {makeSongdoPass,SONGDO_PASS_KEY,SONGDO_STOPS} from '/src/songdo-journey.mjs';
import {makeDesertPass,DESERT_PASS_KEY,DESERT_STOPS,makeOasisPass,OASIS_PASS_KEY,OASIS_STOPS} from '/src/desert-journey.mjs';
const KEY='journey-focus-world-tour-v1';
export function readTour(){try{const t=JSON.parse(sessionStorage.getItem(KEY));return t&&typeof t.id==='string'&&Number.isInteger(t.leg)&&t.leg>=0&&Number.isFinite(t.elapsed)&&t.elapsed>=0&&passportSummary(readPassport()).world?t:null;}catch{return null;}}
export function activeTour(destination){const t=readTour();return t&&new URLSearchParams(location.search).get('tour')===t.id&&WORLD_ORDER[t.leg%WORLD_ORDER.length]===destination?t:null;}
export function stopTour(){try{sessionStorage.removeItem(KEY);}catch{}}
export function tourTicket(t){
 const destination=WORLD_ORDER[t.leg%WORLD_ORDER.length],input={duration:300,character:'blue',medium:'ticket'},options={id:t.id.slice(0,8)+'-'+t.leg};
 if(destination==='seoul')return createBoardingPass({...input,from:'성수',to:'건대입구'},options);
 if(destination==='swiss')return makeSwissPass({...input,from:'호수 북쪽',to:'호수 남쪽'},options);
 const [fn,stops]=destination==='songdo'?[makeSongdoPass,SONGDO_STOPS]:destination==='oasis'?[makeOasisPass,OASIS_STOPS]:[makeDesertPass,DESERT_STOPS];
 return fn({...input,from:stops[0],to:stops[1]},options);
}
function go(t){
 const destination=WORLD_ORDER[t.leg%WORLD_ORDER.length],pass=tourTicket(t);
 sessionStorage.setItem(KEY,JSON.stringify(t));
 if(destination==='seoul'){location.assign('/?destination=seoul&tour='+t.id);return;}
 const key={swiss:SWISS_PASS_KEY,songdo:SONGDO_PASS_KEY,desert:DESERT_PASS_KEY,oasis:OASIS_PASS_KEY}[destination];sessionStorage.setItem(key,JSON.stringify(pass));
 location.assign((destination==='swiss'?'/alpine-pilot/':destination==='songdo'?'/songdo/':'/desert/')+'?ticket='+pass.id+'&tour='+t.id+(destination==='oasis'?'&world=oasis':''));
}
export function showWorldDeparture(){
 if(!passportSummary(readPassport()).world){showPassport();return;}
 ensureTravelStyle();let el=document.getElementById('world-departure');if(!el){el=document.createElement('dialog');el.id='world-departure';el.className='travel-dialog';document.body.append(el);}
 el.innerHTML='<header><div><small>UNLOCKED TITLE</small><h2>세계여행 ∞</h2></div><button data-close aria-label="닫기">×</button></header><p>서울 → 인천 → 스위스 → 사막 → 달빛 오아시스</p><p>각 지역에서 5분씩 집중하고, 다음 열차로 자동 환승해요. 한 바퀴가 끝나면 다시 서울로 돌아와요.</p><p class="travel-note">지도 로딩과 환승 시간은 집중시간에 포함되지 않아요. 언제든 멈추거나 종료할 수 있어요.</p><button class="travel-primary" id="world-go">세계여행 시작하기 ↗</button><p role="status" id="world-error"></p>';
 el.querySelector('[data-close]').onclick=()=>el.close();el.querySelector('#world-go').onclick=()=>{try{go({id:crypto.randomUUID(),leg:0,elapsed:0});}catch{el.querySelector('#world-error').textContent='이 브라우저에서 여행 상태를 저장하지 못했어요.';}};el.showModal();
}
export function transferWorld(destination,elapsed){
 const t=activeTour(destination);if(!t)return false;
 ensureTravelStyle();let el=document.getElementById('world-transfer');if(!el){el=document.createElement('dialog');el.id='world-transfer';el.className='travel-dialog';document.body.append(el);}
 const next={...t,leg:t.leg+1,elapsed:t.elapsed+elapsed},name=DESTINATIONS[WORLD_ORDER[next.leg%WORLD_ORDER.length]].name;
 el.innerHTML=`<header><div><small>WORLD JOURNEY · ${Math.floor(next.leg/5)}바퀴 완료</small><h2>다음 창가는 ${name}.</h2></div></header><p>누적 ${Math.floor(next.elapsed/60)}분 집중했어요.</p><p id="transfer-status" role="status"></p><div class="travel-dialog-actions"><button id="transfer-go">지금 환승</button><button id="transfer-pause">환승 대기</button><button id="transfer-stop">세계여행 마치기</button></div>`;
 let seconds=5,paused=false,done=false;
 const leave=()=>{if(done)return;done=true;clearInterval(timer);try{go(next);}catch{done=false;el.querySelector('#transfer-status').textContent='환승 정보를 저장하지 못했어요. 다시 시도해 주세요.';}};
 const render=()=>el.querySelector('#transfer-status').textContent=paused?'편히 쉬세요. 지금 환승을 누르면 이어져요.':seconds+'초 후 다음 열차로 환승해요.';
 const timer=setInterval(()=>{if(document.hidden||paused)return;if(--seconds<=0)leave();else render();},1000);
 el.querySelector('#transfer-go').onclick=leave;el.querySelector('#transfer-pause').onclick=()=>{paused=true;render();};
 el.querySelector('#transfer-stop').onclick=()=>{clearInterval(timer);stopTour();el.close();location.assign('/');};
 el.addEventListener('cancel',e=>{e.preventDefault();paused=true;render();},{once:true});render();el.showModal();return true;
}
