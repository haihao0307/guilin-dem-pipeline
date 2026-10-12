import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {STATION_SERIF_GLYPHS,LETTERING_LIMITS,LETTERING_SOURCE_LAYOUT,nativeGlyphContours,bezierAt,splitBezier,bezierBounds,compileBezierArc,measureNativeWord,createStationLetteringWord,sampleNativeGlyph,stationLetteringSample,stationLetteringPoint,stationPlatformLettering,stationHallLettering,stationLetteringTemplates,stationLetteringWGSL,nativeArcDistance} from '../../native-station-lettering.mjs';
import {terminalHallMembers} from '../../native-terminal-hall.mjs';
import {stationLampMembers,stationMemberSample} from '../../native-station-lamps.mjs';
import {scanWGSLIdentifiers} from '../wgsl-identifiers.mjs';
const fixture=JSON.parse(fs.readFileSync(new URL('./station-lettering-source-r02.json',import.meta.url),'utf8'));
const close=(a,b,eps=1e-10)=>assert(Math.abs(a-b)<=eps,`${a} != ${b} ± ${eps}`);
const commands=g=>{const c=[];g.draw(Object.fromEntries(['m','l','q','c','z'].map(k=>[k,(...a)=>c.push([k,...a])])));return c;};
const sampleGlyphSource=(character,p,height=.47)=>{const word=createStationLetteringWord(character,{height}),l=measureNativeWord(character,{height});return sampleNativeGlyph(word.glyphs[0],[(p[0]-l.centerX)*l.scale,(p[1]-l.minY)*l.scale]);};
const polylineReference=(g,n=2048)=>{const contours=nativeGlyphContours(g).map(c=>c.flatMap(a=>Array.from({length:a.degree===1?1:n},(_,i)=>bezierAt(a.points,i/(a.degree===1?1:n)))));return p=>{let distance=Infinity,winding=0;for(const contour of contours)for(let j=0;j<contour.length;j++){const a=contour[j],b=contour[(j+1)%contour.length],dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/Math.max(dx*dx+dy*dy,1e-30)));distance=Math.min(distance,Math.hypot(p[0]-a[0]-dx*t,p[1]-a[1]-dy*t));if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<a[0]+dx*(p[1]-a[1])/dy)winding+=dy>0?1:-1;}return winding===0?distance:-distance;};};

test('all 20 glyph programs retain literal source commands, advances, solids and counters',()=>{
 assert.equal(Object.keys(STATION_SERIF_GLYPHS).length,20);
 for(const[c,g]of Object.entries(STATION_SERIF_GLYPHS)){const original=fixture.glyphs[c],stream=commands(g);assert.equal(createHash('sha256').update(JSON.stringify(stream)).digest('hex'),original.commandSHA256,c);for(const k of['advance','solids','counters'])assert.equal(g[k],original[k],c+' '+k);assert.equal(nativeGlyphContours(c).length,g.solids+g.counters,c);for(const k of['m','l','q','c','z'])assert.equal(stream.filter(a=>a[0]===k).length,original.commandCounts[k],c+' '+k);}

});

test('curve evaluator preserves quadratic and cubic points under exact de Casteljau splitting',()=>{
 for(const points of[[[0,0],[.2,.7],[1,0]],[[0,0],[.1,1],[.8,-.7],[1,0]]]){const [a,b]=splitBezier(points,.37);for(let i=0;i<=100;i++){const t=i/100,r=bezierAt(points,t),s=t<=.37?bezierAt(a,t/.37):bezierAt(b,(t-.37)/.63);close(r[0],s[0]);close(r[1],s[1]);}const bounds=bezierBounds(points);for(let i=0;i<=1000;i++)for(let k=0;k<2;k++){const x=bezierAt(points,i/1000)[k];assert(x>=bounds.min[k]-1e-12&&x<=bounds.max[k]+1e-12);}}
});

test('controlled distance approximation encloses dense independent native-curve distance',()=>{
 for(const source of[[[0,0],[.2,.7],[1,0]],[[0,0],[.1,1],[.8,-.7],[1,0]]]){const points=source.map(p=>p.map(x=>x*.25)),a=compileBezierArc(points,.0001);assert(a.error<=.0001);for(const p of[[.2,.3],[.47,-.17],[.88,.02],[0,0],[1,0]]){const d=nativeArcDistance(a,p);let ref=Infinity;for(let i=0;i<=30000;i++)ref=Math.min(ref,Math.hypot(...bezierAt(points,i/30000).map((x,k)=>x-p[k])));assert(Math.abs(d-ref)<=a.error+2e-8,JSON.stringify({p,d,ref,error:a.error}));}}
});

