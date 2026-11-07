// Original, procedural soundscape: no streaming service, samples, or AI calls.
export const SOUND_KEY='journey-focus-desert-sound-v1';
export const DEFAULT_MIX={music:{enabled:true,volume:35},nature:{enabled:true,volume:45},rail:{enabled:true,volume:25}};
export const PRESETS={nature:['nature','rail'],music:['music'],together:['music','nature','rail']};
export function normalizeMix(value){
 return Object.fromEntries(Object.entries(DEFAULT_MIX).map(([key,fallback])=>{
  const item=value?.[key];return [key,{enabled:typeof item?.enabled==='boolean'?item.enabled:fallback.enabled,volume:typeof item?.volume==='number'&&Number.isFinite(item.volume)?Math.max(0,Math.min(100,item.volume)):fallback.volume}];
 }));
}
export function presetMix(mix,name){
 const result=normalizeMix(mix);if(!PRESETS[name])return result;
 for(const key of Object.keys(result))result[key].enabled=PRESETS[name].includes(key);
 return result;
}
export function selectedPreset(mix){return Object.keys(PRESETS).find(name=>Object.keys(DEFAULT_MIX).every(key=>mix[key].enabled===PRESETS[name].includes(key)))||'custom';}
const STEP=60/72/2;
const CHORDS=[[50,57,60,65],[46,53,57,62],[48,55,60,64],[45,52,55,62]];
const MELODY=[[74,null,null,77,null,null,81,null],[79,null,null,null,77,null,null,null],[72,null,null,76,null,null,79,null],[74,null,null,null,69,null,null,null]];
const hz=midi=>440*2**((midi-69)/12);
export const SOUND_PROFILES={
 desert:{title:'모래 위의 작은 별',nature:'부드러운 사막 바람',bpm:72,transpose:0,filter:650,level:.26},
 seoul:{title:'창문에 머문 오후',nature:'창가의 잔잔한 빗소리',bpm:68,transpose:-2,filter:1500,level:.18},
 songdo:{title:'정원에 띄운 편지',nature:'천천히 일렁이는 물결',bpm:70,transpose:3,filter:900,level:.21},
 swiss:{title:'호수 너머의 아침',nature:'호숫가의 고요한 바람',bpm:62,transpose:5,filter:480,level:.26},
 oasis:{title:'달빛이 쉬어가는 곳',nature:'밤의 오아시스 물결',bpm:60,transpose:-5,filter:800,level:.21}
};
function target(param,value,now,tau=.09){param.cancelScheduledValues(now);param.setTargetAtTime(value,now,tau);}

export function createSoundGraph(ctx,destination=ctx.destination,profile='desert'){
 const theme=SOUND_PROFILES[profile]||SOUND_PROFILES.desert,stepSeconds=60/theme.bpm/2;
 const master=ctx.createGain(),compressor=ctx.createDynamicsCompressor();
 master.gain.value=0;compressor.threshold.value=-20;compressor.knee.value=18;compressor.ratio.value=3;compressor.attack.value=.01;compressor.release.value=.25;
 master.connect(compressor).connect(destination);
 const buses=Object.fromEntries(Object.keys(DEFAULT_MIX).map(key=>{const g=ctx.createGain();g.gain.value=0;g.connect(master);return [key,g];}));
 const sources=new Set(),voices=new Set();let seed=731;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296*2-1;};
 const noise=ctx.createBuffer(1,ctx.sampleRate*8,ctx.sampleRate),data=noise.getChannelData(0);
 // Smooth the join of the repeating noise bed; filters soften the high end.
 const edge=Math.floor(ctx.sampleRate*.08);
 for(let i=0;i<data.length;i++)data[i]=random()*Math.min(1,i/edge,(data.length-1-i)/edge);
 function noiseLayer(bus,type,frequency,q,level,rate,depth){
  const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain(),lfo=ctx.createOscillator(),mod=ctx.createGain();
  source.buffer=noise;source.loop=true;filter.type=type;filter.frequency.value=frequency;filter.Q.value=q;gain.gain.value=level;
  lfo.frequency.value=rate;mod.gain.value=depth;lfo.connect(mod).connect(gain.gain);
  source.connect(filter).connect(gain).connect(bus);source.start();lfo.start();sources.add(source);sources.add(lfo);
 }
 noiseLayer(buses.nature,'lowpass',theme.filter,.45,theme.level,.07,theme.level*.24);
 noiseLayer(buses.nature,'bandpass',1150,.6,.024,.13,.01);
 noiseLayer(buses.rail,'lowpass',230,.5,.28,1.65,.076);
 noiseLayer(buses.rail,'bandpass',420,1,.048,3.3,.028);
 const music=ctx.createBiquadFilter(),delay=ctx.createDelay(1),feedback=ctx.createGain(),wet=ctx.createGain();
 music.type='lowpass';music.frequency.value=2200;music.Q.value=.4;
 music.connect(buses.music);music.connect(delay);delay.delayTime.value=stepSeconds*1.5;feedback.gain.value=.22;wet.gain.value=.18;delay.connect(feedback).connect(delay);delay.connect(wet).connect(buses.music);
 function note(midi,time,duration,volume,pad=false,pan=0){
  const osc=ctx.createOscillator(),gain=ctx.createGain(),panner=ctx.createStereoPanner();
  osc.type=pad?'triangle':'sine';osc.frequency.value=hz(midi+theme.transpose);panner.pan.value=pan;gain.gain.value=0;
  gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(volume,time+(pad?.5:.025));gain.gain.exponentialRampToValueAtTime(.0001,time+duration);
  osc.connect(gain).connect(panner).connect(music);
  const voice={osc,gain,panner};voices.add(voice);
  osc.onended=()=>{osc.disconnect();gain.disconnect();panner.disconnect();voices.delete(voice);};osc.start(time);osc.stop(time+duration+.05);
 }
 function scheduleStep(step,time){
  const bar=Math.floor(step/8),section=Math.floor(bar/2)%4,beat=step%8;
  if(beat===0)CHORDS[section].forEach((midi,i)=>note(midi,time+i*.018,4,.09,true,(i-1.5)*.22));
  const midi=MELODY[section][beat];
  if(midi!==null){note(midi,time,2.3,.19,false,bar%2?.25:-.25);note(midi+12,time,1.05,.025,false,bar%2?-.2:.2);}
 }
 function mix(settings){for(const [key,value]of Object.entries(normalizeMix(settings)))target(buses[key].gain,value.enabled?(value.volume/100)**1.5*(key==='music'?1.3:1):0,ctx.currentTime);}
 function fade(active){target(master.gain,active?.72:0,ctx.currentTime,.075);}
 function stopNotes(){
  for(const {osc,gain}of voices){target(gain.gain,0,ctx.currentTime,.035);try{osc.stop(ctx.currentTime+.25);}catch{}}
 }
 function dispose(){stopNotes();for(const s of sources){try{s.stop();}catch{}s.disconnect();}sources.clear();master.disconnect();compressor.disconnect();}
 return {mix,fade,scheduleStep,stopNotes,dispose,stepSeconds};
}

