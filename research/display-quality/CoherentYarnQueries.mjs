// A low-cost domain hint only changes search order. Every suggested domain is
// re-evaluated with the original3 seeds,13 iterations and acceptance limits.
// All untested original domains still run, with the original box/depth gates.
export function coherentYarnSources(original){
 const declaration=`uniform sampler2D uCoarseDomains;uniform vec2 uCoarseSize;uniform float uInstanceOrdinal;int domainGuessCount=0;int domainGuesses[4];int bestDomainOrder=2147483647;`;
 const helper=`
 void seedOriginalDomains(vec3 ro,vec3 rd,ivec2 low,ivec2 high,inout float best,inout vec3 hit,inout float lane){
  domainGuessCount=0;bestDomainOrder=2147483647;ivec2 corner=ivec2(floor(gl_FragCoord.xy/uSize*uCoarseSize-.5));
  for(int k=0;k<4;k++){ivec2 pixel=clamp(corner+ivec2(k&1,k>>1),ivec2(0),ivec2(uCoarseSize)-1);vec4 meta=texelFetch(uCoarseDomains,pixel,0);if(meta.w!=uInstanceOrdinal)continue;
   int col=int(floor(meta.x)),row=int(round(meta.z)),seg=clamp(int(floor(fract(meta.x)*10.)),0,9),key=(row*uGrid.x+col)*10+seg;
   if(col<low.x||col>high.x||row<low.y||row>high.y||col-low.x>=12||row-low.y>=16)continue;bool duplicate=false;for(int j=0;j<4;j++){if(j>=domainGuessCount)break;if(domainGuesses[j]==key)duplicate=true;}if(duplicate)continue;domainGuesses[domainGuessCount++]=key;
   vec3 offset=vec3(float(col)*uPitch,float(row)*uPitch*.5,0.);vec2 box=boxSpan(ro,rd,offset+uBoundsLow[seg],offset+uBoundsHigh[seg]);if(box.x>box.y||box.y<0.||box.x>best)continue;
   float lower=float(col)+float(seg)*.1,upper=lower+.1;for(int trial=0;trial<3;trial++){vec3 h;int order=key*3+trial;if(solveYarnInView(ro,rd,float(row),lower,upper,trial==0?.5:trial==1?.12:.88,h)&&(h.z<best||(h.z==best&&order<bestDomainOrder))){best=h.z;hit=h;lane=float(row);bestDomainOrder=order;}}
  }
 }
 bool alreadyTestedDomain(int row,int col,int seg){int key=(row*uGrid.x+col)*10+seg;for(int j=0;j<4;j++){if(j>=domainGuessCount)break;if(domainGuesses[j]==key)return true;}return false;}
 `;
 const start='float surfaceDepth=1.e9;',init='float best=1.e9,lane=0.;vec3 hit=vec3(0.);',gate='for(int seg=0;seg<10;seg++){vec2 box=',accept='&&h.z<best){best=h.z;hit=h;lane=float(row);segmentHit=true;';
 for(const key of [start,init,gate,accept])if(original.split(key).length!==2)throw Error('Original domain-query adapter changed: '+key);
 let source=declaration+'\n'+original.replace(start,helper+'\n'+start).replace(init,init+'seedOriginalDomains(ro,rd,low,high,best,hit,lane);').replace(gate,'for(int seg=0;seg<10;seg++){if(alreadyTestedDomain(row,col,seg))continue;vec2 box=').replace(accept,'&&(h.z<best||(h.z==best&&((row*uGrid.x+col)*10+seg)*3+trial<bestDomainOrder))){best=h.z;hit=h;lane=float(row);bestDomainOrder=((row*uGrid.x+col)*10+seg)*3+trial;segmentHit=true;');
 let coarse='uniform float uInstanceOrdinal;vec4 originalDomainMeta=vec4(-1.);\n'+original.replace('surfaceDepth=best;','surfaceDepth=best;originalDomainMeta=best<1.e8?vec4(hit.x,hit.y,lane,uInstanceOrdinal):vec4(-1.);').replace('return shadeYarn(ro,rd,hit,lane);','return vec3(0.);');
 return{source,coarse};
}
