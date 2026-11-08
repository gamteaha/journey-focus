import {visualQuality,setVisualQuality} from '/visual-quality.mjs';
import {speakArrival} from '/arrival-audio.mjs';
import {createTravelSound} from '/travel-sound.mjs';
import {ensureTravelStyle,DESTINATIONS,saveReceipt,showCompletion,showPassport} from '/passport.mjs';
import {activeTour,transferWorld,stopTour} from '/world-tour.mjs';
export function createTravelShell({destination,getState,actions,sound:providedSound}){
 ensureTravelStyle();document.body.dataset.travel=destination;
 const sound=providedSound||createTravelSound(destination),host=document.createElement('div');host.id='travel-chrome';
 host.innerHTML=`<nav class="travel-nav" aria-label="여행 도구"><button data-action="settings">☰ 설정</button><button data-action="sound">♫ 소리</button><button data-action="passport">▧ 여권</button></nav><div class="travel-views" role="group" aria-label="열차 화면"><button data-view="cabin">객실 · 캐릭터</button><button data-view="window">창밖 풍경</button></div><div class="travel-clock" hidden><small></small><strong></strong></div><div class="travel-controls"><button class="travel-primary" data-action="play">출발하기</button><button data-action="end">여정 마치기</button></div><div class="travel-world" hidden></div>`;
 document.body.append(host);const q=s=>host.querySelector(s);let runId=crypto.randomUUID(),finished=false,wasPlaying=false,lastState;
 const soundClose=()=>{for(const d of document.querySelectorAll('dialog[open]'))d.close();};
 q('[data-action=settings]').onclick=()=>{soundClose();let el=document.getElementById('travel-settings');if(!el){el=document.createElement('dialog');el.id='travel-settings';el.className='travel-dialog';el.innerHTML='<header><div><small>JOURNEY FOCUS</small><h2>열차 설정</h2></div><button data-close aria-label="설정 닫기">×</button></header><label class="travel-quality">화면 화질 <select id="travel-quality"><option value="high">고화질</option><option value="balanced">균형</option><option value="light">가볍게</option></select></label><p class="travel-note">캐릭터·지도 표시를 선명하게 해요. 지도 원본 해상도에는 한계가 있어요. 도트 풍경의 스타일은 유지돼요.</p><div class="travel-setting-links"><button data-setting="arrival">열차 안내 다시 듣기</button><button data-setting="sound">음악 · 환경음</button><button data-setting="passport">나의 여행 여권</button><button data-setting="details">풍경 · 상세 설정</button><a href="/">여행지 다시 고르기 ↗</a></div><p class="travel-note">진행 중인 여정을 나가면 현재 집중시간은 종료돼요.</p>';document.body.append(el);el.querySelector('[data-close]').onclick=()=>el.close();el.querySelector('#travel-quality').onchange=e=>setVisualQuality(e.target.value);el.querySelector('[data-setting=arrival]').onclick=()=>speakArrival(DESTINATIONS[destination].name);el.querySelector('[data-setting=sound]').onclick=()=>{el.close();sound.open();};el.querySelector('[data-setting=passport]').onclick=()=>{el.close();showPassport();};el.querySelector('[data-setting=details]').onclick=()=>{el.close();actions.settings();};}el.querySelector('#travel-quality').value=visualQuality();el.showModal();};
 q('[data-action=sound]').onclick=()=>{soundClose();sound.open();};q('[data-action=passport]').onclick=()=>{soundClose();showPassport();};
 q('[data-action=play]').onclick=()=>{actions.play();void sound.unlock();update();};q('[data-action=end]').onclick=()=>actions.end();
 host.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{actions.view(b.dataset.view);update();});
 function update(){
  const s=getState();lastState=s;host.hidden=s.visible===false;host.dataset.status=s.status||'idle';
  const playing=s.status==='running';if(playing!==wasPlaying){sound.setActive(playing);if(playing)void sound.unlock();wasPlaying=playing;}
  const tour=activeTour(destination);q('.travel-world').hidden=!tour;q('.travel-world').textContent=tour?`세계여행 ∞ · ${Math.floor(tour.leg/5)+1}번째 바퀴 · ${DESTINATIONS[destination].name}`:'';
  q('[data-action=play]').disabled=!s.ready||!s.seated;q('[data-action=play]').textContent=!s.ready?'열차 준비 중':!s.seated?'먼저 자리를 골라 주세요':playing?'Ⅱ 일시정지':s.status==='paused'?'▶ 이어가기':s.status==='completed'?'다시 출발하기':'열차 출발하기 ↗';
  q('[data-action=end]').hidden=!['running','paused'].includes(s.status);q('[data-action=end]').textContent=tour?'세계여행 마치기':'여정 마치기';
  host.querySelectorAll('[data-view]').forEach(b=>{b.setAttribute('aria-pressed',String(s.view===b.dataset.view));b.disabled=!s.ready||(b.dataset.view==='window'&&!s.seated);});
  q('.travel-clock').hidden=!s.elapsed&&s.status==='idle';const seconds=Math.floor(tour?tour.elapsed+s.elapsed:s.duration===null?s.elapsed:Math.max(0,s.duration-s.elapsed));
  q('.travel-clock small').textContent=tour?'세계여행 · 누적 집중시간':s.status==='paused'?'잠시 쉬어가는 중':s.duration===null?'누적 집중시간':'남은 집중시간';q('.travel-clock strong').textContent=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
  if(finished&&playing){finished=false;runId=crypto.randomUUID();}
 }
 const interval=setInterval(update,200);update();
 document.addEventListener('visibilitychange',()=>{if(document.hidden){actions.pause();sound.setActive(false);wasPlaying=false;}update();});
 window.addEventListener('pagehide',()=>clearInterval(interval),{once:true});
 window.addEventListener('pageshow',e=>{if(e.persisted)location.reload();});
 return {sound,update,complete(data){
  if(finished)return;finished=true;sound.setActive(false);wasPlaying=false;soundClose();
  const tour=activeTour(destination),id=tour?tour.id+'-'+tour.leg:runId;
  const result=saveReceipt({...data,id,destination});
  if(tour&&data.completed&&data.elapsed>=300&&result.saved){transferWorld(destination,data.elapsed);return;}
  if(tour)stopTour();showCompletion(result);
 },get state(){return lastState;}};
}
