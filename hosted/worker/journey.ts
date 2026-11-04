import journeyHtml from '../source/journey.html?raw';
import mapHtml from '../source/map.html?raw';
import { normalizeStations } from '../source/route.mjs';
type Env = { VWORLD_API_KEY?: string; TDATA_API_KEY?: string; ASSETS?: {fetch(request:Request):Promise<Response>} };
let cached:any=null;
let pending:Promise<any>|null=null;
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','X-Frame-Options':'SAMEORIGIN'};
function json(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{...headers,'Content-Type':'application/json; charset=utf-8'}});}
async function stations(env:Env){
 if(cached && Date.now()-cached.fetchedAt<3600000)return cached;
 if(pending)return pending;
 pending=(async()=>{
  if(!env.TDATA_API_KEY)throw new Error('Missing key');
  const url=new URL('https://t-data.seoul.go.kr/apig/apiman-gateway/tapi/TaimsKsccDvSubwayStationGeom/1.0');
  url.search=new URLSearchParams({apikey:env.TDATA_API_KEY,startRow:'1',rowCnt:'1000'}).toString();
  const response=await fetch(url,{signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new Error('Unavailable');
  const rows=normalizeStations(await response.json());
  if(rows.length<2)throw new Error('No stations');
  return cached={stations:rows,fetchedAt:Date.now(),source:'서울특별시 T Data · 교통정책지원시스템(TAIMS)',geometry:'역 좌표만 제공 · 선로 선형 미검증'};
 })();
 try{return await pending;}finally{pending=null;}
}
export default {
 async fetch(request:Request,env:Env){
  const url=new URL(request.url);
  if(!['GET','HEAD'].includes(request.method))return json({error:'METHOD_NOT_ALLOWED'},405);
  const origin=request.headers.get('Origin');
  if(origin&&origin!==url.origin)return json({error:'ORIGIN_DENIED'},403);
  if(url.pathname==='/api/status')return json({vworldConfigured:!!env.VWORLD_API_KEY,tdataConfigured:!!env.TDATA_API_KEY,serviceUrl:url.origin,sdkVersion:'3.0'});
  if(url.pathname==='/api/stations'){
   try{return json(await stations(env));}catch{return json({error:'TDATA_UNAVAILABLE',message:'역 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'},502);}
  }
  if(url.pathname==='/'||url.pathname==='/map'){
   let html=journeyHtml;
   if(url.pathname==='/map'){
    const sdk=new URL('https://map.vworld.kr/js/webglMapInit.js.do');
    sdk.search=new URLSearchParams({version:'3.0',apiKey:env.VWORLD_API_KEY||''}).toString();
    html=mapHtml.replace('{{VWORLD_SDK_URL}}',sdk.href.replaceAll('&','&amp;').replaceAll('"','&quot;'));
   }
   return new Response(request.method==='HEAD'?null:html,{headers:{...headers,'Content-Type':'text/html; charset=utf-8'}});
  }
  return env.ASSETS?env.ASSETS.fetch(request):json({error:'NOT_FOUND'},404);
 }
};
