import {DesertSoundscape,SOUND_PROFILES,normalizeMix,presetMix,selectedPreset,SOUND_KEY} from '/desert/src/soundscape.mjs';
import {ensureTravelStyle} from '/passport.mjs';
const KEY='journey-focus-sound-v2';
export function createTravelSound(destination){
 ensureTravelStyle();const profile=SOUND_PROFILES[destination]||SOUND_PROFILES.desert;
 let stored;try{stored=JSON.parse(localStorage.getItem(KEY)||localStorage.getItem(SOUND_KEY));}catch{}let mix=normalizeMix(stored);
 const el=document.createElement('dialog');el.id='travel-sound';el.className='travel-dialog';el.setAttribute('aria-label','음악과 환경음');
 el.innerHTML=`<header><div><small>JOURNEY RADIO · ${profile.bpm} BPM</small><h2>오늘의 풍경을 들어요.</h2></div><button data-close aria-label="소리 닫기">×</button></header><div class="travel-track"><i aria-hidden="true">♫</i><div><b>${profile.title}</b><small>가사 없이 흐르는 신스와 벨</small></div></div><div class="travel-presets" role="group" aria-label="소리 비교"><button data-preset="nature">환경음만</button><button data-preset="music">음악만</button><button data-preset="together">함께 듣기</button></div><p class="travel-note">환경음만은 바람·물결·빗소리와 열차 소리를 함께 켜요.</p>${[['music','음악',profile.title],['nature','환경음',profile.nature],['rail','열차 소리','낮은 주행음과 레일 리듬']].map(([key,title,note])=>`<div class="travel-channel"><label><input type="checkbox" data-enable="${key}"><span><b>${title}</b><small>${note}</small></span></label><div><input type="range" min="0" max="100" data-volume="${key}" aria-label="${title} 음량"><output data-level="${key}"></output></div></div>`).join('')}<button id="travel-mute">모두 끄기</button><p role="status" id="travel-sound-status"></p><button id="travel-audio-enable" hidden>소리 켜기</button><p class="travel-note">소리 설정은 모든 여행지에서 함께 사용해요.</p>`;
 document.body.append(el);const q=s=>el.querySelector(s);
 const engine=new DesertSoundscape({mix,profile:destination,onChange:s=>{
  q('#travel-sound-status').dataset.playing=String(!!s.audible);q('#travel-sound-status').textContent=s.error?'소리를 켜지 못했어요. 다시 시도해 주세요.':s.audible?'재생 중 · '+profile.title:s.active?'소리 켜짐과 음량을 확인해 주세요.':'출발하면 재생되고, 정차하면 소리도 쉬어요.';
  q('#travel-audio-enable').hidden=!(s.error||s.active&&s.context!=='running');
 }});
 function render(){el.querySelectorAll('[data-preset]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.preset===selectedPreset(mix))));for(const [key,value]of Object.entries(mix)){q(`[data-enable=${key}]`).checked=value.enabled;q(`[data-volume=${key}]`).value=value.volume;q(`[data-level=${key}]`).textContent=value.volume+'%';}q('#travel-mute').textContent=Object.values(mix).some(x=>x.enabled)?'모두 끄기':'함께 듣기';}
 function apply(){engine.setMix(mix);try{localStorage.setItem(KEY,JSON.stringify(mix));}catch{}render();if(engine.active)void engine.unlock();}
 el.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>{mix=presetMix(mix,b.dataset.preset);apply();});
 for(const key of Object.keys(mix)){q(`[data-enable=${key}]`).onchange=e=>{mix[key].enabled=e.target.checked;apply();};q(`[data-volume=${key}]`).oninput=e=>{mix[key].volume=Number(e.target.value);apply();};}
 q('#travel-mute').onclick=()=>{if(Object.values(mix).some(x=>x.enabled))for(const v of Object.values(mix))v.enabled=false;else mix=presetMix(mix,'together');apply();};
 q('#travel-audio-enable').onclick=()=>void engine.unlock();q('[data-close]').onclick=()=>el.close();render();engine.notify();
 window.addEventListener('pagehide',e=>{if(e.persisted)engine.setActive(false);else engine.dispose();});
 return Object.assign(engine,{open:()=>el.showModal()});
}
