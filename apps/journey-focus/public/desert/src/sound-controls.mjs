import {DesertSoundscape,SOUND_KEY,normalizeMix,presetMix,selectedPreset} from './soundscape.mjs';

export function createSoundControls($){
 let stored;try{stored=JSON.parse(localStorage.getItem(SOUND_KEY));}catch{}
 let mix=normalizeMix(stored);
 const engine=new DesertSoundscape({mix,onChange:state=>{
  const status=$('sound-status');status.dataset.playing=String(!!state.audible);status.dataset.context=state.context;
  const layers=Object.entries(mix).filter(([,x])=>x.enabled&&x.volume>0).map(([key])=>({music:'음악',nature:'바람',rail:'열차'})[key]).join(' + ');
  status.textContent=state.error?'소리를 켜지 못했어요. 아래 버튼으로 다시 시도해 주세요.':state.audible?'재생 중 · '+layers:state.active&&state.context!=='running'?'소리 켜기를 누르면 함께 들을 수 있어요.':state.active?'소리를 모두 껐어요.':'출발하면 재생돼요. 정차하면 소리도 쉬어요.';
  $('sound-enable').hidden=!(state.error||(state.active&&state.context!=='running'));
 }});
 function refresh(){
  const selected=selectedPreset(mix);
  document.querySelectorAll('[data-sound-preset]').forEach(b=>b.setAttribute('aria-pressed',String(selected===b.dataset.soundPreset)));
  for(const [key,value]of Object.entries(mix)){
   $('sound-'+key).checked=value.enabled;$('volume-'+key).value=value.volume;$('level-'+key).textContent=value.volume+'%';
  }
  $('sound-mute').textContent=Object.values(mix).some(x=>x.enabled)?'모두 끄기':'함께 듣기';
 }
 function apply(){engine.setMix(mix);try{localStorage.setItem(SOUND_KEY,JSON.stringify(mix));}catch{}refresh();if(engine.active)void engine.unlock();}
 document.querySelectorAll('[data-sound-preset]').forEach(b=>b.onclick=()=>{mix=presetMix(mix,b.dataset.soundPreset);apply();});
 for(const key of Object.keys(mix)){
  $('sound-'+key).onchange=e=>{mix[key].enabled=e.target.checked;apply();};
  $('volume-'+key).oninput=e=>{mix[key].volume=Number(e.target.value);apply();};
 }
 $('sound-mute').onclick=()=>{if(Object.values(mix).some(x=>x.enabled))for(const value of Object.values(mix))value.enabled=false;else mix=presetMix(mix,'together');apply();};
 $('sound-enable').onclick=()=>void engine.unlock();
 const open=()=>{$('settings-dialog').close();$('sound-dialog').showModal();};
 $('sound-open').onclick=open;
 const button=document.createElement('button');button.className='focus-sound';button.textContent='♫ 소리';button.setAttribute('aria-label','음악과 환경음 설정');button.onclick=open;document.body.append(button);
 refresh();engine.notify();
 window.addEventListener('pagehide',event=>{if(event.persisted)engine.setActive(false);else engine.dispose();});
 return engine;
}
