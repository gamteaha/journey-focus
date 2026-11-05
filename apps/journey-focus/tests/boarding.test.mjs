import test from 'node:test';import assert from 'node:assert/strict';
import {createBoardingPass,formatDuration,tearProgress,cardTouchesReader,createTicketCut} from '../src/boarding.mjs';
import {formatTime} from '../src/session.mjs';
test('issued passes freeze the chosen route, hour duration, character and medium',()=>{
 const input={from:'성수',to:'건대입구',duration:7200,character:'mint',medium:'ticket'},pass=createBoardingPass(input,{id:'TEST',date:new Date('2026-11-03T16:00:00Z')});
 input.character='amber';assert.equal(pass.character,'mint');assert.equal(pass.date,'2026-11-04');assert.equal(pass.id,'JF-TEST');assert.ok(Object.isFrozen(pass));assert.equal(formatDuration(pass.duration),'2시간');
 assert.equal(createBoardingPass({...input,from:'건대입구',to:'성수',medium:'card',duration:3600}).medium,'card');
 assert.equal(formatTime(7200),'2:00:00');assert.equal(formatTime(3601),'1:00:01');
});
test('invalid tickets cannot proceed to boarding',()=>{
 const input={from:'성수',to:'건대입구',duration:1500,character:'blue',medium:'ticket'};
 for(const patch of [{to:'성수'},{from:'unknown'},{duration:'1500'},{duration:Infinity},{character:'unknown'},{medium:'bank'}])assert.throws(()=>createBoardingPass({...input,...patch}));
});
test('a short or cancelled tear cannot count as a completed ticket tear',()=>{
 assert.equal(tearProgress(-10,400),0);assert.ok(tearProgress(20,400)<1);assert.equal(tearProgress(150,400),1);assert.equal(tearProgress(Infinity,400),0);assert.equal(tearProgress(80,0),0);
});
test('card admission needs the card centre at a real reader, not an edge overlap',()=>{
 const reader={x:300,y:100,width:100,height:100};
 assert.equal(cardTouchesReader({x:200,y:75,width:300,height:150},reader),true);
 assert.equal(cardTouchesReader({x:50,y:75,width:300,height:150},reader),false);
 assert.equal(cardTouchesReader({x:200,y:500,width:300,height:150},reader),false);
 assert.equal(cardTouchesReader({x:NaN,y:0,width:1,height:1},reader),false);
});
test('ticket cutting must start at an end and follow the line in one direction',()=>{
 const line={x:200,top:100,bottom:400,tolerance:20};
 assert.equal(createTicketCut(line,{x:200,y:250}),null);assert.equal(createTicketCut(line,{x:250,y:100}),null);
 const down=createTicketCut(line,{x:200,y:100});assert.equal(down.move({x:205,y:220}).complete,false);assert.equal(down.move({x:202,y:390}).complete,true);
 const up=createTicketCut(line,{x:201,y:400});assert.equal(up.direction,-1);assert.equal(up.move({x:199,y:110}).complete,true);
 const crooked=createTicketCut(line,{x:200,y:100});crooked.move({x:240,y:230});assert.equal(crooked.move({x:200,y:400}).complete,false);
 const backwards=createTicketCut(line,{x:200,y:100});backwards.move({x:200,y:300});assert.equal(backwards.move({x:200,y:130}).valid,false);
});
