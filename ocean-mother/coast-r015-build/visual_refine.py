"""Refinements following actual R015 six-view screenshot inspection."""
from pathlib import Path
import sys
root=Path(sys.argv[1] if len(sys.argv)>1 else '_r015/site')
p=root/'geometry.mjs';s=p.read_text()
s=s.replace('k<9;k++','k<13;k++').replace('y=.28*Math.sin(k*3.13+seed)','y=k<9?.28*Math.sin(k*3.13+seed):(k%2===0?1.7:-1.4)')
p.write_text(s)
p=root/'shaders.mjs';s=p.read_text()
s=s.replace('vec3 horizon=vec3(.69,.78,.79),zenith=vec3(.12,.39,.56)','vec3 horizon=vec3(.48,.66,.78),zenith=vec3(.045,.23,.49)')
s=s.replace('vec3(.73,.78,.76),haze*.26','vec3(.59,.71,.79),haze*.10')
marker='return c*exposure;}\n`;'
far='''return c*exposure;}
vec3 farSeaRadiance(vec3 rd,vec3 sunDir,int mode,float exposure){
 vec3 refl=skyRadiance(vec3(rd.x,abs(rd.y),rd.z),sunDir,mode,exposure);
 float f=.0204+.9796*pow(1.0-clamp(abs(rd.y),0.0,1.0),5.0);
 return mix(vec3(.024,.105,.145)*exposure,refl,f);
}
`;'''
assert marker in s;s=s.replace(marker,far,1)
start='if(rd.y<0.0){vec3 refl=skyRadiance(vec3(rd.x,-rd.y,rd.z),uSunDir,uMode,uExposure);float f=.0204+.9796*pow(1.0-abs(rd.y),5.0);c=mix(vec3(.035,.18,.22),refl,f);}'
s=s.replace(start,'if(rd.y<0.0)c=farSeaRadiance(rd,uSunDir,uMode,uExposure);')
# Match the analytic distant ocean before leaving the finite detailed patch.
s=s.replace('float coverage=smoothstep(.004,.045,thickness);','float farBlend=smoothstep(24.0,49.0,vWorld.z);water=mix(water,farSeaRadiance(normalize(vWorld-uCamera),uSunDir,uMode,uExposure),farBlend);\n float coverage=smoothstep(.004,.045,thickness);')
s=s.replace('uniform sampler2D uWet;','uniform sampler2D uWet,uRockHeight;')
s=s.replace('hemi=.35+.26*sat(N.y*.5+.5)','hemi=.20+.25*sat(N.y*.5+.5)')
s=s.replace('vec3(.21,.225,.225),vec3(.52,.50,.44)','vec3(.10,.115,.119),vec3(.40,.385,.34)')
s=s.replace('base*=mix(1.0,.69,wet);rough=', '''float mineral=noise2(vWorld.xz*14.0+vWorld.y*vec2(9.0,7.0));base*=.77+.46*mineral;
 float relief=.013*fbm(vWorld.xz*6.0+vWorld.y*vec2(3.1,4.7));
 vec3 px=dFdx(vWorld),py=dFdy(vWorld),rx=cross(py,N),ry=cross(N,px);float det=dot(px,rx);
 if(abs(det)>1e-8)N=normalize(abs(det)*N-sign(det)*(dFdx(relief)*rx+dFdy(relief)*ry));
 base*=mix(1.0,.66,wet);rough=''')
s=s.replace('vec3 lit=base*(hemi+.96*ndl)', '''float visibility=1.0;
 for(int j=1;j<=10;j++){float distanceAlong=float(j)*.6;vec3 probe=vWorld+uSunDir*distanceAlong;
 float height=texture(uRockHeight,fieldUv(probe.xz)).r;
 visibility=min(visibility,smoothstep(-.08,.24,probe.y-height+.14));}
 vec3 lit=base*(hemi+1.08*ndl*mix(.12,1.0,visibility))''')
s=s.replace('vec3(.18,.20,.20),vec3(.47,.49,.47)','vec3(.10,.115,.12),vec3(.31,.33,.32)')
s=s.replace('float core=exp(-r*5.0),edge=soft;float alpha=edge*', '''float flameY=clamp(1.0-gl_PointCoord.y,0.0,1.0),profile=sin(3.14159265*flameY);
 float tongue=pow(max(0.0,1.0-abs(q.x)/max(.03,profile*.70)),1.5)*profile;
 float core=exp(-r*5.0),edge=tongue;float alpha=edge*''')
p.write_text(s)
p=root/'app.mjs';s=p.read_text()
s=s.replace("'uExposure','uWet','uDomain'","'uExposure','uWet','uRockHeight','uDomain'")
s=s.replace('u1i(gl,solidLoc.uWet,0);gl.enable', 'u1i(gl,solidLoc.uWet,0);gl.activeTexture(gl.TEXTURE3);gl.bindTexture(gl.TEXTURE_2D,rockTexture);u1i(gl,solidLoc.uRockHeight,3);gl.enable')
p.write_text(s)
print('Daylight contrast, mesh-based contact shadows, bounded distant blend and flame profiles refined')
