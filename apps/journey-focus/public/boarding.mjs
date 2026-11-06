import {boardingLoadingMarkup} from '/boarding-loading.mjs';
import {CHARACTERS,characterById,createBoardingPass,formatDuration,cardTouchesReader,createTicketCut} from '/src/boarding.mjs';
import {createJourneyPicker} from '/journey-picker.mjs';

function createBoardingFeedback(){
 let context,utterance,enabled=true;
 try{enabled=localStorage.getItem('journey-focus-boarding-sound')!=='off';}catch{}
 function unlock(){if(!enabled)return;try{context??=new (window.AudioContext||window.webkitAudioContext)();void context.resume().catch(()=>{});}catch{}}
 function tone(frequency,delay,duration=.09){if(!context||!enabled)return;const t=context.currentTime+delay,osc=context.createOscillator(),gain=context.createGain();osc.type='sine';osc.frequency.value=frequency;gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(.09,t+.008);gain.gain.exponentialRampToValueAtTime(.001,t+duration);osc.connect(gain).connect(context.destination);osc.start(t);osc.stop(t+duration+.01);}
 function snip(){if(!enabled||!context)return;const t=context.currentTime,buffer=context.createBuffer(1,Math.ceil(context.sampleRate*.065),context.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/data.length,2);const source=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain();source.buffer=buffer;filter.type='highpass';filter.frequency.value=1700;gain.gain.setValueAtTime(.17,t);gain.gain.exponentialRampToValueAtTime(.001,t+.065);source.connect(filter).connect(gain).connect(context.destination);source.start(t);tone(1800,.014,.035);}
 function speak(){if(!enabled||!window.speechSynthesis||!window.SpeechSynthesisUtterance)return;try{utterance=new SpeechSynthesisUtterance('승차하였습니다.');utterance.lang='ko-KR';utterance.rate=1.05;utterance.volume=.85;const korean=speechSynthesis.getVoices().find(v=>/^ko(?:-|_)/i.test(v.lang));if(korean)utterance.voice=korean;speechSynthesis.speak(utterance);}catch{}}
 return {get enabled(){return enabled;},unlock,snip,toggle(){enabled=!enabled;try{localStorage.setItem('journey-focus-boarding-sound',enabled?'on':'off');}catch{}if(enabled)unlock();else if(utterance)try{speechSynthesis.cancel();}catch{}return enabled;},success(medium){unlock();if(medium==='card'){tone(988,0);tone(1318,.12,.12);speak();}else snip();try{navigator.vibrate?.(medium==='card'?[35,45,65]:35);}catch{}}};
}

// City decoration is separate from route/time controls for future editions.
const SEOUL_TICKET={id:'seoul',name:'서울',label:'SEOUL · 01',art:'/images/seoul-stickers/palace-gate.png'};
const ticketSticker=(name,placement)=>`<img class="ticket-sticker ticket-sticker--${placement}" src="/images/seoul-stickers/${name}.png" alt="" aria-hidden="true" draggable="false">`;
const avatar=(id='blue')=>`<svg class="pass-avatar" viewBox="0 0 160 190" aria-hidden="true" style="--avatar-color:${characterById(id).color};--avatar-suit:${characterById(id).suit}"><ellipse cx="80" cy="177" rx="36" ry="6" fill="#173d2f" opacity=".08"/><path d="M55 135q-18 8-16 27l12 2 10-19m44-10q18 8 16 27l-12 2-10-19" fill="#e6e9e0"/><path d="M60 158v18q8 10 16 0v-16m8 0v16q8 10 16 0v-18" fill="var(--avatar-suit)"/><path d="M55 134q25-13 50 0l4 28q-29 18-58 0z" fill="var(--avatar-suit)"/><path d="M80 7c-4 28-35 37-44 65-16 45 8 70 44 70s60-25 44-70c-2-9-4-18-2-27-7 5-11 12-12 18C103 37 91 24 80 7z" fill="var(--avatar-color)"/><circle cx="56" cy="78" r="12" fill="#f8f8ec"/><circle cx="104" cy="78" r="12" fill="#f8f8ec"/><path d="M80 68c-13 11-31 27-31 43 0 22 62 22 62 0 0-16-18-32-31-43z" fill="#fbfaf2"/><ellipse cx="66" cy="101" rx="4" ry="5" fill="#294776"/><ellipse cx="94" cy="101" rx="4" ry="5" fill="#294776"/><circle cx="59" cy="113" r="7" fill="#f4d263"/><circle cx="101" cy="113" r="7" fill="#f4d263"/><path d="M75 111q5-5 10 0-1 6-5 6t-5-6m-2 9q7 6 14 0" fill="none" stroke="#294776" stroke-width="3" stroke-linecap="round"/><path d="M80 135v26" stroke="#e2e7dc" stroke-width="1.5" stroke-dasharray="2 5"/></svg>`;

