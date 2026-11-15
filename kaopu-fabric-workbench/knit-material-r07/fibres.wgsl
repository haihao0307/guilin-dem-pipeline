// Analytic planar carrier. These are shader functions, not a triangle mesh.
fn swatchShift()->vec3<f32>{return vec3<f32>(g.fabric.x*g.geom.x*.5,g.fabric.y*g.geom.x*.25*g.geom.y,0.);}
fn project(p:vec3<f32>)->vec3<f32>{let q=p-g.eye.xyz;let z=dot(q,g.forward.xyz);let ndc=vec2<f32>(dot(q,g.right.xyz)/(g.view.z*g.view.x/g.view.y),-dot(q,g.up.xyz)/g.view.z)/max(.001,z);return vec3<f32>((ndc*.5+.5)*g.view.xy,z);}
@compute @workgroup_size(8,8) fn clearHairs(@builtin(global_invocation_id) gid:vec3<u32>){if(any(gid.xy>=g.dims.xy)){return;}let i=(gid.y*g.dims.x+gid.x)*4u;for(var j=0u;j<4u;j++){atomicStore(&hairAccum[i+j],0u);}}
@compute @workgroup_size(64) fn hairs(@builtin(global_invocation_id) gid:vec3<u32>){
    if(g.fibre.w>.5||g.appearance.x<.001){return;}
    let index=gid.x+gid.y*16384u+g.dims.w;let count=u32(g.fabric.z);let total=u32(g.fabric.x*g.fabric.y)*count;
    if(index>=total||count==0u){return;}
    let needle=index/count;let col=needle%u32(g.fabric.x);let row=needle/u32(g.fabric.x);let j=index%count;
    let id=(row*4099u+col)*997u+j+u32(g.pattern.z)*391u;
    let at=hash(id*13u+4u);let seg=min(79u,u32(at*80.));let s=segs[seg];let u=fract(at*80.);
    let T=normalize(s.b.xyz-s.a.xyz);let B=normalize(cross(T,vec3<f32>(0.,0.,1.))+vec3<f32>(1.e-9));let W=normalize(cross(B,T));
    let theta=hash(id*7u+1u)*TAU;let Q=normalize(B*cos(theta)+W*sin(theta));
    let root=mix(s.a.xyz,s.b.xyz,u)+vec3<f32>(f32(col)*g.geom.x,f32(row)*g.geom.x*.5*g.geom.y,0.)-swatchShift()+Q*(materialYarnRadius(f32(col)+at,theta,f32(row))+.025);
    let population=hash(id*29u);let len=g.fabric.w*(.3+.7*pow(hash(id*31u),1.2))*select(1.,1.7,population>.985);
    let projected=project(root);let reach=len*2.*g.view.y/(max(1.,projected.z)*g.view.z)+4.;
    if(projected.z<1.||any(projected.xy<vec2<f32>(-reach))||any(projected.xy>g.view.xy+vec2<f32>(reach))){return;}
    let V=normalize(g.eye.xyz-root);let light=normalize(vec3<f32>(-.6,.65,1.));
    let nl=max(0.,dot(Q,light));let wrap=.40+.38*sqrt(max(0.,1.-pow(dot(T,light),2.)));
    let fiberColor=materialColor(vec2<f32>(f32(col)+at,f32(row)))*(wrap+nl*.9)*(.86+.28*hash(id*97u));
    var a=project(root);
    for(var k=1u;k<=8u;k++){
        let b=project(strandPoint(root,T,B,W,Q,id,f32(k)/8.,len));
        if(min(a.z,b.z)<1.){a=b;continue;}
        let physicalRadius=g.fibre.x*.5*g.view.y/(g.view.z*(a.z+b.z));let radius=max(.55,physicalRadius);
        let lo=max(vec2<i32>(0),vec2<i32>(floor(min(a.xy,b.xy)-vec2<f32>(radius+1.))));let hi=min(vec2<i32>(g.dims.xy)-vec2<i32>(1),vec2<i32>(ceil(max(a.xy,b.xy)+vec2<f32>(radius+1.))));
        let d=b.xy-a.xy;let dd=max(.000001,dot(d,d));
        for(var y=lo.y;y<=hi.y;y++){for(var x=lo.x;x<=hi.x;x++){
            let xy=vec2<f32>(f32(x)+.5,f32(y)+.5);let t=clamp(dot(xy-a.xy,d)/dd,0.,1.);let edge=length(xy-a.xy-d*t);
            let cover=(1.-smoothstep(max(0.,radius-.5),radius+.5,edge))*min(1.,physicalRadius/.55);
            if(cover<.002){continue;}
            let z=1./mix(1./a.z,1./b.z,t);let pi=u32(y)*g.dims.x+u32(x);let baseDepth=pixels[pi].w*dot(direction(xy),g.forward.xyz);
            if(z>baseDepth+.025){continue;}
            // Hair depth test is real; hair/hair transparency is an optical-depth approximation.
            let tau=min(.7,cover*.38*g.appearance.x);let weight=u32(tau*65536.);let off=pi*4u;
            atomicAdd(&hairAccum[off],u32(fiberColor.x*f32(weight)));atomicAdd(&hairAccum[off+1u],u32(fiberColor.y*f32(weight)));atomicAdd(&hairAccum[off+2u],u32(fiberColor.z*f32(weight)));atomicAdd(&hairAccum[off+3u],weight);
        }}a=b;
    }
}
@compute @workgroup_size(8,8) fn composite(@builtin(global_invocation_id) gid:vec3<u32>){
    let p=gid.xy;if(any(p>=g.dims.xy)){return;}let i=p.y*g.dims.x+p.x;let off=i*4u;let weight=f32(atomicLoad(&hairAccum[off+3u]));var c=pixels[i].xyz;
    if(weight>0.){let hair=vec3<f32>(f32(atomicLoad(&hairAccum[off])),f32(atomicLoad(&hairAccum[off+1u])),f32(atomicLoad(&hairAccum[off+2u])))/weight;let alpha=1.-exp(-weight/65536.);c=mix(c,hair,alpha);}
    c=pow(max(c/(vec3<f32>(1.)+c),vec3<f32>(0.)),vec3<f32>(1./2.2));pixels[i]=vec4<f32>(c,pixels[i].w);textureStore(outputTex,vec2<i32>(p),vec4<f32>(c,1.));
}
