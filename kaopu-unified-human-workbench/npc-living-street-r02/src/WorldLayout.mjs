/**
 * One metre-scale truth for the expanded living street.
 * Geometry, navigation and physical floor fixtures consume this module.
 * Building/fixture footprints are independent of camera and rendering quality.
 */
const p=(x,y,z)=>[x,y,z];
const seat=(id,x,z)=>({id,stand:p(x,0,z+.65),seat:p(x,.46,z),yaw:0});
const benches=[
  {id:'bench-west',x:-3.05,z:1.65,seats:['benchA','benchB']},
  {id:'bench-east',x:6.40,z:4.35,seats:['benchC','benchD']},
  {id:'bench-garden',x:-8.90,z:4.35,seats:['benchE','benchF']}
];
const facades=[
  {id:'tea-house',x:-9.43,width:5.17,height:3.44,material:'plasterLight'},
  {id:'house-west',x:-3.62,width:5.05,height:3.48,material:'plasterLight'},
  {id:'bakery-house',x:2.62,width:7.05,height:3.63,material:'plaster'},
  {id:'garden-house',x:9.58,width:5.00,height:3.46,material:'plasterLight'}
];
const pots=[
  {x:-4.60,z:1.57,radius:.24,height:.39,flower:true},
  {x:-1.50,z:1.54,radius:.27,height:.43,flower:true},
  {x:-.63,z:-2.67,radius:.24,height:.43,flower:true},
  {x:5.72,z:-2.61,radius:.29,height:.49,flower:true},
  {x:6.10,z:3.72,radius:.32,height:.53,flower:false},
  {x:-11.91,z:-2.65,radius:.27,height:.47,flower:true},
  {x:-6.91,z:-2.62,radius:.25,height:.42,flower:true},
  {x:-10.43,z:4.22,radius:.28,height:.44,flower:true},
  {x:-7.36,z:4.22,radius:.25,height:.44,flower:true},
  {x:7.94,z:4.22,radius:.25,height:.44,flower:true},
  {x:7.11,z:-2.65,radius:.27,height:.46,flower:true},
  {x:12.19,z:-2.60,radius:.25,height:.42,flower:false}
];
const trees=[
  {id:'olive-tree',x:-6.07,z:.16,radius:.385,depth:.425},
  {id:'tea-tree',x:-11.85,z:2.00,radius:.42,depth:.46},
  {id:'garden-tree',x:11.75,z:6.70,radius:.46,depth:.48}
];
const lamps=[{id:'lamp-west',x:-11.73,z:6.72},{id:'lamp-east',x:11.77,z:.15}];
const spots={
  benchA:seat('benchA',-3.65,1.65),benchB:seat('benchB',-2.45,1.65),
  benchC:seat('benchC',5.80,4.35),benchD:seat('benchD',7.00,4.35),
  benchE:seat('benchE',-9.50,4.35),benchF:seat('benchF',-8.30,4.35),
  recycle:{stand:p(-4.8,0,0),contact:p(-4.8,.85,-.70),yaw:Math.PI},
  bakery:{stand:p(3.4,0,0),contact:p(3.4,.95,-.75),yaw:Math.PI},
  shelterA:{stand:p(1.90,0,-2.05),yaw:0,canopy:'bakery'},
  shelterB:{stand:p(3.40,0,-2.05),yaw:0,canopy:'bakery'},
  shelterC:{stand:p(4.90,0,-2.05),yaw:0,canopy:'bakery'},
  shelterD:{stand:p(-10.80,0,-2.05),yaw:0,canopy:'tea'},
  shelterE:{stand:p(-9.30,0,-2.05),yaw:0,canopy:'tea'},
  shelterF:{stand:p(-7.80,0,-2.05),yaw:0,canopy:'tea'},
  windowA:{stand:p(9.50,0,-2.29),contact:p(9.44,1.33,-2.8925),yaw:Math.PI},
  planterA:{stand:p(9.70,0,3.30),contact:p(9.77,1.04,2.8475),yaw:Math.PI},
  bottleStarts:[p(-1.20,0,.40),p(1.00,0,1.90),p(3.20,0,2.50),p(-4.50,0,3.10),p(-7.0,0,.8),p(7.9,0,.65)]
};
const colliders=[
  ...facades.map(f=>({id:f.id,kind:'box',min:p(f.x-f.width/2,0,-4.44),max:p(f.x+f.width/2,2.82,-3.28)})),
  {id:'bakery-counter',kind:'box',min:p(2.29,0,-1.10),max:p(4.51,.95,-.40)},
  {id:'recycling-counter',kind:'box',min:p(-5.41,0,-1.05),max:p(-4.19,.85,-.35)},
  ...benches.map(b=>({id:b.id,kind:'seat',min:p(b.x-1.30,0,b.z-.45),max:p(b.x+1.30,1.05,b.z+.27),seatTop:.46})),
  ...pots.map(o=>({id:'pot-'+o.x+'-'+o.z,kind:'cylinder',center:p(o.x,o.height*.5,o.z),radius:o.radius*1.05,height:o.height})),
  ...trees.map(t=>({id:t.id+'-planter',kind:'box',min:p(t.x-t.radius,0,t.z-t.depth),max:p(t.x+t.radius,.30,t.z+t.depth)})),
  ...lamps.map(l=>({id:l.id,kind:'cylinder',center:p(l.x,.075,l.z),radius:.16,height:.15})),
  {id:'care-planter',kind:'box',min:p(8.92,0,1.71),max:p(10.48,.54,2.59)},
  {id:'garden-tap',kind:'box',min:p(9.60,0,2.55),max:p(9.80,1.14,2.866)},
  {id:'windowA-sweep',kind:'box',min:p(8.85,.80,-3.20),max:p(10.15,2.20,-2.655)}
];

