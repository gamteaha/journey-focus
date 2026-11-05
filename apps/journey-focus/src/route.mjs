export const GYEONGCHUN_ORDER = ['신내', '갈매', '별내', '퇴계원', '사릉', '금곡', '평내호평', '천마산', '마석', '대성리', '청평', '상천', '가평', '굴봉산', '백양리', '강촌', '김유정', '남춘천', '춘천'];
export const CITY_ORDER = ['시청','을지로입구','을지로3가','을지로4가','동대문역사문화공원','신당','상왕십리','왕십리','한양대','뚝섬','성수','건대입구','구의','강변','잠실나루','잠실','잠실새내','종합운동장','삼성','선릉','역삼','강남','교대','서초','방배','사당','낙성대','서울대입구','봉천','신림','신대방','구로디지털단지','대림','신도림','문래','영등포구청','당산','합정','홍대입구','신촌','이대','아현','충정로'];
export const STATION_ORDER = [...GYEONGCHUN_ORDER,...CITY_ORDER];
const rad = d => d * Math.PI / 180;
export function normalizeStations(rows,line='경춘선') {
  if (!Array.isArray(rows)) throw new Error('Invalid station response');
  const byName = new Map();
  for (const row of rows) {
    const name=typeof row.stnKrNm==='string'?row.stnKrNm.replace(/\s*\([^)]*\)\s*/g,'').trim():'';
    if (row.lineNm !== line || !(line==='2호선'?CITY_ORDER:GYEONGCHUN_ORDER).includes(name)) continue;
    const lon = Number(row.convX), lat = Number(row.convY);
    if (!Number.isFinite(lon) || !Number.isFinite(lat) || lon < 124 || lon > 132 || lat < 33 || lat > 39) continue;
    byName.set(name, { name, lon, lat });
  }
  return (line==='2호선'?CITY_ORDER:GYEONGCHUN_ORDER).filter(n => byName.has(n)).map(n => byName.get(n));
}
export function distance(a, b) {
  const dlat = rad(b.lat - a.lat), dlon = rad(b.lon - a.lon);
  const h = Math.sin(dlat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dlon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}
export function buildRoute(stations, from, to, shape = null) {
  if(shape?.loop)return circularRoute(stations,from,to,shape,false);
  const start = stations.findIndex(s => s.name === from), end = stations.findIndex(s => s.name === to);
  if (start < 0 || end < 0 || start === end) throw new Error('서로 다른 출발역과 도착역을 선택해 주세요.');
  let selected = stations.slice(Math.min(start, end), Math.max(start, end) + 1);
  if (start > end) selected = selected.reverse();
  let points = selected, geometry = 'station-interpolation';
  const anchors=Array.isArray(shape?.stationAnchors)?shape.stationAnchors:[];
  const fromAnchor=anchors.find(a=>a.name===from),toAnchor=anchors.find(a=>a.name===to);
  const multi=fromAnchor&&toAnchor&&[fromAnchor.pointIndex,toAnchor.pointIndex].every(i=>Number.isInteger(i)&&i>=0&&i<shape.points?.length);
  const supported = shape && (multi || (shape.from === from && shape.to === to) || (shape.from === to && shape.to === from));
  let stops=null;
  if (supported && Array.isArray(shape.points) && shape.points.length > 1 && shape.points.every(p => Number.isFinite(p.lon) && Number.isFinite(p.lat))) {
    geometry = 'osm-rail';
    const low=multi?Math.min(fromAnchor.pointIndex,toAnchor.pointIndex):0,high=multi?Math.max(fromAnchor.pointIndex,toAnchor.pointIndex):shape.points.length-1;
    const source=shape.points.slice(low,high+1);
    points = source.map(p => ({ ...p }));
    const reversed=multi?fromAnchor.pointIndex>toAnchor.pointIndex:shape.from!==from;
    if (reversed) points = points.reverse().map((p, i) => ({ ...p, tunnel: source[source.length - 2 - i]?.tunnel || false }));
    const cumulative=[0];for(let i=1;i<points.length;i++)cumulative.push(cumulative.at(-1)+distance(points[i-1],points[i]));
    stops=multi?anchors.filter(a=>a.pointIndex>=low&&a.pointIndex<=high).map(a=>({name:a.name,metres:cumulative[reversed?high-a.pointIndex:a.pointIndex-low]})).sort((a,b)=>a.metres-b.metres):[{name:from,metres:0},{name:to,metres:cumulative.at(-1)}];
    points = points.map((p,i)=>({...p,name:stops.filter(s=>s.metres<=cumulative[i]+.01).at(-1)?.name||from}));
  }
  const segments = points.slice(0, -1).map((a, i) => ({ a, b: points[i + 1], distance: distance(a, points[i + 1]), tunnel: Boolean(a.tunnel) })).filter(s=>s.distance>0);
  const total = segments.reduce((sum, s) => sum + s.distance, 0);
  if (!Number.isFinite(total) || total <= 0) throw new Error('유효한 경로 좌표가 없습니다.');
  return { stations: selected, segments, distance: total, geometry, ...(stops?{stops}: {}) };
}
export function buildLoopRoute(stations,from,shape){return circularRoute(stations,from,from,shape,true);}
function circularRoute(stations,from,to,shape,fullLap){
  if(!shape?.loop||!stations.some(s=>s.name===from)||!stations.some(s=>s.name===to)||(!fullLap&&from===to))throw new Error('유효한 순환선 역을 선택해 주세요.');
  const a=shape.stationAnchors.find(s=>s.name===from)?.pointIndex,b=shape.stationAnchors.find(s=>s.name===to)?.pointIndex,n=shape.points.length-1;
  if(!Number.isInteger(a)||!Number.isInteger(b)||n<2||distance(shape.points[0],shape.points.at(-1))>.01)throw new Error('연결된 순환선 데이터가 필요해요.');
  function path(direction){
    const indices=[a];let cursor=a;
    do{cursor=(cursor+direction+n)%n;indices.push(cursor);}while(cursor!==b&&indices.length<=n);
    const points=indices.map(i=>({...shape.points[i],tunnel:Boolean(shape.points[direction===1?i:(i-1+n)%n].tunnel)}));
    const segments=points.slice(0,-1).map((p,i)=>({a:p,b:points[i+1],distance:distance(p,points[i+1]),tunnel:p.tunnel}));
    return {indices,points,segments,distance:segments.reduce((sum,s)=>sum+s.distance,0),direction};
  }
  const forward=path(1),backward=fullLap?null:path(-1),chosen=backward&&backward.distance<forward.distance?backward:forward;
  const anchors=new Map(shape.stationAnchors.map(s=>[s.pointIndex,s.name])),stops=[];let metres=0;
  chosen.indices.forEach((i,j)=>{if(j)metres+=chosen.segments[j-1].distance;const name=anchors.get(i);if(name)stops.push({name,metres});});
  const selected=stops.map(s=>({...(stations.find(t=>t.name===s.name)||shape.points[shape.stationAnchors.find(t=>t.name===s.name).pointIndex]),name:s.name}));
  return {stations:selected,segments:chosen.segments,distance:chosen.distance,geometry:'osm-rail',stops,loop:fullLap,direction:chosen.direction};
}
function routeSample(route,metres){
  let remaining = route.loop?((metres%route.distance)+route.distance)%route.distance:Math.max(0,Math.min(route.distance,metres));
  let segment = route.segments.at(-1), ratio = 1;
  for (const s of route.segments) {
    if (remaining <= s.distance) { segment = s; ratio = remaining / s.distance; break; }
    remaining -= s.distance;
  }
  const { a, b } = segment;
  return {segment,ratio,lon:a.lon+(b.lon-a.lon)*ratio,lat:a.lat+(b.lat-a.lat)*ratio};
}
export function positionAt(route, progress) {
  const value=Number(progress)||0,p = route.loop?((value%1)+1)%1:Math.max(0,Math.min(1,value)),metres=route.distance*p;
  const point=routeSample(route,metres),{a,b}=point.segment;
  const passed=route.stops?.filter(s=>s.metres<=metres+.001).at(-1),nextStop=route.stops?.find(s=>s.metres>metres+.001);
  // A 24 m local chord blends the view through polyline corners. The actual
  // source position, distance, endpoints and tunnel metadata are unchanged.
  const behind=routeSample(route,metres-12),ahead=routeSample(route,metres+12);
  const y = Math.sin(rad(ahead.lon - behind.lon)) * Math.cos(rad(ahead.lat));
  const x = Math.cos(rad(behind.lat)) * Math.sin(rad(ahead.lat)) - Math.sin(rad(behind.lat)) * Math.cos(rad(ahead.lat)) * Math.cos(rad(ahead.lon - behind.lon));
  return {
    lon: point.lon, lat: point.lat,
    heading: (Math.atan2(y, x) * 180 / Math.PI + 360) % 360,
    name: p === 1 ? route.stations.at(-1).name : p===0?route.stations[0].name:passed?.name||a.name, next: nextStop?.name || (route.geometry === 'osm-rail' ? route.stations.at(-1).name : b.name),
    segmentProgress: point.ratio, tunnel: point.segment.tunnel,
  };
}
