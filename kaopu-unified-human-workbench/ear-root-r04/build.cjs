const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),sha=s=>crypto.createHash('sha256').update(s).digest('hex');
assert.equal(sha(fs.readFileSync(root+'/ear-refinement-r03/preview.html')),'8f302ee0da21e1ad19e88a8f718acdd518a447c2e7bd5873629e66c144210d49','Frozen R03 preview changed');
require('./derive.cjs');
const file=path.join(__dirname,'build-runtime.cjs');
if(!fs.existsSync(file)){
 let s=fs.readFileSync(root+'/ear-refinement-r03/build-runtime.cjs','utf8').replaceAll('ear-refinement-r03','ear-root-r04').replaceAll('EAR-R03.0','EAR-R04.0').replaceAll('ear-r03-app','ear-r04-app');
 const replace=(a,b)=>{assert.equal(s.split(a).length,2,'R03 build anchor changed: '+a);s=s.replace(a,()=>b);};
 replace("ANCHOR='7f90e53c1d114f65b08710d67d792d489719ee67'","ANCHOR='7e223fed91b389b9ff9b6709593930095b6120a4'");
 replace('let app="',"let app=\"import {mountRootUI} from '../../ear-root-r04/RootUI.mjs';\\n");
 replace('mountRefinementReview({model,viewer,controller});wasLoaded=true;','mountRefinementReview({model,viewer,controller});mountRootUI({model,viewer,controller});wasLoaded=true;');
 replace("recoveredFrom:'b2bb70362e2af7d8792b31d6340cf5565f83c685'","recoveredFrom:'7e223fed91b389b9ff9b6709593930095b6120a4',domainSchema:'kaopu/ear-root-domain@1',earArchiveSchema:'kaopu/ear-structure@3',scalpPinned:true,rootBoundaryPinned:true,spatialBoxSelection:false,subdivisionMovesOldVertices:false");
 replace('userBaseline:ANCHOR,','userBaseline:ANCHOR,lipAncestor:\'7f90e53c1d114f65b08710d67d792d489719ee67\',frozenR03PreviewSHA256:\'8f302ee0da21e1ad19e88a8f718acdd518a447c2e7bd5873629e66c144210d49\',');
 fs.writeFileSync(file,s);
}
require('./build-runtime.cjs');
