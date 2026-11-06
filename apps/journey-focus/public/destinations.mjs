const host=document.getElementById('destination-screen');
const places={
 seoul:{name:'서울',english:'SEOUL, SOUTH KOREA',line:'익숙한 도시를, 새로운 속도로.',description:'한강을 건너고, 도시의 하루를 지나며.<br>2호선 창가에서 나만의 집중 시간을 시작해요.',tag:'도시 · 2호선 순환',number:'01',lat:37.5446,lon:127.0559},
 swiss:{name:'스위스',english:'BERNINA, SWITZERLAND',line:'호수 너머, 알프스의 고요 속으로.',description:'푸른 호수와 산이 펼쳐지는 베르니나선.<br>라고 비앙코 옆의 짧은 여정을 먼저 만나보세요.',tag:'자연 · 베르니나선',number:'02',lat:46.399,lon:10.028}
};
let selected='seoul',globe,loadingApp=false;
host.innerHTML=`
 <header class="atlas-header"><a href="/" class="atlas-brand"><img src="/favicon.svg" alt="" width="34" height="34"><span>Journey <em>Focus</em><small>창밖으로 떠나는 집중</small></span></a><span class="atlas-header-note">어디에 머물든, 나를 위한 시간.</span><span class="atlas-edition">WORLD COLLECTION <b>01 — 02</b></span></header>
 <main class="atlas-main" id="atlas-main">
  <div class="atlas-intro"><span class="atlas-kicker">A LITTLE ESCAPE, A WORLD AWAY</span><h1 tabindex="-1">오늘은 어느 풍경에<br>머물러 볼까요?</h1><p>지구본을 돌려, 나의 다음 창가를 찾아보세요.</p></div>
  <div class="atlas-globe-column"><div class="atlas-globe" id="atlas-globe"><canvas id="atlas-canvas" tabindex="0" role="img" aria-label="회전 가능한 세계 지구본. 드래그 또는 방향키로 회전하세요. 여행지는 아래 버튼으로도 선택할 수 있습니다."></canvas><div class="atlas-pins" id="atlas-pins"><button class="atlas-pin" data-pin="seoul" aria-label="서울 여행지 선택"><i></i><span>서울 <small>SEOUL</small></span></button><button class="atlas-pin" data-pin="swiss" aria-label="스위스 여행지 선택"><i></i><span>스위스 <small>SWITZERLAND</small></span></button></div><span class="atlas-compass" aria-hidden="true">N<br>✧</span><span class="atlas-globe-status" id="atlas-globe-status" role="status">지구본을 펼치고 있어요…</span></div><div class="atlas-rotate"><button id="atlas-left" aria-label="지구본 왼쪽으로 회전">←</button><span>드래그해서 돌려보세요 <small>DRAG TO EXPLORE</small></span><button id="atlas-right" aria-label="지구본 오른쪽으로 회전">→</button></div></div>
  <aside class="atlas-selection"><nav class="atlas-tabs" aria-label="여행지"><button data-place="seoul" aria-pressed="true"><span>01</span> 서울</button><button data-place="swiss" aria-pressed="false"><span>02</span> 스위스</button></nav><div class="atlas-destination" aria-live="polite"><div class="atlas-destination-top"><span id="atlas-country"></span><b id="atlas-number"></b></div><div class="atlas-art" id="atlas-art" aria-hidden="true"></div><div class="atlas-place-heading"><h2 id="atlas-name"></h2><span id="atlas-tag"></span></div><h3 id="atlas-line"></h3><p id="atlas-description"></p><div class="atlas-route" id="atlas-route"></div></div><button class="atlas-continue" id="atlas-continue"><span>서울 승차권 만들기</span><b>↗</b></button><p class="atlas-selection-note" id="atlas-selection-note"></p></aside>
 </main>

 <footer class="atlas-footer"><span>YOUR TIME. YOUR JOURNEY.</span><span>지금 떠날 수 있는 두 가지 풍경</span><a href="https://www.naturalearthdata.com/about/terms-of-use/" target="_blank" rel="noopener">Map · Natural Earth</a></footer>`;

