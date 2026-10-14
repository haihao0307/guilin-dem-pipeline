import LUT from './LayeredSpectralLUT.json';
export const SPECTRAL_LUT=LUT;
let pixels;
function unpack(){if(pixels)return pixels;const raw=atob(LUT.data);if(raw.length!==LUT.texels*6)throw Error('Layered spectral table length mismatch');pixels=new Float32Array(LUT.texels*4);for(let i=0;i<LUT.texels;i++){for(let k=0;k<3;k++){const j=(i*3+k)*2;pixels[i*4+k]=(raw.charCodeAt(j)+raw.charCodeAt(j+1)*256)/65535;}pixels[i*4+3]=1;}return pixels;}
export function appendSpectralTable(texture){
 if(texture.userData.layeredSpectral)return texture.userData.layeredSpectral;
 if(texture.image.width!==512||!(texture.image.data instanceof Float32Array))throw Error('Original pore table contract changed');
 const before=texture.image.data,table=unpack(),row=before.length/2048;if(!Number.isInteger(row))throw Error('Unaligned source table');
 const padded=Math.ceil(table.length/2048)*2048,data=new Float32Array(before.length+padded);data.set(before);data.set(table,before.length);texture.image={data,width:512,height:data.length/2048};texture.needsUpdate=true;
 texture.userData.layeredSpectral={row,texels:LUT.texels,bytes:table.byteLength,payloadSHA256:LUT.payloadSHA256};return texture.userData.layeredSpectral;
}
const d=LUT.dimensions,l=LUT.limits;
export const SPECTRAL_GLSL=`
uniform int uLSRow,uLSPreset;
vec3 lsTexel(int m,int b,int t,int v,int p,int lip){
 int i=m+${d.melanin}*(b+${d.blood}*(t+${d.thickness}*(v+${d.vessel}*(p+${d.preset}*lip))));
 return texelFetch(uRFPores,ivec2(i%512,uLSRow+i/512),0).rgb;
}
vec3 lsLookup(float mel,float blood,float thickness,float vessel,int lip,int preset){
 vec4 q=clamp(vec4((sqrt(max(mel,${l.mel[0]}))-${Math.sqrt(l.mel[0])})/${Math.sqrt(l.mel[1])-Math.sqrt(l.mel[0])},blood/${l.blood[1]},(thickness-${l.thickness[0]})/${l.thickness[1]-l.thickness[0]},vessel/${l.vessel[1]}),0.,1.)*vec4(${d.melanin-1}.,${d.blood-1}.,${d.thickness-1}.,${d.vessel-1}.);
 ivec4 lo=ivec4(floor(q)),hi=min(lo+ivec4(1),ivec4(${d.melanin-1},${d.blood-1},${d.thickness-1},${d.vessel-1}));vec4 f=fract(q);vec3 result=vec3(0.);
 for(int v=0;v<2;v++)for(int t=0;t<2;t++)for(int b=0;b<2;b++)for(int m=0;m<2;m++){
  float w=(m==0?1.-f.x:f.x)*(b==0?1.-f.y:f.y)*(t==0?1.-f.z:f.z)*(v==0?1.-f.w:f.w);
  result+=lsTexel(m==0?lo.x:hi.x,b==0?lo.y:hi.y,t==0?lo.z:hi.z,v==0?lo.w:hi.w,preset,lip)*w;
 }return result;
}
`;
