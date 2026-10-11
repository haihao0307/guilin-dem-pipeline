import{COACH_LAYOUT,COACH_DIMENSIONS,COACH_FLOOR,PLATFORM_LAYOUT}from'../metre-scale.mjs';
export function boardingPlateSpecs(){
 const outerStepZ=COACH_DIMENSIONS.bodyAndStepsWidth/2-.17,edge=1.85+.055,innerY=PLATFORM_LAYOUT.top+(COACH_FLOOR-PLATFORM_LAYOUT.top)/3,outerY=PLATFORM_LAYOUT.top;
 return COACH_LAYOUT.flatMap(c=>[c.frontDoor,c.rearDoor].map(x=>({x,innerZ:outerStepZ,outerZ:edge,innerY,outerY,width:COACH_DIMENSIONS.doorWidth-.06,thickness:.026,length:Math.hypot(edge-outerStepZ,innerY-outerY),angle:Math.atan2(innerY-outerY,edge-outerStepZ)})));
}
export function boardingPlateDeployed(view){return view.door>=.999&&Math.abs(view.velocity)<1e-6&&view.station.index===0;}
export function createBoardingPlates(T,catalog){const root=new T.Group();root.name='Door-interlocked original procedural boarding plates';const specs=boardingPlateSpecs();for(const p of specs){const o=new T.Mesh(new T.BoxGeometry(p.width,p.thickness,p.length),catalog.get('structural-iron'));o.position.set(p.x,(p.innerY+p.outerY)/2-p.thickness/2,(p.innerZ+p.outerZ)/2);o.rotation.x=p.angle;o.castShadow=o.receiveShadow=true;root.add(o);}return{root,specs,update(view){root.visible=boardingPlateDeployed(view);},proof:{source:'host coach dimensions + existing Session.door',mount:'train-render-frame',newActorPaths:false,gates:['door >= .999','velocity < 1e-6','station.index == 0'],plateCount:specs.length}};}
