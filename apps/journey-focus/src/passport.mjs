export const PASSPORT_KEY='journey-focus-passport-v1';
export const STAMP_SECONDS=300;
export const DESTINATIONS=Object.freeze({
 seoul:{name:'서울',mark:'SEOUL',color:'#567663',unlock:0},songdo:{name:'인천',mark:'INCHEON',color:'#558e91',unlock:0},
 swiss:{name:'스위스',mark:'SWISS',color:'#7a83a4',unlock:0},desert:{name:'사막',mark:'DESERT',color:'#b17a4b',unlock:0},
 oasis:{name:'달빛 오아시스',mark:'MOON OASIS',color:'#83749e',unlock:3}
});
export const WORLD_ORDER=Object.freeze(['seoul','songdo','swiss','desert','oasis']);
export function validReceipt(r){return !!r&&typeof r.id==='string'&&r.id.length<120&&!!DESTINATIONS[r.destination]&&typeof r.from==='string'&&typeof r.to==='string'&&Number.isFinite(r.elapsed)&&r.elapsed>=0&&r.elapsed<=864000&&typeof r.date==='string'&&Number.isFinite(Date.parse(r.date))&&typeof r.stamp==='boolean';}
export function normalizePassport(value){const ids=new Set();return {version:1,receipts:(Array.isArray(value?.receipts)?value.receipts:[]).filter(r=>validReceipt(r)&&!ids.has(r.id)&&ids.add(r.id))};}
export function passportSummary(value){
 const receipts=normalizePassport(value).receipts,stamped=receipts.filter(r=>r.stamp&&r.elapsed>=STAMP_SECONDS),visited=[...new Set(stamped.map(r=>r.destination))],count=stamped.length;
 return {count,visited,unlocked:Object.keys(DESTINATIONS).filter(id=>count>=DESTINATIONS[id].unlock),world:WORLD_ORDER.every(id=>visited.includes(id))};
}
export function addReceipt(value,input){
 const book=normalizePassport(value),existing=book.receipts.find(r=>r.id===input.id);if(existing)return {book,receipt:existing,duplicate:true};
 const elapsed=Math.max(0,Math.floor(input.elapsed)),stamp=elapsed>=STAMP_SECONDS&&(input.completed===true||input.unlimited===true);
 const receipt={id:input.id,destination:input.destination,from:String(input.from||''),to:String(input.to||''),elapsed,date:input.date||new Date().toISOString(),stamp};
 if(!validReceipt(receipt))throw Error('Invalid journey receipt');
 if(!passportSummary(book).unlocked.includes(receipt.destination))throw Error('Destination is locked');
 return {book:{version:1,receipts:[receipt,...book.receipts]},receipt,duplicate:false};
}