test('each finite glyph retains actual counter holes and curved ink',()=>{
 for(const[c,p]of[['O',[393,370]],['P',[330,500]],['A',[330,400]],['R',[350,500]],['o',[311,270]],['4',[250,360]],['龍',[268,350]],['龍',[268,220]],['龍',[735,80]],['龍',[720,400]]])assert(sampleGlyphSource(c,p).d>0,`Counter filled: ${c} ${p}`);
 for(const[c,p]of[['O',[100,370]],['P',[200,450]],['A',[140,120]],['o',[100,270]],['龍',[130,200]],['九',[380,700]]])assert(sampleGlyphSource(c,p).d<0,`Ink missing: ${c} ${p}`);
});

test('native winding agrees with dense independent contours on serif and Chinese glyph grids',()=>{
 for(const c of ['O','P','4','九','龍']){const ref=polylineReference(c,512),height=.47,l=measureNativeWord(c,{height}),w=createStationLetteringWord(c,{height});for(let x=-7;x<=1020;x+=73)for(let y=-97;y<=890;y+=71){const p=[x+.317,y+.619],r=ref(p)*l.scale,q=[(p[0]-l.centerX)*l.scale,(p[1]-l.minY)*l.scale],s=sampleNativeGlyph(w.glyphs[0],q).d;if(Math.abs(r)>w.error*2)assert.equal(Math.sign(s),Math.sign(r),c+' '+p);assert(Math.abs(s-r)<=w.error+1e-6,JSON.stringify({c,p,s,r,error:w.error}));}}
});

test('R02 source word centering and requested visible heights are retained',()=>{
 const templates=stationLetteringTemplates();assert.deepEqual(templates.map(w=>w.text),['PLATFORM','No. 1','No. 2','No. 3','No. 4','九龍  KOWLOON']);
 for(const w of templates){const bounds=w.glyphs.reduce((b,g)=>({min:[0,1].map(k=>Math.min(b.min[k],g.bounds.min[k])),max:[0,1].map(k=>Math.max(b.max[k],g.bounds.max[k]))}),{min:[Infinity,Infinity],max:[-Infinity,-Infinity]});close(bounds.min[1],0);close(bounds.max[1],w.height);close(bounds.min[0],-w.width/2);close(bounds.max[0],w.width/2);assert.equal(w.id,7);assert.equal(w.seed,188);assert.equal(w.pixelAA,false);}
 close(templates[0].width,.9024678663239075);close(templates[5].width,4.0535);
 for(const row of fixture.legacyMetricComparison){close(measureNativeWord(row.text,{height:row.height}).width,row.nativeWidthM);assert(Math.abs(row.widthDeltaM)<.000001);}
 assert.equal(LETTERING_SOURCE_LAYOUT.hall.sourceFaceClearance,.04);
});

test('station signs retain literal two-line layout within 1.12 × 0.52 m source boards',()=>{
 for(let row=0;row<4;row++){const origin=[-30+20*row,0,-53.5],words=stationPlatformLettering({row,origin});assert.equal(words.length,4);for(const w of words){const isTop=w.text==='PLATFORM';assert(isTop||w.text==='No. '+(row+1));close(w.height,isTop?.12:.17);close(w.origin[1],.85+2.6+(isTop?.075:-.16));assert(w.width<1.12);assert((isTop?.075:-.16)+w.height<.26);const side=w.normal[0];close(w.origin[0]-origin[0],.03+side*.0225);close(w.origin[2]-origin[2],-.72);assert.deepEqual(w.right,[0,0,-side]);assert.deepEqual(w.up,[0,1,0]);close(w.depth,.0045);close(w.embed,.0005);}}
});

test('both physical sign faces have outward relief, inward roots and nonmirrored lettering',()=>{
 const board=stationLampMembers().find(m=>m.id==='sign');for(const w of stationPlatformLettering()){const q=[0,w.height/2,-.00025],p=stationLetteringPoint(w,q);assert(stationMemberSample(board,p).d<0,'Letter root must meet actual sign, not old floating plane');const edge=stationLetteringPoint(w,[w.width/2,0,0]),center=stationLetteringPoint(w,[0,0,0]);close((edge[2]-center[2])*w.right[2],w.width/2);close(w.right[2]*-w.normal[0],1);}
});

