import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizePassport,passportSummary,addReceipt,WORLD_ORDER,learningSummary} from '../src/passport.mjs';
const input={id:'run-1',destination:'seoul',from:'성수',to:'건대입구',elapsed:300,completed:true,date:'2026-11-07T00:00:00.000Z'};
test('personal ranking counts elapsed study time, ties share rank and duplicate runs count once',()=>{
 let book=normalizePassport(null);for(const [id,elapsed]of [['a',300],['b',900],['c',900],['d',60]])book=addReceipt(book,{...input,id,elapsed}).book;
 book=addReceipt(book,{...input,id:'b',elapsed:900}).book;
 const s=learningSummary(book,'a');assert.equal(s.total,2160);assert.equal(s.sessions,4);assert.equal(s.best,900);assert.equal(s.rank,3);assert.deepEqual(s.ranked.map(r=>r.rank),[1,1,3,4]);assert.equal(learningSummary(null).rank,null);
});
test('existing four worlds remain open, bonus requires three stamps',()=>{
 let book=normalizePassport(null);assert.deepEqual(passportSummary(book).unlocked,['seoul','songdo','swiss','desert']);
 assert.throws(()=>addReceipt(book,{...input,destination:'oasis'}));
 for(let i=0;i<3;i++)book=addReceipt(book,{...input,id:'run-'+i}).book;
 assert.ok(passportSummary(book).unlocked.includes('oasis'));assert.equal(passportSummary(book).world,false);
});
test('short previews and early stops keep a souvenir but no stamp; unlimited completion qualifies',()=>{
 for(const patch of [{elapsed:60},{completed:false},{elapsed:299.999}])assert.equal(addReceipt(null,{...input,...patch}).receipt.stamp,false);
 assert.equal(addReceipt(null,{...input,completed:false,unlimited:true}).receipt.stamp,true);
 const once=addReceipt(null,input),again=addReceipt(once.book,input);assert.equal(again.duplicate,true);assert.equal(passportSummary(again.book).count,1);
});
test('world title needs every regional stamp, not simply many repeat stamps',()=>{
 let book=normalizePassport(null);for(let i=0;i<8;i++)book=addReceipt(book,{...input,id:'repeat-'+i}).book;
 assert.equal(passportSummary(book).world,false);
 for(const destination of WORLD_ORDER)book=addReceipt(book,{...input,id:destination,destination}).book;
 assert.equal(passportSummary(book).world,true);
});
test('malformed storage and duplicate receipts are discarded',()=>{
 assert.equal(normalizePassport({receipts:[null,{},input]}).receipts.length,0);
 const receipt=addReceipt(null,input).receipt;
 assert.equal(normalizePassport({receipts:[receipt,receipt,{...receipt,id:'bad',elapsed:NaN}]}).receipts.length,1);
 assert.throws(()=>addReceipt(null,{...input,elapsed:NaN}));
});
