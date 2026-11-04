// One deadline covers terrain, model creation, textures and all queued models.
export function createLoadScope(timeoutMs=20000){
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(new Error('Scenery loading timed out; please retry')),timeoutMs);
 function wait(value){
  return new Promise((resolve,reject)=>{
   const signal=controller.signal;
   const aborted=()=>{signal.removeEventListener('abort',aborted);reject(signal.reason);};
   if(signal.aborted){reject(signal.reason);return;}
   signal.addEventListener('abort',aborted,{once:true});
   Promise.resolve(value).then(result=>{signal.removeEventListener('abort',aborted);resolve(result);},error=>{signal.removeEventListener('abort',aborted);reject(error);});
  });
 }
 async function delay(ms){let timer;try{await wait(new Promise(resolve=>{timer=setTimeout(resolve,ms);}));}finally{clearTimeout(timer);}}
 function cancel(){clearTimeout(timer);controller.abort(new Error('Scenery loading cancelled'));}
 return {wait,delay,cancel,get cancelled(){return controller.signal.aborted;}};
}