// Local vector illustrations stay crisp and match the existing printed ticket.
const swissArt=`<svg viewBox="0 0 460 190" fill="none"><path d="M10 158 105 34l58 71L234 9l99 118 38-49 79 83" fill="#c1cec3" stroke="#657b70" stroke-width="1.5"/><path d="m68 82 37-48 37 45-25-10-13 14-16-9zm112-1 54-72 64 77-35-17-24 8-17-26-21 26" fill="#fffaf0"/><path d="M0 164q90-33 177-4t283-9v39H0" fill="#a8c5c8"/><path d="M5 172q95-25 198 4m58 1q77 8 182-10" stroke="#e8f1e7" stroke-width="3"/><path d="M12 145q170-15 255 7t179-11" stroke="#657b70" stroke-width="2" stroke-dasharray="3 5"/><g transform="translate(278 118)"><rect width="85" height="27" rx="5" fill="#ba705d" stroke="#644e42" stroke-width="2"/><path d="M0 12h85" stroke="#f8ebd1" stroke-width="3"/><path d="M8 5h13v7H8zm21 0h13v7H29zm21 0h13v7H50zm21 0h8v7h-8z" fill="#e4ede3"/><circle cx="14" cy="28" r="4" fill="#48574d"/><circle cx="70" cy="28" r="4" fill="#48574d"/></g></svg>`;
const seoulArt=`<div class="atlas-seoul-art"><img src="/images/seoul-stickers/palace-gate.png" alt=""><img src="/images/seoul-stickers/namsan-tower.png" alt=""><img src="/images/seoul-stickers/green-metro.png" alt=""></div>`;
const $=id=>document.getElementById(id);
function select(id,move=true){
 if(!places[id])return;selected=id;const p=places[id];host.dataset.destination=id;
 $('atlas-country').textContent=p.english;$('atlas-number').textContent=p.number;$('atlas-name').textContent=p.name;$('atlas-tag').textContent=p.tag;$('atlas-line').textContent=p.line;$('atlas-description').innerHTML=p.description;$('atlas-art').innerHTML=id==='swiss'?swissArt:seoulArt;
 $('atlas-route').innerHTML=id==='seoul'?'<span>성수</span><i></i><span>2호선 순환</span>':'<span>알프스</span><i></i><span>라고 비앙코</span>';
 $('atlas-continue').firstElementChild.textContent=`${p.name} 승차권 만들기`;
 $('atlas-selection-note').textContent=id==='swiss'?'약 1.6km · 첫 해외 풍경 체험':'집중 시간에 맞춰 도착역을 추천해요.';
 host.querySelectorAll('[data-place]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.place===id)));
 host.querySelectorAll('[data-pin]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.pin===id)));
 if(move)globe?.focus(p);
}
function swissTicket(){return openTicket('swiss');}
function seoulTicket(){return openTicket('seoul');}
async function openTicket(destination){
 if(loadingApp)return;loadingApp=true;const button=$('atlas-continue');button.disabled=true;button.firstElementChild.textContent=places[destination].name+' 승차권 준비 중…';
 try{
  if(destination==='swiss')await import('/swiss-ticket.mjs');else await import('/app.mjs');
  globe?.setActive(false);document.body.classList.remove('destination-mode');host.hidden=true;history.replaceState(null,'','?destination='+destination);
  if(!$('change-destination')){const back=document.createElement('a');back.id='change-destination';back.className='atlas-back seoul-world-back';back.href='/';back.textContent='← 여행지 다시 고르기';$('boarding-screen').prepend(back);}
  $('boarding-title')?.setAttribute('tabindex','-1');$('boarding-title')?.focus({preventScroll:true});
 }catch(error){console.error(error);$('atlas-selection-note').textContent='승차권을 불러오지 못했어요. 다시 눌러 주세요.';}
 finally{loadingApp=false;button.disabled=false;button.firstElementChild.textContent=places[destination].name+' 승차권 만들기';}
}
host.querySelectorAll('[data-place]').forEach(b=>b.onclick=()=>select(b.dataset.place));
host.querySelectorAll('[data-pin]').forEach(b=>b.onclick=()=>select(b.dataset.pin));
$('atlas-continue').onclick=()=>selected==='swiss'?swissTicket():seoulTicket();

$('atlas-left').onclick=()=>globe?.rotate(-25,0);$('atlas-right').onclick=()=>globe?.rotate(25,0);
select('seoul',false);
const destination=new URLSearchParams(location.search).get('destination');
if(destination==='swiss'){select('swiss',false);swissTicket();}else if(destination==='seoul'){void seoulTicket();}
if(!['seoul','swiss'].includes(destination)){
 import('/destination-globe.mjs').then(async({createGlobe})=>{
  globe=await createGlobe({canvas:$('atlas-canvas'),container:$('atlas-globe'),pins:host.querySelectorAll('[data-pin]'),places});
  $('atlas-globe-status').hidden=true;globe.setActive(!host.hidden&&!$('atlas-main').hidden);
 }).catch(error=>{console.error(error);$('atlas-globe-status').textContent='지구본을 표시하지 못했어요. 여행지 버튼으로 선택해 주세요.';});
}
