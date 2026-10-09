import test from 'node:test';
import assert from 'node:assert/strict';
import {recoverExplicitPantsCuffGathering as repair} from './cuff-gathering.mjs';
function fixture(){
 const d={schema:'kaopu-analytic-sewing-pattern@1',units:'mm',source:{commit:'d449629979028123a5c4dc9e732a2ec19b7fce31'},recipeHash:'original-recipe',geometryHash:'original-cutting-geometry',bodyCm:{waist:78},design:{meta:{bottom:{v:'Pants'}},pants:{cuff:{type:{v:'CuffBand'},top_ruffle:{v:1.15}}}},panels:[],interfaces:[],seams:[],validation:{analytic2DPass:true,warnings:[]}};
 for(const side of ['l','r']){
  const top=[];
  for(const [part,length]of [['f',300],['b',340]]){
   const cuff={panelId:'pant_'+side+'_cuff_'+part,edge:0,reverse:true},leg={panelId:'pant_'+part+'_'+side,edge:0,reverse:false},cuffLength=640/1.15/2;
   top.push(cuff);d.interfaces.push({component:leg.panelId,name:'bottom',edges:[leg]});
   d.panels.push({id:leg.panelId,verticesMm:[[0,0],[length,0],[length,100],[0,100]]},{id:cuff.panelId,verticesMm:[[0,0],[cuffLength,0],[cuffLength,20],[0,20]]});
   d.seams.push({id:side+part,a:leg,b:cuff,lengthAMm:length,lengthBMm:cuffLength,gathering:{ruffleCoefficientA:1,ruffleCoefficientB:1,projectedLengthAMm:length,projectedLengthBMm:cuffLength}});
  }
  d.interfaces.push({component:'CuffBand_pant_'+side,name:'top',edges:top});
 }
 return d;
}
test('recover local front/back gathering while preserving body, design and exact cutting geometry',async()=>{
 const original=fixture(),before=JSON.stringify(original),out=await repair(original);
 assert.deepEqual(out.panels,original.panels);assert.deepEqual(out.bodyCm,original.bodyCm);assert.deepEqual(out.design,original.design);assert.equal(out.geometryHash,original.geometryHash);assert.notEqual(out.recipeHash,original.recipeHash);
 assert.equal(out.source.continuationCuffGathering.rows.length,4);
 for(const s of out.seams){assert.ok(Math.abs(s.gathering.projectedLengthAMm-s.gathering.projectedLengthBMm)<1e-8);assert.equal(s.originalGatheringBeforeContinuationRepair.ruffleCoefficientA,1);}
 assert.equal(JSON.stringify(original),before);assert.equal(await repair(out),out);
});
test('requested total ratio must agree with actual source material lengths',async()=>{const d=fixture();d.design.pants.cuff.top_ruffle.v=1.25;await assert.rejects(repair(d),/aggregate source edge ratio/);});
test('do not apply constructor-specific correction to an unknown upstream version',async()=>{const d=fixture();d.source.commit='unverified';await assert.rejects(repair(d),/unverified source/);});
test('plain hems, other cuff types and unrelated garments remain unchanged',async()=>{for(const mode of ['plain','skirt','upper']){const d=fixture();if(mode==='plain')d.design.pants.cuff.type.v=null;if(mode==='skirt')d.design.pants.cuff.type.v='CuffSkirt';if(mode==='upper')d.design.meta.bottom.v=null;assert.equal(await repair(d),d);}});
