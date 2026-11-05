import test from 'node:test';import assert from 'node:assert/strict';
import {CABIN_SEATS,createCabinState,cabinStudyFrame} from '../src/cabin.mjs';
test('study camera faces the correct bench and keeps a narrow screen centred on the player',()=>{
 const a=cabinStudyFrame('A10',2),b=cabinStudyFrame('B10',2);
 assert.ok(a.position[0]>0&&a.target[0]<0);assert.ok(b.position[0]<0&&b.target[0]>0);
 assert.equal(a.position[2],a.target[2]);assert.equal(a.rowSeats,7);assert.equal(a.position[2],b.position[2]);
 assert.equal(cabinStudyFrame('A01',2).rowSeats,3);assert.equal(cabinStudyFrame('B10',.5).position[2],CABIN_SEATS.find(s=>s.id==='B10').z);
 assert.ok(cabinStudyFrame('A10',NaN).position.every(Number.isFinite));assert.equal(cabinStudyFrame('unknown'),null);
});
test('previewing a highlighted seat does not move or sit until confirmation',()=>{
 const s=createCabinState(),before=s.snapshot();
 assert.equal(s.confirmSeat(),false);assert.equal(s.previewSeat('B10'),true);
 for(let i=0;i<120;i++)s.update(.02);
 assert.equal(s.snapshot().x,before.x);assert.equal(s.snapshot().z,before.z);assert.equal(s.snapshot().seatId,null);assert.equal(s.snapshot().targetSeatId,null);assert.equal(s.snapshot().candidateSeatId,'B10');
 assert.equal(s.previewSeat('invalid'),false);assert.equal(s.snapshot().candidateSeatId,'B10');
 assert.equal(s.confirmSeat(),true);assert.equal(s.snapshot().targetSeatId,'B10');
 for(let i=0;i<200;i++)s.update(.02);assert.equal(s.snapshot().seatId,'B10');
 s.previewSeat('A10');assert.equal(s.snapshot().seatId,'B10');assert.equal(s.snapshot().candidateSeatId,'A10');
 s.confirmSeat();s.update(.02);s.previewSeat('B09');assert.equal(s.snapshot().targetSeatId,null);assert.equal(s.snapshot().candidateSeatId,'B09');
 s.stand();s.previewSeat('A10');s.update(.02,{z:1});assert.equal(s.snapshot().candidateSeatId,null);assert.equal(s.confirmSeat(),false);
});
test('seat selection walks through the aisle before sitting, and standing releases the seat',()=>{
 const s=createCabinState();assert.equal(s.chooseSeat('B10'),true);assert.equal(s.snapshot().seatId,null);
 for(let i=0;i<200;i++)s.update(.02);assert.equal(s.snapshot().seatId,'B10');assert.equal(s.snapshot().x,.93);assert.equal(s.snapshot().posture,'seated');
 s.stand();assert.equal(s.snapshot().seatId,null);assert.ok(Math.abs(s.snapshot().x)<=.46);
});
test('manual movement cancels a seat approach and remains inside the walkable aisle',()=>{
 const s=createCabinState();s.chooseSeat('A01');for(let i=0;i<400;i++)s.update(.03,{x:1,z:1});const a=s.snapshot();assert.equal(a.seatId,null);assert.equal(a.targetSeatId,null);assert.ok(a.x<=.46&&a.z<=7.9);
 s.chooseSeat('B20');for(let i=0;i<600;i++)s.update(.03);assert.equal(s.snapshot().seatId,'B20');s.update(.03,{x:0,z:-1});assert.equal(s.snapshot().seatId,null);
});
test('invalid destinations preserve state and seat identifiers are unique',()=>{
 const s=createCabinState(),before=s.snapshot();assert.equal(s.chooseSeat('__proto__'),false);assert.equal(s.moveTo(NaN,0),false);assert.deepEqual(s.snapshot(),before);assert.equal(new Set(CABIN_SEATS.map(s=>s.id)).size,40);s.update(Infinity);assert.ok(Number.isFinite(s.snapshot().x));
});
