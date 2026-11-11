// Exact-input optimizations for the complete source candidate. No population,
// iteration limits, residual tolerances, reconstruction kernels or dyes removed.
export function optimizeFibreSources(source,fibres,options){
 const replace=(text,from,to)=>{if(text.split(from).length!==2)throw Error('Full fibre optimization source anchor changed: '+from.slice(0,70));return text.replace(from,to);};
 if(options.zeroCurl){
  fibres='uniform bool uQuadraticFibre;\n'+fibres;
  fibres=replace(fibres,'return root+strand*t+bend*t*t+curl*sin(wave*t)*sin(3.141592654*t);','if(uQuadraticFibre)return root+strand*t+bend*t*t;return root+strand*t+bend*t*t+curl*sin(wave*t)*sin(3.141592654*t);');
  fibres=replace(fibres,'vec3 p=path(a.xyz,b.xyz,c.xyz,d.xyz,w,t),v=b.xyz+2.*c.xyz*t+d.xyz*(w*cos(w*t)*sin(pi*t)+pi*sin(w*t)*cos(pi*t));','vec3 p=path(a.xyz,b.xyz,c.xyz,d.xyz,w,t),v=b.xyz+2.*c.xyz*t;if(!uQuadraticFibre)v+=d.xyz*(w*cos(w*t)*sin(pi*t)+pi*sin(w*t)*cos(pi*t));');
  fibres=replace(fibres,'vec3 acc=2.*c.xyz+d.xyz*((-w*w-pi*pi)*sin(w*t)*sin(pi*t)+2.*w*pi*cos(w*t)*cos(pi*t));','vec3 acc=2.*c.xyz;if(!uQuadraticFibre)acc+=d.xyz*((-w*w-pi*pi)*sin(w*t)*sin(pi*t)+2.*w*pi*cos(w*t)*cos(pi*t));');
  fibres=replace(fibres,'vec3 T=normalize(b.xyz+2.*c.xyz*tbest+d.xyz*(b.w*cos(b.w*tbest)*sin(3.141592654*tbest)+3.141592654*sin(b.w*tbest)*cos(3.141592654*tbest))),N=normalize(rootNormal.xyz);','vec3 velocity=b.xyz+2.*c.xyz*tbest;if(!uQuadraticFibre)velocity+=d.xyz*(b.w*cos(b.w*tbest)*sin(3.141592654*tbest)+3.141592654*sin(b.w*tbest)*cos(3.141592654*tbest));vec3 T=normalize(velocity),N=normalize(rootNormal.xyz);');
 }
 let fragmentInit='';
 if(options.hoist){
  source='vec3 ffForward,ffShortDye,ffReflectionDye,ffTransmissionDye;float ffExchangeScale,ffDominance;\n'+source;
  source=replace(source,'float dyeLuminance=max(.001,dot(dye,vec3(.2126,.7152,.0722)));\n vec3 shortPathDye=dye*pow(dyeLuminance,-.18);','vec3 shortPathDye=ffShortDye;');
  source=replace(source,'mix(dye,vec3(1.),.6)*reflection+sqrt(max(dye,vec3(.001)))*transmission','ffReflectionDye*reflection+ffTransmissionDye*transmission');
  source=replace(source,'vec3 light=fibreResponse(T,N,V,uKeyDirection,uKeyEnergy,dye)+fibreResponse(T,N,V,uRimDirection,uRimEnergy,dye);','float dyeLuminance=max(.001,dot(dye,vec3(.2126,.7152,.0722)));ffShortDye=dye*pow(dyeLuminance,-.18);ffReflectionDye=mix(dye,vec3(1.),.6);ffTransmissionDye=sqrt(max(dye,vec3(.001)));ffExchangeScale=pow(dyeLuminance,-.28);vec3 light=fibreResponse(T,N,V,uKeyDirection,uKeyEnergy,dye)+fibreResponse(T,N,V,uRimDirection,uRimEnergy,dye);');
  source=replace(source,'float env=0.;for(int i=0;i<8;i++)env+=dot(uEnvironmentEnergy[i],vec3(.2126,.7152,.0722))/8.;\n float key=dot(uKeyEnergy,vec3(.2126,.7152,.0722)),dominance=key/(key+env*3.141592654+.001);','float dominance=ffDominance;');
  source=replace(source,'pow(max(.001,dot(dye,vec3(.2126,.7152,.0722))),-.28)','ffExchangeScale');
  fibres=replace(fibres,'vec3 forward=normalize(uTarget-uEye);','vec3 forward=ffForward;');
  fibres=replace(fibres,'viewDepth=dot(q,normalize(uTarget-uEye))','viewDepth=dot(q,ffForward)');
  fragmentInit='ffForward=f;float env=0.;for(int i=0;i<8;i++)env+=dot(uEnvironmentEnergy[i],vec3(.2126,.7152,.0722))/8.;float key=dot(uKeyEnergy,vec3(.2126,.7152,.0722));ffDominance=key/(key+env*3.141592654+.001);';
 }
 if(options.queryOnly)fibres=replace(fibres,'vec3 light=lightSourceFibre(T,N,-rd,dye,tbest);','vec3 light=dye; // diagnostic only, never a target appearance result');
 return{source,fibres,fragmentInit};
}
export function fibreCullingBounds(records,stride=28){
 const count=records.length/stride,values=new Float32Array(count*8),tmp=new Float32Array(1),bits=new Uint32Array(tmp.buffer),outward=(v,up)=>{tmp[0]=v;if((up&&tmp[0]<v)||(!up&&tmp[0]>v))bits[0]+=((tmp[0]>=0)===up)?1:-1;return tmp[0];};
 for(let i=0;i<count;i++)for(let k=0;k<3;k++){const at=i*stride,root=records[at+k],s=records[at+4+k],b=records[at+8+k],c=Math.abs(records[at+12+k]),r=records[at+3];values[i*8+k]=outward(root+Math.min(0,s)+Math.min(0,b)-c-r,false);values[i*8+4+k]=outward(root+Math.max(0,s)+Math.max(0,b)+c+r,true);}return values;
}
export function packFibreRecords(built,columns,morton=false){
 const data=new Float32Array(built.count*20);for(let i=0;i<built.count;i++){const id=morton?built.order[i]:i,at=id*28,to=i*20,src=built.records;if(src[at+11]!==1||src[at+15]!==Math.floor(id/960)%columns||src[at+16]!==Math.floor(id/(960*columns)))throw Error('Unsupported fibre metadata for exact packed layout');for(let k=0;k<8;k++)data[to+k]=src[at+k];for(let k=0;k<3;k++){data[to+8+k]=src[at+8+k];data[to+12+k]=src[at+12+k];data[to+16+k]=src[at+20+k];}data[to+11]=src[at+18];data[to+15]=src[at+19];data[to+19]=id;}
 return{data,stride:20,savedBytes:built.records.byteLength-data.byteLength,morton};
}
export function packedFibreShader(source,morton){
 const from='vec4 a=fibreWord(id*7u),b=fibreWord(id*7u+1u),c=fibreWord(id*7u+2u),d=fibreWord(id*7u+3u),e=fibreWord(id*7u+4u),rootNormal=fibreWord(id*7u+5u);';if(source.split(from).length!==2||/\be\.y\b/.test(source))throw Error('Packed fibre source metadata audit failed');source=source.replace(from,'vec4 rootNormal=fibreWord(id*5u+4u),a=fibreWord(id*5u),b=fibreWord(id*5u+1u),packedC=fibreWord(id*5u+2u),packedD=fibreWord(id*5u+3u);uint originalId=uint(rootNormal.w);vec4 c=vec4(packedC.xyz,1.),d=vec4(packedD.xyz,float((originalId/960u)%uint(uGrid.x))),e=vec4(float(originalId/(960u*uint(uGrid.x))),0.,packedC.w,packedD.w);');return morton?source.replace('id=orderedFibre(leafCursor++);','id=leafCursor++;'):source;
}
