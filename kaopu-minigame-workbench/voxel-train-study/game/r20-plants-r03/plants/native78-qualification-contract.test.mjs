import test from 'node:test';
import assert from 'node:assert/strict';
import {qualifyMusaMeasurements as qualify,MUSA_QUALIFICATION_CONTRACT as contract,compareNativeGraphs} from './native78-qualification-snapshot.mjs';
// Small qualification-predicate fixture, not regenerated plant output or a golden
// geometry substitute. Its bounds/cells come from measured CI run 38103398263.
const pairs=[{geometry:contract.geometry,content:contract.nodeContent},{geometry:contract.geometry,content:contract.chromiumContent}];
const zero={differentValues:0,maxAbs:0,maxRel:0,nodeNaNs:0,browserNaNs:0,nodeInfinities:0,browserInfinities:0,signedZeroDifferences:0,examples:[]};
function measurement(){
 const fields=[['positions','Float32Array',61896],['normals','Float32Array',61896],['colors','Float32Array',61896],['uvs','Float32Array',41264],['indices','Uint32Array',108990],['windWeights','Float32Array',20632],['windChannels','Float32Array',82528],['windAnchors','Float32Array',61896],['windLeafAxes','Float32Array',61896],['windLeafNormals','Float32Array',61896],['bladeRanges77','Uint32Array',112]],arrays=fields.map(([key,type,length])=>({...zero,path:'specimen.geometry.'+key,type,length,bytes:length*4,byteEqual:true}));
 for(const [i,length]of[16384,16384,16384,262144,262144,262144].entries())arrays.push({...zero,path:'specimen.surfaces.resources['+i+'].bytes',type:'Uint8Array',length,bytes:length,byteEqual:true});
 arrays.push({...zero,path:'specimen.growth.bladeStorage[0]',type:'Float64Array',length:1232,bytes:9856,byteEqual:false,differentValues:5,maxAbs:1.1102230246251565e-16,examples:[370,372,373,374,678].map(index=>({index,abs:1.1102230246251565e-16}))});
 return{input:{profile:{condition76:'normal',habitatForm:'sheltered',leafNaturalismVersion:73,material:'wild-reference',productionSystemVersion:78,profileVersion:8,reproductive76:false,seed:761014,species:'musa-balbisiana',stage:'establishing',treeLeafVersion:75,tropicalLibraryVersion:76},source:{head:contract.sourceHead,closureSha256:contract.sourceClosure}},node:{geometryHash:contract.geometry,contentHash:contract.nodeContent},browser:{geometryHash:contract.geometry,contentHash:contract.chromiumContent},arrays,graph:{...zero,numbers:5914,differentNumbers:0,nonNumericDifferences:0},gates:Object.fromEntries(['sameInput','sameRuleBytes','typedArrayShape','indexExact','finiteArrays','finiteGraph','resourcesExact','topology','noUnseededRandom','noBrowserErrors'].map(k=>[k,true]))};
}
test('Measured native pair and cell-specific Float64 envelope passes without geometry normalization',()=>assert.equal(qualify(measurement(),pairs).pass,true));
test('Unknown output is rejected even when numeric differences look tiny',()=>{const r=measurement();r.browser.contentHash='0'.repeat(64);assert.equal(qualify(r,pairs).pass,false);assert.equal(qualify(measurement(),pairs.slice(0,1)).pass,false);});
for(const [name,edit]of[
 ['render geometry bit change',r=>{r.arrays[0].byteEqual=false;}],
 ['resource bit change',r=>{r.arrays[12].byteEqual=false;}],
 ['index change',r=>{r.arrays[4].differentValues=1;}],
 ['array type change',r=>{r.arrays[0].type='Float64Array';}],
 ['array count change',r=>{r.arrays[0].length--;}],
 ['missing array',r=>{r.arrays.pop();}],
 ['blade overbound',r=>{r.arrays.at(-1).maxAbs=3e-16;}],
 ['extra blade cell',r=>{r.arrays.at(-1).differentValues=6;}],
 ['unobserved blade cell',r=>{r.arrays.at(-1).examples[0].index=0;}],
 ['signed zero change',r=>{r.arrays.at(-1).signedZeroDifferences=1;}],
 ['NaN',r=>{r.arrays.at(-1).browserNaNs=1;}],
 ['graph overbound',r=>{r.graph.maxAbs=3e-16;}],
 ['extra graph cell',r=>{r.graph.differentNumbers=8;}],
 ['graph structure change',r=>{r.graph.nonNumericDifferences=1;}],
 ['graph omitted field',r=>{r.graph.numbers=5913;}],
 ['unobserved graph cell',r=>{r.graph.differentNumbers=1;r.graph.examples=[{path:'unobserved',abs:1e-17}];}],
 ['different seed',r=>{r.input.profile.seed++;}],
 ['different stage',r=>{r.input.profile.stage='mature';}],
 ['different source closure',r=>{r.input.source.closureSha256='0'.repeat(64);}],
 ['failed exact input gate',r=>{r.gates.sameInput=false;}]
])test('Rejects '+name,()=>{const r=measurement();edit(r);assert.equal(qualify(r,pairs).pass,false);});
test('Graph comparator preserves signed zero, NaN and complete structural differences',()=>{const r=compareNativeGraphs({a:0,b:{$number:'NaN'},c:'leaf'},{a:{$number:'-0'},b:0,c:'changed',extra:1});assert.equal(r.exact,false);assert.equal(r.signedZeroDifferences,1);assert.equal(r.nodeNaNs,1);assert(r.nonNumericDifferences>0);});
