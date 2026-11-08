import {setVisualQuality} from '/visual-quality.mjs';
import {createCabin} from '/cabin.mjs';
import {characterById} from '/src/boarding.mjs';
const stage=document.querySelector('#cabin-stage'),parentOrigin=new URLSearchParams(location.search).get('parent');
const localFrame=['localhost','127.0.0.1'].includes(location.hostname);
const allowed=parentOrigin===location.origin||(localFrame&&/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(parentOrigin||''));
let cabin,active=true,lastState='',character=characterById(new URLSearchParams(location.search).get('character')).id;
let session={state:'idle',elapsed:0,duration:0};
function notify(type,data={}){if(allowed&&parent!==window)parent.postMessage({type:'jf:cabin-'+type,...data},parentOrigin);}
function publish(state){const s=state||cabin?.snapshot();if(!s)return;const payload={...s,posture:stage.dataset.posture||s.posture,character:stage.dataset.character};const text=JSON.stringify(payload);if(text!==lastState){lastState=text;notify('state',{state:payload});}}
window.addEventListener('message',event=>{if(event.source!==parent||event.origin!==parentOrigin)return;if(event.data?.type==='jf:cabin-quality')setVisualQuality(event.data.quality);if(event.data?.type==='jf:cabin-active'){active=Boolean(event.data.active);cabin?.setActive(active);}if(event.data?.type==='jf:cabin-seat')cabin?.chooseSeat(event.data.id);if(event.data?.type==='jf:cabin-session'){session=event.data.session||{};cabin?.setSession(session);}if(event.data?.type==='jf:cabin-configure'){character=characterById(event.data.character).id;cabin?.setCharacter(character);if(event.data.reset)cabin?.reset();publish();}});
window.addEventListener('keydown',event=>{if(!active||event.repeat||event.isComposing||/^(INPUT|SELECT|TEXTAREA|BUTTON|A)$/.test(event.target?.tagName))return;if(event.code==='Space'){event.preventDefault();notify('shortcut',{key:'space'});}if(event.key==='Escape')notify('shortcut',{key:'escape'});});
try{cabin=await createCabin({host:stage,onWindow:()=>notify('window'),onState:publish,onProgress:progress=>notify('progress',{progress}),character});cabin.setCharacter(character);cabin.setSession(session);cabin.setActive(active);notify('ready');publish();}
catch{stage.replaceChildren(Object.assign(document.createElement('p'),{className:'cabin-boot',textContent:'객실을 불러오지 못했어요. 새로고침해 주세요.'}));notify('error');}
const timer=setInterval(()=>{if(active)publish();},125);
window.addEventListener('pagehide',()=>{clearInterval(timer);cabin?.suspend();});
