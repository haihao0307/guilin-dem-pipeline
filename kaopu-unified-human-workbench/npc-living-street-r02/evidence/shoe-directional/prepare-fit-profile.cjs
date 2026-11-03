/** Timing-only diagnostic copy of the current production full geometry function. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),root=path.resolve(__dirname,'../..'),file=path.join(root,'src/NativeShoeFit.mjs'),source=fs.readFileSync(file,'utf8'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
if(sha(source)!=='84739f46947d01ce1c57faaf1a251c9233843d65ff1fec3bf254c97a4acc3b9e')throw Error('Production fit changed');
let text=source;const replace=(a,b)=>{if(!text.includes(a)||text.indexOf(a)!==text.lastIndexOf(a))throw Error('Expected unique fit-profile anchor');text=text.replace(a,b);};
replace("from '../vendor/appearance/cloth-adapted/mesh-contact.mjs'", "from '../../vendor/appearance/cloth-adapted/mesh-contact.mjs'");
replace('export function fitNativeShoeGeometry(source,field) {','export function fitNativeShoeGeometry(source,field) {\n  const profile={cloneMs:0,actualVertexNormalMapMs:0,triangleAuditMs:0,boundsMetadataMs:0};let profileMark=performance.now();');
replace('    for(let i=0;i<P.count;i++){\n      const p=[oldP.getX(i)', '    profile.cloneMs+=performance.now()-profileMark;profileMark=performance.now();\n    for(let i=0;i<P.count;i++){\n      const p=[oldP.getX(i)');
replace('    const idx=g.index.array,old=oldP.array,now=P.array;', '    profile.actualVertexNormalMapMs+=performance.now()-profileMark;profileMark=performance.now();\n    const idx=g.index.array,old=oldP.array,now=P.array;');
replace('    P.needsUpdate=N.needsUpdate=true;', '    profile.triangleAuditMs+=performance.now()-profileMark;profileMark=performance.now();\n    P.needsUpdate=N.needsUpdate=true;');
replace('restAttributeAndIndexCountsRetained:true};return part;', 'restAttributeAndIndexCountsRetained:true};profile.boundsMetadataMs+=performance.now()-profileMark;profileMark=performance.now();return part;');
replace('  const fitting={...field.report,maximumDisplacementMm,', '  const fitting={...field.report,profile,maximumDisplacementMm,');
fs.writeFileSync(path.join(__dirname,'NativeShoeGeometryProfiled.mjs'),text);
fs.writeFileSync(path.join(__dirname,'FIT_PROFILE_SOURCE.json'),JSON.stringify({source:'src/NativeShoeFit.mjs',sourceSHA256:sha(source),output:'evidence/shoe-directional/NativeShoeGeometryProfiled.mjs',outputSHA256:sha(text),modifications:'Relative import relocation plus timing around clone, actual vertex/normal mapping, full finite triangle audit, bounds/metadata. All computations and ordering retained.'},null,2)+'\n');
