import {canonical} from './Expressions.mjs';
// Authored EB1 analytic studio radiance. The rough specular convolution below
// is a declared spherical-Gaussian display approximation, not full GI.
export const surfaceEnvironmentGLSL=`
uniform float uEnvironmentStrength,uEnvironmentRotation;
float studioLobe(vec3 d,vec3 axis,float k,float amplitude,float rough){float filtered=1./(1./k+rough*rough*2.);float energyRatio=filtered*(1.-exp(-2.*k))/(k*max(.00001,1.-exp(-2.*filtered)));return amplitude*energyRatio*exp(filtered*(dot(d,axis)-1.));}
vec3 studioReflection(vec3 d,float rough){float a=-uEnvironmentRotation*.01745329252,c=cos(a),s=sin(a);d=vec3(c*d.x+s*d.z,d.y,-s*d.x+c*d.z);float a1=studioLobe(d,vec3(-.650,.550,.5244),22.,7.,rough),a2=studioLobe(d,vec3(.765,.280,.5804),32.,4.,rough),a3=studioLobe(d,vec3(0.,.820,-.5724),18.,5.5,rough);return vec3(.035+.12*max(0.,d.y)+.025*max(0.,-d.y)+a1+a2+a3)*uEnvironmentStrength;}
`;
export function surfaceSceneLighting(recipe){
 if(!globalThis.KAOPU_EB1)throw Error('Versioned display light evaluator is unavailable');
 const allowed=['key','rim','environment','keyAzimuth','keyElevation','rimAzimuth','rimElevation','environmentRotation','exposure','keyColor','rimColor'];
 if(Object.keys(recipe).some(k=>!allowed.includes(k))||Object.entries(recipe).some(([k,v])=>k.endsWith('Color')?!/^#[a-fA-F0-9]{6}$/.test(v):!Number.isFinite(v))||['key','rim','environment','exposure'].some(k=>recipe[k]!==undefined&&recipe[k]<0))throw Error('Invalid shared scene light');
 const input={...globalThis.KAOPU_EB1.DEFAULT,...globalThis.KAOPU_EB1.PRESETS.neutral,...recipe},value=globalThis.KAOPU_EB1.sampleProfile(input),{exposure,...geometryLight}=input;
 return{input,value,exposure,key:canonical(geometryLight),space:'world',colourSpace:'linear-rgb',model:'two-directional-and-eight-environment-lobes@1',calibratedRadiometry:false,globalIllumination:false};
}
