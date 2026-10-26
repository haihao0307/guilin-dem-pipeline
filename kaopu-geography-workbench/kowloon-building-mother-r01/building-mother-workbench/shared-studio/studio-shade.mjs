// Display-only: preserve the caller's semantic/material lookup and selection.
export const STUDIO_UNIFORMS=`uniform vec3 uStudioMin,uStudioMax;uniform bool uStudioClip;uniform vec3 uStudioClipNormal;uniform float uStudioClipOffset;`;
const background='outColor=vec4(233./255.,237./255.,240./255.,1.);';
const form='float form=.66+.24*max(dot(n,normalize(vec3(-.45,.82,-.55))),0.)+.10*max(dot(n,normalize(vec3(.7,.3,.6))),0.);c*=form;';
export const STUDIO_LIGHT_GLSL=`
float studioScale(){return max(1.,max(uStudioMax.x-uStudioMin.x,max(uStudioMax.y-uStudioMin.y,uStudioMax.z-uStudioMin.z))/5.);}
vec3 studioKeyLight(){return (uStudioMin+uStudioMax)*.5+vec3(-7.,7.,-8.5)*studioScale();}
vec3 studioFillLight(){return (uStudioMin+uStudioMax)*.5+vec3(7.,5.,1.5)*studioScale();}
`;
const lighting=STUDIO_LIGHT_GLSL+`
vec3 studioLight(vec3 p,vec3 n,vec3 albedo){vec3 k=studioKeyLight(),f=studioFillLight();float a=max(dot(n,normalize(k-p)),0.)*studioVisibility(p,n,k),b=max(dot(n,normalize(f-p)),0.)*studioVisibility(p,n,f);return albedo*(vec3(.20)+vec3(1.,.94,.84)*1.30*a+vec3(.79,.88,1.)*.93*b);}
vec3 studioBackground(vec3 rd){vec2 uv=gl_FragCoord.xy/uResolution;vec3 bg=mix(vec3(.28,.30,.32),vec3(.48,.49,.50),exp(-dot(uv-vec2(.5,.6),uv-vec2(.5,.6))*3.));float s=studioScale(),y=uStudioMin.y-.02*s,t=(y-uCameraEye.y)/rd.y;if(t>0.&&rd.y<-.001){vec3 p=uCameraEye+rd*t,c=studioLight(p,vec3(0,1,0),vec3(.36,.37,.38));float fade=1.-smoothstep(2.*s,4.4*s,distance(p.xz,(uStudioMin.xz+uStudioMax.xz)*.5));bg=mix(bg,c,fade);}return pow(max(bg,vec3(0)),vec3(1./2.2));}
`;
export function buildStudioShade(original,visibilityGLSL){if(!original.includes(background)||!original.includes(form))throw Error('Unsupported legacy shade contract');return original.replace('void main(){',STUDIO_UNIFORMS+'\n'+visibilityGLSL+'\n'+lighting+'\nvoid main(){').replace(background,'outColor=vec4(studioBackground(ray()),1.);').replace(form,'c=pow(max(studioLight(uCameraEye+rd*h.x,n,c),vec3(0)),vec3(1./2.2));').replace('if(edge)c*=.80;','');}
