import {LAYOUT as L} from './transport-layout.mjs';
const f=v=>Number.isInteger(v)?v+'.0':String(v);
const v=a=>`vec3<f32>(${a.map(f).join(',')})`;
// The scene consumes the same drive coordinates as transport.mjs; no clock sine
// determines carried-object or tool position. All lengths are metres.
export const TRANSPORT_FIELD=String.raw`
fn transportField(p:vec3<f32>)->Field {
 let beltQ=u.transport.x;let sx=u.transport.y;let fence=u.transport.z;
 let wy=u.tool.x;let wz=u.tool.y;let jaw=u.tool.z;
 var frame=box(p-vec3<f32>(.5,1.05,3.5),vec3<f32>(.65,.18,27.5));
 frame=max(frame,-box(p-vec3<f32>(.5,1.05,9.75),vec3<f32>(.7,.5,.61)));
 var f=field(frame,5u,p,9004.0);
 // The roller shuttle fills this 1.20 m belt pocket while docked.
 let slatZ=repeatX(p.z+beltQ,.55,90.);
 var slats=max(box(vec3<f32>(p.x-.5,p.y-1.24,slatZ),vec3<f32>(.61,.065,.20)),box(p-vec3<f32>(.5,1.25,3.5),vec3<f32>(.65,.2,27.5)));
 slats=max(slats,-box(p-vec3<f32>(.5,1.25,9.75),vec3<f32>(.7,.3,.60)));
 f=take(f,field(slats,4u,p,9002.0));
 // Continuous drive shaft and right-angle gearbox connect the existing crank
 // to the belt head. Boiler pipe is only a service connection, not pressure sim.
 var shaft=capsule(p,vec3<f32>(-21.2,.82,-26.),vec3<f32>(.5,.82,-26.),.075);
 shaft=min(shaft,capsule(p,vec3<f32>(.5,.82,-26.),vec3<f32>(.5,1.15,-24.),.075));
 shaft=min(shaft,box(p-vec3<f32>(.5,.82,-26.),vec3<f32>(.32,.3,.32)));
 f=take(f,field(shaft,5u,p,9012.0));
 let roller=min(cylinder((p-vec3<f32>(.5,1.15,-24.)).yxz,.155,.65),cylinder((p-vec3<f32>(.5,1.15,31.)).yxz,.155,.65));f=take(f,field(roller,9u,p,9004.0));
 let bound=box(p-vec3<f32>(6.9,1.8,9.6),vec3<f32>(7.25,1.85,1.75));
 if(bound>1.){return take(f,field(bound,0u,p,9000.0));}
 // Floor-recessed rails. Rail crown is 4 mm above the finished floor.
 // Onboard wheel drive; no raised screw or stationary leg cuts the crossing.
 let rz=abs(p.z-9.75)-.46;
 var metal=box(vec3<f32>(p.x-${f(L.railX)},p.y-${f(L.railCenterY)},rz),${v([L.railHalfX,L.railHalfY,L.railHalfZ])});
 // Four carriage legs connect the low bogies to the original roller deck.
 let legDX=abs(p.x-sx)-.48;let legDZ=abs(p.z-9.75)-.46;
 metal=min(metal,box(vec3<f32>(legDX,p.y-.665,legDZ),vec3<f32>(.055,.455,.055)));
 metal=min(metal,box(p-vec3<f32>(sx,.255,9.75),vec3<f32>(.55,.065,.50)));
 metal=min(metal,box(p-vec3<f32>(sx,1.16,9.75),vec3<f32>(.64,.055,.60)));
 let rlocal=repeatX(p.z-9.75,.13,4.);
 metal=min(metal,max(cylinder(vec3<f32>(p.y-1.26,p.x-sx,rlocal),.045,.61),box(p-vec3<f32>(sx,1.26,9.75),vec3<f32>(.64,.055,.595))));
 // Raised stops are below the bag until it is centred and fully supported.
 metal=min(metal,box(vec3<f32>(p.x-sx,p.y-(1.235+fence),abs(p.z-9.75)-.385),vec3<f32>(.54,.07,.025)));
 let wheelX=abs(p.x-sx)-.48;metal=min(metal,cylinder(vec3<f32>(wheelX,abs(p.z-9.75)-.46,p.y-${f(L.wheelY)}),${f(L.wheelRadius)},.035));
 // Axle gearbox is carried by the trolley; simplified motor torque is not boiler pressure.
 f=take(f,field(metal,5u,p,9031.0));
 // Cartesian lifting/placing arm: fixed pillar -> crosshead -> vertical slide
 // -> telescoping reach -> opposed jaw pads. Each link has a bearing overlap.
 var arm=box(p-${v(L.pillar)},${v(L.pillarHalf)});
 arm=min(arm,box(p-vec3<f32>(12.2,3.25,8.86),vec3<f32>(.56,.14,.16)));
 arm=min(arm,box(p-vec3<f32>(12.6,3.25,9.305),vec3<f32>(.16,.14,.605)));
 arm=min(arm,box(p-vec3<f32>(12.6,2.95,9.75),vec3<f32>(.095,.35,.10)));
 arm=min(arm,box(p-vec3<f32>(12.6,(3.20+wy)/2.,9.75),vec3<f32>(.060,(3.20-wy)/2.+.08,.065)));
 arm=min(arm,box(p-vec3<f32>(12.6,wy,9.73),vec3<f32>(.18,.10,.20)));
 arm=min(arm,box(p-vec3<f32>(12.6,wy,(9.90+wz)/2.),vec3<f32>(.05,.04,(9.90-wz)/2.)));
 arm=min(arm,box(p-vec3<f32>(12.6,wy,wz),vec3<f32>(jaw+.06,.035,.11)));
 let dx=abs(p.x-12.6)-jaw;arm=min(arm,box(vec3<f32>(dx,p.y-(wy-.18),p.z-wz),vec3<f32>(.025,.18,.18)));
 f=take(f,field(arm,9u,p,9007.0));
 // Identifiable spindle collars and carriage paint remain mother materials.
 let painted=min(box(p-vec3<f32>(sx,1.07,10.37),vec3<f32>(.6,.13,.04)),box(p-vec3<f32>(11.8,.10,8.86),vec3<f32>(.30,.08,.24)));
f=take(f,field(painted,14u,p,9043.0));
 // Both crossing bars use the controller gate angle; pause/power loss keep them.
 let gateAngle=u.transport.w;let gateZ=select(8.35,11.15,p.z>9.75);
 let hinge=vec3<f32>(${f(L.gateX)},${f(L.gateY)},gateZ);
 let end=hinge+vec3<f32>(cos(gateAngle),sin(gateAngle),0.)*${f(L.gateLength)};
 var gates=capsule(p,hinge,end,${f(L.gateRadius)});
 gates=min(gates,box(p-vec3<f32>(${f(L.gateX)},.55,gateZ),vec3<f32>(.075,.55,.075)));
 return take(f,field(gates,14u,p,9044.0));
}
fn mechanicalBag(p:vec3<f32>,halfSize:vec3<f32>,seed:f32)->Field {
 let r=.02;var f=field(box(p,max(vec3<f32>(.001),halfSize-vec3<f32>(r)))-r,4u,p,seed+9000.);
 // Only this registered object receives these fittings; no decorative duplicates.
 let strapX=abs(p.x)-halfSize.x*.58;
 let straps=max(box(vec3<f32>(strapX,p.y,p.z),vec3<f32>(.018,halfSize.y+.004,halfSize.z+.004)),-box(p,halfSize-vec3<f32>(.009)));
 let topOnly=max(straps,-p.y-halfSize.y+.015);f=take(f,field(topOnly,5u,p,seed+9000.));
 let handle=max(box(p-vec3<f32>(0.,halfSize.y+.035,0.),vec3<f32>(.10,.035,.025)),-box(p-vec3<f32>(0.,halfSize.y+.025,0.),vec3<f32>(.07,.030,.05)));
 return take(f,field(handle,9u,p,seed+9000.));
}
`;
