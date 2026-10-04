#version 300 es
precision highp float;
precision highp int;
uniform vec3 iResolution;
uniform float iTime;
out vec4 fragColor;
/*
    Original code from https://x.com/YoheiNishitsuji/status/1923362809569837131
*/

uniform int uPalette;
uniform float uPigment;
uniform float uMottle;
uniform float uPale;
// Procedural, object-space color design. Not measured juvenile pigment anatomy.
vec3 pigmentField(vec3 q, vec3 folded) {
    float regionMix = clamp(0.50 + 0.24*sin(dot(q,vec3(1.9,1.25,-0.65)))
                           + 0.19*sin(dot(q,vec3(-0.70,2.7,1.40))),0.0,1.0);
    float fine = sin(q.x*21.0 + sin(q.y*11.0))*sin(q.z*17.0 + q.y*13.0);
    float foldFeature = abs(folded.y)/(1.0+length(folded));
    float pale = smoothstep(0.22,0.68, foldFeature) *
                 smoothstep(0.30,0.85,regionMix);
    vec3 baseA,baseB,cap;
    if(uPalette==2) {
        baseA=vec3(0.31,0.43,0.23); baseB=vec3(0.72,0.73,0.44);
        cap=vec3(0.89,0.94,0.73);
    } else if(uPalette==3) {
        baseA=vec3(0.46,0.34,0.19); baseB=vec3(0.76,0.62,0.31);
        cap=vec3(0.46,0.94,0.48);
    } else if(uPalette==4) {
        baseA=vec3(0.62,0.26,0.16); baseB=vec3(0.92,0.57,0.31);
        cap=vec3(1.0,0.88,0.70);
    } else {
        baseA=vec3(0.55,0.34,0.17); baseB=vec3(0.90,0.66,0.37);
        cap=vec3(1.0,0.91,0.73);
    }
    vec3 dye=mix(baseA,baseB,mix(0.56,regionMix,uMottle));
    // Modest mottling stays with object coordinates, never screen coordinates.
    dye*=1.0+0.06*uMottle*fine;
    float capMask=clamp(pale*uPale,0.0,0.85);
    if(uPalette==3) capMask=clamp((0.30+0.70*pale)*
                                  smoothstep(0.45,0.80,regionMix)*uPale,0.0,0.85);
    return clamp(mix(dye,cap,capMask),0.05,1.0);
}

void mainImage(out vec4 o, vec2 u) {
    o = vec4(0.0);
    vec3 dyeSum=vec3(0.0); float dyeWeight=0.0;
    for(float t = iTime, i=0.,g=0.,e=0.,s=0.; ++i < 99.; )
     {
        vec3 r = iResolution,
             p = vec3( 2.* ( u+u - r.xy ) / r.y , g - 6. ),
             A = vec3(0,9,-3)/9.5;
        p.y++;
        p =  A* dot(p+p,A) - p - .14*cross(p,A);
        p.xz *= mat2(cos(t*.3 - vec4(0,11,33,0)));
        vec3 tissuePoint=p;
        s = 6.;
        for( int j=0; j++ < 12; p = vec3(0, 4.03, -1) - abs( abs(p)*e - vec3(3,4,3)) )
             s *= e = 16. / dot(p, p);
        g += .3* p.y*p.y / s;
        o += ( log2(s) - g*.8 ) / 7e2 * vec4(.9,1,1,0);
        float weight=max((log2(s)-g*.8)/7e2,0.0);
        dyeSum+=weight*pigmentField(tissuePoint,p);
        dyeWeight+=weight;
    }
    vec3 dye=dyeSum/max(dyeWeight,0.000001);
    // Original radiance supplies fine form. Pigment multiplies it; no bloom/texture.
    vec3 color=clamp(o.rgb,0.0,1.0)*dye;
    o.rgb=mix(o.rgb,color,uPigment);
}

void main(){mainImage(fragColor,gl_FragCoord.xy);fragColor.a=1.0;}