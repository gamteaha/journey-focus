import {mascotMarkup} from '/mascot.mjs';
import {learningSummary,DESTINATIONS} from '/src/passport.mjs';
const duration=seconds=>`${Math.floor(seconds/3600)}시간 ${Math.floor(seconds%3600/60)}분`;
const date=value=>new Date(value).toLocaleDateString('ko-KR');
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
export function stampCelebration(el,{earned=true}={}){
 const mascot=document.createElement('div');mascot.className='stamp-ceremony';
 mascot.innerHTML=`<div class="stamp-clerk" aria-hidden="true">${mascotMarkup()}<i class="stamp-tool"></i></div><div><small>횃불이의 여행 기록소</small><strong>${earned?'오늘의 집중, 도장 꾹!':'함께한 시간도 소중해요.'}</strong><span>${earned?'수고했어요. 여권에 추억을 남겼어요.':'다음에는 5분 이상 완주하고 도장도 받아요.'}</span></div>`;
 el.querySelector('header')?.after(mascot);el.classList.toggle('stamp-earned',earned);
}
export function decoratePassport(el,book){
 el.classList.add('passport-book');el.classList.remove('book-open');
 const stats=learningSummary(book),pages=document.createElement('div');pages.className='passport-pages';pages.hidden=true;
 const identity=document.createElement('section');identity.className='passport-identity';
 identity.innerHTML=`<span class="passport-country">JOURNEY REPUBLIC</span><h3>횃불이와 나의 여권</h3><div class="passport-photo">${mascotMarkup()}</div><dl><dt>여행자</dt><dd>나와 횃불이</dd><dt>누적 집중</dt><dd>${duration(stats.total)}</dd><dt>여정</dt><dd>${stats.sessions}번의 작은 여행</dd></dl><div class="passport-mrz">JF&lt;FLAME&lt;TRAVELER&lt;&lt;<br>YOUR&lt;TIME&lt;YOUR&lt;JOURNEY</div><button type="button" id="passport-fold">표지 보기 ↶</button>`;
 const stampPage=document.createElement('section');stampPage.className='passport-stamp-page';
 stampPage.innerHTML='<span class="passport-country">PLACES THAT STAY WITH ME</span><h3>창가에서 모은 도장</h3><p class="travel-note">받은 도장을 누르면 횃불이가 다시 꾹 찍어줘요.</p>';
 for(const selector of ['.passport-count','.passport-grid','.passport-reward']){const child=el.querySelector(selector);if(child)stampPage.append(child);}
 pages.append(identity,stampPage);el.querySelector('header').after(pages);
 const cover=document.createElement('button');cover.type='button';cover.id='passport-cover';cover.className='passport-cover';cover.setAttribute('aria-expanded','false');
 cover.innerHTML=`<span>JOURNEY FOCUS</span><strong>나의 작은 여행 여권</strong><div>${mascotMarkup()}</div><b>여 권 <small>PASSPORT</small></b><span class="cover-open">눌러서 펼쳐 보기 ↗</span>`;pages.before(cover);
 const toggle=open=>{pages.hidden=!open;cover.hidden=open;cover.setAttribute('aria-expanded',String(open));el.classList.toggle('book-open',open);(open?el.querySelector('#passport-fold'):cover).focus({preventScroll:true});};
 cover.onclick=()=>toggle(true);el.querySelector('#passport-fold').onclick=()=>toggle(false);
 stampPage.querySelectorAll('.passport-stamp.earned').forEach(stamp=>{const button=document.createElement('button');button.type='button';button.className='stamp-replay';button.setAttribute('aria-label',stamp.textContent.trim()+' 도장 다시 찍기');stamp.replaceWith(button);button.append(stamp);button.onclick=()=>{stamp.classList.remove('stamp-pop');void stamp.offsetWidth;stamp.classList.add('stamp-pop');const photo=el.querySelector('.passport-photo');photo.classList.remove('stamp-pop');void photo.offsetWidth;photo.classList.add('stamp-pop');};});
 const records=document.createElement('details');records.className='personal-ranking';
 records.innerHTML=`<summary>나의 학습 시간 랭킹 <small>이 브라우저의 개인 기록</small></summary><ol>${stats.ranked.slice(0,5).map(r=>`<li><b>${r.rank}위</b><span>${DESTINATIONS[r.destination].name}<small>${escape(date(r.date))}</small></span><strong>${Math.floor(r.elapsed/60)}분 ${r.elapsed%60}초</strong></li>`).join('')||'<li>여정을 마치면 나의 기록이 쌓여요.</li>'}</ol><button id="passport-share" ${stats.sessions?'':'disabled'}>학습 기록 공유 ↗</button><p id="passport-share-status" role="status"></p>`;
 el.append(records);records.querySelector('#passport-share').onclick=()=>shareLearning(book,null,records.querySelector('#passport-share-status'));
}
export function decorateCompletion(el,result,book){
 stampCelebration(el,{earned:result.receipt.stamp&&result.saved});
 const stats=learningSummary(book,result.receipt.id),line=document.createElement('p');line.className='personal-result';
 line.textContent=stats.rank?`내 여정 기록 ${stats.rank}위 · 누적 ${duration(stats.total)}`:'이번 여정의 집중시간을 이미지로 남겨 보세요.';
 el.querySelector('.travel-result').after(line);
 const button=document.createElement('button');button.id='learning-share';button.textContent='학습 기록 공유 ↗';
 el.querySelector('.travel-dialog-actions').prepend(button);
 const status=document.createElement('p');status.id='learning-share-status';status.setAttribute('role','status');el.append(status);
 button.onclick=()=>shareLearning(book,result.receipt,status);
}
export async function learningCard(book,receipt){
 const stats=learningSummary(book,receipt?.id),c=document.createElement('canvas');c.width=1200;c.height=900;const x=c.getContext('2d');
 x.fillStyle='#e0e7d8';x.fillRect(0,0,1200,900);x.fillStyle='#fff7e4';x.beginPath();x.roundRect(50,50,1100,800,35);x.fill();
 x.strokeStyle='#c9b995';x.lineWidth=2;x.strokeRect(78,78,1044,744);x.fillStyle='#304c43';
 x.font='22px sans-serif';x.fillText('JOURNEY FOCUS  /  MY STUDY JOURNEY',115,135);
 x.font='bold 48px sans-serif';x.fillText(receipt?'오늘도, 나에게 도착했어요.':'차곡차곡 쌓인 나의 집중.',115,225);
 x.font='bold 100px serif';x.fillText(`${Math.floor((receipt?.elapsed??stats.total)/60)}분`,115,380);
 x.font='26px sans-serif';x.fillText(receipt?DESTINATIONS[receipt.destination].name+'에서 보낸 시간':'지금까지 누적 집중시간',120,430);
 x.fillStyle='#6e8069';x.font='25px sans-serif';x.fillText(`기록한 여정 ${stats.sessions}회  ·  내 최고 기록 ${Math.floor(stats.best/60)}분`,115,550);
 x.fillText(receipt&&stats.rank?`내 여정 기록 ${stats.rank}위`:'나만의 학습 기록 · 다른 사람과 비교한 순위가 아니에요',115,595);
 x.font='20px sans-serif';x.fillText(date(receipt?.date||new Date()),115,740);x.fillText('작은 집중이 모여, 세계여행이 돼요.',115,780);
 const svg=mascotMarkup().replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" '),img=new Image();
 img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);try{await img.decode();x.drawImage(img,840,245,205,245);}catch{}
 return new Promise((resolve,reject)=>c.toBlob(blob=>blob?resolve(blob):reject(Error('Image export failed')),'image/png'));
}
export async function shareLearning(book,receipt,status){
 status.textContent='공유 카드를 만들고 있어요…';
 try{const blob=await learningCard(book,receipt),file=new File([blob],'journey-focus-study.png',{type:'image/png'});
  if(navigator.canShare?.({files:[file]})&&navigator.share){try{await navigator.share({files:[file],title:'나의 집중 여행',text:'횃불이와 함께한 나의 학습 기록 · Journey Focus'});status.textContent='공유했어요.';return;}catch(e){if(e.name==='AbortError'){status.textContent='공유를 취소했어요.';return;}}}
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);status.textContent='공유 이미지를 저장했어요. 카카오톡 등에 첨부해 주세요.';
 }catch{status.textContent='공유 이미지를 만들지 못했어요. 다시 눌러 주세요.';}
}
