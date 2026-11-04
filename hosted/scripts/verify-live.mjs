// The private-site token is accepted on hidden stdin only; never saved.
process.stdin.setEncoding('utf8');
let input='';
process.stdin.on('data',async chunk=>{
 input+=chunk;
 if(!/[\r\n]/.test(input))return;
 process.stdin.pause();
 const {origin,token}=JSON.parse(input);
 input='';
 try{
  for(const path of ['/','/api/status','/api/stations','/map','/app.mjs','/assets/leafy_tree_lod/model.gltf']){
   const response=await fetch(origin+path,{headers:{'OAI-Sites-Authorization':'Bearer '+token},redirect:'manual',signal:AbortSignal.timeout(25000)});
   const body=await response.text();
   if(response.status!==200)throw new Error(path+' returned '+response.status);
   if(path==='/api/stations'&&JSON.parse(body).stations.length<19)throw new Error('Station list incomplete');
   if(path==='/api/status'&&!JSON.parse(body).vworldConfigured)throw new Error('Map not configured');
   console.log(JSON.stringify({path,status:response.status,bytes:body.length}));
  }
  console.log('Live site checks passed');
  process.exit(0);
 }catch(error){console.log(error.message);process.exit(1);}
});
if(process.stdin.isTTY){process.stdin.setRawMode(true);process.stderr.write('Ready for private verification JSON on hidden stdin.\n');}