export class DesertSoundscape{
 constructor({mix,profile='desert',onChange=()=>{},contextFactory=()=>new (globalThis.AudioContext||globalThis.webkitAudioContext)()}={}){
  this.profile=profile;
  this.mix=normalizeMix(mix);this.onChange=onChange;this.contextFactory=contextFactory;this.active=false;this.context=null;this.graph=null;this.step=0;this.error=false;this.disposed=false;
 }
 notify(){this.onChange({active:this.active,context:this.context?.state||'idle',audible:this.active&&this.context?.state==='running'&&Object.values(this.mix).some(x=>x.enabled&&x.volume>0),error:this.error});}
 async unlock(){
  if(this.disposed)return;
  try{
   if(!this.context){this.context=this.contextFactory();this.graph=createSoundGraph(this.context,this.context.destination,this.profile);this.graph.mix(this.mix);this.context.onstatechange=()=>this.notify();}
   this.error=false;await this.context.resume();if(this.disposed)return;
   this.sync();
  }catch{this.error=true;this.notify();}
 }
 setMix(mix){this.mix=normalizeMix(mix);this.graph?.mix(this.mix);this.notify();}
 setActive(active){this.active=!!active;if(this.graph)this.sync();else this.notify();}
 sync(){
  clearTimeout(this.suspendTimer);
  if(this.active&&this.context.state==='running'){
   this.graph.fade(true);
   if(!this.interval){this.next=this.context.currentTime+.06;const tick=()=>{
    // Do not queue a burst of missed notes after a throttled tab.
    if(this.next<this.context.currentTime-.1)this.next=this.context.currentTime+.04;
    while(this.next<this.context.currentTime+.2){this.graph.scheduleStep(this.step++,this.next);this.next+=this.graph.stepSeconds;}
   };tick();this.interval=setInterval(tick,80);}
  }else{
   clearInterval(this.interval);this.interval=null;this.graph.fade(false);this.graph.stopNotes();
   this.suspendTimer=setTimeout(()=>{if(!this.active&&!this.disposed)void this.context.suspend().catch(()=>{});},400);
  }
  this.notify();
 }
 dispose(){this.disposed=true;clearTimeout(this.suspendTimer);clearInterval(this.interval);this.graph?.dispose();if(this.context){this.context.onstatechange=null;void this.context.close().catch(()=>{});}}
}

// Render exactly the same score/graph for downloadable audition files and audio QA.
export async function renderSoundPreview(mix,seconds=24,sampleRate=24000){
 const ctx=new OfflineAudioContext(2,Math.ceil(seconds*sampleRate),sampleRate),graph=createSoundGraph(ctx);
 graph.mix(mix);graph.fade(true);
 for(let step=0;step*STEP<seconds-2;step++)graph.scheduleStep(step,step*STEP+.06);
 // A short tail prevents a cut-off at the end of the sample.
 ctx.suspend(Math.max(.1,seconds-1)).then(()=>{graph.fade(false);void ctx.resume();});
 return ctx.startRendering();
}
