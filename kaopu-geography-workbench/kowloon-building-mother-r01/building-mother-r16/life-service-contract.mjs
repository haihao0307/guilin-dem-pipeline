/** Semantic service ports, never invented pipe geometry or certified engineering.
 * Reuses actual emitted floor/room identities; one or many floors follow one loop.
 */
export const SERVICE_TYPES=Object.freeze(['water_supply','electricity','drainage']);
export function attachLifeServiceContract(recipe,source=null){
 const locations={
  lowrise:{street:'La Salle Road',number:'33',address:'香港九龍喇沙利道33號',source:'https://hk.centanet.com/estate/en/33-La-Salle-Road/2-UJFDFRSSRO'},
  kcc:{street:'Liberty Avenue',number:'2',address:'香港九龍自由道2號',source:'https://hkkcc.org.hk/about-kcc/introduction?lang=zh'},
  warehouse:{street:'Cheong Hang Road',number:'1',address:'香港紅磡暢行道1號',source:'https://sourcing.hktdc.com/en/Supplier-Store-Directory/China-Travel-Hip-Kee-Godown-Hong-Kong-Ltd/1X02QI7B'}
 };
 recipe.identity={objectId:recipe.buildingId,type:'building',recipeRevision:'R15',validFrom:null,validTo:null,observedAt:null,observationTimePolicy:'photo time separate from model validity; unknown remains null'};
 recipe.location={earth:'Earth',city:'Hong Kong',region:'Kowloon',...locations[recipe.caseId],georeference:source?.sourceGeoreference??null,longitudeLatitude:null,addressPointVerified:false,displayTranslationIsGeographic:false};
 recipe.neighbourhood={belongsTo:{city:'Hong Kong',region:'Kowloon',siteId:null},adjacentTo:[],eastNeighbour:null,validFrom:null,validTo:null,status:'unknown; side-by-side display is not a real neighbour relation'};
 recipe.sharedComponents={policy:'component type + parameters + host transform; one implementation reused, not one program per building',windowEmitter:'r07/apertures.mjs:deriveAperture and source-hosted-window.mjs',doorSystem:'deferred interface, no ordinary door leaf',buildingBatchTarget:7000,batchTargetEvidence:'user planning goal, not collected or generated buildings',actualCases:3};
 const g=recipe.graph,root=recipe.buildingId,ids=new Set(g.nodes.map(n=>n.id));
 const node=(id,type,props={})=>{if(ids.has(id))throw Error('Duplicate service port '+id);ids.add(id);g.nodes.push({id,type,...props});return id;};
 const own=(id,to)=>g.edges.push({from:id,to,type:'ownedBy',network:'ownership'});
 const occupancy=node(root+':occupancy','occupancy_use',{actualOccupants:null,actualCapacity:null,useEvidence:'building usage contract; room functions remain observed or explicitly authored'});own(occupancy,root);
 const entries=SERVICE_TYPES.map(service=>{const id=node(root+':service:'+service+':site-port','service_port',{service,position:null,connectionStatus:'unknown',network:'services',actualConnected:false});own(id,root);return{id,service};});
 const levels=[],demands=[];
 for(const f of recipe.circulation.floors){
  const ports=SERVICE_TYPES.map(service=>{const id=node(f.id+':service:'+service,'service_port',{service,position:null,connectionStatus:'unknown',actualConnected:false});own(id,f.id);g.edges.push({from:id,to:entries.find(x=>x.service===service).id,type:'requiresServiceConnection',network:'services',evidence:'required_interface_not_verified_pipe',enabled:false});return{id,service};});
  for(const room of f.rooms){g.edges.push({from:room,to:occupancy,type:'supportsOccupancyUse',network:'use',actualOccupantAssigned:false});demands.push({spaceId:room,floorId:f.id,servicePortCandidates:ports.map(p=>p.id),requiredServicesByActualRoomUse:'unknown_or_authored_room_use_not_surveyed',connected:false});}
  levels.push({floorId:f.id,ports});
 }
 recipe.occupancy={nodeId:occupancy,actualOccupants:null,actualCapacity:null,spaceIds:demands.map(d=>d.spaceId)};
 recipe.services={types:[...SERVICE_TYPES],sitePorts:entries,levels,demands,pipeGeometryGenerated:false,actualConnectivityVerified:false,hydraulicOrElectricalSimulation:false};
 recipe.lifePaths={order:['outside','building_entry','vertical_core_if_needed','corridor','room','balcony_if_evidenced'],balconyPolicy:'connect only an observed or named authored balcony; missing evidence is unknown, not an invented slab',localAccessValidation:recipe.validation,completeActualBuildingRouteVerified:false};
 for(const n of g.nodes){n.objectId??=n.id;n.validFrom??=null;n.validTo??=null;n.observedAt??=null;}
 const missingOwners=g.edges.filter(e=>e.network==='ownership'&&(!ids.has(e.from)||!ids.has(e.to)));if(missingOwners.length)throw Error('Orphan service interface');
 return recipe;
}
