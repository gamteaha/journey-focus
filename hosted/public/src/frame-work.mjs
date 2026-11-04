// Coalesce repeated terrain events and spread expensive scalar SDK queries over
// animation frames. One indivisible query may exceed the time budget; never run
// another one in that frame after the budget is exhausted.
export function createFrameWork(run,{
 request=fn=>globalThis.requestAnimationFrame?globalThis.requestAnimationFrame(fn):setTimeout(fn,16),
 cancel=id=>globalThis.cancelAnimationFrame?globalThis.cancelAnimationFrame(id):clearTimeout(id),
 now=()=>performance.now(),budgetMs=4,maxSteps=4,onError=()=>{},
}={}){
 let frame=null,iterator=null,again=false,epoch=0;
 function stop(){epoch++;if(frame!==null)cancel(frame);frame=null;iterator=null;again=false;}
 function schedule(){if(frame===null)frame=request(tick);}
 function tick(){
  frame=null;
  try{
   const current=epoch;
   if(!iterator){iterator=run();again=false;}
   const start=now();let steps=0;
   while(steps++<maxSteps){
    const result=iterator.next();
    if(current!==epoch)return;
    if(result.done){iterator=null;if(again)schedule();return;}
    if(now()-start>=budgetMs)break;
   }
   schedule();
  }catch(error){stop();onError(error);}
 }
 return{request(){if(iterator||frame!==null)again=true;else schedule();},cancel:stop};
}
