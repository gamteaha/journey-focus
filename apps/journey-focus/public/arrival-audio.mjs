let current;
export const arrivalText=destination=>`지금 ${String(destination||'다음 여행지').replace(/[<>\r\n]/g,'').slice(0,60)}행 열차가 들어오고 있습니다. 한 걸음 물러나 안전하게 기다려 주세요.`;
export function speakArrival(destination,{status}={}){
 const text=arrivalText(destination);if(status)status.textContent=text;
 if(!window.speechSynthesis||!window.SpeechSynthesisUtterance){if(status)status.textContent=text+' · 이 브라우저는 음성 안내를 지원하지 않아요.';return false;}
 try{
  if(current)speechSynthesis.cancel();current=new SpeechSynthesisUtterance(text);current.lang='ko-KR';current.rate=.94;current.pitch=1;current.volume=.8;
  const voice=speechSynthesis.getVoices().find(v=>/^ko[-_]/i.test(v.lang));if(voice)current.voice=voice;
  current.onerror=e=>{if(status&&!['canceled','interrupted'].includes(e.error))status.textContent='안내 음성이 차단됐어요. 안내 듣기를 다시 눌러 주세요.';};
  speechSynthesis.speak(current);return true;
 }catch{if(status)status.textContent='안내 음성을 재생하지 못했어요. 다시 눌러 주세요.';return false;}
}
export function mountArrivalAudio(root,destination){
 if(!root)return;let panel=root.querySelector('.arrival-announcement');
 if(!panel){panel=document.createElement('div');panel.className='arrival-announcement';panel.innerHTML='<p role="status"></p><button type="button">♫ 열차 안내 듣기</button><button type="button" data-announcement-mute>안내소리 끄기</button>';(root.querySelector('.arrival-actions')||root).append(panel);}
 let enabled=true;try{enabled=localStorage.getItem('journey-focus-boarding-sound')!=='off';}catch{}
 const status=panel.querySelector('p'),listen=panel.querySelector('button'),mute=panel.querySelector('[data-announcement-mute]');status.textContent=arrivalText(destination);
 const render=()=>{mute.textContent=enabled?'안내소리 끄기':'안내소리 켜기';mute.setAttribute('aria-pressed',String(enabled));};
 const save=()=>{try{localStorage.setItem('journey-focus-boarding-sound',enabled?'on':'off');}catch{}};
 listen.onclick=()=>{enabled=true;save();render();speakArrival(destination,{status});};
 mute.onclick=()=>{enabled=!enabled;save();render();if(enabled)speakArrival(destination,{status});else window.speechSynthesis?.cancel();};render();
 // Mount is called at each new boarding attempt, including a newly issued
 // ticket that reuses the same loading panel.
 if(enabled)speakArrival(destination,{status});
}
window.addEventListener('pagehide',()=>window.speechSynthesis?.cancel());
