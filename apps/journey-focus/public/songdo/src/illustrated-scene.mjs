// Continuous environment painting + one near foliage band. No isolated sprite collage.
export async function createIllustratedScene(container,$) {
  const canvas=document.createElement('canvas');canvas.setAttribute('aria-label','연결된 공원과 물길을 바라보는 창밖 여행');container.append(canvas);
  const ctx=canvas.getContext('2d');
  const load=name=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error(name));image.src=new URL('../input/'+name,import.meta.url).href;});
  const [panorama,verge]=await Promise.all([load('window-panorama-v2.png'),load('window-verge-v2.png')]);
  let width=1,height=1,offset=0,weather='clear',season='spring',temp=16;
  const resize=()=>{const r=container.getBoundingClientRect(),dpr=Math.min(devicePixelRatio,2);width=Math.max(1,r.width);height=Math.max(1,r.height);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);};
  new ResizeObserver(resize).observe(container);resize();
  const names={spring:'봄꽃',summer:'여름 바람',autumn:'가을 낙엽',winter:'겨울'};
  function configure(){season=$('season').value;weather=$('weather').value;temp=Number($('temperature').value);const text=`${names[season]} · ${weather==='rain'?(temp<=2?'눈':'비'):weather==='wind'?'바람':'맑음'} · ${temp}°C`;$('temperature-label').textContent=`${temp}°C`;$('weather-description').textContent=text;$('focus-weather').textContent=text;}
  $('season').onchange=()=>{$('temperature').value={spring:16,summer:29,autumn:14,winter:-3}[$('season').value];configure();};$('weather').onchange=configure;$('temperature').oninput=configure;$('temperature').value=16;configure();
  const mod=(x,n)=>(x%n+n)%n;
  // Mirrored adjacent tiles meet at the exact same edge, without a hard reset or crossfade ghosts.
  function ribbon(image,travel,h,y){
    const w=h*image.width/image.height,start=Math.floor(travel/w),position=mod(travel,w);
    for(let i=0;i<Math.ceil(width/w)+2;i++){
      const x=i*w-position,reverse=mod(start+i,2)===1;ctx.save();ctx.translate(x,y);if(reverse){ctx.translate(w,0);ctx.scale(-1,1);}ctx.drawImage(image,0,0,w+.5,h);ctx.restore();
    }
  }
  function tunnel(travel,phase){
    const g=ctx.createLinearGradient(0,0,0,height);g.addColorStop(0,'#486c6c');g.addColorStop(1,'#95b3a2');ctx.fillStyle=g;ctx.fillRect(0,0,width,height);
    const spacing=height*.6;
    for(let i=-1;i<Math.ceil(width/spacing)+1;i++){const x=i*spacing-mod(travel*3,spacing);ctx.fillStyle='#b4cbb5';ctx.fillRect(x,0,12,height);ctx.fillStyle='#ffdf98';ctx.fillRect(x+35,height*.2,spacing*.45,8);ctx.fillStyle='#3b6768';ctx.fillRect(x+32,height*.46,spacing*.5,height*.13);}
    ctx.fillStyle='#fff2d3';ctx.textAlign='center';ctx.font=`${Math.max(13,Math.min(22,width/24))}px sans-serif`;ctx.fillText(phase==='boarding'?'곧, 햇살 가득한 창밖으로':'오늘도 함께 잘 달렸어요',width/2,height*.4);
  }
  function draw({distance,time,phase}){
    ctx.setTransform(canvas.width/width,0,0,canvas.height/height,0,0);
    const scale=height/700,tileWidth=height*panorama.width/panorama.height;
    const travel=distance*3.2*scale+offset*tileWidth+tileWidth*.12;
    if(phase!=='outdoors'){tunnel(travel,phase);container.dataset.offset=travel.toFixed(2);return;}
    // The bank, bridge, village, and mountains keep their shared perspective.
    ribbon(panorama,travel,height,0);
    // Same art direction; only the low near-bank foliage has faster parallax.
    ribbon(verge,travel*2.6,height*.48,height*.52);
    if(weather==='rain'){ctx.fillStyle='rgba(68,100,133,.12)';ctx.fillRect(0,0,width,height);}
    const snow=weather==='rain'&&temp<=2,rain=weather==='rain'&&!snow;
    const petals=weather!=='rain'&&(season==='spring'||season==='autumn');
    if(snow||rain||petals){
      const count=rain?65:snow?40:16;
      for(let i=0;i<count;i++){
        const x=mod(i*83.37+time*(weather==='wind'?24:8)*scale,width+20)-10;
        const y=mod(i*61.4+time*(rain?240:snow?34:24)*scale,height+24)-12;
        ctx.save();ctx.translate(x+Math.sin(time*.7+i)*5,y);
        if(rain){ctx.strokeStyle='rgba(221,240,247,.6)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(-2,12*scale);ctx.stroke();}
        else {ctx.rotate(time*.3+i);ctx.fillStyle=snow?'rgba(255,253,246,.85)':season==='autumn'?'rgba(208,137,68,.6)':'rgba(255,205,220,.65)';ctx.beginPath();ctx.ellipse(0,0,Math.max(1.4,3*scale),Math.max(1,1.5*scale),0,0,Math.PI*2);ctx.fill();}ctx.restore();
      }
    }
    container.dataset.offset=travel.toFixed(2);container.dataset.scene='송도 정원 · 상상 속 물길';$('scene-name').textContent='송도 정원 · 상상 속 물길';
  }
  return {draw,next(){offset+=.23;}};
}
