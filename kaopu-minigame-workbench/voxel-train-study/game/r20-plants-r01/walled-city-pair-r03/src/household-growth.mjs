// Authored household event, supported by observed relations, not a surveyed address.
// Japanese cutaway 070652: a passage can become a room; SCMP G04/G07: a local
// enclosure affects a roof/awning, a window, laundry, and the adjacent passage.
export const HOUSEHOLD_GROWTH=[{
 id:'A-F04-west-1973-work-alcove',floorId:'A-F04',year:1973,kind:'enclose-edge-balcony-bay',
 actor:'A-owner',users:'existing west-bay household',cause:'home piecework and personal study compete with the shared dining surface',
 funds:'authored accumulated rent after repairs; no automatic growth from a new child',
 bay:0,depthM:.84,clearHeightM:2.28,extent:'one outermost bay of the existing balcony; other households and all original structure remain',
 uses:['fold-down work surface','household storage'],newBeds:0,
 access:{from:'existing A-F04 west household door',controller:'existing household',sharedRouteChange:'outermost balcony bay becomes private; central/other bay access remains through its own doors',hours:'household controlled'},
 support:{on:'existing concrete balcony slab',verification:'geometric footprint only; no structural-engineering certification'},
 laundry:{from:'west bay window working reach',to:'next balcony bay working reach',agreement:'authored shared timed drying slot; clothing line is not a navigation edge'},
 drainage:{from:'new sloped local canopy edge',to:'same-floor existing front downpipe',capacity:'unverified; no new wet fixture or assumed service capacity'},
 evidence:['Japanese 070652 passage/room change captions','SCMP reconstruction G04/G07 window, canopy and household relation'],
 sourceStatus:'relations observed; household, address, money, year and dimensions authored'
}];
export function compileHouseholdGrowth(floors,events=HOUSEHOLD_GROWTH,year=1988){
 const rows=floors.map(f=>({...f,growth:null})),ids=new Set();
 for(const e of events){
  if(ids.has(e.id))throw Error('duplicate growth event');ids.add(e.id);
  const f=rows.find(f=>f.id===e.floorId);if(!f)throw Error('unknown floor');
  if(f.growth)throw Error('one bounded frontage event per floor in this candidate');
  const bays=[0,1,3].includes(f.programmeCode)?2:3;
  if(!f.balcony||![0,bays-1].includes(e.bay))throw Error('requires existing edge balcony bay');
  if(!(e.depthM>.25&&e.depthM<=.84)||e.clearHeightM>f.height-.20)throw Error('addition exceeds existing slab/height envelope');
  if(e.year<f.year||e.year>year)throw Error('event chronology outside snapshot');
  const pitch=f.width/bays,centerX=f.cx-f.width/2+(e.bay+.5)*pitch,halfWidth=pitch*.43;
  f.growth={...e,centerX,halfWidth,areaM2:2*halfWidth*e.depthM,age:(year-e.year)/40};
 }
 return rows;
}
