// Metres. Shared by the contact controller, traffic sweep and generated field.
export const LAYOUT=Object.freeze({floorTop:.028,railCenterY:.010,railHalfY:.022,railHalfZ:.055,railX:6.55,railHalfX:6.7,railOffsetZ:.46,wheelRadius:.16,wheelY:.192,junctionZ:9.75,beltX:.5,beltTop:1.305,dockX:12.6,pillar:[11.8,1.65,8.86],pillarHalf:[.16,1.65,.14],gateX:3.05,gateY:1.1,gateZ:[8.35,11.15],gateLength:1.9,gateRadius:.045,frontCrossZ:-27.2,rearCrossZ:33.5});
export const EQUIPMENT_SLOTS=Object.freeze(['R26-B01-L3-B',...Array.from({length:4},(_,n)=>Array.from({length:6},(_,c)=>`R27-B01-L${n+3}-A-C${c+1}`)).flat()]);
export const TRANSFER_ZONE=Object.freeze({id:'TRANSFER-CROSSING',center:[6.55,1.75,9.38],half:[7.05,1.75,1.88]});
export const RAIL_RULE=Object.freeze({riseM:.004,cargoBottomM:.625,pedestrianCertified:false,wheelCertified:false,policy:'Cargo-envelope clearance only. Pedestrians and wheeled carriers require an explicit approved crossing profile; no automatic access.'});
export function crossingAllowed(profile){return profile?.kind==='cargo-envelope'||(profile?.approved===true&&Number.isFinite(profile.maxStepM)&&profile.maxStepM>=RAIL_RULE.riseM);}
const box=(id,center,half)=>({id,center,half});
export function physicalObstacles(machine){const L=LAYOUT,sx=machine?.shuttle.q??L.beltX,g=machine?.gate?.q??Math.PI/2;
 const wy=machine?.lift.q??3.0,wz=machine?.reach.q??9.75,jaw=machine?.jaws.q??.37;
 const out=[box('MAIN-BELT',[.5,1.0875,3.5],[.65,.2175,27.5]),box('CRANK-DRIVE',[-23.15,1.45,-26],[1.6,.75,.18]),box('DRIVE-SHAFT',[-10.35,.82,-26],[10.85,.075,.075]),box('DRIVE-GEARBOX',[.5,.82,-26],[.32,.3,.32]),box('ARM-PILLAR',L.pillar,L.pillarHalf),box('ARM-FOOT',[11.8,.10,8.86],[.30,.08,.24]),box('ARM-CROSSHEAD-X',[12.2,3.25,8.86],[.56,.14,.16]),box('ARM-CROSSHEAD-Z',[12.6,3.25,9.305],[.16,.14,.605]),box('SHUTTLE',[sx,(.032+1.305+(machine?.fence.q??0))/2,9.75],[.64,(1.305+(machine?.fence.q??0)-.032)/2,.66])];
 out.push(box('ARM-GUIDE',[12.6,2.95,9.75],[.095,.35,.10]),box('ARM-SLIDE',[12.6,(3.2+wy)/2,9.75],[.060,(3.2-wy)/2+.08,.065]),box('ARM-WRIST',[12.6,wy,9.73],[.18,.10,.20]),box('ARM-REACH',[12.6,wy,(9.90+wz)/2],[.05,.04,(9.90-wz)/2]),box('ARM-JAW-BAR',[12.6,wy,wz],[jaw+.06,.035,.11]),box('SERVICE-RISER',[11.65,4.125,8.86],[.12,3.795,.12]),box('SERVICE-TRANSFER',[6.075,7.8,9.75],[5.695,.12,.12]));
 for(const sign of[-1,1])out.push(box('ARM-JAW-'+sign,[12.6+sign*jaw,wy-.18,wz],[.025,.18,.18]));
 for(const sign of[-1,1])out.push(box('FLOOR-RAIL-'+sign,[L.railX,L.railCenterY,L.junctionZ+sign*L.railOffsetZ],[L.railHalfX,L.railHalfY,L.railHalfZ]));
 out.push(box('RETURN-REAR',[23.25,.45,32],[22.75,.09,.09]),box('RETURN-TRANSFER',[6.075,.45,9.75],[5.575,.09,.09]),box('FRONT-PARTITION',[8,5,-28.3],[36.6,5,.2]));
 for(const z of L.gateZ){const dx=Math.cos(g)*L.gateLength,dy=Math.sin(g)*L.gateLength;out.push(box('GATE-'+z,[L.gateX+dx/2,L.gateY+dy/2,z],[Math.abs(dx)/2+L.gateRadius,Math.abs(dy)/2+L.gateRadius,L.gateRadius]));}
 return out;
}
