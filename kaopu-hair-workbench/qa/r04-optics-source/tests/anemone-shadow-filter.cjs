/* Independent CPU/source-contract checks. A real GPU A/B remains mandatory. */
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),path=require('node:path');
const O=require('../src/anemone-optics.js'),before=require('../baselines/r04-contact-first/src/anemone-optics.js');
let checks=0;
const check=(v,m)=>{assert(v,m);checks++;},close=(a,b,m,t=1e-9)=>check(Math.abs(a-b)<t,m+': '+a+' / '+b);
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const baselinePath=path.join(__dirname,'../baselines/r04-contact-first/src/anemone-optics.js');
check(sha(fs.readFileSync(baselinePath))==='625f10a61024f5dc8cab1f3beda9e7558d3628d5dd8dedd7ea806f352ad28667','frozen pre-filter shader exact bytes');
for(const key of ['tentacleVertex','bodyVertex','shadowFragment'])check(O[key]===before[key],key+' unchanged, including all generated positions');
for(const key of ['DEFAULTS','PALETTES','DEBUG_MODES'])check(JSON.stringify(O[key])===JSON.stringify(before[key]),key+' unchanged');
for(const key of ['lighting','lightMatrix','applyUniforms','beerLambert','localPath','options'])check(O[key].toString()===before[key].toString(),key+' unchanged');
// Aside from the receiver normal and surface shadow call, main is byte-identical.
const main=code=>code.slice(code.indexOf('void main(){'));
const unchangedMain=main(O.fragment).replace(' // Compute the actual rasterized receiver plane before any divergent branch.\n // Analytic shading normals remain untouched; only shadow comparisons use it.\n vec3 receiverNormal=cross(dFdx(world),dFdy(world));\n receiverNormal=dot(receiverNormal,receiverNormal)>.000000000001?normalize(receiverNormal):n;\n','').replace('shadowVisibility(world,receiverNormal,tentacle?tubeShape.x:0.)','shadowVisibility(world+n*.0015)');
check(unchangedMain===main(before.fragment),'all color, light, roughness, exposure, transmission and source-exit code unchanged');
const light=[0,0,1],matrix=O.lightMatrix(light,[0,.62,0],3.2),texel=1/1024,radius=.03,oldBias=.00065;
const flat=O.shadowReceiver(matrix,[0,0,1],radius,texel,oldBias);
close(flat.worldTexel,.00625,'world texel from actual light projection',1e-8);
close(flat.plane[0],0,'flat receiver U slope');close(flat.plane[1],0,'flat receiver V slope');
close(flat.biasWorld,flat.worldTexel*.10,'front receiver base bias is one tenth texel');
close(flat.biasLimit,.0024,'default radius caps bias at 8 percent');
for(const r of [.01,.015,.03,.045,.08,0])for(const angle of [0,.2,.7,1.1,1.45,Math.PI/2,1.8,Math.PI])for(const size of [512,1024,2048]){
 const p=O.shadowReceiver(matrix,[Math.sin(angle),0,Math.cos(angle)],r,1/size,oldBias);
 check(p.plane.every(Number.isFinite)&&Object.values(p).filter(x=>typeof x==='number').every(Number.isFinite),'finite receiver at grazing/reversed normals');
 check(p.biasWorld>=0&&p.biasWorld<=.5*p.worldTexel+1e-12,'bias never exceeds half world texel');
 check(r===0||p.biasWorld<=r*.08+1e-12,'tube bias never exceeds 8 percent local radius');
 check(p.bias<=oldBias+1e-12,'requested normalized bias remains an upper bound');
 check(p.planeLimitWorld<=p.worldTexel*2+1e-12&&(r===0||p.planeLimitWorld<=r*.5+1e-12),'receiver-plane extrapolation bounded by footprint and curvature');
}
const zeroBias=O.shadowReceiver(matrix,[1,0,.01],radius,texel,0);close(zeroBias.biasWorld,0,'zero requested bias remains zero');
// Matrix maps +Z toward the light, so a world plane with +X normal component
// slopes toward increasing normalized depth with increasing shadow U.
const normal=[.5,.2,1],tilted=O.shadowReceiver(matrix,normal,radius,texel,oldBias);
check(tilted.plane[0]>0&&tilted.plane[1]>0,'receiver plane depth slope has correct sign');
const inverted=O.shadowReceiver(matrix,normal.map(x=>-x),radius,texel,oldBias);
close(tilted.plane[0],inverted.plane[0],'plane independent of normal orientation');
close(tilted.plane[1],inverted.plane[1],'V plane independent of normal orientation');
const size=1024,uv=[.50031,.49961],z=.5;
const makePlane=(rec,offset=0)=>(x,y)=>z+rec.plane[0]*((x+.5)/size-uv[0])+rec.plane[1]*((y+.5)/size-uv[1])-offset;
const query=(receiver,depthAt,u=uv,d=z)=>O.shadowVisibilityReference({uv:u,depth:d,width:size,height:size,receiver,depthAt});
close(query(flat,()=>1),1,'unobstructed kernel weights sum to one');
close(query(flat,()=>0),0,'fully blocked kernel remains dark');
close(query(tilted,makePlane(tilted)),1,'sloping receiver does not self-shadow under corrected comparisons');
close(query({...tilted,plane:[0,0]},makePlane(tilted))<1?1:0,1,'same tilted receiver exposes centre-depth PCF self-shadow regression');
close(query(tilted,makePlane(tilted,.008*tilted.depthPerWorld)),0,'nearby 0.008-world-unit parallel blocker remains opaque');
// Sampling an independent closer tube is a comparison test, not a blanket
// shadow lift. The majority-shadowed kernel must still be below one half.
const half=(x,y)=>x<size*.5?.2:1;
check(query(flat,half,[.4995,.5])<.5,'nearby independent blocker is retained');
// Continuity at texel-cell boundaries: piecewise-linear weights cannot jump
// in 1/9 increments like the old equal-weight NEAREST kernel.
let previous=null,min=1,max=0,largestStep=0,distinct=new Set();
for(let i=0;i<=2000;i++){
 const u=.5+(i/2000-.5)*6/size,value=query(flat,half,[u,.5]);
 check(value>=-1e-12&&value<=1+1e-12,'filtered comparison is bounded');
 if(previous!==null){check(value>=previous-1e-10,'simple blocker edge transition monotonic');largestStep=Math.max(largestStep,Math.abs(value-previous));}
 previous=value;min=Math.min(min,value);max=Math.max(max,value);distinct.add(value.toFixed(6));
}
close(min,0,'edge sweep reaches shadow');close(max,1,'edge sweep reaches light');
check(largestStep<.002,'subtexel edge motion has no 1/9 jump');check(distinct.size>200,'continuous filter has more than ten visibility levels');
for(const cell of [511,512,513]){
 const boundary=(cell+.5)/size;
 close(query(flat,half,[boundary-1e-10,.5]),query(flat,half,[boundary+1e-10,.5]),'bilinear/tent reconstruction continuous across grid cell',1e-6);
}
close(query(flat,()=>1,[-.01,.5]),0,'outside-frustum query remains conservatively dark');
check(query(flat,()=>1,[.00001,.5])<1,'outside-map taps do not invent visible light');
const f=O.fragment;
check(f.includes('texelFetch(uShadowDepth,texel,0).r'),'compare exact stored depth before filtering');
check(f.includes('wx[x]*wy[y]*step(receiverDepth-bias,depth)'),'filter comparison outcomes, never interpolated raw depth');
check(f.includes('q.z+clamp(dot(plane,offset),-planeLimit,planeLimit)'),'each tap has its own bounded receiver-plane depth');
check(!f.includes('texture(uShadowDepth'),'no old nearest/fractional depth sampling path remains');
check(f.includes('float escape=max(.002,tubeShape.x*.14);'),'source-exit escape offset preserved');
check(f.includes('return shadowVisibility(point,entryNormal,tubeShape.x);'),'source-exit uses its own entry normal and radius');
check(f.indexOf('dFdx(world)')<f.indexOf('if(tentacle&&nl<0.)'),'derivatives occur outside divergent transmission branch');
check((f.match(/dFdx\(/g)||[]).length===1&&(f.match(/dFdy\(/g)||[]).length===1,'no hidden branch derivatives');
check(!f.includes('discard')&&!f.includes('gl_FragDepth'),'opaque geometry/depth behavior unchanged');
console.log(JSON.stringify({passed:true,checks,oldShaderSha256:sha(fs.readFileSync(baselinePath)),newShaderSha256:sha(fs.readFileSync(path.join(__dirname,'../src/anemone-optics.js'))),defaultFootprint:flat,largestVisibilityStep:largestStep,distinctVisibilityLevels:distinct.size,scope:'CPU and source invariants only; shader compilation, runtime quality and contact shadow preservation require isolated Chromium A/B'},null,2));
