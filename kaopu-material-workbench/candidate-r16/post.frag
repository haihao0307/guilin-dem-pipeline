#version 300 es
precision highp float;
uniform sampler2D uScene;
uniform vec2 uTexel;
uniform float uSpatialWeight;
out vec4 color;
float luma(vec3 c){return dot(c,vec3(.299,.587,.114));}
void main(){vec2 uv=gl_FragCoord.xy*uTexel;vec3 c=texture(uScene,uv).rgb,n=texture(uScene,uv+vec2(0.,uTexel.y)).rgb,s=texture(uScene,uv-vec2(0.,uTexel.y)).rgb,e=texture(uScene,uv+vec2(uTexel.x,0.)).rgb,w=texture(uScene,uv-vec2(uTexel.x,0.)).rgb;float lo=min(luma(c),min(min(luma(n),luma(s)),min(luma(e),luma(w)))),hi=max(luma(c),max(max(luma(n),luma(s)),max(luma(e),luma(w))));float edge=smoothstep(9./255.,47./255.,hi-lo);color=vec4(mix(c,(n+s+e+w)*.25,edge*uSpatialWeight),1.);}