export const STREET_LAYOUT=Object.freeze({
  version:'KAOPU-LIVING-STREET-R02',unit:'metre',
  floor:{center:p(0,-.06,2),size:p(26,.12,14),surfaceY:0},
  bounds:{minX:-12.45,maxX:12.45,minZ:-2.75,maxZ:8.40},
  facades,benches,pots,trees,lamps,colliders,spots,
  seatIds:['benchA','benchB','benchC','benchD','benchE','benchF'],
  shelterIds:['shelterA','shelterB','shelterC','shelterD','shelterE','shelterF'],
  actorStarts:[
    {id:'A',x:-.65,z:1.25,yaw:-.4},{id:'B',x:-2.45,z:2.32,yaw:0},
    {id:'C',x:-7.15,z:2.4,yaw:.45},{id:'D',x:5.8,z:2.6,yaw:-.6},
    {id:'E',x:1.6,z:5.3,yaw:2.8},{id:'F',x:-5.6,z:5.9,yaw:-.8}
  ],
  carePlanter:{id:'planterA',center:p(9.7,.27,2.15),size:p(1.56,.54,.88),soilTop:.50},
  window:{id:'windowA',x:9.50,y:1.50,z:-3.10,width:1.22,height:1.34,handleHeight:1.33,maxOpenRad:.45},
  canopies:[
    {id:'bakery',left:1.35,right:5.37,frontZ:-1.10,backZ:-3.08,frontY:2.45,backY:2.68},
    {id:'tea',left:-11.45,right:-7.15,frontZ:-1.10,backZ:-3.08,frontY:2.45,backY:2.68}
  ],
  wanderPoints:[p(-10.2,0,.3),p(-7.2,0,6.7),p(-3.3,0,5.3),p(.4,0,3.8),p(4.9,0,6.8),p(8.6,0,.4),p(10.5,0,4.8)],
  bottleDropBounds:{minX:-10.7,maxX:10.7,minZ:-.10,maxZ:7.2}
});
export const STREET_SPOTS=STREET_LAYOUT.spots;
export const STREET_COLLIDERS=STREET_LAYOUT.colliders;

