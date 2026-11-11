// 布料最小单元 · 真实参与渲染的 WGSL
// g.geom: 针距 / 行拉伸 / 纱线半径 / 起伏
// g.fabric: 列数 / 行数 / 每针毛丝数 / 毛长尺度(mm)
// g.appearance.yzw 与 g.palette.xyz: 两种线性色彩
// g.pattern: 花纹编号 / 花纹尺度 / 固定种子 / 捻度
// g.fibre: 毛丝直径(mm) / 弯曲 / 短绒体积 / 面片开关

fn materialYarnRadius(t:f32, a:f32, lane:f32)->f32 {
    let phase=hash(u32(i32(floor(t)+lane*4099.))+u32(g.pattern.z))*TAU;
    let u=fract(t);
    let irregular=1.+.038*sin(u*21.+phase)+.022*sin(u*49.+phase*3.);
    let ply=1.+.055*cos(3.*(a+u*TAU*g.pattern.w))+.022*sin(5.*a+phase+u*11.);
    return g.geom.z*irregular*ply;
}

fn materialColor(uv:vec2<f32>)->vec3<f32> {
    let A=g.appearance.yzw;let B=g.palette.xyz;
    let q=uv/max(.2,g.pattern.y);let kind=u32(g.pattern.x);
    var blend=0.;
    if(kind==1u){blend=step(.5,fract(q.y*.5));}
    if(kind==2u){blend=f32((i32(floor(q.x))+i32(floor(q.y*.5)))&1);}
    if(kind==3u){let d=abs(fract(q.x*.5)-.5)+abs(fract(q.y*.25)-.5);blend=smoothstep(.43,.49,d);}
    if(kind==4u){blend=smoothstep(.25,.75,noise(vec3<f32>(uv*.7,g.pattern.z*.01)));}
    if(kind==5u){blend=step(.45,fract(q.x*.5+abs(fract(q.y*.25)-.5)));}
    return mix(A,B,blend);
}

fn surfaceNoise(f:Field,w:array<f32,6>)->vec3<f32> {
    var pigment=0.;var grain=0.;var sheen=0.;var freq=1.;
    for(var i=0u;i<6u;i++){
        let weight=w[i];
        if(weight>0.||g.control.w>.5){
            let n=noise(vec3<f32>(f.t*9.*freq,f.theta*11.*freq,f.lane*13.+g.pattern.z*.01));
            let twisted=f.theta*25.*freq+f.t*TAU*g.pattern.w*2.;
            pigment+=weight*(n-.5)*.14/pow(1.5,f32(i));
            grain+=weight*sin(twisted+n)*.16/pow(1.45,f32(i));
        }
        sheen+=(1.-weight)*.018;freq*=1.85;
    }
    return vec3<f32>(pigment,grain,sheen);
}

fn volume(f:Field,w:array<f32,6>)->f32 {
    if(f.sd<0.||f.sd>1.0){return 0.;}
    // 短绒底层。清晰长毛来自 strandPoint，不是假白雾。
    let n=noise(vec3<f32>(f.t*15.,f.theta*30.,f.sd*3.+f.lane*11.));
    return g.fibre.z*g.appearance.x*(.07+.18*pow(n,4.))*exp(-f.sd*5.);
}

fn strandPoint(root:vec3<f32>,T:vec3<f32>,B:vec3<f32>,W:vec3<f32>,Q:vec3<f32>,id:u32,t:f32,len:f32)->vec3<f32> {
    let drift=normalize(T*(hash(id*41u)-.5)*1.35+Q*(.3+.5*hash(id*23u)));
    let bend=B*(hash(id*19u)-.5)*1.25+W*(hash(id*37u)-.45)*.7;
    let curl=normalize(B*(hash(id*79u)-.5)+W*(hash(id*83u)-.5)+vec3<f32>(.0001));
    return root+drift*len*t*.95+bend*len*t*t*g.fibre.y
        +curl*len*.1*g.fibre.y*sin(PI*(1.4+1.2*hash(id*73u))*t)*sin(PI*t);
}
