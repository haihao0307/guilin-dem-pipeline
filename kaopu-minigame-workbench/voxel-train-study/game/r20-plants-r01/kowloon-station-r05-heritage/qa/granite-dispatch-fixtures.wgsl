
fn dispatchReset(){stationCandidates.count=0u;stationCandidateOverflow=false;stationRawCandidateCount=0u;stationCandidateUpper=10000.;stationGraniteSlot=STATION_CANDIDATE_CAPACITY;stationGraniteDistance=10000.;}
fn dispatchFixture(p:vec3<f32>,index:u32)->u32{
 dispatchReset();let ds=array<f32,8>(-.046,-.045,-.0449,-.0001,0.,.0001,.0449,.045);let d=ds[index%8u];let q=p-vec3<f32>(24.,0.,4.);
 let granite=HitField(d,2u,q,171.,d,vec3<f32>(4.8,23.,4.8),f32(index));
 let near=HitField(.012,0u,q,0.,.012,vec3<f32>(1.),1.);
 let oldStone=HitField(.019,2u,q,186.,.019,vec3<f32>(1.),2.);
 if(index<24u){
  let order=index/8u;if(order==0u){recordGraniteCandidate(granite,p);}recordCandidate(near);if(order==1u){recordGraniteCandidate(granite,p);}recordCandidate(oldStone);if(order==2u){recordGraniteCandidate(granite,p);}return 3u;
 }
 if(index==24u){recordPart(p,-1.,0u,p,0.);recordGraniteCandidate(granite,p);return 2u;}
 if(index==25u){for(var i=0u;i<96u;i++){recordPart(p,0.,0u,p,0.);}recordGraniteCandidate(granite,p);return 97u;}
 if(index==26u){for(var i=0u;i<95u;i++){recordPart(p,1.,0u,p,0.);}recordGraniteCandidate(granite,p);return 96u;}
 if(index==27u){recordGraniteCandidate(granite,p);for(var i=0u;i<96u;i++){recordPart(p,1.,0u,p,0.);}return 97u;}
 if(index==28u){recordGraniteCandidate(granite,p);dispatchReset();recordPart(p,.2,0u,p,0.);return 1u;}
 if(index==29u){recordGraniteCandidate(granite,p);recordPart(p,-1.,0u,p,0.);return 2u;}
 if(index==30u){recordPart(p,.003,8u,p,187.);recordGraniteCandidate(granite,p);return 2u;}
 let exact=referenceCPhysicalDistance(granite,p,resolveStationState(p));recordPart(p,exact,0u,p,0.);recordGraniteCandidate(granite,p);return 2u;
}
fn dispatchBitDifference(a:vec4<f32>,b:vec4<f32>)->vec4<f32>{return select(vec4<f32>(0.),vec4<f32>(1.),bitcast<vec4<u32>>(a)!=bitcast<vec4<u32>>(b));}
fn dispatchProbe(p:vec3<f32>,index:u32,row:u32)->vec4<f32>{
 let expectedRaw=dispatchFixture(p,index);let actual=resolveCandidates(p);let reference=referenceCResolveCandidates(p);
 if(row==12u){return dispatchBitDifference(vec4<f32>(actual.d,f32(actual.id),actual.baseD,actual.seed),vec4<f32>(reference.d,f32(reference.id),reference.baseD,reference.seed));}
 if(row==13u){return dispatchBitDifference(vec4<f32>(actual.q,actual.sourceSeed),vec4<f32>(reference.q,reference.sourceSeed));}
 if(row==14u){return dispatchBitDifference(vec4<f32>(actual.extent,0.),vec4<f32>(reference.extent,0.));}
 return vec4<f32>(select(0.,1.,stationRawCandidateCount!=min(expectedRaw,96u)),select(0.,1.,stationCandidateOverflow!=(expectedRaw>96u)),select(0.,1.,stationGraniteSlot!=96u&&stationGraniteSlot>=stationCandidates.count),select(0.,1.,!all(abs(vec4<f32>(actual.d,actual.q))<vec4<f32>(1e30))));
}
