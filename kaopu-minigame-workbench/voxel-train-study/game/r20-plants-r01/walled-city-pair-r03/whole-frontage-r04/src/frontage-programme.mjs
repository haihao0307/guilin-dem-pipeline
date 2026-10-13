import {HOUSEHOLD_GROWTH} from '../../src/household-growth.mjs';
// An authored design interpretation of the existing life-world, not a measured
// address, historic floor-use census or a claim that unseen reference pixels were read.
// Each row gives negotiated frontage divisions and actual aperture/shelter uses.
// Type: 0 high ventilation, 1 sleeping/living window, 2 broad work/study window,
// 3 household entrance, 4 open shop/work entrance. Masks identify physical bays.
const rows=[
 ['A-F00',.23,.70,[4,4,0],3,0,1963,'repair benches need daylight; narrow parts store stays screened'],
 ['A-F01',.42,.74,[2,0,1],1,0,1964,'noodle preparation has a broad work opening and high steam vent'],
 ['A-F02',.31,.76,[2,3,2],4,1,1965,'shared teaching table keeps two daylight zones and a middle exit'],
 ['A-F03',.46,.72,[2,2,0],1,0,1971,'barber chair faces a broad glazed waiting bay; services use a high opening'],
 ['A-F04',1/3,.71,[3,3,2],4,2,1973,'recorded 1973 west household study enclosure displaces timed drying to the neighbouring shared middle bay'],
 ['A-F05',.25,.57,[1,0,1],4,0,1974,'shift sleepers keep low glare windows; bedding storage is ventilated'],
 ['A-F06',.43,.73,[2,1,0],1,0,1975,'sewing table follows long daylight window; family sleep stays smaller'],
 ['A-F07',.24,.66,[0,3,2],4,1,1976,'borrowed landing remains clear; wash corner has a high vent'],
 ['A-F08',.37,.62,[2,1,1],1,0,1980,'child study borrows the wider frontage while sleeping windows remain private'],
 ['A-F09',.30,.70,[1,3,3],1,1,1982,'shift households share central balcony access and edge bedding storage'],
 ['A-F10',.45,.75,[2,0,1],1,0,1981,'shared meal window is wide; roof route uses the retained internal stair'],
 ['A-F11',.28,.66,[3,3,2],4,4,1986,'young upper-floor household encloses the west edge as dry storage'],
 ['A-F12',.40,.68,[2,1,0],1,0,1985,'roof workers share a work table and small sleeping opening'],
 ['A-F13',.27,.61,[1,2,0],2,0,1987,'caretaker has a work window facing roof access and a high store vent'],
 ['B-F00',.40,.73,[4,2,0],1,0,1962,'noodle counter opens to street beside food preparation daylight'],
 ['B-F01',.29,.70,[0,2,2],6,0,1964,'repair room keeps an internal stair access between parts store and bench'],
 ['B-F02',.35,.68,[2,3,3],1,1,1966,'east household work enclosure relocates drying to the west'],
 ['B-F03',.25,.60,[1,2,0],2,0,1970,'sewing shifts use the broad middle bay beside family sleep'],
 ['B-F04',.31,.73,[3,3,1],4,4,1972,'west bedding store preserves central access for shift tenants'],
 ['B-F05',.44,.75,[2,0,1],1,0,1973,'learning room has broad table light and a small storage vent'],
 ['B-F06',.28,.65,[0,1,2],4,0,1975,'borrowed landing and wash corner stay distinct and passable'],
 ['B-F07',.36,.67,[2,3,3],1,1,1974,'east family work alcove leaves shared access in the middle'],
 ['B-F08',.24,.58,[1,0,1],1,0,1980,'shift beds retain separate narrow windows and a drying vent'],
 ['B-F09',.30,.69,[3,3,2],4,4,1981,'west study enclosure keeps the east balcony usable for drying'],
 ['B-F10',.41,.70,[2,1,0],1,0,1982,'meal table gets daylight while roof access uses the retained internal stair'],
 ['B-F11',.33,.72,[2,3,3],1,1,1986,'east household dry store leaves west washing and drying access'],
 ['B-F12',.28,.63,[1,2,0],2,0,1987,'workers share the wider central work window under the roof']
];
export const FRONTAGE_PROGRAMME=rows.map(([floorId,split1,split2,types,canopyMask,dryingMask,canopyYear,cause])=>({floorId,split1,split2,types,canopyMask,dryingMask,canopyYear,cause,sourceStatus:'authored dimensions and bay allocation; uses inherited from the R03 life-world; relations informed by user-described cutaway observations'}));
const growth=[
 ['A-F04',0,.84,1973,'work-study',2.28],['A-F09',2,.57,1982,'bedding-storage',2.24],
 ['A-F11',0,.69,1986,'dry-household-storage',2.25],['B-F02',2,.76,1966,'home-piecework',2.28],
 ['B-F04',0,.59,1972,'bedding-storage',2.25],['B-F07',2,.82,1974,'work-study',2.24],
 ['B-F09',0,.72,1981,'child-study',2.27],['B-F11',2,.63,1986,'dry-household-storage',2.25]
];
export const FRONTAGE_EVENTS=growth.map(([floorId,bay,depthM,year,use,clearHeightM])=>({id:`${floorId}-edge-${year}-${use}`,floorId,bay,depthM,year,use,clearHeightM,kind:'enclose-edge-balcony-bay',newBeds:0,cause:'existing household negotiates an edge of its existing balcony for the named use',access:'existing household door; middle shared bay and stair landing remain open',support:'within existing balcony slab; geometric fit only, no engineering certification',laundry:'moves to the explicitly recorded open drying bay',drainage:'sloped sheet canopy drains toward existing downpipe; capacity unverified',sourceStatus:'fictional address, year, dimensions and household agreement; relation-based design interpretation',...(floorId==='A-F04'?HOUSEHOLD_GROWTH[0]:{}),use,clearHeightM}));
export function compileFrontages(base){
 const ids=new Set();
 const floors=base.floors.map(f=>{
  const frontage=FRONTAGE_PROGRAMME.find(x=>x.floorId===f.id);if(!frontage||ids.has(f.id))throw Error('missing or duplicate frontage');ids.add(f.id);
  const e=FRONTAGE_EVENTS.find(e=>e.floorId===f.id),bounds=[0,frontage.split1,frontage.split2,1];
  if(!(bounds[1]>.20&&bounds[2]-bounds[1]>.20&&1-bounds[2]>.20))throw Error('frontage too narrow');
  if(frontage.canopyYear<f.year||frontage.canopyYear>base.world.year)throw Error('canopy chronology');
  if(f.level>0&&!f.balcony&&frontage.types.some(t=>t>=3))throw Error('upper frontage door has no landing');
  if(frontage.dryingMask&&!f.balcony)throw Error('drying requires supported working reach');
  let growth=null;
  if(e){if(!f.balcony||![0,2].includes(e.bay)||e.year<f.year||e.year>base.world.year||e.clearHeightM>f.height-.20||e.depthM>.84)throw Error('invalid supported household enclosure');if(frontage.types[e.bay]!==3)throw Error('enclosure must retain its actual entrance');if(frontage.dryingMask&(1<<e.bay))throw Error('drying inside enclosure');if(!frontage.types.some((t,i)=>i!==e.bay&&t===3))throw Error('drying has no independent balcony access');const lo=bounds[e.bay],hi=bounds[e.bay+1],width=(hi-lo)*f.width*.86;growth={...e,centerX:f.cx-f.width/2+(lo+hi)*f.width/2,halfWidth:width/2,areaM2:width*e.depthM,age:(base.world.year-e.year)/40};}
  return {...f,frontage:{...frontage,bounds},growth};
 });
 if(ids.size!==27||FRONTAGE_PROGRAMME.length!==27)throw Error('whole pair must retain all 27 floors');
 return floors;
}