test('real raised caps, sides, buried roots and holes are distinct from bounds',()=>{
 const w=createStationLetteringWord('O',{height:.17,depth:.0045,embed:.0005}),l=measureNativeWord('O',{height:.17});const p=(x,y,z)=>stationLetteringPoint(w,[(x-l.centerX)*l.scale,(y-l.minY)*l.scale,z]);
 assert(stationLetteringSample(w,p(100,370,.002)).d<0);close(stationLetteringSample(w,p(100,370,.0045)).d,0);close(stationLetteringSample(w,p(100,370,.0046)).d,.0001);assert(stationLetteringSample(w,p(393,370,.0045)).d>.02,'Cap must never fill O counter');
 const miss=stationLetteringSample(w,[5,5,5]);assert.equal(miss.valid,false);assert.equal(miss.d,Infinity);assert(!('id'in miss));assert.equal(miss.steps,0);assert(miss.lowerBound>1);
});

test('engraving exposes a finite cutter, never silently emits it as raised ink',()=>{
 const w=createStationLetteringWord('O',{height:.17,depth:.002,embed:.0005,mode:'engraved'}),l=measureNativeWord('O',{height:.17}),xy=[(100-l.centerX)*l.scale,(370-l.minY)*l.scale];assert.deepEqual(w.zRange,[-.002,.0005]);const hit=stationLetteringSample(w,[...xy,-.001]);assert(hit.d<0);assert.equal(hit.mode,'engraved');assert(stationLetteringSample(w,[...xy,-.003]).d>0);
});

test('hall lettering requires actual −X portico anchor and keeps original title',()=>{
 const anchor=terminalHallMembers().anchors[0],w=stationHallLettering({anchor});assert.equal(w.text,'九龍  KOWLOON');assert.deepEqual(w.origin,anchor.at);assert.deepEqual(w.normal,[-1,0,0]);assert.deepEqual(w.right,[0,0,1]);close(w.height,.47);close(w.depth,.020);const p=stationLetteringPoint(w,[1,.1,.02]);close(p[0],anchor.at[0]-.02);close(p[2],anchor.at[2]+1);assert.throws(()=>stationHallLettering());
});

test('all approximation and query budgets are explicit and fail closed',()=>{
 for(const w of stationLetteringTemplates()){assert(w.error<=w.toleranceM);assert(w.worldError>w.error);assert(w.stepBudget<=LETTERING_LIMITS.maxStepsPerGlyph*w.glyphs.length);for(const g of w.glyphs){assert(g.arcs.length<=LETTERING_LIMITS.maxArcsPerGlyph);for(const a of g.arcs){assert(a.steps<=LETTERING_LIMITS.maxStepsPerArc);assert(a.error<=w.toleranceM);assert(a.rootError<1e-7);}}}
 for(const o of[{toleranceM:1e-9},{height:2},{depth:0},{origin:[Infinity,0,0]},{right:[-1,0,0]}])assert.throws(()=>createStationLetteringWord('O',o));assert.throws(()=>createStationLetteringWord('Z'));assert.throws(()=>createStationLetteringWord(' '.repeat(4)));assert.throws(()=>stationPlatformLettering({row:4}));assert.throws(()=>compileBezierArc([[0,0],[0,1e9],[1,0]],.00002));
});

test('WGSL has complete licensed curve commands, finite loops and valid-only candidates',()=>{
 const code=stationLetteringWGSL();assert.deepEqual(scanWGSLIdentifiers(code),[]);assert(code.includes('struct StationLetteringHit{valid:u32'));assert(code.includes('StationLetteringHit(0u,1e5,error,safeBound'));assert(code.includes('stationLetteringBezier'));assert(code.includes('stationLetteringWinding'));assert(code.includes('k<28u'));assert(code.includes('No. 4'));assert(code.includes('九龍  KOWLOON'));assert(code.includes('row+1u'));assert(code.includes('vec3<f32>(offset.z,offset.y,-offset.x)'));for(const token of['textureSample','sampler','vertexBuffer','BufferGeometry','THREE.'])assert(!code.includes(token));assert(code.length<250000,'Unexpected unbounded code growth');
});
