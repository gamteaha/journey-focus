// Public camera events distinguish VWorld's late initial flight from our first
// queued view. Keep the loading state until it settles; never take control again
// after startup, so manual navigation remains available.
export function settleInitialView(viewer,{align,ready}){
 let cancelled=false,appliedAt=null,removeEnd=null;
 const deadline=Date.now()+10000;
 function cancel(){if(cancelled)return;cancelled=true;clearInterval(timer);removeEnd?.();removeEnd=null;}
 function apply(){if(cancelled||appliedAt!==null)return;appliedAt=Date.now();removeEnd?.();removeEnd=null;align();}
 const onEnd=()=>{
  const camera=viewer.camera,pitch=camera.pitch*180/Math.PI,height=camera.positionCartographic?.height;
  if(Number.isFinite(height)&&height>600&&Math.abs(pitch+35)<3)apply();
 };
 removeEnd=viewer.camera.moveEnd?.addEventListener?.(onEnd)||null;
 const timer=setInterval(()=>{
  if(cancelled)return;
  const now=Date.now();
  if(appliedAt===null&&now>=deadline)apply();
  if(appliedAt!==null&&((now-appliedAt>=500&&viewer.scene.globe.tilesLoaded)||now-appliedAt>=3500)){
   cancel();align();ready();
  }
 },100);
 return cancel;
}
