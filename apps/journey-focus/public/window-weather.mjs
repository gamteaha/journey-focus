const KEY='journey-focus-window-weather';
const DEFAULTS={mode:'mist',humidity:65};
function normalize(value){return {mode:['clear','rain','mist'].includes(value?.mode)?value.mode:DEFAULTS.mode,humidity:Number.isFinite(value?.humidity)?Math.max(0,Math.min(100,Math.round(value.humidity))):DEFAULTS.humidity};}

// A local window treatment; this does not call or alter a provider weather API.
export function createWindowWeather({scene,settingsHost}){
 let settings={...DEFAULTS};try{settings=normalize(JSON.parse(localStorage.getItem(KEY)));}catch{}
 const layer=document.createElement('div');layer.id='window-weather';layer.hidden=true;layer.setAttribute('aria-hidden','true');
 layer.innerHTML='<div class="weather-frost"></div><canvas class="weather-rain"></canvas>';
 scene.insertBefore(layer,scene.querySelector('.scene-shade'));
 const panel=document.createElement('section');panel.id='weather-settings';panel.setAttribute('aria-labelledby','weather-title');
 panel.innerHTML=`<h3 id="weather-title">창밖 날씨</h3><div class="weather-modes" role="group" aria-label="창밖 날씨"><button type="button" data-weather="clear">맑음</button><button type="button" data-weather="rain">잔잔한 비</button><button type="button" data-weather="mist">비 · 습기</button></div><label class="weather-humidity"><span>습기 강도</span><input id="weather-humidity" type="range" min="0" max="100" step="5" aria-label="습기 강도"><output for="weather-humidity"></output></label><p id="weather-status" role="status"></p>`;
 settingsHost.append(panel);
 const canvas=layer.querySelector('canvas'),ctx=canvas.getContext('2d'),range=panel.querySelector('input'),output=panel.querySelector('output'),status=panel.querySelector('p');
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),supportsBlur=CSS.supports('backdrop-filter','blur(2px)')||CSS.supports('-webkit-backdrop-filter','blur(2px)');
 let active=false,disposed=false,frame=0,last=0,time=0,width=1,height=1,frames=0;
 // Bounded, deterministic particles: no DOM nodes or 3D particles per raindrop.
 const random=i=>{const n=Math.sin(i*127.1+31.7)*43758.5453;return n-Math.floor(n);};
 const streaks=Array.from({length:72},(_,i)=>({x:random(i+1),y:random(i+105),speed:95+random(i+209)*150,length:9+random(i+307)*19}));
 const beads=Array.from({length:24},(_,i)=>({x:random(i+407),y:random(i+509),r:2+random(i+607)*4,speed:2+random(i+709)*8}));
 function paint(){
  if(!ctx)return;ctx.clearRect(0,0,width,height);
  ctx.lineWidth=.8;ctx.strokeStyle='rgba(229,240,242,.24)';ctx.beginPath();
  for(const drop of streaks){const y=(drop.y*(height+50)+time*drop.speed)%(height+50)-25,x=drop.x*width-y*.12;ctx.moveTo(x,y);ctx.lineTo(x-3,y+drop.length);}
  ctx.stroke();
  for(const bead of beads){const x=bead.x*width,y=(bead.y*(height+30)+time*bead.speed)%(height+30)-15,r=bead.r;
   ctx.beginPath();ctx.ellipse(x,y,r,r*1.4,0,0,Math.PI*2);ctx.fillStyle='rgba(111,143,150,.15)';ctx.fill();ctx.strokeStyle='rgba(239,249,248,.48)';ctx.lineWidth=.65;ctx.stroke();
   ctx.beginPath();ctx.ellipse(x-r*.25,y-r*.35,r*.32,r*.55,-.3,0,Math.PI*2);ctx.fillStyle='rgba(248,255,253,.45)';ctx.fill();
   if(bead.speed>7){const trail=ctx.createLinearGradient(x,y-r*7,x,y);trail.addColorStop(0,'rgba(237,247,245,0)');trail.addColorStop(1,'rgba(237,247,245,.19)');ctx.strokeStyle=trail;ctx.lineWidth=r*.55;ctx.beginPath();ctx.moveTo(x,y-r*7);ctx.lineTo(x,y-r);ctx.stroke();}
  }
  frames++;layer.dataset.frames=String(frames);
 }
 function shouldAnimate(){return !disposed&&active&&settings.mode!=='clear'&&!document.hidden&&!reduced.matches&&Boolean(ctx);}
 function tick(now){frame=0;if(!shouldAnimate()){layer.dataset.animating='false';return;}if(!last)last=now;if(now-last>=1000/30){time+=Math.min(.08,(now-last)/1000);last=now;paint();}frame=requestAnimationFrame(tick);}
 function reconcile(){
  cancelAnimationFrame(frame);frame=0;last=0;
  layer.hidden=!active||settings.mode==='clear';
  if(!layer.hidden){paint();if(shouldAnimate())frame=requestAnimationFrame(tick);}
  layer.dataset.animating=String(shouldAnimate());
 }
 function resize(){
  const r=layer.getBoundingClientRect();if(r.width<1||r.height<1)return;
  // Cap the canvas at 1000 CSS pixels wide, independent of device pixel ratio.
  const scale=Math.min(1,1000/r.width);width=Math.max(1,Math.round(r.width*scale));height=Math.max(1,Math.round(r.height*scale));canvas.width=width;canvas.height=height;
  if(active&&settings.mode!=='clear')paint();
 }
 function apply(persist=false){
  layer.dataset.mode=settings.mode;
  const amount=settings.mode==='mist'?settings.humidity/100:0;
  layer.style.setProperty('--weather-blur',`${settings.mode==='mist'?amount*4.5:0}px`);
  layer.style.setProperty('--weather-mist',String(amount));
  layer.dataset.blurSupported=String(supportsBlur);
  for(const button of panel.querySelectorAll('[data-weather]'))button.setAttribute('aria-pressed',String(button.dataset.weather===settings.mode));
  range.value=String(settings.humidity);range.disabled=settings.mode!=='mist';output.value=`${settings.humidity}%`;
  status.textContent=settings.mode==='clear'?'습기 없이 창밖을 바라봐요.':settings.mode==='rain'?'유리창을 타고 흐르는 잔잔한 빗방울.':supportsBlur?'비 오는 날, 창가에 옅게 서린 습기.':'비 오는 창가에 옅은 안개를 더해요.';
  if(persist)try{localStorage.setItem(KEY,JSON.stringify(settings));}catch{}
  reconcile();resize();
 }
 for(const button of panel.querySelectorAll('[data-weather]'))button.onclick=()=>{settings.mode=button.dataset.weather;apply(true);};
 range.oninput=()=>{settings.humidity=Number(range.value);apply(true);};
 const observer=new ResizeObserver(resize);observer.observe(layer);
 document.addEventListener('visibilitychange',reconcile);reduced.addEventListener('change',reconcile);apply();
 return {setActive(value){if(disposed||active===Boolean(value))return;active=Boolean(value);reconcile();resize();},dispose(){if(disposed)return;disposed=true;cancelAnimationFrame(frame);observer.disconnect();document.removeEventListener('visibilitychange',reconcile);reduced.removeEventListener('change',reconcile);layer.remove();panel.remove();}};
}
