// Exact elimination of completed ideal zero-width stitch equalities.
// Material identities, triangles, UVs and original per-particle masses survive.
// This is a solver variable map, never a geometric garment-shell generator.
export class StitchGroups {
 constructor(lab){this.lab=lab;this.parent=lab.positions.map((_,i)=>i);this.representatives=[...this.parent];this.groupCount=this.parent.length;this.equalities=0;}
 find(i){return this.parent[i]===i?i:this.parent[i]=this.find(this.parent[i]);}
 synchronize(){const l=this.lab;let changed=false;for(const c of l.seamConstraints){if(c.eliminated||l.elapsed-c.activatedAt<c.rampDuration)continue;const a=this.find(c.a),b=this.find(c.b);if(a===b){c.eliminated=true;continue;}const pa=l.positions[a],pb=l.positions[b],gap=Math.hypot(...pa.map((x,k)=>x-pb[k]));if(gap>.002)continue;this.parent[Math.max(a,b)]=Math.min(a,b);c.eliminated=true;this.equalities++;changed=true;}if(changed)this.rebuild();return changed;}
 rebuild(){const l=this.lab,groups=new Map();for(let i=0;i<this.parent.length;i++){const r=this.find(i);if(!groups.has(r))groups.set(r,[]);groups.get(r).push(i);}this.representatives=[...groups.keys()];this.groupCount=groups.size;this.groups=groups;
  for(const [root,ids]of groups){let mass=0;const p=[0,0,0],v=[0,0,0],pins=ids.filter(i=>l.pins.has(i));for(const i of ids){const m=1/l.baseInvMass[i];mass+=m;for(let k=0;k<3;k++){p[k]+=l.positions[i][k]*m;v[k]+=l.velocity[i][k]*m;}}for(let k=0;k<3;k++){p[k]=pins.length?pins.reduce((sum,i)=>sum+l.positions[i][k],0)/pins.length:p[k]/mass;v[k]/=mass;}for(const i of ids){l.positions[i]=p;l.velocity[i]=v;l.invMass[i]=pins.length?0:1/mass;}}
 }
 report(){return{mode:'ideal-zero-width-stitch equality elimination',materialParticles:this.parent.length,solverGroups:this.groupCount,mergedEqualities:this.equalities,restMetricChanged:false,materialIdsPreserved:true,totalMaterialMassKg:this.lab.baseInvMass.reduce((s,w)=>s+1/w,0),fixedSolverGroups:this.representatives.filter(i=>this.lab.invMass[i]===0).length};}
}
