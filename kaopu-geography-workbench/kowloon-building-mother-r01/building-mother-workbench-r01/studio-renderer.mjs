import {WholeRenderer} from '../building-rule-sketch-r06/kowloon-building-mother-r01/whole-building-facade-r01/semantic-renderer.mjs';
import {SEMANTIC_SHADE} from '../building-rule-sketch-r06/kowloon-building-mother-r01/whole-building-facade-r01/semantic-registry.mjs';

// Display-only studio lighting. The shared model and identity buffers are untouched.
// This is a controlled diffuse/specular presentation, not a measured material model.
const background='outColor=vec4(233./255.,237./255.,240./255.,1.);';
const flat='float form=.66+.24*max(dot(n,normalize(vec3(-.45,.82,-.55))),0.)+.10*max(dot(n,normalize(vec3(.7,.3,.6))),0.);c*=form;';
if(!SEMANTIC_SHADE.includes(background)||!SEMANTIC_SHADE.includes(flat))throw Error('Shared display source changed: review studio adapter');
export const STUDIO_SHADE=SEMANTIC_SHADE.replace(background,`vec2 uv=gl_FragCoord.xy/uResolution;float glow=exp(-dot((uv-vec2(.5,.55))*vec2(1.1,1.4),(uv-vec2(.5,.55))*vec2(1.1,1.4))*3.);outColor=vec4(mix(vec3(.30,.315,.33),vec3(.46,.47,.48),glow),1.);`).replace(flat,`
vec3 key=normalize(vec3(-.65,.85,-.65)),fill=normalize(vec3(.75,.35,-.2)),rim=normalize(vec3(.25,.65,.9));
vec3 albedo=mix(vec3(dot(c,vec3(.2126,.7152,.0722))),c,.34);
vec3 illumination=vec3(.25)+vec3(1.,.94,.84)*.62*max(dot(n,key),0.)+vec3(.78,.87,1.)*.27*max(dot(n,fill),0.);
float spec=pow(max(dot(n,normalize(key-rd)),0.),40.)*.10;
float edgeLight=pow(1.-max(dot(n,-rd),0.),2.)*max(dot(n,rim),0.)*.16;
c=albedo*illumination+vec3(1.,.97,.91)*spec+vec3(.82,.89,1.)*edgeLight;
`);
export class StudioRenderer extends WholeRenderer{
 setModel(model,source){super.setModel(model,source);if(!this.studioShadeProgram)this.studioShadeProgram=this.compile('building-mother-gray-studio',STUDIO_SHADE);this.shadeProgram=this.studioShadeProgram;}
}
