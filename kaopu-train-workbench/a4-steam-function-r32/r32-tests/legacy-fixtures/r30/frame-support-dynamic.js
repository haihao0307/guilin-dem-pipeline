/* Candidate-only documented slot topology + explicitly inferred support.
 * Both original frame constructors and baseline remain unmodified. */
(function(){const D=DYNAMIC,F=FRAME_SUPPORT,prior=D.visible,hidden=new Set(F.replaceStackIds);
SCENE.sources.installation+='\n'+F.source;SCENE.parts.push(...F.parts);
D.visible=(part,installation)=>hidden.has(part.id)?false:prior(part,installation);
if(/float mDisc\(|float mBoxInf\(/.test(SCENE.sources.support))throw Error('Unexpected support helper collision');
SCENE.sources.support+='\nfloat mDisc(vec3 p,vec3 c,int axis,float r,float h){vec3 q=p-c;vec2 v=axis==0?q.yz:axis==1?q.xz:q.xy;return max(length(v)-r,abs(q[axis])-h);}\nfloat mBoxInf(vec3 p,vec3 c,vec3 h){vec3 q=abs(p-c)-h;return max(max(q.x,q.y),q.z);}\n';
for(const h of F.frameHostCuts){if(SCENE.hostCuts[h.sourcePartId])throw Error('Unexpected existing frame cut');SCENE.sources.support+='\n'+h.glsl;const name=h.fieldFunction+'_candidate_only';SCENE.sources.support+=`\nfloat ${name}(vec3 p){return installationCandidate==1?${h.fieldFunction}(p):1e6;}\n`;SCENE.hostCuts[h.sourcePartId]=name;}
})();
