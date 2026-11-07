import {cp,mkdir,readFile,readdir,rm,stat,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=fileURLToPath(new URL('../',import.meta.url));
const app=path.join(root,'apps/journey-focus');
const output=path.resolve(root,'dist/cloudflare');
if(path.relative(root,output)!==path.join('dist','cloudflare'))throw new Error('Invalid build directory');
// Only this generated deployment directory is replaced, never source or .env files.
await rm(output,{recursive:true,force:true});
await mkdir(output,{recursive:true});
for(const entry of await readdir(path.join(app,'public'),{withFileTypes:true})){
 if(['review','video-pilot.html'].includes(entry.name))continue;
 await cp(path.join(app,'public',entry.name),path.join(output,entry.name),{recursive:true});
}
await cp(path.join(app,'src'),path.join(output,'src'),{recursive:true});
await mkdir(path.join(output,'models'),{recursive:true});
await cp(path.join(root,'assets-source/subway-car/SubwayCar_Compiled.fbx'),path.join(output,'models/subway-car.fbx'));
await cp(path.join(root,'assets-source/subway-car/README.md'),path.join(output,'models/SOURCE.md'));
await writeFile(path.join(output,'_headers'),'/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  X-Frame-Options: SAMEORIGIN\n');

// Check the browser's actual import graph, including FBXLoader dependencies.
const pending=['/destinations.mjs','/desert/src/app.mjs','/songdo/src/app.mjs','/alpine-pilot/pilot.mjs','/app.mjs','/map.mjs','/cabin-frame.mjs'],seen=new Set();
while(pending.length){
 const url=pending.pop();
 if(seen.has(url))continue;
 seen.add(url);
 const code=await readFile(path.join(output,url),'utf8');
 // Match declarations, not prose such as BufferGeometryUtils' "from 'srgb-linear'" comment.
 for(const match of code.matchAll(/(?:^\s*import\s+(?:[^;'"\x60]*?\bfrom\s*)?|^\s*export\s+(?:\*|\{[^}]*\})\s+from\s*|\bimport\s*\(\s*)['"]([^'"]+)['"]/gm)){
  const specifier=match[1];
  if(/^https?:/.test(specifier))continue;
  if(!specifier.startsWith('/')&&!specifier.startsWith('.'))throw new Error(`Unmapped browser import: ${specifier}`);
  pending.push(new URL(specifier,'https://assets.invalid'+url).pathname);
 }
}
let files=0,bytes=0;
async function verify(directory){
 for(const entry of await readdir(directory,{withFileTypes:true})){
  const file=path.join(directory,entry.name);
  if(entry.isDirectory()){await verify(file);continue;}
  if(entry.name.startsWith('.env')||entry.name.startsWith('.dev.vars'))throw new Error('Credential file found in assets');
  const size=(await stat(file)).size;
  if(size>25*1024*1024)throw new Error(`Asset exceeds Cloudflare size limit: ${path.relative(output,file)}`);
  files++;bytes+=size;
 }
}
await verify(output);
console.log(`Cloudflare assets ready: ${files} files, ${(bytes/1024/1024).toFixed(1)} MiB; ${seen.size} browser modules verified.`);
