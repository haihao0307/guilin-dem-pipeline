/** Original, texture-free appearance functions. Inputs are view-space unit directions.
 * Finite rectangular source idea audited against ET16; see SOURCE-AUDIT.md.
 * These are artist controls, not optical or anatomical measurements. */
export const EYE_SURFACE_VERSION='joey/native-eye-surface-r54@1';
export const EYE_SURFACE_DEFAULTS=Object.freeze({enabled:true,pupilFeather:.008,limbusSoftness:.012,angularWidth:.075,reflectionStrength:1.2,wetness:.68});
const RANGES={pupilFeather:[.0005,.035],limbusSoftness:[0,.04],angularWidth:[.03,.18],reflectionStrength:[0,2.4],wetness:[0,1]};
export function validateEyeSurface(input={}){
 if(!input||typeof input!=='object'||Array.isArray(input))throw TypeError('Eye surface settings must be an object');
 for(const key of Object.keys(input))if(!Object.hasOwn(EYE_SURFACE_DEFAULTS,key))throw TypeError('Unknown eye surface field: '+key);
 const result={...EYE_SURFACE_DEFAULTS,...input};
 if(typeof result.enabled!=='boolean')throw TypeError('enabled must be boolean');
 for(const[key,[lo,hi]]of Object.entries(RANGES))if(!Number.isFinite(result[key])||result[key]<lo||result[key]>hi)throw RangeError('Invalid eye surface field: '+key);
 return result;
}
const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=v=>{if(!Array.isArray(v)||v.length!==3||!v.every(Number.isFinite))throw TypeError('Expected finite direction');const n=Math.hypot(...v);if(n<1e-12)throw RangeError('Degenerate direction');return v.map(x=>x/n);};
/** CPU oracle for scalar behavior; derivatives are explicitly provided by the caller. */
export function finiteSourceReflection({normal,view,lightDirection,angularWidth=.075,footprint=.012}){
 const n=unit(normal),V=unit(view),L=unit(lightDirection);
 if(!Number.isFinite(angularWidth)||angularWidth<.03||angularWidth>.18||!Number.isFinite(footprint)||footprint<=0)throw RangeError('Invalid finite-source width');
 const NdotV=clamp(dot(n,V)),R=V.map((x,i)=>2*dot(n,V)*n[i]-x),forward=dot(R,L);
 if(forward<=0)return 0;
 const X=unit(cross(Math.abs(L[1])>.98?[1,0,0]:[0,1,0],L)),Y=cross(L,X),qx=dot(R,X)/Math.max(forward,.001),qy=dot(R,Y)/Math.max(forward,.001),soft=Math.max(.012,footprint);
 const box=(1-smooth(angularWidth-soft,angularWidth+soft,Math.abs(qx)))*(1-smooth(1.8*angularWidth-soft,1.8*angularWidth+soft,Math.abs(qy)));
 return box*(.025+.975*(1-NdotV)**5);
}
export function eyeEdgeMasks({radius,pupilRadius,derivative=.0005,enabled=true,pupilFeather=.008,limbusSoftness=.012}){
 if(![radius,pupilRadius,derivative,pupilFeather,limbusSoftness].every(Number.isFinite)||radius<0||pupilRadius<=0||pupilRadius>=1||derivative<0||pupilFeather<0||limbusSoftness<0)throw RangeError('Invalid edge sample');
 const aa=Math.max(derivative,.0005),irisAA=Math.max(aa,enabled?limbusSoftness:0),pupilAA=Math.max(aa,enabled?pupilFeather:0);
 return {iris:1-smooth(1-irisAA,1+irisAA,radius),pupil:1-smooth(pupilRadius-pupilAA,pupilRadius+pupilAA,radius)};
}
export function reflectionRadiance({reflection,color,strength,wetness,radial}){
 if(!Array.isArray(color)||color.length!==3||![...color,reflection,strength,wetness,radial].every(Number.isFinite)||color.some(x=>x<0)||reflection<0||reflection>1||strength<0||wetness<0||wetness>1||radial<0)throw RangeError('Invalid radiance sample');
 const cornea=1-smooth(1,1.28,radial),weight=strength*wetness*(.2+.8*cornea)*reflection;
 return color.map(x=>x*weight);
}
