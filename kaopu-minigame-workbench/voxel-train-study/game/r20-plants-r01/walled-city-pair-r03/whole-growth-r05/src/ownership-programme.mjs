import {compileFrontages} from '../../whole-frontage-r04/src/frontage-programme.mjs';

const fictional='Fictional parcel agreement, dimensions and dates; causal design interpretation, not a measured historical address or engineering certification';
export const OWNERSHIP_EVENTS=[
 {id:'A-west-1969-daylight-line',buildingId:'A',fromLevel:6,parcel:0,year:1969,minimumFront:-3.55,incrementM:1.10,kind:'rental-funded-setback',cause:'The west owner funds another rental phase but accepts a deeper building line to retain daylight for the lower household and a usable roof work platform.',funds:'authored accumulation of earlier rental income',support:'new walls remain over the lower existing floor footprint',access:'A-F06 west household door onto the exposed lower roof'},
 {id:'A-middle-1977-daylight-line',buildingId:'A',fromLevel:10,parcel:1,year:1977,minimumFront:-2.25,incrementM:1.40,kind:'rental-funded-setback',cause:'The middle owner adds rooms with accumulated rent after negotiating a larger light opening and shared roof-use route instead of extending the whole frontage.',funds:'authored later rental accumulation',support:'retained lower roof and inward wall line',access:'A-F10 middle door onto the connected middle/east roof platform'},
 {id:'B-east-1977-roof-right',buildingId:'B',fromLevel:8,parcel:2,year:1977,minimumFront:-2.30,incrementM:1.15,kind:'rental-funded-setback',cause:'The east owner builds a smaller rental addition while the lower tenants retain roof daylight and a reachable outdoor work and drying edge.',funds:'authored independent rental accumulation',support:'addition remains within the previous roof footprint',access:'B-F08 east door onto the retained roof platform'},
 {id:'B-workshop-1961-extra-headroom',buildingId:'B',level:1,year:1961,extraHeightM:.55,kind:'initial-workshop-headroom',cause:'The original repair-workshop owner reserves headroom for tall repair work before later rental floors are added; their independently funded floors and roof inherit the higher datum.',funds:'authored initial workshop investment, followed by later rent-funded upper phases',support:'same footprint and stacked internal core',access:'all later B landings rise; three borrowed links acquire finite stair flights with level end landings'}
].map(e=>({...e,sourceStatus:fictional}));

export function parcelAt(f,x){return x<f.parcelBounds[1]?0:x<f.parcelBounds[2]?1:2;}
export function frontAt(f,x){return f.fronts[parcelAt(f,x)];}
export function compileOwnershipWorld(base){
 const floors=compileFrontages(base).map(f=>structuredClone(f));
 for(const f of floors){
  if(f.buildingId==='B'){if(f.level===1)f.height=Number((f.height+.55).toFixed(6));if(f.level>=2)f.base=Number((f.base+.55).toFixed(6));}
  const active=f.buildingId==='A'?f.level>=6:f.level>=8,lo=f.cx-f.width/2,hi=f.cx+f.width/2;
  // Stable ownership lines, independent of later whole-building width/centre changes.
  const boundaries=f.buildingId==='A'?[-8.0,-4.158]:[4.14,7.572];
  if(active){f.frontage.split1=(boundaries[0]-lo)/f.width;f.frontage.split2=(boundaries[1]-lo)/f.width;f.frontage.bounds=[0,f.frontage.split1,f.frontage.split2,1];}
  f.parcelBounds=f.frontage.bounds.map(v=>lo+v*f.width);
  f.fronts=[0,1,2].map(i=>Math.max(f.front,...OWNERSHIP_EVENTS.filter(e=>e.minimumFront!==undefined&&e.buildingId===f.buildingId&&f.level>=e.fromLevel&&e.parcel===i).map(e=>e.minimumFront)));
  if(['A-F07','A-F09','B-F09'].includes(f.id)){f.frontage.dryingMask=2;f.frontage.cause+='; the new ownership return relocates drying to the reachable middle platform';}
  if(f.id==='A-F11'){f.frontage.types=[3,2,3];f.frontage.cause+='; separate west store and east drying platforms each retain an independent entrance across the recessed middle ownership bay';}
  if(f.id==='A-F06')f.frontage.types[0]=3;
  if(['A-F10','A-F12'].includes(f.id))f.frontage.types[1]=3;
  if(f.id==='B-F08')f.frontage.types[2]=3;
  f.slidingMask=f.id==='B-F11'?6:f.id==='A-F12'?2:0;
  if(f.growth&&f.id!=='A-F04'){const g=f.growth,lo=f.parcelBounds[g.bay],hi=f.parcelBounds[g.bay+1],width=(hi-lo)*.86;g.centerX=(lo+hi)/2;g.halfWidth=width/2;g.areaM2=width*g.depthM;}
 }
 for(const f of floors){
  const previous=floors.find(p=>p.buildingId===f.buildingId&&p.level===f.level-1);
  f.supportFronts=[0,1,2].map(i=>previous?frontAt(previous,(f.parcelBounds[i]+f.parcelBounds[i+1])/2):f.fronts[i]);
  f.terraceMask=f.fronts.reduce((m,z,i)=>m|(z-f.supportFronts[i]>=.80?1<<i:0),0);
  f.platforms=f.fronts.map((z,i)=>{const terrace=!!(f.terraceMask&(1<<i)),balcony=!!f.balcony&&(f.frontage.types[i]>=3||!!(f.frontage.dryingMask&(1<<i)));return{parcel:i,left:f.parcelBounds[i],right:f.parcelBounds[i+1],front:terrace?f.supportFronts[i]:z-(balcony?.95:0),wallFront:z,kind:terrace?'retained-lower-roof':balcony?'existing-balcony':null};});
  for(let i=0;i<3;i++)if(f.frontage.types[i]>=3&&f.level>0&&!f.platforms[i].kind)throw Error(f.id+' unsupported parcel entrance '+i);
  if(previous&&f.fronts.some((z,i)=>z<f.supportFronts[i]-.00001))throw Error(f.id+' unsupported outward return');
 }
 const buildings=structuredClone(base.buildings);const b=buildings.find(b=>b.id==='B');b.heightSteps[1]=Number((b.heightSteps[1]+.55).toFixed(6));b.height=Number((b.height+.55).toFixed(6));
 return{floors,buildings,events:[...base.events,...floors.filter(f=>f.growth).map(f=>f.growth),...OWNERSHIP_EVENTS]};
}
