// Authored window joinery. Local x is bay width, y is sill-up, z points inside.
// The glass is a physical slab in the same field; renderer continues through it.
export const WINDOWS=String.raw`
fn sashWindow(q:vec3<f32>,radius:f32,spring:f32,seed:f32,worldToWindow:mat3x3<f32>)->Field {
 let opening=archOpening(q,radius,spring,.8);
 let reveal=max(archOpening(vec3<f32>(q.xy,q.z+.08),radius+.14,spring,.27),-opening);
 var f=field(reveal,3u,q,seed);
 let frameOuter=archOpening(vec3<f32>(q.xy,q.z-.11),radius-.025,spring,.10);
 let frameInner=archOpening(vec3<f32>(q.xy,q.z-.11),radius-.13,spring,.24);
 var frame=max(frameOuter,-frameInner);
 // Two vertically sliding sashes, recessed glazing and arched fanlight.
 let meeting=spring*.51;let centre=box(q-vec3<f32>(0.,spring*.5,.12),vec3<f32>(.035,spring*.5,.06));
 let rail=box(q-vec3<f32>(0.,meeting,.12),vec3<f32>(radius-.10,.045,.065));
 let transom=box(q-vec3<f32>(0.,spring,.12),vec3<f32>(radius-.09,.05,.08));
 let bar=box(q-vec3<f32>(0.,spring*.25,.13),vec3<f32>(radius-.10,.022,.044));
 let upperbar=box(q-vec3<f32>(0.,spring*.76,.13),vec3<f32>(radius-.10,.022,.044));
 frame=min(frame,min(min(centre,rail),min(transom,min(bar,upperbar))));
 for(var i=0;i<3;i++){let a=.78539816*f32(i+1);let end=vec3<f32>(cos(a)*(radius-.11),spring+sin(a)*(radius-.11),.12);frame=min(frame,capsule(q,vec3<f32>(0.,spring,.12),end,.021));}
 frame=max(frame,archOpening(q,radius-.025,spring,.26));
 f=take(f,field(frame,14u,q,seed));
 let glass=max(archOpening(q,radius-.12,spring,.6),abs(q.z-.165)-.0045);
 f=take(f,field(glass,8u,q,seed));
 let sill=box(q-vec3<f32>(0.,-.09,-.13),vec3<f32>(radius+.23,.09,.42));f=take(f,field(sill,3u,q,seed));
 let apron=box(q-vec3<f32>(0.,-.24,.025),vec3<f32>(radius+.10,.075,.19));f=take(f,field(apron,3u,q,seed));
 // Hardware lives at the meeting rail; sheltered contact polishes the handle.
 let handle=capsule(q,vec3<f32>(-.12,meeting+.09,.225),vec3<f32>(.12,meeting+.09,.225),.018);
 f=take(f,field(handle,9u,q,seed));f.wet=.035;
 // The complete timber frame has these actual local metre extents. No normal,
 // tangent or footprint may silently switch back to world axes.
 if(f.mat==14u){f.component=MaterialFrame(worldToWindow,vec3<f32>(-radius+.025,0.,.01),vec3<f32>(radius-.025,spring+radius-.025,.21),1.);}return f;
}
`;

export const ENTRY_JOINERY=String.raw`
fn entryJoinery(p:vec3<f32>)->Field {
 let bound=box(p-vec3<f32>(-39.6,2.9,-18.),vec3<f32>(5.4,3.0,4.1));
 if(bound>1.){return field(bound,0u,p,0.);}
 let q=vec3<f32>(p.z+18.,p.y,p.x+38.7);
 let opening=archOpening(q,3.4,2.2,1.);
 let trim=max(archOpening(vec3<f32>(q.xy,q.z+.15),3.65,2.2,.24),-opening);
 var f=field(shell(trim,p),3u,p,20.);
 // The threshold bridges a 33 mm interior finish, without imaginary tall stairs.
 let threshold=box(p-vec3<f32>(-38.70,.0165,-18.),vec3<f32>(.38,.0165,3.38));
 f=take(f,field(threshold,3u,p,20.));
 let outerLanding=box(p-vec3<f32>(-43.5,-.008,-18.),vec3<f32>(1.15,.008,4.3));f=take(f,field(outerLanding,3u,p,20.));
 // Four timber leaves form two inward-folded pairs. Each leaf is 1.56 m
 // wide: the folded stack stays beside the jamb and intrudes only 1.62 m.
 // The central 6.08 m entry axis stays open rather than a 3 m leaf filling it.
 for(var leafIndex=0;leafIndex<4;leafIndex++){let side=leafIndex/2;let folded=leafIndex%2;let sg=select(-1.,1.,side==1);
 let door=vec3<f32>(p.x+38.62-.81,p.y-1.56,(p.z+18.-sg*3.24)*sg+f32(folded)*.14);
 var leaf=box(door,vec3<f32>(.78,1.53,.050));let paneHole=box(door-vec3<f32>(0.,.59,0.),vec3<f32>(.58,.62,.20));leaf=max(leaf,-paneHole);
 f=take(f,field(shell(leaf,p),4u,door,22.+f32(leafIndex)));
 let pane=max(paneHole,abs(door.z)-.0045);f=take(f,field(shell(pane,p),8u,door,22.+f32(leafIndex)));
 let glazingBars=min(box(door-vec3<f32>(0.,.59,0.),vec3<f32>(.025,.65,.075)),box(door-vec3<f32>(0.,.59,0.),vec3<f32>(.60,.025,.075)));f=take(f,field(shell(glazingBars,p),14u,door,22.+f32(leafIndex)));
 let bottomPanel=max(box(door-vec3<f32>(0.,-.77,.056),vec3<f32>(.60,.53,.022)),-box(door-vec3<f32>(0.,-.77,.056),vec3<f32>(.53,.45,.10)));f=take(f,field(shell(bottomPanel,p),18u,door,22.+f32(leafIndex)));
 let pull=capsule(door,vec3<f32>(-.52,-.1,.11),vec3<f32>(-.52,.3,.11),.027);f=take(f,field(shell(pull,p),9u,door,22.+f32(leafIndex)));
 let hinge=cylinder(vec3<f32>(p.x+37.04,p.y-1.56,(p.z+18.-sg*3.17)*sg),.035,.17);f=take(f,field(shell(hinge,p),9u,p,24.));
 }
 // Fanlight follows the same opening outline, not a second opaque arch plate.
 let fan=max(opening,max(3.14-q.y,abs(q.z-.14)-.0045));f=take(f,field(shell(fan,p),8u,q,20.));
 let transom=box(q-vec3<f32>(0.,3.12,.12),vec3<f32>(3.27,.065,.09));f=take(f,field(shell(transom,p),14u,q,20.));
 let fanU=repeatX(q.x,.82,3.);let fanBar=max(box(vec3<f32>(fanU,q.y-4.30,q.z-.12),vec3<f32>(.026,1.17,.065)),max(opening,3.14-q.y));f=take(f,field(shell(fanBar,p),14u,q,20.));return f;
}
`;
