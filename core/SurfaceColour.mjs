// Same display encoding as the generic WebGPU path. Linear values remain
// linear until the final composite; alpha/optical depth are never gamma coded.
export const surfaceColourGLSL=`vec3 surfaceSRGB(vec3 c){c=max(c,vec3(0.));return mix(c*12.92,1.055*pow(c,vec3(1./2.4))-.055,greaterThan(c,vec3(.0031308)));}`;
export function linearToSRGB(c){return c.map(v=>v<=.0031308?v*12.92:1.055*Math.max(0,v)**(1/2.4)-.055);}
