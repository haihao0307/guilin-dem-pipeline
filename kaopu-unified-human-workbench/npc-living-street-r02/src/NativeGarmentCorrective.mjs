/** Full-material wearer-rest pose corrective.
 * Reuses unchanged source distance/strainGuard/wrapped-dihedral formulae and
 * the original 16 + 12 constraint budget at h=1/240. This is a bounded local
 * kinematic solve, not a claim to run the source free-cloth time integrator.
 * All constraints are audited on the SAME final geometry after contact.
 */
import {createWearerRestSolver,createPositiveReferenceAttachments,auditGarmentMetric,expandGarmentDisplay} from './NativeGarmentMetric.mjs';
import {originalContactSamples,auditGarmentBody} from './NativeGarmentFit.mjs';

// Source audit margin stays 4 mm. This local planning guard supplies ten
// micrometres before waist anchors are frozen, and during later contact.
// It is deliberately reported separately, not claimed as a source parameter.
const H=1/240,MARGIN=.004,PLANNING_GUARD=.00001,LIMIT=.08,SOURCE_CONTACT_STEP=.008;
export class NativeGarmentCorrective{
  constructor(binding){
    this.binding=binding;this.metric=binding.metric;this.solver=createWearerRestSolver(this.metric);
    this.solver.p.set(this.metric.fittedNative);this.solver.initial.set(this.metric.fittedNative);
    this.attachments=createPositiveReferenceAttachments(this.metric);this.referenceLambda=new Float64Array(this.solver.p.length);
    this.samples=originalContactSamples(this.metric);this.vertexSamples=this.samples.filter(s=>s.kind==='vertex');
    this.previousReference=null;this.lastReport=null;
  }
  initializeNeutral(reference,normals){
    // Source material-physics performs contact initialization before selecting
    // its fixed waistband anchors. With an actual-native-body contact adapter,
    // do that bounded neutral solve while those same material sites still have
    // their physical mass; dynamic solve() never releases the waist anchors.
    const savedWeights=this.solver.w.slice();
    for(const id of this.solver.pins)this.solver.w[id]=1/Math.max(1e-7,this.solver.mass[id]);
    try{
      const result=this.solve(reference,normals,{warmStart:false});
      result.report.neutralInitialization={waistAnchorsFrozenAfterContact:true,temporarilyFreeSourceWaistSites:this.solver.pins.length,sourceOrder:'material-physics constructor: contact initialization before waistband pins'};
      return result;
    }finally{this.solver.w.set(savedWeights);}
  }
  attach(reference){
    const s=this.solver,p=s.p,L=this.referenceLambda,C=this.attachments.compliance;
    for(let i=0;i<s.count;i++){
      if(!s.w[i]){p.set(reference.subarray(i*3,i*3+3),i*3);continue;}
      const alpha=C[i]/(H*H),den=s.w[i]+alpha;
      for(let k=0;k<3;k++){const q=i*3+k,dl=(-(p[q]-reference[q])-alpha*L[q])/den;L[q]+=dl;p[q]+=s.w[i]*dl;}
    }
  }
  boundToReference(reference,metrics){
    const p=this.solver.p;for(let i=0;i<this.solver.count;i++){
      const k=i*3,x=p[k]-reference[k],y=p[k+1]-reference[k+1],z=p[k+2]-reference[k+2],l=Math.hypot(x,y,z);
      if(l>LIMIT){const s=LIMIT/l;p[k]=reference[k]+x*s;p[k+1]=reference[k+1]+y*s;p[k+2]=reference[k+2]+z*s;metrics.totalBoundClamps++;}
    }
  }
  projectContacts(reference,normals,dense,metrics){
    const p=this.solver.p,w=this.solver.w,samples=dense?this.samples:this.vertexSamples;
    for(const sample of samples){
      const point=[0,0,0],origin=[0,0,0],normal=[0,0,0];let inverse=0;
      for(let j=0;j<sample.ids.length;j++){
        const id=sample.ids[j],a=sample.weights[j];inverse+=w[id]*a*a;
        for(let k=0;k<3;k++){point[k]+=p[id*3+k]*a;origin[k]+=reference[id*3+k]*a;normal[k]+=normals[id*3+k]*a;}
      }
      if(inverse===0){metrics.fixedSamples++;continue;}
      const nl=Math.hypot(...normal);if(nl>0)for(let k=0;k<3;k++)normal[k]/=nl;
      const result=this.binding.contact.project(point,{eligibleFaces:this.binding.eligibleFaces,preferredNormal:nl?normal:null,referenceOrigin:origin,margin:MARGIN+PLANNING_GUARD,limit:LIMIT});
      this.onContact?.({phase:this.phase,sample,point,origin,normal,result});
      if(!result.delta){if(!result.resolved)metrics.unresolvedQueries++;continue;}
      // Original cloth-physics.contact caps one sample correction at 8 mm
      // before its unchanged inverse-mass barycentric distribution. The true
      // exterior endpoint remains the constraint target; an interior partial
      // step is not falsely certified as an exterior solution.
      const requestedLength=Math.hypot(...result.delta),step=requestedLength>SOURCE_CONTACT_STEP?result.delta.map(v=>v*SOURCE_CONTACT_STEP/requestedLength):result.delta;
      metrics.maximumRequestedContactM=Math.max(metrics.maximumRequestedContactM,requestedLength);
      if(requestedLength>SOURCE_CONTACT_STEP)metrics.sourceStepLimitedContacts++;
      const updates=[];let fraction=1;
      for(let j=0;j<sample.ids.length;j++){
        const id=sample.ids[j],factor=w[id]*sample.weights[j]/inverse,delta=step.map(x=>x*factor),d=[p[id*3]-reference[id*3],p[id*3+1]-reference[id*3+1],p[id*3+2]-reference[id*3+2]],a=delta.reduce((s,x)=>s+x*x,0),b=2*(d[0]*delta[0]+d[1]*delta[1]+d[2]*delta[2]),c=d.reduce((s,x)=>s+x*x,0)-LIMIT*LIMIT;
        if(a>0&&a+b+c>0){const discriminant=Math.max(0,b*b-4*a*c);fraction=Math.min(fraction,Math.max(0,(-b+Math.sqrt(discriminant))/(2*a)));}
        updates.push({id,delta});
      }
      for(const {id,delta} of updates)for(let k=0;k<3;k++)p[id*3+k]+=delta[k]*fraction;
      metrics.corrections++;if(sample.kind!=='vertex')metrics.interiorCorrections++;if(fraction<1)metrics.totalBoundClamps++;
    }
  }
  solve(reference,normals,{warmStart=true,onContact=null}={}){
    const t=performance.now(),s=this.solver,metric=this.metric,previous=s.p.slice();
    this.onContact=onContact;
    if(reference.length!==s.p.length||normals.length!==s.p.length)throw Error('GARMENT_POSE_REFERENCE_SIZE');
    if(warmStart&&this.previousReference)for(let i=0;i<s.p.length;i++)s.p[i]+=reference[i]-this.previousReference[i];else s.p.set(reference);
    const before=auditGarmentMetric(metric,s.p,{referenceNative:reference}),metrics={corrections:0,interiorCorrections:0,totalBoundClamps:0,unresolvedQueries:0,fixedSamples:0,sourceStepLimitedContacts:0,maximumRequestedContactM:0,materialMS:0,contactMS:0};
    this.referenceLambda.fill(0);for(const e of s.edges)e.lambda=0;for(const b of s.bends)b.lambda=0;
    const initialBodyMetrics={...this.binding.contact.metrics};
    for(let it=0;it<16;it++){
      this.phase='material/'+it;
      const a=performance.now();this.attach(reference);for(const e of s.edges)s.distance(e,H);if(it%2===0)for(const b of s.bends)s.bending(b,H);s.strainGuard();this.boundToReference(reference,metrics);metrics.materialMS+=performance.now()-a;
      const b=performance.now();this.projectContacts(reference,normals,it===15,metrics);metrics.contactMS+=performance.now()-b;
    }
    for(let it=0;it<12;it++){
      this.phase='guard/'+it;
      const a=performance.now();s.strainGuard();this.boundToReference(reference,metrics);metrics.materialMS+=performance.now()-a;
      const b=performance.now();this.projectContacts(reference,normals,it===11,metrics);metrics.contactMS+=performance.now()-b;
    }
    this.phase='final';const last=performance.now();this.projectContacts(reference,normals,false,metrics);metrics.contactMS+=performance.now()-last;
    const p=s.p.slice(),after=auditGarmentMetric(metric,p,{referenceNative:reference}),contact=auditGarmentBody(this.binding,p),finite=Array.from(p).every(Number.isFinite),
      numericallyEligible=finite&&after.maxWearerEdgeRatio<=1.45&&after.maxReferenceMoveM<=LIMIT+1e-10&&contact.inside===0&&contact.clearanceDeficits===0;
    const queryDelta={};for(const key of Object.keys(this.binding.contact.metrics))queryDelta[key]=this.binding.contact.metrics[key]-(initialBodyMetrics[key]??0);
    const report={schema:'native-wearer-rest-pose-corrective/1',model:'original full sewn source distance and wrapped dihedral + positive reference attachment + actual-body contact',
      sourceFreeClothIntegrator:false,sourcePaperMetricCertified:false,hSeconds:H,materialIterations:16,guardIterations:12,
      marginM:MARGIN,sourceAuditMarginM:MARGIN,localPlanningGuardM:PLANNING_GUARD,planningContactMarginM:MARGIN+PLANNING_GUARD,
      sourcePerSampleContactStepM:SOURCE_CONTACT_STEP,totalMaterialDisplacementLimitM:LIMIT,originalDisplayTopologyRetained:true,
      before,after,contact,metrics,queryDelta,elapsedMS:performance.now()-t,numericallyEligible,visualAccepted:false,productionReady:false,
      activeFeaturePolicy:'current material sample only; no historical exterior tangent planes or contact multipliers are accumulated'};
    // A rejected proposal remains available in the result for exact diagnostic
    // rendering, but does not silently replace the last material state.
    if(numericallyEligible)this.previousReference=Float64Array.from(reference);else s.p.set(previous);
    this.lastReport=report;return {positions:p,display:expandGarmentDisplay(metric,p),report};
  }
}
