import {normalizeStations} from '../apps/journey-focus/src/route.mjs';

const commonHeaders={
 'Cache-Control':'no-store',
 'X-Content-Type-Options':'nosniff',
 'Referrer-Policy':'strict-origin-when-cross-origin',
 'X-Frame-Options':'SAMEORIGIN',
};
export function createWorker(fetcher=(...args)=>fetch(...args)){
 let cached=null,pending=null;
 async function stations(env){
  if(!env.TDATA_API_KEY)throw new Error('TDATA_MISSING');
  if(cached&&Date.now()-cached.fetchedAt<3600000)return cached;
  if(pending)return pending;
  pending=(async()=>{
   const url=new URL('https://t-data.seoul.go.kr/apig/apiman-gateway/tapi/TaimsKsccDvSubwayStationGeom/1.0');
   url.search=new URLSearchParams({apikey:env.TDATA_API_KEY,startRow:'1',rowCnt:'1000'});
   const response=await fetcher(url,{signal:AbortSignal.timeout(20000)});
   if(!response.ok)throw new Error('TDATA_UNAVAILABLE');
   const rows=normalizeStations(await response.json(),'2호선');
   if(rows.length<2)throw new Error('TDATA_NO_STATIONS');
   return cached={stations:rows,fetchedAt:Date.now(),source:'서울특별시 T Data · 교통정책지원시스템(TAIMS)',geometry:'역 좌표만 제공 · 선로 선형 미검증'};
  })();
  try{return await pending;}finally{pending=null;}
 }
 return {
  async fetch(request,env){
   const url=new URL(request.url);
   const json=(body,status=200)=>new Response(request.method==='HEAD'?null:JSON.stringify(body),{status,headers:{...commonHeaders,'Content-Type':'application/json; charset=utf-8'}});
   if(!['GET','HEAD'].includes(request.method))return json({error:'METHOD_NOT_ALLOWED'},405);
   const origin=request.headers.get('Origin');
   if(origin&&origin!==url.origin)return json({error:'ORIGIN_DENIED'},403);
   if(url.pathname==='/api/status')return json({vworldConfigured:!!env.VWORLD_API_KEY,tdataConfigured:!!env.TDATA_API_KEY,serviceUrl:url.origin,sdkVersion:'3.0'});
   if(url.pathname==='/api/stations'){
    try{return json(await stations(env));}
    catch{return json({error:env.TDATA_API_KEY?'TDATA_UNAVAILABLE':'TDATA_MISSING',message:'역 정보를 불러오지 못했어요. API 설정과 연결 상태를 확인해 주세요.'},502);}
   }
   // html_handling is disabled: nested directory URLs need an explicit entry.
   // Canonicalize the slash so the pilot's relative scripts/route resolve correctly.
   if(['/alpine-pilot','/songdo','/desert'].includes(url.pathname)){
    url.pathname+='/';
    return new Response(null,{status:308,headers:{...commonHeaders,Location:url.href}});
   }
   const htmlFiles={'/':'/index.html','/map':'/map.html','/map.html':'/map.html','/cabin-frame':'/cabin-frame.html','/cabin-frame.html':'/cabin-frame.html','/alpine-pilot/':'/alpine-pilot/index.html','/alpine-pilot/index.html':'/alpine-pilot/index.html'};
   htmlFiles['/songdo/']='/songdo/index.html';htmlFiles['/songdo/index.html']='/songdo/index.html';
   htmlFiles['/desert/']='/desert/index.html';htmlFiles['/desert/index.html']='/desert/index.html';
   const file=htmlFiles[url.pathname];
   if(file){
    // Read HTML from the assets binding, with HTML redirects disabled in Wrangler.
    const asset=await env.ASSETS.fetch(new Request(new URL(file,url),{method:'GET'}));
    if(!asset.ok)return json({error:'ASSET_MISSING'},502);
    let html=await asset.text();
    if(file==='/map.html'){
     const sdk=new URL('https://map.vworld.kr/js/webglMapInit.js.do');
     sdk.search=new URLSearchParams({version:'3.0',apiKey:env.VWORLD_API_KEY||''});
     html=html.replace('{{VWORLD_SDK_URL}}',sdk.href.replaceAll('&','&amp;').replaceAll('"','&quot;'));
    }
    return new Response(request.method==='HEAD'?null:html,{headers:{...commonHeaders,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"frame-ancestors 'self'"}});
   }
   if(url.pathname.startsWith('/api/'))return json({error:'NOT_FOUND'},404);
   return env.ASSETS.fetch(request);
  }
 };
}
export default createWorker();
