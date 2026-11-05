import {durationFromParts,MIN_DURATION,MAX_DURATION} from '/src/journey.mjs';

export function createJourneyPicker({host,context,onChange,onApply,onValidityChange}){
 const hours=host.querySelector('#focus-hours'),minutes=host.querySelector('#focus-minutes');
 const parts=()=>durationFromParts(/^\d{1,2}$/.test(hours.value)?Number(hours.value):NaN,/^\d{1,2}$/.test(minutes.value)?Number(minutes.value):NaN);
 function edit(){const duration=parts();if(duration!==null)onChange(duration);else onValidityChange();}
 for(const input of [hours,minutes]){
  input.addEventListener('input',edit);
  input.addEventListener('blur',()=>{const duration=parts()??context().duration;hours.value=String(Math.floor(duration/3600)).padStart(2,'0');minutes.value=String(duration/60%60).padStart(2,'0');onValidityChange();});
  input.addEventListener('keydown',event=>{if(!['ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();step((event.key==='ArrowUp'?1:-1)*(input===hours?3600:60));});
 }
 function step(amount){onChange(Math.max(MIN_DURATION,Math.min(MAX_DURATION,(parts()??context().duration)+amount)));}
 host.querySelectorAll('[data-time-step]').forEach(button=>button.onclick=()=>step(Number(button.dataset.timeStep)));
 host.querySelector('#recommend-apply').onclick=onApply;
 let lastRoute='';
 function update(recommendation){
  const c=context(),h=Math.floor(c.duration/3600),m=c.duration/60%60;
  const editing=document.activeElement===hours||document.activeElement===minutes;
  for(const [input,value]of [[hours,h],[minutes,m]]){if(!editing)input.value=String(value).padStart(2,'0');input.setAttribute('aria-valuenow',String(Number(input.value)||0));}
  host.querySelector('#duration-error').hidden=parts()!==null;
  host.querySelector('[data-time-step="-3600"]').disabled=h===0;
  host.querySelector('[data-time-step="3600"]').disabled=c.duration===MAX_DURATION;
  host.querySelector('[data-time-step="-60"]').disabled=c.duration===MIN_DURATION;
  host.querySelector('[data-time-step="60"]').disabled=c.duration===MAX_DURATION;
  host.querySelector('#recommended-count').textContent=recommendation?recommendation.stopCount+'개':'…';
  host.querySelector('#recommended-route').textContent=recommendation?recommendation.from+' → '+recommendation.to:'실제 노선을 준비하고 있어요';
  const apply=host.querySelector('#recommend-apply');
  const selected=recommendation?.from===c.from&&recommendation?.to===c.to;
  apply.disabled=!recommendation||selected;apply.textContent=selected?'✓ 추천 경로 선택됨':'이 도착역으로 선택';
  host.querySelector('#pace-note').textContent=recommendation&&!selected?'도착역을 직접 골랐어요. 추천 경로를 선택하면 비슷한 속도로 떠나요.':recommendation?.shortPreview?'짧은 시간은 빠른 체험으로 재생돼요.':recommendation&&recommendation.paceDifference>.35?'이 출발역에서는 가능한 도착역 중 가장 가까운 속도로 추천해요.':'시간에 맞는 선로 거리를 골라, 비슷한 속도로 떠나요.';
  const key=recommendation?.stops.join('|')||'';
  if(key!==lastRoute){
   lastRoute=key;const track=host.querySelector('#recommended-stops');track.replaceChildren();
   const names=recommendation?.stops||[];
   for(const [i,name]of names.entries()){const stop=document.createElement('li');stop.className=i===0?'departure':i===names.length-1?'arrival':'';const dot=document.createElement('i');const label=document.createElement('span');label.textContent=name;stop.append(dot,label);if(i===0){const caption=document.createElement('small');caption.textContent='출발';stop.append(caption);}else if(i===names.length-1){const caption=document.createElement('small');caption.textContent='도착';stop.append(caption);}track.append(stop);}
   track.style.setProperty('--stop-count',String(Math.max(2,names.length)));
  }
 }
 return {update,get valid(){return parts()!==null;}};
}
