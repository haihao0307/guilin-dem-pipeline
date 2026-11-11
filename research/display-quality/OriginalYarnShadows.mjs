// World shadows query the preserved yarn function, not a rectangular cloth
// proxy. Short-fibre attenuation is not included in this opaque query.
export function appendOriginalYarnShadows(source,querySource=source){
 const marker='vec3 sampleWorld(vec3 ro,vec3 rd){',at=querySource.indexOf(marker);if(at<0)throw Error('Original yarn query missing');let depth=1,end=at+marker.length;for(;end<querySource.length&&depth;end++){if(querySource[end]==='{')depth++;if(querySource[end]==='}')depth--;}
 let body=querySource.slice(at+marker.length,end-1);
 body=body.replace(/vec3 background=.*?;\s*if\(uDebug==2\)return background;/,'').replaceAll('return background;','return false;').replace('float best=1.e9,lane=0.;','float best=farLimit,lane=0.;').replace('yy<16','yy<256').replace('xx<12','xx<256');
 const finish=body.indexOf('surfaceDepth=best;');if(finish<0)throw Error('Original yarn query completion missing');body=body.slice(0,finish)+'return best<farLimit;';
 // This query returns a boolean, not a nearest surface. The first accepted
 // positive root below farLimit already fixes the final answer to true.
 // Keep the original seeds, refinement, residual, bounds and ordering until
 // that root is accepted; do not apply this termination to primary visibility.
 const accepted='best=h.z;hit=h;lane=float(row);';if(body.split(accepted).length!==2)throw Error('Original shadow acceptance changed');body=body.replace(accepted,accepted+'return true;');
 return `uniform bool uWorldYarnShadows;uniform int uWorldYarnCount;uniform vec3 uWorldYarnPositions[8];float yarnWorldVisibility(vec3 p,vec3 l);\n`+source+`\nbool originalYarnBlocked(vec3 ro,vec3 rd,float farLimit){${body}}\nfloat yarnWorldVisibility(vec3 p,vec3 l){if(!uWorldYarnShadows)return 1.;for(int i=0;i<8;i++){if(i>=uWorldYarnCount)break;if(originalYarnBlocked(p+l*.08-uWorldYarnPositions[i],l,1.e8))return 0.;}return 1.;}\n`;
}