export function createBoarding({host,context,onBoarded,onEntered,onRetry,onOpen,onDurationChange,onApplyRecommendation,edition=SEOUL_TICKET,makePass=createBoardingPass,pickerPresentation}){
 const cityStamp=()=>`<span class="city-stamp" aria-label="${edition.name} 에디션"><b>${edition.name}행</b><small>${edition.label}</small></span>`;
 const cityArt=()=>`<img class="seoul-ticket-art" src="${edition.art}" alt="" aria-hidden="true" draggable="false">`;
 const sticker=ticketSticker;
 const ticketStickerForCity=(name,placement)=>edition.id==='seoul'||['pocket-watch','hearts-sparkles'].includes(name)?sticker(name,placement):'';
 let character='blue',medium='ticket',issued=null,busy=false,completed=false,drag=null;
 let enterAttempt=0,entryAbort,loadingProgress=0;
 const feedback=createBoardingFeedback();
 host.dataset.city=edition.id;
 try{const options=JSON.parse(localStorage.getItem('journey-focus-boarding-options')||'null');character=characterById(options?.character).id;medium=options?.medium==='card'?'card':'ticket';}catch{}
 host.innerHTML=`
 <div class="boarding-station" aria-hidden="true"><span class="station-line">02</span><span>FOCUS LINE</span><i></i><span>YOUR NEXT STOP</span></div>
 <section class="boarding-panel boarding-choose" id="boarding-choose" aria-labelledby="boarding-title">
  <div class="boarding-heading"><div><span class="boarding-eyebrow">JOURNEY FOCUS · TICKET OFFICE</span><h1 id="boarding-title">오늘의 여정을 발급하세요.</h1><p>어디로, 얼마나, 누구와 떠날까요?</p></div><div class="boarding-medium" role="group" aria-label="승차권 종류"><button data-medium="ticket">종이 승차권</button><button data-medium="card">교통카드</button></div></div>
  <div class="pass-size-stage" id="pass-size-stage"><div class="boarding-pass-slot" id="boarding-pass-slot"><div class="boarding-pass" id="boarding-pass">
   <img class="card-front-image" id="card-choice-art" src="/images/inu-transit-card.jpg" alt="인천대학교 횃불이 교통카드 앞면" draggable="false" hidden>
   <div class="card-choice-heading"><span class="card-print-brand">JF<small>FOCUS LINE</small></span><div><strong>승 차 권</strong><small>집중 여정 교통카드</small></div><span class="card-contactless" aria-hidden="true">)))</span></div>
   <div class="pass-main">${ticketStickerForCity('green-metro','edge-train')}${ticketStickerForCity('pocket-watch','edge-watch')}<div class="pass-masthead"><div class="city-ticket-brand"><strong>FOCUS EXPRESS <span>↗</span></strong>${cityArt()}${ticketStickerForCity('namsan-tower','header-tower')}</div>${cityStamp()}<span id="boarding-pass-kind">자유석 · 편도</span></div><div class="printed-journey"><small>DEPARTURE</small><strong data-boarding-from>성수</strong><span>↓</span><small id="boarding-end-label">ARRIVAL</small><strong data-boarding-to>건대입구</strong><div>집중시간 <b data-boarding-duration>25분</b></div></div><div class="pass-fineprint">천천히 흘러가는 풍경과 함께하는 나만의 시간.</div></div>
   <aside class="pass-stub">${ticketStickerForCity('hearts-sparkles','traveler')}<span class="boarding-eyebrow">YOUR TRAVELER</span><div id="boarding-avatar-preview"></div><strong data-boarding-character>블루</strong><span>기본 캐릭터 · 색상 선택</span><div class="pass-barcode" aria-hidden="true"></div><span class="pass-stub-note">좌석은 열차 안에서<br>직접 골라 주세요.</span></aside>
  </div></div><div class="card-journey-fields journey-booking-fields" id="card-journey-fields"><div class="boarding-field-title"><span>01</span> 어디서 출발할까요?</div><div id="boarding-route-fields"></div><div class="boarding-field-title"><span>02</span> 나에게 필요한 집중시간</div><div id="boarding-duration-fields"></div></div></div>
  <div class="boarding-lower"><fieldset class="boarding-characters"><legend>03 <span>함께할 캐릭터</span></legend><div>${CHARACTERS.map(c=>`<button type="button" data-character="${c.id}" aria-pressed="false" style="--swatch:${c.color}">${avatar(c.id)}<span>${c.name}</span><i aria-hidden="true">✓</i></button>`).join('')}</div></fieldset><div class="boarding-issue"><span id="boarding-summary"></span><button id="boarding-next" disabled>승차권 발급하기 <span>↗</span></button><p id="boarding-status" role="status">노선을 준비하고 있어요.</p><button id="boarding-retry" class="boarding-text-button" hidden>노선 다시 불러오기</button></div></div>
 </section>
 <section class="boarding-panel boarding-inspect" id="boarding-inspect" hidden aria-labelledby="inspect-title">
  <div class="boarding-heading"><div><span class="boarding-eyebrow">02 · BOARDING GATE</span><h1 id="inspect-title">승차권을 보여 주세요.</h1><p id="boarding-instruction">오른쪽 확인용 티켓을 잡고 옆으로 뜯어 주세요.</p></div><span class="gate-sign">02 <small>PLATFORM</small></span></div>
  <div class="boarding-gate" id="boarding-gate">
   <div class="receipt" id="boarding-receipt"><div class="receipt-main"><div class="pass-masthead"><strong>FOCUS EXPRESS ↗</strong><div class="receipt-city">${cityArt()}${cityStamp()}</div><span data-boarding-date></span></div><span class="boarding-eyebrow">BOARDING PASS</span><div class="receipt-route"><strong data-boarding-from></strong><span>→</span><strong data-boarding-to></strong></div><div class="receipt-meta"><span>집중시간 <b data-boarding-duration></b></span><span>캐릭터 <b data-boarding-character></b></span></div><div class="pass-barcode" aria-hidden="true"></div><span class="receipt-number" data-boarding-id></span><span class="boarding-stamp" aria-hidden="true">탑승 확인</span></div><div class="tear-stub" id="tear-stub"><span class="boarding-eyebrow">승무원 확인용</span><strong data-boarding-to></strong><b data-boarding-duration></b><span class="stub-arrow" aria-hidden="true">✂</span><small>절취선을 따라<br>일자로 잘라 주세요</small><div class="pass-barcode" aria-hidden="true"></div></div><button class="ticket-cut" id="ticket-cut" aria-label="절취선 위나 아래 끝에서 반대쪽 끝까지 일자로 그어 자르기"><span class="cut-guide" aria-hidden="true"></span><span class="cut-trace" aria-hidden="true"></span><span class="cut-scissors" aria-hidden="true">✂</span></button></div>
   <div class="transit-card" id="transit-card" hidden role="button" tabindex="0" aria-label="교통카드를 잡고 단말기로 끌어서 놓기">
    <img class="card-front-image" src="/images/inu-transit-card.jpg" alt="인천대학교 횃불이 교통카드 앞면" draggable="false">
   </div>
   <div class="card-reader" id="card-reader" hidden><span class="reader-label">FOCUS LINE · ENTRY</span><div class="reader-screen"><span id="reader-message">카드를 대어 주세요</span><strong>02</strong></div><button id="reader-target" aria-label="카드를 끌어 놓을 단말기 위치"><svg viewBox="0 0 70 70" aria-hidden="true"><path d="M25 18q18 17 0 34m11-43q28 26 0 52m-20-33q7 7 0 14" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg><span>카드를 여기에 놓아 주세요</span></button><div class="reader-light"></div></div>
  </div>
  <div class="card-trip-summary" id="card-trip-summary" hidden><span><b data-boarding-from></b> → <b data-boarding-to></b></span><span>집중시간 <b data-boarding-duration></b></span><span>함께할 친구 <b data-boarding-character></b></span></div>
  <div class="boarding-confirmation" id="boarding-confirmation" role="status" hidden><span aria-hidden="true">✓</span><strong>승차하였습니다</strong><small>객실로 들어가고 있어요.</small></div>
  <div class="boarding-feedback-tools"><button id="boarding-feedback" class="boarding-text-button" aria-pressed="true">♫ 안내소리 켬</button></div>
  <div class="boarding-gate-actions"><button id="boarding-back" class="boarding-text-button">← 다시 고르기</button><p id="boarding-gate-status" role="status">승차권이 준비됐어요.</p><button id="boarding-use" class="boarding-use">확인용 티켓 뜯기 <span>→</span></button></div>
 </section>
 ${boardingLoadingMarkup()}
 <div class="boarding-foot"><span>BAI · JOURNEY FOCUS</span><span>탑승 후 원하는 자리에 앉으면 여정을 시작할 수 있어요.</span><span>YOUR TIME. YOUR JOURNEY.</span></div>`;
 const $=id=>host.querySelector('#'+id);
 // Issued paper/card keep their shared 5px/mm display scale. The editable
 // paper ticket has its own enlarged canvas so its controls remain readable.
 function fitPasses(){const choosing=!$('boarding-choose').hidden,area=choosing?$('boarding-pass-slot'):$('boarding-gate'),r=area.getBoundingClientRect(),style=getComputedStyle(area);const height=choosing?r.height:r.height-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom);if(r.width>0&&height>0){host.style.setProperty('--pass-zoom',String(Math.min(1.2,r.width/700,height/428)));if(choosing&&medium==='ticket')host.style.setProperty('--editor-zoom',String(matchMedia('(max-width:799px)').matches?1:Math.min(1,r.width/1120,height/520)));}}
 const sizeObserver=new ResizeObserver(fitPasses);sizeObserver.observe($('pass-size-stage'));sizeObserver.observe($('boarding-pass-slot'));sizeObserver.observe($('boarding-gate'));sizeObserver.observe(host);
 $('boarding-route-fields').append(document.querySelector('.station-selects'),document.querySelector('#route-summary'));
 $('boarding-duration-fields').append(document.querySelector('#duration-picker'));
 const picker=createJourneyPicker({host:$('duration-picker'),context,onChange:onDurationChange,onApply:onApplyRecommendation,onValidityChange:()=>update(),presentation:pickerPresentation});
 const bookingFields=$('card-journey-fields'),passMain=$('boarding-pass').querySelector('.pass-main'),passStub=$('boarding-pass').querySelector('.pass-stub'),characters=host.querySelector('.boarding-characters'),lower=host.querySelector('.boarding-lower'),issue=host.querySelector('.boarding-issue');
 function placeTicketControls(){
  const target=medium==='ticket'?passMain:$('pass-size-stage');
  if(bookingFields.parentElement!==target)target.append(bookingFields);
  const characterTarget=medium==='ticket'?passStub:lower;
  if(characters.parentElement!==characterTarget){if(medium==='ticket')passStub.append(characters);else lower.insertBefore(characters,issue);}
 }
 const rideBar=document.querySelector('#ride-bar');rideBar.append(document.querySelector('#start'),document.querySelector('#connection'),document.querySelector('#data-button'));
 function update(){
  const c=context(),traveler=characterById(character),p=issued||{...c,character,medium};
  host.dataset.medium=medium;host.style.setProperty('--boarding-color',traveler.color);host.style.setProperty('--boarding-suit',traveler.suit);
  placeTicketControls();
  $('card-choice-art').hidden=medium!=='card';picker.update(c.recommendation);
  $('boarding-pass-kind').textContent=p.duration===null?(edition.unlimitedKind||'자유석 · 무제한 순환'):(edition.kind||'자유석 · 편도');$('boarding-end-label').textContent=p.duration===null?(edition.unlimitedHeading||'CIRCLE LINE'):'ARRIVAL';
  host.querySelectorAll('[data-medium]').forEach(b=>{b.classList.toggle('selected',b.dataset.medium===medium);b.setAttribute('aria-pressed',String(b.dataset.medium===medium));});
  host.querySelectorAll('[data-character]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.character===character)));
  $('boarding-avatar-preview').innerHTML=avatar(character);
  for(const [field,value]of Object.entries({from:p.from||'출발역',to:p.duration===null?(edition.unlimitedDestination||'2호선 순환'):p.to||'도착역',duration:formatDuration(p.duration),character:characterById(p.character).name,id:p.id||'',date:p.date||''}))host.querySelectorAll(`[data-boarding-${field}]`).forEach(el=>el.textContent=value);
  $('boarding-summary').textContent=c.ready?c.duration===null?`${c.from} 출발 · ${edition.unlimitedSummary||'∞ 무제한 순환'}`:`${c.from} ${edition.routeArrow||'→'} ${c.to} · ${formatDuration(c.duration)}`:'여정을 준비하고 있어요';
  $('boarding-next').disabled=!c.ready||!picker.valid||busy;$('boarding-next').innerHTML=medium==='card'?'교통카드 준비하기 <span>↗</span>':'승차권 발급하기 <span>↗</span>';
  $('boarding-status').textContent=c.error?'노선을 불러오지 못했어요. 다시 시도해 주세요.':!picker.valid?'1분부터 2시간까지 골라 주세요.':c.ready?c.statusText|| (c.duration===null?'원할 때 종료할 수 있는 2호선 순환권이에요.':'시간을 바꾸면 어울리는 실제 도착역을 추천해요.'):'노선을 준비하고 있어요.';$('boarding-retry').hidden=!c.error;
  fitPasses();
 }
 for(const button of host.querySelectorAll('[data-character]'))button.onclick=()=>{if(busy)return;character=button.dataset.character;update();};
 for(const button of host.querySelectorAll('[data-medium]'))button.onclick=()=>{if(busy)return;medium=button.dataset.medium;update();};
 $('boarding-retry').onclick=onRetry;
 $('boarding-next').onclick=()=>{try{const c=context();if(!c.ready)return;resetDrag();$('boarding-confirmation').hidden=true;host.dataset.feedback='';issued=makePass({...c,character,medium});try{localStorage.setItem('journey-focus-boarding-options',JSON.stringify({character,medium}));}catch{}update();$('boarding-choose').hidden=true;$('boarding-inspect').hidden=false;host.dataset.stage='inspect';$('reader-message').textContent='카드를 대어 주세요';$('boarding-gate-status').textContent=medium==='card'?'교통카드가 준비됐어요.':'승차권이 준비됐어요.';$('boarding-receipt').hidden=medium!=='ticket';$('transit-card').hidden=medium!=='card';$('card-reader').hidden=medium!=='card';$('card-trip-summary').hidden=medium!=='card';$('inspect-title').textContent=medium==='card'?'카드를 찍고, 일상 밖으로.':'절취선을 따라 잘라 주세요.';$('boarding-instruction').textContent=medium==='card'?'카드를 잡고 단말기 가운데로 끌어서 놓아 주세요.':'절취선의 위나 아래 끝에서 반대쪽 끝까지 일자로 그어 주세요.';$('boarding-use').innerHTML='버튼으로 승차 확인 <span>↵</span>';$('boarding-use').focus({preventScroll:true});}catch(error){$('boarding-status').textContent=error.message;}};
 function resetDrag(){const previous=drag;drag=null;host.dataset.gesture='';$('transit-card').classList.remove('is-dragging');$('transit-card').style.removeProperty('--drag-x');$('transit-card').style.removeProperty('--drag-y');$('card-reader').classList.remove('reader-ready');$('ticket-cut').style.setProperty('--cut-p','0');$('ticket-cut').classList.remove('cut-up');for(const el of [$('transit-card'),$('ticket-cut')])if(previous&&el.hasPointerCapture?.(previous.id))el.releasePointerCapture(previous.id);}
 function cancelDrag(message){resetDrag();if(message&&!busy&&host.dataset.stage==='inspect')$('boarding-gate-status').textContent=message;}
 $('boarding-back').onclick=()=>{if(busy)return;issued=null;resetDrag();$('boarding-inspect').hidden=true;$('boarding-choose').hidden=false;host.dataset.stage='choose';update();$('boarding-next').focus({preventScroll:true});};
 function finish(){if(busy||completed||!issued)return;busy=true;completed=true;$('boarding-use').disabled=true;$('boarding-back').disabled=true;
  if(medium==='card'){const card=$('transit-card').getBoundingClientRect(),target=$('reader-target').getBoundingClientRect(),zoom=parseFloat(getComputedStyle($('transit-card')).zoom)||1,dx=drag?.kind==='card'?drag.dx:0,dy=drag?.kind==='card'?drag.dy:0;host.style.setProperty('--tap-x',`${(target.x+target.width/2-(card.x+card.width/2)+dx)/zoom}px`);host.style.setProperty('--tap-y',`${(target.y+target.height/2-(card.y+card.height/2)+dy)/zoom}px`);}
  resetDrag();feedback.success(medium);host.dataset.feedback=medium;host.classList.add('boarding-used');host.dataset.stage='boarding';$('reader-message').textContent='승차하였습니다';$('boarding-confirmation').hidden=false;$('boarding-gate-status').textContent='탑승 확인 완료. 객실로 들어갑니다.';
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  setTimeout(startLoading,reduced?300:medium==='card'?1800:1250);
 }
 function showLoading(progress){
  const value=Number.isFinite(progress.progress)?Math.min(100,Math.max(0,progress.progress)):loadingProgress;loadingProgress=Math.max(loadingProgress,value);
  const percent=Math.floor(loadingProgress);$('arrival-percent').textContent=percent+'%';$('arrival-fill').style.width=percent+'%';$('arrival-meter').setAttribute('aria-valuenow',String(percent));
  if(progress.label)$('arrival-status').textContent=progress.label;if(progress.detail)$('arrival-detail').textContent=progress.detail;
  $('arrival-cabin').className=progress.stage==='world'||percent===100?'done':'active';$('arrival-world').className=percent===100?'done':progress.stage==='world'?'active':'';
 }
 const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 async function startLoading(){
  if(!issued)return;const attempt=++enterAttempt;entryAbort?.abort();entryAbort=new AbortController();loadingProgress=0;host.dataset.stage='loading';host.classList.remove('loading-failed','boarding-leaving');$('boarding-choose').hidden=true;$('boarding-inspect').hidden=true;$('boarding-loading').hidden=false;$('boarding-loading').setAttribute('aria-busy','true');$('arrival-retry').hidden=true;$('arrival-title').textContent='열차가 들어오는 중이에요.';showLoading({progress:0,stage:'cabin',label:'객실과 창밖 풍경을 준비하고 있어요.',detail:'준비가 끝나면 자동으로 열차에 탑승해요.'});$('arrival-title').focus({preventScroll:true});
  await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);
  if(attempt!==enterAttempt)return;
  try{
   await onBoarded(issued,{signal:entryAbort.signal,onProgress:p=>{if(attempt===enterAttempt)showLoading(p);}});
   if(attempt!==enterAttempt)return;showLoading({progress:100,stage:'world',label:'열차가 도착했어요.',detail:'이제 마음에 드는 자리에 앉아 보세요.'});$('boarding-loading').setAttribute('aria-busy','false');
   await pause(matchMedia('(prefers-reduced-motion: reduce)').matches?50:250);if(attempt!==enterAttempt)return;
   host.classList.add('boarding-leaving');await pause(matchMedia('(prefers-reduced-motion: reduce)').matches?30:380);if(attempt!==enterAttempt)return;
   host.hidden=true;host.classList.remove('boarding-leaving');onEntered?.();
  }catch(error){if(attempt!==enterAttempt||error.name==='AbortError')return;host.classList.add('loading-failed');$('boarding-loading').setAttribute('aria-busy','false');$('arrival-title').textContent='열차 준비가 잠시 멈췄어요.';$('arrival-status').textContent=error.message||'열차를 준비하지 못했어요. 다시 시도해 주세요.';$('arrival-detail').textContent='승차권은 그대로 보관하고 있어요.';$('arrival-retry').hidden=false;}
 }
 $('arrival-retry').onclick=startLoading;
 $('boarding-use').onclick=()=>{feedback.unlock();finish();};$('reader-target').onclick=()=>{$('boarding-gate-status').textContent='교통카드를 잡고 이 단말기 위로 끌어서 놓아 주세요.';};
 const card=$('transit-card'),cut=$('ticket-cut');
 card.onpointerdown=e=>{if(busy||medium!=='card'||e.button!==0||!e.isPrimary)return;e.preventDefault();resetDrag();feedback.unlock();drag={kind:'card',id:e.pointerId,x:e.clientX,y:e.clientY,dx:0,dy:0};card.setPointerCapture(e.pointerId);card.classList.add('is-dragging');host.dataset.gesture='card';};
 function moveCard(e){if(drag?.kind!=='card'||drag.id!==e.pointerId)return;drag.dx=e.clientX-drag.x;drag.dy=e.clientY-drag.y;const zoom=parseFloat(getComputedStyle(card).zoom)||1;card.style.setProperty('--drag-x',`${drag.dx/zoom}px`);card.style.setProperty('--drag-y',`${drag.dy/zoom}px`);const ready=cardTouchesReader(card.getBoundingClientRect(),$('reader-target').getBoundingClientRect());$('card-reader').classList.toggle('reader-ready',ready);$('boarding-gate-status').textContent=ready?'여기에 놓으면 승차해요.':'카드를 단말기 가운데로 옮겨 주세요.';}
 card.onpointermove=moveCard;card.onpointerup=e=>{if(drag?.kind!=='card'||drag.id!==e.pointerId)return;moveCard(e);if(Math.hypot(drag.dx,drag.dy)>=18&&cardTouchesReader(card.getBoundingClientRect(),$('reader-target').getBoundingClientRect()))finish();else cancelDrag('단말기 위에 놓아 주세요. 카드를 다시 움직일 수 있어요.');};
 card.onkeydown=e=>{if((e.code==='Enter'||e.code==='Space')&&!e.repeat){e.preventDefault();feedback.unlock();finish();}};
 cut.onpointerdown=e=>{if(busy||medium!=='ticket'||e.button!==0||!e.isPrimary)return;e.preventDefault();resetDrag();feedback.unlock();const r=cut.getBoundingClientRect(),path=createTicketCut({x:r.x+r.width/2,top:r.top,bottom:r.bottom,tolerance:Math.max(18,r.width*.65)},{x:e.clientX,y:e.clientY});if(!path){$('boarding-gate-status').textContent='절취선의 위쪽 또는 아래쪽 끝에서 시작해 주세요.';return;}drag={kind:'cut',id:e.pointerId,path,tick:0};cut.classList.toggle('cut-up',path.direction===-1);cut.setPointerCapture(e.pointerId);host.dataset.gesture='cut';};
 function moveCut(e){if(drag?.kind!=='cut'||drag.id!==e.pointerId)return null;const result=drag.path.move({x:e.clientX,y:e.clientY});if(!result.valid){cancelDrag('선을 벗어났어요. 절취선 끝에서 다시 일자로 그어 주세요.');return null;}cut.style.setProperty('--cut-p',String(result.progress));const tick=Math.floor(result.progress*4);if(tick>drag.tick&&tick<4){drag.tick=tick;feedback.snip();}$('boarding-gate-status').textContent=`절취선을 따라 자르는 중 · ${Math.round(result.progress*100)}%`;return result;}
 cut.onpointermove=moveCut;cut.onpointerup=e=>{if(drag?.kind!=='cut'||drag.id!==e.pointerId)return;const result=moveCut(e);if(result?.complete)finish();else if(drag)cancelDrag('끝까지 이어서 잘라 주세요. 절취선 끝에서 다시 시작해요.');};cut.onclick=e=>{if(e.detail===0){feedback.unlock();finish();}};
 for(const el of [card,cut]){el.onpointercancel=()=>cancelDrag('동작이 취소됐어요. 다시 시도해 주세요.');el.onlostpointercapture=()=>{if(drag)cancelDrag();};}
 window.addEventListener('blur',()=>cancelDrag());window.addEventListener('resize',()=>cancelDrag());document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelDrag();});
 function feedbackLabel(){$('boarding-feedback').setAttribute('aria-pressed',String(feedback.enabled));$('boarding-feedback').textContent=feedback.enabled?'♫ 안내소리 켬':'♫ 안내소리 끔';}
 $('boarding-feedback').onclick=()=>{feedback.toggle();feedbackLabel();};feedbackLabel();
 update();host.dataset.stage='choose';
 function openOffice(){++enterAttempt;entryAbort?.abort();entryAbort=null;onOpen?.();issued=null;busy=false;completed=false;host.hidden=false;host.classList.remove('boarding-used','boarding-leaving','loading-failed');document.body.classList.add('boarding-mode');document.querySelector('#journey-workspace').hidden=true;$('boarding-choose').hidden=false;$('boarding-inspect').hidden=true;$('boarding-loading').hidden=true;$('boarding-use').disabled=false;$('boarding-back').disabled=false;resetDrag();$('boarding-confirmation').hidden=true;host.dataset.feedback='';host.dataset.stage='choose';update();}
 $('arrival-back').onclick=openOffice;
 return {update,open:openOffice};
}
