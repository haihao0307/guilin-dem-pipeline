// One authored station-area layout. Original streamed street ingredients stay
// unchanged; their entire root and terrain exclusion footprint move together.
export function stationDistrictSiting(score,{boardingTrackX=5,streetHalfWidthM=25,clearanceM=10}={}){
 const reservation=score?.site?.hotelReservation;if(!reservation||reservation.built)throw Error('Expected unbuilt hotel reservation');
 const hotelLandwardEdgeWorldZ=reservation.center[0]-reservation.halfExtent[0]-boardingTrackX;
 const offsetZ=hotelLandwardEdgeWorldZ-streetHalfWidthM-clearanceM;
 return Object.freeze({schema:'kaopu.fh88.station-siting/1',units:'metres',offset:Object.freeze([0,0,offsetZ]),hotelLandwardEdgeWorldZ,streetSeawardEdgeWorldZ:offsetZ+streetHalfWidthM,clearanceM,buildingsRemoved:0,detailParametersChanged:false});
}
export function applyStationDistrictSiting(world,score){
 const placement=stationDistrictSiting(score),street=world.streetDistrict;if(!street)throw Error('Retained street district missing');
 street.root.position.fromArray(placement.offset);
 const originalExclusions=street.exclusions.bind(street);street.exclusions=distance=>originalExclusions(distance).map(r=>({...r,minZ:r.minZ+placement.offset[2],maxZ:r.maxZ+placement.offset[2]}));
 street.proof.stationSiting=placement;return placement;
}
