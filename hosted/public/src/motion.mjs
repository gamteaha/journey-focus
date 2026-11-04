export function medianHeight(values){
  const finite=values.filter(Number.isFinite).sort((a,b)=>a-b);
  if(!finite.length)return null;
  const middle=Math.floor(finite.length/2);
  return finite.length%2?finite[middle]:(finite[middle-1]+finite[middle])/2;
}
export function pilotGroundHeight(values,reference){
  return medianHeight(values.filter(h=>Number.isFinite(h)&&h>=0&&(!Number.isFinite(reference)||reference<0||Math.abs(h-reference)<20)));
}
export class HeightStabilizer{
  constructor(){this.height=null;this.time=null;}
  update(target,seconds,snap=false){
    const dt=this.time===null?0:Math.max(0,Math.min(.05,seconds-this.time));
    this.time=seconds;
    if(!Number.isFinite(target))return this.height;
    if(this.height===null||snap){this.height=target;return this.height;}
    const desired=(target-this.height)*(1-Math.exp(-dt/.35));
    this.height+=Math.max(-.8*dt,Math.min(.8*dt,desired));
    return this.height;
  }
}
