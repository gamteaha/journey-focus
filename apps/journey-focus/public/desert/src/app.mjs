import {mascotMarkup,studyMascotMarkup} from '/mascot.mjs';
import {mountArrivalAudio} from '/arrival-audio.mjs';
import {createTravelShell} from '/travel-shell.mjs';
import {activeTour} from '/world-tour.mjs';
import {isUnlocked} from '/passport.mjs';
import {createPixelScene} from './pixel-scene.mjs';

import {Session,speedFor,sceneryPhase} from '/songdo/src/session.mjs';
import {stations} from './route.mjs';
import {tripPosition} from './journey.mjs';
import {DESERT_PASS_KEY,validDesertPass,OASIS_PASS_KEY,validOasisPass} from '/src/desert-journey.mjs';
const destination=new URLSearchParams(location.search).get('world')==='oasis'?'oasis':'desert';
const passKey=destination==='oasis'?OASIS_PASS_KEY:DESERT_PASS_KEY,validPass=destination==='oasis'?validOasisPass:validDesertPass;
if(!isUnlocked(destination)){location.replace('/?locked='+destination);await new Promise(()=>{});}
import {boardingLoadingMarkup} from '/boarding-loading.mjs';
const $=id=>document.getElementById(id),all=selector=>[...document.querySelectorAll(selector)];
let pass;try{pass=JSON.parse(sessionStorage.getItem(passKey));}catch{}
if(!validPass(pass)||new URLSearchParams(location.search).get('ticket')!==pass.id){location.replace('/?destination='+destination);await new Promise(()=>{});}
const state={from:stations.findIndex(s=>s.name===pass.from),to:stations.findIndex(s=>s.name===pass.to),minutes:pass.duration===null?Infinity:pass.duration/60,friend:pass.character,seat:null,seated:false,screen:'cabin'};
const session=new Session(state.minutes),reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
let distance=0,visualTime=0,factor=1,last=performance.now(),ready=false,art,completed=false;
let position={x:50,y:77};
let shell;
document.body.dataset.theme=pass.character;const studyImage=document.querySelector('.window-companion');studyImage.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(studyMascotMarkup(pass.character).replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" '));studyImage.alt='창가에서 공부하는 횃불이';const travelerImage=$('traveler').querySelector('img');travelerImage.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(mascotMarkup(pass.character).replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" '));
all('[data-from]').forEach(el=>el.textContent=pass.from);all('[data-to]').forEach(el=>el.textContent=pass.to);
$('cabin-trip').textContent=pass.from+' → '+pass.to+' · '+(pass.duration===null?'무제한':pass.duration/60+'분');
$('train-loading').innerHTML=boardingLoadingMarkup({hidden:false});mountArrivalAudio($('train-loading'),pass.to);
$('train-loading').querySelector('[data-boarding-from]').textContent=pass.from;
$('train-loading').querySelector('[data-boarding-to]').textContent=pass.to;
$('train-loading').querySelector('.arrival-route>span').textContent=destination==='oasis'?'05':'04';
$('train-loading').querySelector('.arrival-route>small').textContent=destination==='oasis'?'MOON OASIS':'DUNE EXPRESS';
$('arrival-back').onclick=()=>location.assign('/?destination='+destination);$('arrival-retry').onclick=()=>location.reload();
function progress(value,label){$('arrival-percent').textContent=value+'%';$('arrival-fill').style.width=value+'%';$('arrival-meter').setAttribute('aria-valuenow',value);$('arrival-status').textContent=label;}
document.addEventListener('visibilitychange',()=>{if(document.hidden&&session.status==='running'){session.pause(performance.now());updateSound();refresh();}});
$('end-journey').hidden=pass.duration!==null;
$('end-journey').onclick=()=>{session.pause(performance.now());session.status='completed';$('settings-dialog').close();finish();refresh();};
const seats=[];
for(const side of ['left','right'])for(let i=0;i<6;i++){
 const id=(side==='left'?'A':'B')+String(i+1).padStart(2,'0');
 const seat={id,side,x:side==='left'?12+(i%2)*12:76+(i%2)*12,y:49+Math.floor(i/2)*14};seats.push(seat);
 const b=document.createElement('button');b.type='button';b.textContent=id;b.dataset.seat=id;b.setAttribute('aria-label',`${id} · ${side==='left'?'왼쪽':'오른쪽'} 창가 좌석`);b.setAttribute('aria-pressed','false');
 b.onclick=()=>{state.seat=seat;state.seated=false;position={x:side==='left'?35:65,y:seat.y};updateSeat();};$('seat-'+side).append(b);
}
function updateSeat(){
 all('[data-seat]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.seat===state.seat?.id));b.classList.toggle('occupied',state.seated&&b.dataset.seat===state.seat?.id);});
 $('traveler').style.left=position.x+'%';$('traveler').style.top=position.y+'%';
 $('traveler-label').textContent=state.seated?state.seat.id+' · 내 자리':'횃불이';
 $('seat-status').textContent=state.seated?`${state.seat.id} · 나의 창가 자리. 출발 준비가 됐어요.`:state.seat?`${state.seat.id} · ${state.seat.side==='left'?'왼쪽':'오른쪽'} 창가. 앉기 버튼을 눌러 주세요.`:'자리를 누르거나 방향키 / WASD로 움직여요.';
 $('sit').disabled=!state.seat;$('sit').textContent=state.seated?'일어나기 E':'앉기 E';
 $('start').disabled=!state.seated||!ready;$('window-view').disabled=!state.seated||!ready;
 $('start').textContent=!state.seated?'먼저 자리를 골라 주세요':!ready?'풍경을 준비하고 있어요…':session.status==='paused'?'나의 여정 이어가기 ↗':'나의 여정 시작하기 ↗';
 $('seat-caption').textContent=state.seat?`${state.seat.id} · 횃불이와 나란히`:'나의 창가 자리';
}
function move(direction){if(state.seated)return;const d={up:[0,-7],down:[0,7],left:[-8,0],right:[8,0]}[direction];position.x=Math.max(33,Math.min(67,position.x+d[0]));position.y=Math.max(45,Math.min(83,position.y+d[1]));state.seat=seats.reduce((a,b)=>Math.hypot(position.x-a.x,position.y-a.y)<Math.hypot(position.x-b.x,position.y-b.y)?a:b);updateSeat();}
all('[data-move]').forEach(b=>b.onclick=()=>move(b.dataset.move));
$('sit').onclick=()=>{if(!state.seat)return;state.seated=!state.seated;position=state.seated?{x:state.seat.x,y:state.seat.y}:{x:state.seat.side==='left'?35:65,y:state.seat.y};updateSeat();};
document.addEventListener('keydown',e=>{
 if(document.querySelector('dialog[open]')||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;
 if(e.key==='Escape'&&document.body.classList.contains('focusing')){$('focus-exit').click();return;}
 if(state.screen!=='cabin'||document.body.classList.contains('focusing'))return;
 const direction={ArrowUp:'up',w:'up',W:'up',ArrowDown:'down',s:'down',S:'down',ArrowLeft:'left',a:'left',A:'left',ArrowRight:'right',d:'right',D:'right'}[e.key];
 if(direction){e.preventDefault();move(direction);}else if(e.key.toLowerCase()==='e'){$('sit').click();}
});
function start(){if(!ready||!state.seated)return;if(session.status==='completed'){session.reset(state.minutes);distance=0;visualTime=0;completed=false;}session.start(performance.now());document.body.classList.add('focusing');updateSound();void shell.sound.unlock();refresh();}
$('start').onclick=start;$('window-view').onclick=()=>{if(ready&&state.seated){document.body.classList.add('focusing');refresh();}};
$('focus-pause').onclick=()=>{if(session.status==='running')session.pause(performance.now());else start();updateSound();refresh();};
$('focus-exit').onclick=()=>{document.body.classList.remove('focusing');updateSound();updateSeat();$('start').focus({preventScroll:true});};
function reopen(){if(session.status==='running')session.pause(performance.now());location.assign('/?destination='+destination);}
$('ticket-reopen').onclick=reopen;
$('settings-open').onclick=()=>$('settings-dialog').showModal();
const focusSettings=document.createElement('button');focusSettings.className='focus-settings';focusSettings.textContent='☰ 설정';focusSettings.onclick=()=>$('settings-dialog').showModal();document.body.append(focusSettings);
$('settings-ticket').onclick=()=>{$('settings-dialog').close();reopen();};
$('about-open').onclick=()=>$('about-dialog').showModal();$('settings-about').onclick=()=>{$('settings-dialog').close();$('about-dialog').showModal();};
all('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());
$('speed').oninput=e=>{factor=Number(e.target.value);$('speed-label').textContent=factor.toFixed(1)+'×';};
function updateSound(){shell?.sound.setActive(session.status==='running');}
function history(){try{const data=JSON.parse(localStorage.getItem('journey-focus-desert-history')||'[]');return Array.isArray(data)?data.filter(x=>x&&typeof x.route==='string'&&Number.isFinite(x.minutes)&&typeof x.date==='string').slice(0,50):[];}catch{return [];}}
$('history-open').onclick=()=>{
 $('settings-dialog').close();const list=$('history-list');list.replaceChildren();const records=history();
 if(!records.length)list.textContent='아직 완료한 여정이 없어요. 첫 여행을 떠나 볼까요?';
 for(const record of records){const article=document.createElement('article');article.textContent=`${record.route} · ${record.minutes}분`;const small=document.createElement('small');small.textContent=record.date+' · '+(record.seat||'창가');article.append(small);list.append(article);}
 $('history-dialog').showModal();
};
$('new-journey').onclick=()=>{$('complete-dialog').close();reopen();};
function finish(){
 if(completed)return;completed=true;updateSound();const route=`${stations[state.from].name} → ${stations[state.to].name}`;
 const record={route,minutes:Math.round(session.elapsed/60*10)/10,seat:state.seat?.id,date:new Date().toLocaleString('ko-KR')};let saved=true;
 try{localStorage.setItem('journey-focus-desert-history',JSON.stringify([record,...history()].slice(0,50)));}catch{saved=false;}
 $('complete-summary').textContent=`${route} · ${Math.floor(session.elapsed/60)}분 ${Math.floor(session.elapsed%60)}초 집중을 마쳤어요.`+(saved?'':' 이 브라우저에서는 기록을 저장하지 못했어요.');shell.complete({from:pass.from,to:pass.to,elapsed:session.elapsed,completed:session.minutes!==Infinity&&session.elapsed>=session.minutes*60,unlimited:pass.duration===null});
}
function refresh(){
 $('end-journey').disabled=session.status==='idle'||session.status==='completed';
 const seconds=pass.duration===null?Math.floor(session.elapsed):Math.max(0,Math.ceil(session.minutes*60-session.elapsed));
 $('focus-time').textContent=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
 $('focus-state').textContent=(pass.duration===null?'누적 · ':'')+({idle:'출발 대기 · 창밖 미리보기',running:'집중 중',paused:'잠시 쉬는 중',completed:'집중 완료'})[session.status];
 $('focus-pause').textContent=({idle:'나의 여정 시작 →',running:'일시정지 Ⅱ',paused:'계속하기 →',completed:'다시 시작 →'})[session.status];
 const span=Math.abs(state.to-state.from)*300,cycle=session.elapsed/span;
 const backwards=pass.duration===null&&Math.floor(cycle)%2===1;
 const progress=pass.duration===null?cycle%1:session.elapsed/(session.minutes*60);
 const route=tripPosition(backwards?state.to:state.from,backwards?state.from:state.to,progress);
 $('focus-direction').textContent=`${destination==='oasis'?'달빛 호수선':'사막선'} · ${stations[backwards?state.from:state.to].name} 방면`;
 $('focus-route').textContent=route.current.index===(backwards?state.from:state.to)?`${route.current.name} · 도착`:`${route.current.name} → ${route.next.name}`;
 $('focus-progress').style.width=`${route.progress*100}%`;
 $('focus-distance').textContent=`가상 여행 · ${Math.round(route.progress*100)}% · ${state.seat?.id||'창가'}`;
}
async function boot(){
 progress(25,'횃불이와 객실을 준비하고 있어요.');
 const artwork=createPixelScene($('viewport'),$);
 const images=Promise.all([...document.images].map(img=>img.decode()));
 [art]=await Promise.race([Promise.all([artwork,images]),new Promise((_,reject)=>setTimeout(()=>reject(Error('Loading timeout')),25000))]);
 progress(100,destination==='oasis'?'달빛 열차가 준비됐어요.':'사막 열차가 준비됐어요.');
 await new Promise(resolve=>setTimeout(resolve,250));$('train-loading').hidden=true;$('scene-next').onclick=()=>art.next();$('loading').remove();ready=true;updateSeat();last=performance.now();
 if(activeTour(destination)){document.querySelector('[data-seat=B03]').click();$('sit').click();start();}
 let frames=0,fpsSince=last;
 function frame(now){
  const before=session.elapsed;session.tick(now);let delta=session.elapsed-before;
  if(session.status==='idle'&&document.body.classList.contains('focusing'))delta=Math.max(0,now-last)/1000;
  distance+=delta*speedFor('new',session.minutes,factor);visualTime+=reducedMotion?0:delta;last=now;
  if(document.body.classList.contains('focusing')){
   const phase=sceneryPhase(session);$('viewport').dataset.scenery=phase;
   art.draw({distance:reducedMotion?0:distance,time:visualTime,phase});
   $('travel-status').textContent=phase==='boarding'?'출발 승강장 · 곧 바깥으로 나가요':phase==='arrival'?'도착 승강장 · 오늘도 수고했어요':session.status==='paused'?'잠시 정차 · 풍경도 기다려요':'도트 사막 여행 · 모래언덕 너머로';
  }
  refresh();if(session.status==='completed')finish();frames++;
  if(now-fpsSince>1000){$('fps').textContent=`${Math.round(frames*1000/(now-fpsSince))} FPS`;frames=0;fpsSince=now;}
  requestAnimationFrame(frame);
 }
 requestAnimationFrame(frame);
}
shell=createTravelShell({destination,getState:()=>({ready,seated:state.seated,status:session.status,elapsed:session.elapsed,duration:pass.duration,view:document.body.classList.contains('focusing')?'window':'cabin'}),actions:{
 play:()=>{if(session.status==='running'){session.pause(performance.now());updateSound();refresh();}else start();},pause:()=>{if(session.status==='running'){session.pause(performance.now());updateSound();refresh();}},
 view:value=>{if(value==='window')$('window-view').click();else $('focus-exit').click();},settings:()=>$('settings-dialog').showModal(),
 end:()=>{session.pause(performance.now());session.status='completed';finish();refresh();}
}});
if($('sound-open'))$('sound-open').onclick=()=>{$('settings-dialog').close();shell.sound.open();};
if($('train-sound'))$('train-sound').closest('label').hidden=true;
if(destination==='oasis'){$('season').value='night';$('season').disabled=true;document.title='Journey Focus · 달빛 오아시스';document.querySelector('.window-top>span').textContent='MOON OASIS · STAMP COLLECTION';document.querySelector('.flow-footer').firstChild.textContent='달빛 오아시스 · 도장으로 열린 보상 여행 ';}
refresh();
boot().catch(error=>{console.error(error);$('arrival-status').textContent='풍경을 준비하지 못했어요. 다시 시도해 주세요.';$('arrival-retry').hidden=false;});
