// Original, low-resolution scene. Nearest-neighbour scaling preserves each pixel;
// scenery is drawn in world coordinates, so long trips never jump at a tile seam.
const palettes={
 dawn:{sky:['#6c7196','#a090ae','#d5acb7','#f2c1ac','#f8d2ad'],sun:'#ffe5b3',haze:'#e8bda3',far:'#bf969d',dune:'#dfb09a',light:'#f3c7a2',mid:'#d2997f',sand:'#e9b18a',shade:'#b17d71',dark:'#795a61',water:'#69aaa6',waterLight:'#b1d1bc',leaf:'#567d6b',leafLight:'#83a37a'},
 day:{sky:['#6ba8b8','#87bdc7','#aed4d2','#d0e3d3','#e9e8c9'],sun:'#fff1c2',haze:'#f3e0ba',far:'#c7b294',dune:'#e1c08c',light:'#f8dca5',mid:'#cba070',sand:'#edcb91',shade:'#c49a68',dark:'#8a684c',water:'#499c9d',waterLight:'#97d3ba',leaf:'#3f7460',leafLight:'#80a56b'},
 sunset:{sky:['#77758c','#b78d9a','#e5aa9c','#f2c39e','#f9d5a6'],sun:'#ffe4aa',haze:'#f8d3ab',far:'#b58b85',dune:'#d6a080',light:'#f5ca93',mid:'#c88b6b',sand:'#e8b681',shade:'#af785d',dark:'#72545a',water:'#538f8d',waterLight:'#a7c4a0',leaf:'#416d60',leafLight:'#7f9770'},
 night:{sky:['#202a48','#293551','#35435d','#48556c','#657078'],sun:'#f4dfb4',haze:'#677078',far:'#4b5068',dune:'#656078',light:'#a69697',mid:'#56546d',sand:'#797087',shade:'#4a4963',dark:'#303750',water:'#315975',waterLight:'#7198aa',leaf:'#344e58',leafLight:'#5d7d73'}
};
const mod=(n,m)=>(n%m+m)%m;
const rand=n=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
export async function createPixelScene(container,$){
 const canvas=document.createElement('canvas');canvas.setAttribute('aria-label','도트 모래언덕과 오아시스를 지나는 가상 사막 열차');canvas.style.imageRendering='pixelated';container.append(canvas);
 const ctx=canvas.getContext('2d',{alpha:false});if(!ctx)throw Error('Canvas unavailable');
 let w=400,h=224,offset=0,sky='sunset',weather='clear',wind=.3,lastFrame;
 function resize(){const r=container.getBoundingClientRect();if(!r.width||!r.height)return;h=224;w=Math.max(60,Math.min(1200,Math.round(h*r.width/r.height)));canvas.width=w;canvas.height=h;ctx.imageSmoothingEnabled=false;if(lastFrame)draw(lastFrame);}
 new ResizeObserver(resize).observe(container);resize();
 const names={dawn:'살구빛 새벽',day:'햇살 가득한 사막',sunset:'노을빛 모래언덕',night:'별이 흐르는 사막'};
 function configure(){sky=$('season').value;weather=$('weather').value;wind=Number($('temperature').value)/100;document.body.dataset.sky=sky;const label=names[sky]+' · '+({clear:'고요함',wind:'모래 산들바람',dust:'모래바람'})[weather];$('temperature-label').textContent=Math.round(wind*100)+'%';$('weather-description').textContent=label;$('focus-weather').textContent=label;$('scene-name').textContent=names[sky];if(lastFrame)draw(lastFrame);}
 $('season').onchange=configure;$('weather').onchange=configure;$('temperature').oninput=configure;configure();
 function rect(x,y,ww,hh,color){ctx.fillStyle=color;ctx.fillRect(Math.round(x),Math.round(y),Math.max(1,Math.round(ww)),Math.max(1,Math.round(hh)));}
 function ellipse(x,y,rx,ry,color){for(let yy=-Math.ceil(ry);yy<=ry;yy++){const dx=Math.floor(rx*Math.sqrt(Math.max(0,1-yy*yy/(ry*ry))));if(dx)rect(x-dx,y+yy,dx*2,1,color);}}
 function ridge(y,amp,scale,travel,color,highlight){
  for(let x=0;x<w;x+=2){const n=(x+travel)/scale,top=Math.round(y+amp*(Math.sin(n)+.35*Math.sin(n*1.83+1)));rect(x,top,2,h-top,color);if(highlight)rect(x,top,2,2,highlight);}
 }
 function pyramid(x,y,size,p){
  for(let row=0;row<size;row++){const left=Math.floor(row*.92),right=Math.floor(row*.72);rect(x-left,y-size+row,left+1,1,p.light);rect(x+1,y-size+row,right+1,1,p.shade);if(row%9===0&&row>8)rect(x-left+2,y-size+row,Math.max(1,left-3),1,p.dune);}
  rect(x-3,y-6,5,6,p.dark);
 }
 function palm(x,y,size,p,phase=0){
  ellipse(x,y+1,11*size,2*size,p.shade);
  for(let i=0;i<10;i++){const xx=x+Math.sin(i*.13)*4*size;rect(xx,y-i*4*size,4*size,5*size,i%2?p.dark:p.shade);}
  const top=y-37*size,head=x+3*size,sway=Math.round(Math.sin(phase)*size);
  for(const direction of [-1,1])for(const branch of [0,1,2]){
   for(let j=0;j<7;j++){const xx=head+direction*j*3*size+sway,yy=top+((j-2)*(j-2)*.32-branch*3)*size;rect(xx,yy,(5-j*.2)*size,3*size,branch===2?p.leafLight:p.leaf);}
  }
  rect(head-2*size,top+3*size,3*size,3*size,p.dark);rect(head+2*size,top+2*size,3*size,3*size,p.dark);
 }
 function oasis(x,y,p,time){
  ellipse(x,y,65,14,p.shade);ellipse(x,y-1,59,11,p.water);
  for(let row=0;row<7;row++){const yy=y-9+row*3,extent=48*Math.sqrt(Math.max(0,1-(yy-y)**2/121));for(let j=0;j<4;j++){const xx=x-extent+mod(j*27+row*7+time*1.2,Math.max(1,extent*2-13));rect(xx,yy,5+rand(j+row*11)*9,1,p.waterLight);}}
  for(const [dx,dy,size]of [[-48,-9,.8],[-34,-15,1.05],[40,-10,.85],[56,-3,.65]])palm(x+dx,y+dy,size,p,time*(weather==='clear'?.12:.7));
  for(let i=0;i<12;i++){const xx=x-61+i*11;rect(xx,y+9+Math.sin(i)*3,5,2,p.leaf);rect(xx+2,y+5+Math.sin(i)*3,1,6,p.leafLight);}
 }
 function ruin(x,y,p){
  rect(x-35,y+2,76,3,p.shade);
  for(const dx of [-29,-12,15,32]){rect(x+dx,y-28,7,29,p.light);rect(x+dx+5,y-28,3,29,p.shade);rect(x+dx-2,y-30,12,4,p.dune);rect(x+dx-1,y-2,11,3,p.dune);for(let j=0;j<3;j++)rect(x+dx,y-23+j*8,6,1,p.mid);}
  rect(x-32,y-36,54,6,p.dune);rect(x-30,y-37,49,2,p.light);rect(x-29,y-30,46,3,p.shade);rect(x-11,y-27,27,22,p.dark);rect(x-7,y-24,18,24,p.mid);rect(x-1,y-19,10,19,p.dark);
  rect(x+45,y-5,12,6,p.shade);rect(x+43,y-7,10,3,p.light);
 }
 function camels(x,y,p){
  for(let i=0;i<3;i++){const xx=x+i*21;rect(xx,y-7,12,4,p.dark);rect(xx+2,y-10,4,3,p.dark);rect(xx+7,y-9,3,3,p.dark);rect(xx+11,y-13,3,8,p.dark);rect(xx+12,y-14,5,3,p.dark);rect(xx+1,y-3,1,6,p.dark);rect(xx+8,y-3,1,6,p.dark);rect(xx-3,y-7,3,1,p.dark);if(i<2)rect(xx+17,y-8,5,1,p.shade);}
 }
 function station(x,y,p){
  rect(x-26,y-24,49,25,p.light);rect(x-29,y-26,55,4,p.shade);rect(x-23,y-29,44,3,p.dune);rect(x-20,y-16,9,9,p.water);rect(x-17,y-16,1,9,p.light);rect(x+10,y-16,8,9,p.water);rect(x-3,y-16,8,17,p.dark);rect(x-26,y,51,3,p.shade);rect(x+33,y-20,2,23,p.dark);rect(x+28,y-22,15,6,p.leaf);rect(x+31,y-20,8,1,p.light);
 }
 function draw(frame){
  lastFrame=frame;const {distance,time,phase}=frame,p=palettes[sky]||palettes.sunset;
  const travel=distance*.66+offset;canvas.dataset.sky=sky;container.dataset.offset=travel.toFixed(2);container.dataset.scene='도트 사막 · '+names[sky];
  for(let i=0;i<p.sky.length;i++){const y=i*25;rect(0,y,w,26,p.sky[i]);if(i)for(let x=0;x<w;x+=4)rect(x+2,y,1,1,p.sky[i-1]);}rect(0,125,w,h,p.haze);
  if(sky==='night'){
   for(let i=0;i<70;i++){const xx=Math.floor(rand(i+1)*w),yy=Math.floor(rand(i+501)*89);rect(xx,yy,1,1,(i%4===0&&Math.sin(time*.22+i)>.5)?p.sky[3]:p.sun);if(i%17===0){rect(xx-1,yy,3,1,p.sun);rect(xx,yy-1,1,3,p.sun);}}
   ellipse(w*.76,39,12,12,p.sun);ellipse(w*.76+5,35,11,11,p.sky[1]);
  }else{
   ellipse(w*.76,51,23,23,p.sky[3]);ellipse(w*.76,51,19,19,p.sun);
   for(let i=0;i<3;i++){const xx=mod(i*171+23-travel*.025,w+130)-70,yy=25+i%2*15;rect(xx,yy,38,3,p.sky[3]);rect(xx+9,yy-2,21,2,p.sky[3]);rect(xx+29,yy+3,24,2,p.sky[3]);}
  }
  ridge(112,7,43,travel*.08,p.far);
  for(let tile=Math.floor(travel*.12/640)-1;tile<=Math.floor(travel*.12/640)+2;tile++){const x=tile*640-travel*.12; pyramid(x+125,136,55,p);pyramid(x+189,139,36,p);pyramid(x+234,141,24,p);}
  ridge(142,9,65,travel*.24,p.dune,p.light);
  ridge(160,11,86,travel*.45,p.mid);
  for(let tile=Math.floor(travel*.55/900)-1;tile<=Math.floor(travel*.55/900)+2;tile++){
   const x=tile*900-travel*.55;oasis(x+320,174,p,time);ruin(x+655,171,p);camels(x+110,162,p);
  }
  ridge(195,10,100,travel*.85,p.sand,p.light);
  // Fine sand ribbons and scattered pebbles stay anchored to this near layer.
  for(let i=Math.floor(travel/40)-2;i<Math.floor((travel+w)/40)+2;i++){const x=i*40-travel,y=204+rand(i)*17;rect(x,y,8+rand(i+20)*14,1,p.dune);if(i%3===0){rect(x+7,y-5,5,3,p.shade);rect(x+8,y-6,3,1,p.light);}}
  if(phase!=='outdoors'){const x=phase==='boarding'?w+40-mod(travel*4,w+150):-80;station(x,195,p);}
  // Near track edge gives the window a quiet, unmistakable train rhythm.
  rect(0,220,w,4,p.dark);for(let x=-mod(travel*1.8,20);x<w;x+=20)rect(x,220,7,4,p.shade);rect(0,218,w,2,p.light);
  if(weather!=='clear'){
   const count=Math.round((weather==='dust'?85:25)*(wind+.25));
   for(let i=0;i<count;i++){const xx=mod(i*37.31-time*(15+wind*35),w+12)-6,yy=mod(i*19.73+Math.sin(time*.3+i)*3,h);rect(xx,yy,weather==='dust'?3:1,1,i%3?p.light:p.dune);}
  }
 }
 return {draw,next(){offset+=310;if(lastFrame)draw(lastFrame);}};
}
