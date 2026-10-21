const fs=require('node:fs'), path=require('node:path'), assert=require('node:assert/strict');
const {spawn}=require('node:child_process'), {createHash,webcrypto}=require('node:crypto');
require('./candidate/guilin/canonical-tile-source.js');
const root=__dirname;
async function main(){
 const child=spawn('python3',[path.join(root,'range_fixture_server.py'),'--port','0'],{stdio:['ignore','pipe','inherit']});
 const port=await new Promise((resolve,reject)=>{child.stdout.once('data',b=>resolve(JSON.parse(b.toString()).port));child.once('error',reject);});
 try {
  const origin=`http://127.0.0.1:${port}`,base=origin+'/candidate/guilin-elevation-store-v1/';
  const url=base+'shards/elevation-shard-000.i16pack', checks=[];
  const head=await fetch(url,{method:'HEAD'});assert.equal(head.status,200);assert.equal(+head.headers.get('Content-Length'),66595840);
  for(const [start,end] of [[0,15],[524288,524303],[66595824,66595839]]){
   const response=await fetch(url,{headers:{Range:`bytes=${start}-${end}`}});
   assert.equal(response.status,206);assert.equal(response.headers.get('Content-Range'),`bytes ${start}-${end}/66595840`);
   assert.equal((await response.arrayBuffer()).byteLength,16);checks.push({start,end,status:206});
  }
  const oob=await fetch(url,{headers:{Range:'bytes=66595840-66595855'}});assert.equal(oob.status,416);assert.equal(await oob.text(),'');
  const old=JSON.parse(fs.readFileSync(path.join(root,'baseline/guilin/data/NATIVE_ELEVATION_MANIFEST.json')));
  let requestCount=0,maxRange=0;
  const source=createGuilinCanonicalTileSource({baseUrl:base,cryptoImpl:webcrypto,fetchFn:async(u,o)=>{
   if(o.headers?.Range){const m=/bytes=(\d+)-(\d+)/.exec(o.headers.Range);maxRange=Math.max(maxRange,+m[2]-m[1]+1);requestCount++;}
   return fetch(u,o);
  }});
  const tiles=[old.tiles[0],old.tiles.at(-1)];
  for(const t of tiles){const b=await source.loadTile(t);assert.equal(createHash('sha256').update(Buffer.from(b)).digest('hex'),t.sha256);}
  let cancelled=false,consumed=false;
  const broken=createGuilinCanonicalTileSource({baseUrl:origin+'/force200/guilin-elevation-store-v1/',cryptoImpl:webcrypto,fetchFn:async(u,o)=>{
   const response=await fetch(u,o);if(!o.headers?.Range)return response;
   return {status:response.status,headers:response.headers,body:{cancel:async()=>{cancelled=true;await response.body.cancel();}},arrayBuffer:async()=>{consumed=true;return response.arrayBuffer();}};
  }});
  await assert.rejects(broken.loadTile(old.tiles[0]));
  assert.equal(cancelled,true);assert.equal(consumed,false);
  const result={passed:true,transport:'actual localhost HTTP, no browser',range_checks:checks,no_range_head_status:head.status,out_of_bounds_status:oob.status,
   first_and_southeast_legacy_tile_sha_exact:true,range_requests:requestCount,maximum_range_bytes:maxRange,
   forced_http_200_cancelled_before_arrayBuffer:true,browser_qa_completed:false,public_deployment_completed:false};
  fs.writeFileSync(path.join(root,'reports/REAL_HTTP_TRANSPORT_VERIFY.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
 } finally {child.kill('SIGTERM');}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
