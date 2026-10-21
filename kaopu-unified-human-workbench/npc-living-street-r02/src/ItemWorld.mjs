/**
 * Physical objects for the R07 courtyard. Metres, Y-up, one native THREE runtime.
 *
 * A native weighted palm must meet the ACTUAL object surface before a finite
 * force Cannon LockConstraint is installed. The object remains dynamic during
 * transport. Elapsed time animates an attempt; it never proves acquisition.
 *
 * This is explicitly an assisted grasp, not a five-finger friction simulation.
 * Bread uses a conservative box collision hull and an ellipsoid visual/contact
 * surface. Eating verifies that real bread reaches a sampled native mouth;
 * the bite is a visual consumption transition, not teeth/digestion simulation.
 *
 * Call motionInput(state) before NativeMotion.update (spread its returned fields
 * LAST), then update(dt, reports). Only the caller commits returned receipts to
 * LifeSimulation. This module never changes inventory, currency or ownership.
 */
import * as CANNON from '../vendor/cannon-es.js';
import {STREET_LAYOUT} from './WorldLayout.mjs';

export const ITEM_PHYSICS = Object.freeze({
  version:'native-courtyard-items/1', bottleRadiusM:.032, bottleHeightM:.14,
  bottleMassKg:.035, breadHalfExtentsM:[.075,.035,.045], breadMassKg:.11,
  contactToleranceM:.012, maximumAllowedPalmPenetrationM:.004,
  transportToleranceM:.035, mouthSurfaceToleranceM:.025,
  minimumBottleLiftM:.24, assistedMaximumForceN:16,assistedMaximumTorqueNm:.512,
  fixedStepSeconds:1/120, solverIterations:18
});

const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const vec=p=>p?.toArray?p.toArray():Array.isArray(p)||ArrayBuffer.isView(p)?Array.from(p):p&&'x'in p?[p.x,p.y,p.z]:null;
const finite=p=>p?.length===3&&p.every(Number.isFinite);
const add=(a,b)=>a.map((v,i)=>v+b[i]);
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const scale=(a,k)=>a.map(v=>v*k);
const length=a=>Math.hypot(...a);
const distance=(a,b)=>length(sub(a,b));
const plain=a=>({x:a[0],y:a[1],z:a[2]});
const forward=state=>[Math.sin(state.yaw),0,Math.cos(state.yaw)];
const modes={collect:'pickup',buy:'trade',recycle:'trade',eat:'eat'};
const asCannon=a=>new CANNON.Vec3(...a);
const position=item=>item.body.position.toArray();
const clone=value=>JSON.parse(JSON.stringify(value));

/** Exact finite-cylinder signed distance in local object coordinates. */
export function cylinderSurfaceDistance(local,radius=.032,height=.14) {
  const radial=Math.hypot(local[0],local[2])-radius,axial=Math.abs(local[1])-height/2;
  return Math.hypot(Math.max(radial,0),Math.max(axial,0))+Math.min(Math.max(radial,axial),0);
}

/** Good metric distance near an ellipsoid's surface; exact on its principal axes. */
export function ellipsoidSurfaceDistance(local,half=ITEM_PHYSICS.breadHalfExtentsM) {
  const k0=Math.hypot(...local.map((v,i)=>v/half[i]));
  const k1=Math.hypot(...local.map((v,i)=>v/(half[i]*half[i])));
  return k1<1e-12?-Math.min(...half):k0*(k0-1)/k1;
}

export class ItemWorld {
  constructor({THREE,scene,sim,courtyard,actors=[]}={}) {
    if(!THREE?.Group||!scene?.add||!sim?.actors)throw Error('ItemWorld requires native THREE, scene and LifeSimulation');
    this.THREE=THREE;this.scene=scene;this.sim=sim;this.courtyard=courtyard;
    this.actors=actors instanceof Map?actors:new Map((Array.isArray(actors)?actors:Object.values(actors)).map(a=>[a.id,a]));
    this.group=new THREE.Group();this.group.name='native-courtyard-real-items';scene.add(this.group);
    this.materials={
      plastic:new THREE.MeshStandardMaterial({color:0xb4d3d4,roughness:.30,metalness:.03}),
      cap:new THREE.MeshStandardMaterial({color:0x456f79,roughness:.57}),
      label:new THREE.MeshStandardMaterial({color:0xe7e5d8,roughness:.85}),
      stripe:new THREE.MeshStandardMaterial({color:0x577568,roughness:.82}),
      crust:new THREE.MeshStandardMaterial({color:0xbb8249,roughness:.96}),
      cut:new THREE.MeshStandardMaterial({color:0xe6c499,roughness:1}),
      bag:new THREE.MeshStandardMaterial({color:0x88704c,roughness:.96}),
      bagDark:new THREE.MeshStandardMaterial({color:0x463f2d,roughness:1}),
      clasp:new THREE.MeshStandardMaterial({color:0xa79770,roughness:.59,metalness:.25})
    };
    this.reset();
  }

  reset() {
    if(this.world)for(const record of this.records.values())this._release(record);
    for(const child of [...this.group.children]) {
      this.group.remove(child);child.traverse(o=>{if(o.isMesh)o.geometry.dispose();});
    }
    this.world=new CANNON.World({gravity:new CANNON.Vec3(0,-9.81,0),allowSleep:true});
    this.world.solver.iterations=ITEM_PHYSICS.solverIterations;this.world.solver.tolerance=1e-8;
    this.world.defaultContactMaterial.friction=.57;this.world.defaultContactMaterial.restitution=.025;
    this.world.broadphase=new CANNON.NaiveBroadphase();
    this.items=new Map();this.records=new Map();this.reports=new Map();this.bags=new Map();this.history=[];
    this.clock=0;this.serial=0;this.runSequence=this.sim.runSequence;
    this.metrics={physicalSteps:0,physicalSubsteps:0,maximumSubstepSeconds:0,actualGrasps:0,verifiedBottleLifts:0,receipts:0,failedAttempts:0,
      maximumObservedConstraintErrorM:0,maximumObservedPalmPenetrationM:0,
      maximumConstraintForceN:0,maximumConstraintTorqueNm:0,
      successes:{collect:0,buy:0,recycle:0,eat:0}};
    this._boxFixture('paving',STREET_LAYOUT.floor.center,STREET_LAYOUT.floor.size);
    for(const c of this.courtyard?.colliders||[]) {
      if(c.min&&c.max) {
        this._boxFixture(c.id,c.min.map((v,i)=>(v+c.max[i])/2),c.min.map((v,i)=>c.max[i]-v));
      } else if(c.center&&c.radius&&c.height) {
        const body=new CANNON.Body({mass:0,shape:new CANNON.Cylinder(c.radius,c.radius,c.height,16)});
        body.position.set(...c.center);body._itemFixture=c.id;this.world.addBody(body);
      }
    }
    // This tray is real authored Courtyard geometry, whose general counter AABB
    // does not include its extra .038 m height.
    if(this.courtyard?.shop)this._boxFixture('bakery-tray',[3.31,.969,-.75],[1.44,.038,.44]);
    // A real, visible raised serving board bridges the old tray and the front
    // edge. It prevents a front loaf starting partly inside the older tray.
    this._boxFixture('bakery-serving-board',[3.71,.975,-.495],[1.12,.05,.21]);
    this._mesh(new this.THREE.BoxGeometry(1.12,.05,.21),this.materials.bag,this.group,3.71,.975,-.495);
    for(const state of this.sim.actors)this._makeBag(state);
    for(const b of this.sim.bottles)if(b.state!=='removed')this._makeBottle(b);
    this._makeShopStock(this.sim.shop.stock);
    this._syncLogical();this._syncVisuals(0);return this;
  }

  _boxFixture(id,center,size) {
    const body=new CANNON.Body({mass:0,shape:new CANNON.Box(new CANNON.Vec3(...size.map(v=>Math.max(.002,v/2))))});
    body.position.set(...center);body._itemFixture=id;this.world.addBody(body);return body;
  }

  _mesh(geometry,material,parent,x=0,y=0,z=0) {
    const mesh=new this.THREE.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
  }

  _bottleMesh(id) {
    const T=this.THREE,g=new T.Group();g.name='physical-'+id;
    this._mesh(new T.CylinderGeometry(.031,.032,.110,16),this.materials.plastic,g,0,-.015,0);
    this._mesh(new T.CylinderGeometry(.013,.031,.016,16),this.materials.plastic,g,0,.048,0);
    this._mesh(new T.CylinderGeometry(.013,.013,.008,12),this.materials.plastic,g,0,.060,0);
    this._mesh(new T.CylinderGeometry(.014,.014,.006,12),this.materials.cap,g,0,.067,0);
    this._mesh(new T.CylinderGeometry(.0324,.0324,.042,16),this.materials.label,g,0,-.012,0);
    this._mesh(new T.CylinderGeometry(.0326,.0326,.006,16),this.materials.stripe,g,0,-.013,0);
    return g;
  }

  _breadMesh(id) {
    const T=this.THREE,g=new T.Group();g.name='physical-'+id;
    const loaf=this._mesh(new T.SphereGeometry(1,24,14),this.materials.crust,g);
    loaf.scale.set(...ITEM_PHYSICS.breadHalfExtentsM);
    const h=ITEM_PHYSICS.breadHalfExtentsM;
    for(const x of [-h[0]*.45,0,h[0]*.45]) {
      const y=h[1]*Math.sqrt(1-(x/h[0])**2);
      const cut=this._mesh(new T.BoxGeometry(.004,.001,h[2]*.70),this.materials.cut,g,x,y-.0005,0);
      cut.rotation.y=-.30;
    }
    return g;
  }

  _newItem({id,kind,at,mode,owner=null,logicalId=null}) {
    const isBottle=kind==='bottle',shape=isBottle?new CANNON.Cylinder(.032,.032,.14,16):new CANNON.Box(new CANNON.Vec3(...ITEM_PHYSICS.breadHalfExtentsM));
    const body=new CANNON.Body({mass:isBottle?ITEM_PHYSICS.bottleMassKg:ITEM_PHYSICS.breadMassKg,shape,
      linearDamping:.24,angularDamping:.38,allowSleep:true,sleepSpeedLimit:.04,sleepTimeLimit:.5});
    body.position.set(...at);body.collisionFilterGroup=2;body.collisionFilterMask=3;
    body._itemId=id;this.world.addBody(body);
    const mesh=isBottle?this._bottleMesh(id):this._breadMesh(id);this.group.add(mesh);
    const item={id,logicalId,kind,body,mesh,mode,owner,createdAt:this.clock,heldBy:null,
      stockOrigin:mode==='shop'?at.slice():null,lastLogicalState:null,storedSince:null,
      lastProof:null,recoveryRequired:false};
    this.items.set(id,item);return item;
  }

  _makeBottle(b) {
    const item=this._newItem({id:b.id,logicalId:b.id,kind:'bottle',at:[b.x,.072,b.z],mode:b.state==='inventory'?'stored':b.state==='recycled'?'recycled':'ground',owner:b.owner});
    item.lastLogicalState=b.state;
    if(b.state==='inventory')this._store(item,this.sim.actor(b.owner),true);
    return item;
  }

  _makeShopStock(count) {
    const points=[[3.4,-.49],[3.75,-.49],[4.10,-.49],[3.40,-.79],[3.76,-.79],[2.98,-.79],[2.64,-.89],[4.16,-.89]];
    for(let i=0;i<count;i++) {
      const p=points[i%points.length],tray=p[1]<=-.56&&p[0]>=2.59&&p[0]<=4.03;
      this._newItem({id:'bread-stock-'+(++this.serial),kind:'bread',at:[p[0],(i<3?1:tray?.988:.95)+ITEM_PHYSICS.breadHalfExtentsM[1]+.002,p[1]],mode:'shop'});
    }
  }

  _makeBag(state) {
    const T=this.THREE,g=new T.Group();g.name='working-satchel-'+state.id;
    this._mesh(new T.BoxGeometry(.255,.13,.125),this.materials.bag,g,0,-.072,0);
    this._mesh(new T.BoxGeometry(.223,.008,.094),this.materials.bagDark,g,0,-.004,0);
    this._mesh(new T.BoxGeometry(.267,.012,.014),this.materials.bag,g,0,.005,.061);
    this._mesh(new T.BoxGeometry(.267,.012,.014),this.materials.bag,g,0,.005,-.061);
    this._mesh(new T.BoxGeometry(.014,.012,.126),this.materials.bag,g,-.126,.005,0);
    this._mesh(new T.BoxGeometry(.014,.012,.126),this.materials.bag,g,.126,.005,0);
    this._mesh(new T.BoxGeometry(.026,.024,.008),this.materials.clasp,g,0,-.057,.066);
    this.group.add(g);this.bags.set(state.id,g);
  }

  _bagPalm(state) {
    const actor=this.actors.get(state.id),tools=actor?.poseTools,rig=actor?.rig;
    if(tools&&rig) {
      const H=actor.binding.height,hip=rig.restP[rig.limbs.legR.a],p=[hip[0]-H*.073,hip[1]-H*.035,hip[2]-H*.014],m=rig.skinMatrices[rig.index.get('root')];
      return tools.toWorld([m[0]*p[0]+m[1]*p[1]+m[2]*p[2]+m[3],m[4]*p[0]+m[5]*p[1]+m[6]*p[2]+m[7],m[8]*p[0]+m[9]*p[1]+m[10]*p[2]+m[11]]).toArray();
    }
    // Only for a non-native numerical harness. Production supplies both actors.
    return [state.x-Math.cos(state.yaw)*.25,.92,state.z+Math.sin(state.yaw)*.25];
  }

  _storagePoint(item,state) {
    const bag=this._bagPalm(state),f=forward(state),right=[-Math.cos(state.yaw),0,Math.sin(state.yaw)];
    const ids=item.kind==='bottle'?state.inventory.bottles:[];
    const index=Math.max(0,ids.indexOf(item.logicalId)),slot=item.kind==='bottle'?(index-1)*.070:0;
    return add(add(bag,scale(f,item.kind==='bottle'?.032:ITEM_PHYSICS.breadHalfExtentsM[2])),add(scale(right,slot),[0,item.kind==='bottle'?.025:.032,0]));
  }

  _makeKinematic(item) {
    item.body.type=CANNON.Body.KINEMATIC;item.body.mass=0;item.body.updateMassProperties();
    item.body.collisionFilterGroup=0;item.body.collisionFilterMask=0;
    item.body.velocity.setZero();item.body.angularVelocity.setZero();item.body.wakeUp();
  }

  _makeDynamic(item) {
    item.body.type=CANNON.Body.DYNAMIC;item.body.mass=item.kind==='bottle'?ITEM_PHYSICS.bottleMassKg:ITEM_PHYSICS.breadMassKg;
    item.body.updateMassProperties();item.body.collisionFilterGroup=2;item.body.collisionFilterMask=3;item.body.wakeUp();
  }

  _store(item,state,initial=false) {
    if(!state)return;
    this._makeKinematic(item);item.mode='stored';item.owner=state.id;item.heldBy=null;item.storedSince=this.clock;
    item.storeFrom=position(item);item.storeQuaternion=item.body.quaternion.clone();
    if(initial){item.body.position.set(...this._storagePoint(item,state));item.storeFrom=position(item);}
  }

  _remove(item) {
    this.world.removeBody(item.body);this.group.remove(item.mesh);item.mesh.traverse(o=>{if(o.isMesh)o.geometry.dispose();});this.items.delete(item.id);
  }

  _syncLogical() {
    for(const state of this.sim.actors) {
      const record=this.records.get(state.id);
      if(record&&state.task?.token!==record.token)this._endRecord(record,state);
    }
    for(const b of this.sim.bottles) {
      let item=this.items.get(b.id);
      if(b.state==='removed'){if(item&&!item.heldBy)this._remove(item);continue;}
      if(!item)item=this._makeBottle(b);
      if(b.state==='inventory'&&item.lastLogicalState!=='inventory'&&!item.heldBy)this._store(item,this.sim.actor(b.owner));
      if(b.state==='recycled'){item.owner='recycling';if(!item.heldBy)item.mode='recycled';}
      item.lastLogicalState=b.state;
    }
    for(const state of this.sim.actors) {
      const owned=[...this.items.values()].filter(i=>i.kind==='bread'&&i.owner===state.id&&i.mode!=='consumed');
      // Import an explicitly supplied starting inventory; ordinary acquisition
      // reuses the exact physically transported shop loaf in _endRecord.
      for(let i=owned.length;i<state.inventory.bread;i++) {
        const item=this._newItem({id:'bread-inventory-'+(++this.serial),kind:'bread',at:this._bagPalm(state),mode:'stored',owner:state.id});
        item.provenance='explicit-starting-inventory';this._store(item,state,true);
      }
    }
  }

  _ensureReset() {if(this.runSequence!==this.sim.runSequence)this.reset();}

  _surfaceDistance(item,worldPoint) {
    const p=item.body.pointToLocalFrame(asCannon(worldPoint)).toArray();
    return item.kind==='bottle'?cylinderSurfaceDistance(p):ellipsoidSurfaceDistance(p);
  }

  _surfaceTowardActor(item,state) {
    // Select the real surface opposing the calibrated native palm normal.
    // The loaf uses its long-axis end; bottles keep the original forward grip.
    const turn=this.actors.get(state.id)?.graspProfiles?.[item.kind]?.shape?.contactYawRadians||0,
      d=scale(forward({yaw:state.yaw+turn}),-1);
    const local=item.body.vectorToLocalFrame(asCannon(d));
    let t;
    if(item.kind==='bottle')t=Math.min(.032/Math.max(1e-12,Math.hypot(local.x,local.z)),.07/Math.max(1e-12,Math.abs(local.y)));
    else {const h=ITEM_PHYSICS.breadHalfExtentsM;t=1/Math.hypot(local.x/h[0],local.y/h[1],local.z/h[2]);}
    return item.body.pointToWorldFrame(local.scale(t)).toArray();
  }

  _counterCenter(record,index=record.index) {
    const offsets=[0,.105,.210],top=this.courtyard?.recycle?.top??.85;
    return [-4.8+(offsets[index]??((index%5)-2)*.10),top+.073,-.445-Math.floor(index/3)*.09];
  }

  _newRecord(state) {
    const t=state.task;if(!t||t.phase!=='interact'||!modes[t.kind])return null;
    let items=[];
    if(t.kind==='collect') {const item=this.items.get(t.targetId);if(item)items=[item];}
    else if(t.kind==='buy') {
      const options=[...this.items.values()].filter(i=>i.kind==='bread'&&i.mode==='shop'&&!i.heldBy&&!i.reservedBy&&!i.recoveryRequired);
      options.sort((a,b)=>distance(position(a),[state.x,1,state.z])-distance(position(b),[state.x,1,state.z]));
      if(options[0]){items=[options[0]];items[0].reservedBy=state.id;}
    } else if(t.kind==='recycle')items=state.inventory.bottles.map(id=>this.items.get(id)).filter(Boolean);
    else if(t.kind==='eat') {
      const item=[...this.items.values()].find(i=>i.kind==='bread'&&i.owner===state.id&&i.mode!=='consumed'&&!i.heldBy);if(item)items=[item];
    }
    const record={actorId:state.id,token:t.token,kind:t.kind,items:items.map(i=>i.id),index:0,
      duration:t.duration||3,progress:0,age:0,stage:'reach',grasped:false,emitted:false,finished:false,
      initialBread:state.inventory.bread,initialBottles:state.inventory.bottles.slice(),
      contactEvidence:null,deliveries:[],failure:null,stableSamples:0,minimumContactErrorM:null,
      maximumLiftM:0,maximumConstraintErrorM:0,minimumMouthDistanceM:null,firstMouthAt:null,
      constraint:null,hand:null,handTarget:null,sourceTarget:null,sourceOffset:null,gripOffsetLocal:null};
    if(!items.length)record.failure=t.kind==='buy'?'柜台目前没有可取的面包，掉落品需要整理':'找不到与所有权一致的实物';
    this.records.set(state.id,record);this._beginCycle(record,state);return record;
  }

  _beginCycle(record,state) {
    record.progress=0;record.stage='reach';record.grasped=false;record.sourceTarget=null;
    record.contactEvidence=null;record.stableSamples=0;record.maximumLiftM=0;record.initialObjectPosition=null;
    const item=this.items.get(record.items[record.index]);
    if(item)record.sourceTarget=this._surfaceTowardActor(item,state);
  }

  _buyClearance(record,item,state) {
    if(record.buyClearance)return record.buyClearance;
    const half=ITEM_PHYSICS.breadHalfExtentsM,source=record.sourceTarget,
      hand=this.actors.get(state.id)?.graspProfiles?.bread?.sides?.R,
      outward=scale(forward(state),-1),fixtures=[];
    // Both paths propose PALM positions. Measure the complete physical hull
    // from that palm, including the off-centre long-axis end grip, instead of
    // treating the loaf's centre as its handle. This radius remains valid for
    // every yaw during transport and is frozen at the actual grasp.
    let propRadius=0,minPropY=Infinity;
    for(const x of [-half[0],half[0]])for(const y of [-half[1],half[1]])for(const z of [-half[2],half[2]]) {
      const v=item.body.pointToWorldFrame(new CANNON.Vec3(x,y,z));
      propRadius=Math.max(propRadius,Math.hypot(v.x-source[0],v.z-source[2]));
      minPropY=Math.min(minPropY,v.y-source[1]);
    }
    const radius=Math.max(propRadius,hand?.horizontalReachM||0);
    let top=-Infinity,exit=-Infinity;
    for(const body of this.world.bodies){
      if(!/^bakery-(counter|tray|serving-board)$/.test(body._itemFixture||''))continue;
      body.updateAABB();const lo=body.aabb.lowerBound,hi=body.aabb.upperBound;
      // The actual loaf and complete native hand must clear each nearby
      // authored surface before moving towards the person's bag.
      if(source[0]+radius<lo.x||source[0]-radius>hi.x)continue;
      fixtures.push({id:body._itemFixture,min:lo.toArray(),max:hi.toArray()});
      top=Math.max(top,hi.y);
      for(const x of [lo.x,hi.x])for(const z of [lo.z,hi.z])exit=Math.max(exit,x*outward[0]+z*outward[2]);
    }
    if(!fixtures.length)throw Error('Bread has no measured bakery collision surface');
    const minHandY=Number.isFinite(hand?.minimumYMFromBottleCenter)?hand.minimumYMFromBottleCenter:0,
      liftMarginM=.012,palmY=top+Math.max(-minPropY,-minHandY)+liftMarginM,
      travel=Math.max(0,exit+radius+liftMarginM-source[0]*outward[0]-source[2]*outward[2]);
    return {counterTopY:top,palmClearanceY:palmY,
      exitPoint:[record.sourceTarget[0]+outward[0]*travel,palmY,record.sourceTarget[2]+outward[2]*travel],
      breadHalfExtentsM:half.slice(),minimumHandYMFromPalm:minHandY,
      horizontalHandRadiusM:hand?.horizontalReachM||0,horizontalPropRadiusFromPalmM:propRadius,
      horizontalClearanceRadiusM:radius,minimumPropYMFromPalm:minPropY,liftMarginM,fixtures,
      source:'current Cannon fixture AABBs and this native hand\'s complete weighted grasp envelope'};
  }

  /** Inputs intentionally override task.progress: failed contact holds the pose. */
  motionInput(state) {
    this._ensureReset();this._syncLogical();
    if(!state.task||state.task.phase!=='interact'||!modes[state.task.kind])return {};
    let record=this.records.get(state.id);if(!record)record=this._newRecord(state);
    if(!record)return {};
    const item=this.items.get(record.items[record.index]);
    if(item&&!record.grasped&&record.stage==='reach')record.sourceTarget=this._surfaceTowardActor(item,state);
    const source=record.sourceTarget||[state.x,.8,state.z],
      graspShape=this.actors.get(state.id)?.graspProfiles?.[item?.kind]?.shape;
    let target=source,gripTarget=null;
    if(record.kind==='recycle') {
      const offset=record.gripOffsetWorld||scale(forward(state),.032);
      target=sub(this._counterCenter(record),offset);gripTarget=source;
    } else if(record.kind==='eat')gripTarget=source;
    return {mode:modes[record.kind],target:plain(target),gripTarget:gripTarget&&plain(gripTarget),
      progress:record.progress,grip:record.grasped?1:clamp((record.progress-.30)/.16),
      graspProfile:item?.kind||'bottle',
      objectGripYaw:graspShape?.contactYawRadians||0,
      ...(record.kind==='collect'?{pickupAttached:record.grasped&&!!record.constraint}:{}),
      ...(record.kind==='buy'&&item?{buyClearance:this._buyClearance(record,item,state)}:{}),
      ...(record.kind==='eat'?{mouthGripDepthM:(graspShape?.halfExtentsM?.[2]||ITEM_PHYSICS.breadHalfExtentsM[0])*2,mouthClearanceM:.012}:{})};
  }

  contactTarget(state) {return this.motionInput(state).target||null;}

  _reportedHandPose(report) {
    const p=vec(report.palm),n=vec(report.palmNormal)||[0,0,1];
    if(!finite(p)||!finite(n))throw Error('Native hand pose must be finite');
    const orientation=new CANNON.Quaternion();
    const axis=vec(report.handCylinderAxis),forwardHand=vec(report.handForward);
    if(finite(axis)&&finite(forwardHand)){
      const T=this.THREE,z=new T.Vector3(...n).normalize(),y=new T.Vector3(...axis);
      y.addScaledVector(z,-y.dot(z)).normalize();
      const x=new T.Vector3().crossVectors(y,z).normalize();
      if(!Number.isFinite(x.x)||x.lengthSq()<.99||y.lengthSq()<.99)throw Error('Degenerate native hand frame');
      const matrix=new T.Matrix4().makeBasis(x,y,z),q=new T.Quaternion().setFromRotationMatrix(matrix).normalize();
      orientation.set(q.x,q.y,q.z,q.w);
    }else orientation.setFromAxisAngle(new CANNON.Vec3(0,1,0),Math.atan2(n[0],n[2]));
    return {position:p,quaternion:orientation};
  }

  _grasp(record,item,report) {
    const palm=vec(report.palm),signed=this._surfaceDistance(item,palm);
    record.minimumContactErrorM=Math.min(record.minimumContactErrorM??Infinity,Math.abs(signed));
    this.metrics.maximumObservedPalmPenetrationM=Math.max(this.metrics.maximumObservedPalmPenetrationM,Math.max(0,-signed));
    if(!report.contactPhase||!report.contactReady||report.finite===false||report.poseValid===false||
      Math.abs(signed)>ITEM_PHYSICS.contactToleranceM||signed< -ITEM_PHYSICS.maximumAllowedPalmPenetrationM)return false;
    if(item.heldBy&&item.heldBy!==record.actorId)return false;
    if(record.kind==='buy')record.buyClearance=this._buyClearance(record,item,this.sim.actor(record.actorId));
    this._makeDynamic(item);
    const hand=new CANNON.Body({mass:0,type:CANNON.Body.KINEMATIC,collisionFilterGroup:0,collisionFilterMask:0});
    const initial=this._reportedHandPose(report);hand.position.set(...initial.position);hand.quaternion.copy(initial.quaternion);
    this.world.addBody(hand);
    const constraint=new CANNON.LockConstraint(hand,item.body,{maxForce:ITEM_PHYSICS.assistedMaximumForceN});
    constraint.collideConnected=false;this.world.addConstraint(constraint);
    record.hand=hand;record.handTarget=initial;record.constraint=constraint;record.grasped=true;record.stage='transport';
    record.initialObjectPosition=position(item);record.gripOffsetLocal=hand.pointToLocalFrame(item.body.position).toArray();
    record.gripOffsetWorld=sub(position(item),palm);record.initialBottomY=this._bottomY(item);
    record.contactEvidence={surfaceErrorM:Math.abs(signed),signedSurfaceDistanceM:signed,
      nativePalmTargetErrorM:report.contactErrorM,nativeBoneLengthErrorM:report.boneLengthErrorM,
      objectAt:position(item),palmAt:palm,at:this.clock,finiteForceLimitN:ITEM_PHYSICS.assistedMaximumForceN,
      finiteTorqueLimitNm:ITEM_PHYSICS.assistedMaximumTorqueNm};
    item.heldBy=record.actorId;item.mode='held';item.lastProof=record.contactEvidence;
    this.metrics.actualGrasps++;return true;
  }

  _release(record) {
    if(record.constraint)this.world.removeConstraint(record.constraint);
    if(record.hand)this.world.removeBody(record.hand);
    const item=this.items?.get(record.items?.[record.index]);if(item)item.heldBy=null;
    record.constraint=null;record.hand=null;record.handTarget=null;record.grasped=false;
  }

  _bottomY(item) {
    const q=item.body.quaternion;
    if(item.kind==='bottle') {
      const axis=q.vmult(new CANNON.Vec3(0,1,0));
      const extent=Math.abs(axis.y)*.07+.032*Math.sqrt(Math.max(0,1-axis.y*axis.y));return item.body.position.y-extent;
    }
    const ext=ITEM_PHYSICS.breadHalfExtentsM;
    const axes=[new CANNON.Vec3(1,0,0),new CANNON.Vec3(0,1,0),new CANNON.Vec3(0,0,1)];
    return item.body.position.y-axes.reduce((sum,a,i)=>sum+Math.abs(q.vmult(a).y)*ext[i],0);
  }

  _constraintError(record,item) {
    if(!record.hand||!record.gripOffsetLocal)return Infinity;
    const desired=record.hand.pointToWorldFrame(asCannon(record.gripOffsetLocal)).toArray();
    return distance(position(item),desired);
  }

  _counterSupport(item,record) {
    const top=this.courtyard?.recycle?.top??.85,p=position(item),target=this._counterCenter(record);
    const inside=Math.abs(p[0]-target[0])<.10&&p[2]<-.367&&p[2]>-.84;
    const contact=this.world.contacts.some(c=>(c.bi===item.body&&c.bj._itemFixture==='recycling-counter')||(c.bj===item.body&&c.bi._itemFixture==='recycling-counter'));
    return {ok:inside&&Math.abs(this._bottomY(item)-top)<.018&&item.body.velocity.length()<.14&&contact,
      actualCounterContact:contact,bottomY:this._bottomY(item),counterTopY:top,speedMps:item.body.velocity.length(),position:p};
  }

  _tickRecord(record,state,report,dt) {
    record.age+=dt;if(record.emitted||record.failure)return;
    const item=this.items.get(record.items[record.index]);if(!item){record.failure='执行中的实物已不存在';return;}
    if(!report||!finite(vec(report.palm)))return;
    if(report.finite===false){record.failure='原生动作出现无效数值，物品已经安全释放';this._release(record);return;}
    if(record.grasped&&report.poseValid===false){
      record.failure='原生动作超出关节或支撑范围，物品已经安全释放';
      record.poseFailure={poseValid:false,wristBendDegrees:report.wristBendDegrees??null,
        boneLengthErrorM:report.boneLengthErrorM??null,at:this.clock};
      this._release(record);return;
    }
    if(record.finished){
      // A completed physical attempt can wait for the logical task boundary.
      // Continue driving the actual hand through its last reported pose while
      // it still holds the object; never leave a hidden driver at the prior
      // progress sample as the displayed palm finishes moving.
      if(record.grasped)record.handTarget=this._reportedHandPose(report);
      return;
    }
    if(record.stage==='reach') {
      // Resume an interrupted transaction from bottles really staged on this
      // counter, with their ownership still intact until final atomic commit.
      if(record.kind==='recycle'&&item.mode==='owned-staged') {
        const support=this._counterSupport(item,record);
        if(support.ok){record.deliveries.push({itemId:item.id,resumedPhysicalDeposit:true,...support});this._nextRecycle(record,state);return;}
      }
      if(record.progress>=.30)this._grasp(record,item,report);
      if(!record.grasped)record.progress=Math.min(.48,record.progress+dt/Math.max(1.4,record.duration));
    }
    if(record.grasped) {
      record.handTarget=this._reportedHandPose(report);
      record.progress=Math.min(1,Math.max(.48,record.progress)+dt/Math.max(1.4,record.duration));
      const error=this._constraintError(record,item);
      record.maximumConstraintErrorM=Math.max(record.maximumConstraintErrorM,error);
      this.metrics.maximumObservedConstraintErrorM=Math.max(this.metrics.maximumObservedConstraintErrorM,error);
      const lift=item.body.position.y-record.initialObjectPosition[1];record.maximumLiftM=Math.max(record.maximumLiftM,lift);
    }
    if(record.age>24&&!record.finished)record.failure=record.grasped?'实物没有到达动作完成位置':'原生掌面未与实物形成有效接触';
  }

  _afterPhysics(record,state,report,dt) {
    if(record.emitted||record.failure||record.finished)return;
    const item=this.items.get(record.items[record.index]);if(!item||!report)return;
    if(record.stage==='settle') {
      const support=this._counterSupport(item,record);
      record.stableSamples=support.ok?record.stableSamples+1:0;
      if(record.stableSamples>=3) {
        item.mode='owned-staged';record.deliveries.push({itemId:item.id,contact:record.contactEvidence,
          maximumConstraintErrorM:record.maximumConstraintErrorM,verifiedAt:this.clock,...support});
        this._nextRecycle(record,state);
      }
      return;
    }
    if(!record.grasped||record.progress<.98||!report.completed||!finite(vec(report.completionTarget)))return;
    const error=this._constraintError(record,item),palm=vec(report.palm),end=vec(report.completionTarget);
    if(error>ITEM_PHYSICS.transportToleranceM||distance(palm,end)>.018)return;
    const common={contact:record.contactEvidence,physicalPosition:position(item),palmAtCompletion:palm,
      completionTarget:end,actualConstraintErrorM:error,maximumConstraintErrorM:record.maximumConstraintErrorM,
      nativeEndPoseReady:!!report.completed,checkedAt:this.clock};
    if(record.kind==='collect') {
      const lift=item.body.position.y-record.initialObjectPosition[1];
      const bag=vec(report.bagTarget),atBag=bag&&distance(palm,bag)<.020;
      if(lift<ITEM_PHYSICS.minimumBottleLiftM||this._bottomY(item)<.25||!atBag)return;
      record.finalEvidence={...common,itemId:item.id,liftM:lift,atActualBagM:distance(palm,bag)};
      this.metrics.verifiedBottleLifts++;record.finished=true;
    } else if(record.kind==='buy') {
      const bag=vec(report.bagTarget);if(!bag||distance(palm,bag)>.020)return;
      const moved=distance(position(item),record.initialObjectPosition);if(moved<.16)return;
      record.finalEvidence={...common,itemId:item.id,transportDistanceM:moved,atActualBagM:distance(palm,bag)};record.finished=true;
    } else if(record.kind==='recycle') {
      const center=this._counterCenter(record),destinationError=distance(position(item),center);
      if(destinationError>.035)return;
      this._release(record);item.mode='owned-staged';record.stage='settle';record.progress=1;record.stableSamples=0;
    } else if(record.kind==='eat') {
      const mouth=vec(report.mouthSurface);if(!finite(mouth))return;
      const mouthDistance=this._surfaceDistance(item,mouth);
      record.minimumMouthDistanceM=Math.min(record.minimumMouthDistanceM??Infinity,Math.abs(mouthDistance));
      if(mouthDistance<-.004||mouthDistance>ITEM_PHYSICS.mouthSurfaceToleranceM)return;
      record.stableSamples++;
      if(record.stableSamples<3)return;
      record.finalEvidence={...common,itemId:item.id,actualMouthSurface:mouth,breadToMouthSurfaceM:mouthDistance,
        verifiedMouthSamples:record.stableSamples,consumptionModel:'visible bite transition at actual native mouth; no teeth or digestion physics'};
      record.finished=true;
    }
  }

  _advancePhysics(dt){
    if(dt<=0)return;
    // The native pose is sampled at the simulation boundary. Drive its
    // kinematic palm continuously through every physical substep, including
    // angular velocity, instead of teleporting a zero-velocity constraint.
    // Only the driver is prescribed; each held object stays fully dynamic.
    const frames=[...this.records.values()].filter(r=>r.grasped&&r.hand&&r.handTarget).map(record=>({record,
      from:record.hand.position.clone(),qFrom:record.hand.quaternion.clone(),
      to:new CANNON.Vec3(...record.handTarget.position),qTo:record.handTarget.quaternion.clone()}));
    const count=Math.max(1,Math.ceil(dt/ITEM_PHYSICS.fixedStepSeconds-1e-9)),step=dt/count;
    this.metrics.maximumSubstepSeconds=Math.max(this.metrics.maximumSubstepSeconds,step);
    for(let i=0;i<count;i++){
      for(const frame of frames){
        const {record,from,to,qFrom,qTo}=frame,hand=record.hand;if(!hand||!record.constraint)continue;
        // This pinned Cannon GSSolver clamps accumulated lambda (impulse),
        // then reports multiplier=lambda/h. Convert N and N m to per-step
        // impulses; dividing each orthogonal axis by sqrt(3) also bounds the
        // vector norm instead of permitting sqrt(3) times the stated force.
        record.constraint.equations.forEach((equation,index)=>{
          const limit=(index<3?ITEM_PHYSICS.assistedMaximumForceN:ITEM_PHYSICS.assistedMaximumTorqueNm)*step/Math.sqrt(3);
          equation.minForce=-limit;equation.maxForce=limit;
        });
        const b=(i+1)/count,p1=new CANNON.Vec3(),q1=new CANNON.Quaternion();
        from.lerp(to,b,p1);qFrom.slerp(qTo,b,q1);
        // Read the actual integrated driver pose, then prescribe velocities
        // towards the next sample. Neither the hand nor the object is snapped
        // to a transform during transport.
        p1.vsub(hand.position,hand.velocity);hand.velocity.scale(1/step,hand.velocity);
        const rotation=q1.mult(hand.quaternion.conjugate());if(rotation.w<0){rotation.x*=-1;rotation.y*=-1;rotation.z*=-1;rotation.w*=-1;}
        const vectorLength=Math.hypot(rotation.x,rotation.y,rotation.z),angle=2*Math.atan2(vectorLength,rotation.w);
        if(vectorLength>1e-12)hand.angularVelocity.set(rotation.x*angle/(vectorLength*step),rotation.y*angle/(vectorLength*step),rotation.z*angle/(vectorLength*step));
        else hand.angularVelocity.setZero();
        hand.aabbNeedsUpdate=true;
      }
      this.world.step(step);this.metrics.physicalSubsteps++;
      for(const frame of frames){
        const record=frame.record,hand=record.hand,item=this.items.get(record.items[record.index]);
        if(!hand||!item||!record.constraint)continue;
        const reaction=record.constraint.equations.map(e=>e.multiplier||0);
        this.metrics.maximumConstraintForceN=Math.max(this.metrics.maximumConstraintForceN,Math.hypot(...reaction.slice(0,3)));
        this.metrics.maximumConstraintTorqueNm=Math.max(this.metrics.maximumConstraintTorqueNm,Math.hypot(...reaction.slice(3)));
        const error=this._constraintError(record,item),signed=this._surfaceDistance(item,hand.position.toArray());
        record.maximumConstraintErrorM=Math.max(record.maximumConstraintErrorM,error);
        this.metrics.maximumObservedConstraintErrorM=Math.max(this.metrics.maximumObservedConstraintErrorM,error);
        this.metrics.maximumObservedPalmPenetrationM=Math.max(this.metrics.maximumObservedPalmPenetrationM,Math.max(0,-signed));
        if(error>ITEM_PHYSICS.transportToleranceM||signed< -ITEM_PHYSICS.maximumAllowedPalmPenetrationM||Math.abs(signed)>ITEM_PHYSICS.contactToleranceM){
          record.failure='实际抓握超出接触范围，已释放实物';
          record.constraintFailure={errorM:error,signedPalmSurfaceDistanceM:signed,physicalSubstep:this.metrics.physicalSubsteps};
          this._release(record);
        }
      }
    }
    this.metrics.physicalSteps++;
  }

  _nextRecycle(record,state) {
    this._release(record);record.index++;
    if(record.index>=record.items.length) {
      record.index=Math.max(0,record.items.length-1);record.finished=true;record.stage='all-deposited';record.progress=1;
      record.finalEvidence={bottleIds:record.items.slice(),deliveries:record.deliveries.slice(),
        everyBottlePhysicallyOnCounter:record.deliveries.length===record.items.length,checkedAt:this.clock};
    } else this._beginCycle(record,state);
  }

  _endRecord(record,state) {
    const active=this.items.get(record.items[record.index]),wasHeld=!!record.constraint;
    this._release(record);
    const committed=record.kind==='collect'?this.sim.bottle(record.items[0])?.owner===state.id:
      record.kind==='buy'?state.inventory.bread>record.initialBread:
      record.kind==='eat'?state.inventory.bread<record.initialBread:
      record.items.every(id=>this.sim.bottle(id)?.state==='recycled');
    for(const id of record.items) {
      const item=this.items.get(id);if(!item)continue;item.reservedBy=null;item.heldBy=null;
      if(committed) {
        if(record.kind==='collect'||record.kind==='buy')this._store(item,state);
        else if(record.kind==='eat'){item.mode='consumed';item.consumedAt=this.clock;this._makeKinematic(item);}
        else {item.mode='recycled';item.owner='recycling';this._makeDynamic(item);}
      } else if(record.kind==='collect') {item.mode='ground';item.owner=null;this._makeDynamic(item);}
      else if(record.kind==='buy') {
        const moved=item.stockOrigin&&distance(position(item),item.stockOrigin)>.06;
        if(moved||wasHeld){item.mode='shop-recovery';item.recoveryRequired=true;this._makeDynamic(item);}
        else item.mode='shop';
      } else if(item===active&&(wasHeld||item.mode==='held')) {
        item.mode='owned-loose';item.owner=state.id;this._makeDynamic(item);
      }
    }
    this.history.push({actorId:record.actorId,token:record.token,kind:record.kind,committed,
      externalReceiptIssued:record.emitted,reason:record.failure||(!committed?'interrupted-or-rejected':null),at:this.clock,
      evidence:record.finalEvidence||null});if(this.history.length>40)this.history.shift();
    this.records.delete(record.actorId);
  }

  _syncVisuals(dt) {
    for(const state of this.sim.actors) {
      const bag=this.bags.get(state.id),p=add(this._bagPalm(state),scale(forward(state),.045));
      if(bag){bag.position.set(...p);bag.rotation.y=state.yaw;}
    }
    for(const item of [...this.items.values()]) {
      if(item.mode==='stored') {
        const state=this.sim.actor(item.owner);if(state) {
          const target=this._storagePoint(item,state),t=clamp((this.clock-item.storedSince)/.32);
          // A confirmed insertion settles visibly inside its bag. Stored items
          // are explicit kinematic cargo, never counted as a friction grasp.
          const p=item.storeFrom&&t<1?item.storeFrom.map((v,i)=>v+(target[i]-v)*t):target;
          item.body.position.set(...p);item.body.quaternion.setFromAxisAngle(new CANNON.Vec3(0,1,0),state.yaw);
        }
      } else if(item.mode==='consumed') {
        const t=clamp((this.clock-item.consumedAt)/.30);item.mesh.scale.setScalar(Math.max(.001,1-t));
        if(t>=1){this._remove(item);continue;}
      }
      item.mesh.position.copy(item.body.position);item.mesh.quaternion.copy(item.body.quaternion);
      const b=item.logicalId&&this.sim.bottle(item.logicalId);
      if(b?.state==='ground') {b.x=item.body.position.x;b.y=item.body.position.y;b.z=item.body.position.z;}
    }
    // Replace the six decorative stock meshes with six individually conserved
    // physical loaves. There is no seventh free display loaf.
    for(const mesh of this.courtyard?.shop?.bread||[])mesh.visible=false;
  }

  update(dt,motionReportsById={}) {
    if(!Number.isFinite(dt)||dt<0)throw Error('ItemWorld dt must be a nonnegative finite number');
    this._ensureReset();this._syncLogical();
    const reports=motionReportsById instanceof Map?motionReportsById:new Map(Object.entries(motionReportsById));
    this.reports=reports;const step=Math.min(dt,.20);this.clock+=step;
    for(const state of this.sim.actors) {
      let record=this.records.get(state.id);
      if(!record&&state.task?.phase==='interact'&&modes[state.task.kind])record=this._newRecord(state);
      if(record)this._tickRecord(record,state,reports.get(state.id),step);
    }
    this._syncVisuals(0);
    this._advancePhysics(step);
    const receipts=[];
    for(const state of this.sim.actors) {
      const record=this.records.get(state.id);if(!record)continue;
      this._afterPhysics(record,state,reports.get(state.id),step);
      if(record.emitted)continue;
      if(record.failure) {
        this._release(record);record.emitted=true;this.metrics.failedAttempts++;this.metrics.receipts++;
        receipts.push({id:state.id,token:record.token,success:false,reason:record.failure,evidence:{
          scope:'physical-executor-rejected',age:record.age,minimumSurfaceErrorM:record.minimumContactErrorM,
          maximumConstraintErrorM:record.maximumConstraintErrorM,constraintFailure:record.constraintFailure||null,
          poseFailure:record.poseFailure||null,objectIds:record.items.slice()}});
      } else if(record.finished&&state.task?.progress>=.98) {
        record.emitted=true;this.metrics.receipts++;this.metrics.successes[record.kind]++;
        receipts.push({id:state.id,token:record.token,success:true,evidence:{
          schema:ITEM_PHYSICS.version,kind:record.kind,assist:'finite-force Cannon LockConstraint',
          nativePalmRequired:true,physicalTransportRequired:true,clockOnlyCompletion:false,
          ...record.finalEvidence}});
      }
    }
    this._syncVisuals(step);return receipts;
  }

  snapshot() {
    return {schema:ITEM_PHYSICS.version,time:this.clock,runSequence:this.runSequence,constants:clone(ITEM_PHYSICS),
      metrics:clone(this.metrics),items:[...this.items.values()].map(item=>({id:item.id,logicalId:item.logicalId,kind:item.kind,
        mode:item.mode,owner:item.owner,heldBy:item.heldBy,position:position(item),quaternion:item.body.quaternion.toArray(),
        velocity:item.body.velocity.toArray(),dynamic:item.body.type===CANNON.Body.DYNAMIC,
        recoveryRequired:item.recoveryRequired,lastProof:item.lastProof})),
      actions:[...this.records.values()].map(r=>({actorId:r.actorId,token:r.token,kind:r.kind,stage:r.stage,progress:r.progress,
        age:r.age,objectIds:r.items.slice(),index:r.index,grasped:r.grasped,emitted:r.emitted,finished:r.finished,
        sourceTarget:r.sourceTarget,minimumContactErrorM:r.minimumContactErrorM,maximumLiftM:r.maximumLiftM,
        maximumConstraintErrorM:r.maximumConstraintErrorM,minimumMouthDistanceM:r.minimumMouthDistanceM,
        failure:r.failure,constraintFailure:r.constraintFailure||null,poseFailure:r.poseFailure||null,deliveries:r.deliveries.slice()})),history:clone(this.history),
      scope:{human:'complete native body; kinematic IK supplied by NativeMotion',
        grasp:'real palm-surface threshold, finite-force assisted rigid constraint; continuous linear/angular kinematic driving at substeps no larger than 1/120 s; no independent finger friction claim',
        bottles:'dynamic finite cylinders; contacts and actual transport measured',
        bread:'visible ellipsoid; conservative box collision hull; measured mouth approach and visual bite',
        inventory:'logical ownership belongs to LifeSimulation; bag storage explicitly kinematic',
        interruption:'released objects remain at actual positions; staged owned bottles retain ownership; dropped unsold bread needs recovery'}};
  }

  /** Read-only inspection of the current real actor, loaf and collision world.
   * This neither advances the simulation nor places a prop or a skeleton.
   */
  probeInteractionGeometry(actorId){
    const actor=this.actors.get(actorId),state=this.sim.actor(actorId),record=this.records.get(actorId),
      item=record&&this.items.get(record.items[record.index]);
    if(!actor?.diagnostics||!state)throw Error('Native geometry probe requires an actual actor');
    const fixtures=[];
    for(const body of this.world.bodies){
      if(!/^bakery-(counter|tray|serving-board)$/.test(body._itemFixture||''))continue;
      body.updateAABB();fixtures.push({id:body._itemFixture,min:body.aabb.lowerBound.toArray(),max:body.aabb.upperBound.toArray()});
    }
    const prop=item?{id:item.id,kind:item.kind,position:position(item),quaternion:item.body.quaternion.toArray(),
      ...(item.kind==='bread'?{halfExtentsM:ITEM_PHYSICS.breadHalfExtentsM.slice()}:{radius:ITEM_PHYSICS.bottleRadiusM,height:ITEM_PHYSICS.bottleHeightM})}:null;
    const native=actor.diagnostics({prop,fixtures:record?.kind==='buy'?fixtures:[]}),contacts=[];
    if(item)for(const contact of this.world.contacts){
      if(contact.bi!==item.body&&contact.bj!==item.body)continue;
      const other=contact.bi===item.body?contact.bj:contact.bi;if(!other._itemFixture)continue;
      const gap=contact.bj.position.vadd(contact.rj).vsub(contact.bi.position).vsub(contact.ri);
      contacts.push({fixture:other._itemFixture,signedGapM:contact.ni.dot(gap)});
    }
    return {schema:'native-actual-interaction-geometry/1',actor:actorId,time:this.clock,
      token:state.task?.token||null,kind:state.task?.kind||null,phase:state.task?.phase||null,
      progress:record?.progress??null,stage:record?.stage||null,grasped:!!record?.grasped,
      prop,native,contacts,actualMouthDistanceM:item?this._surfaceDistance(item,native.actualMouthSurface):null,
      mutation:false,scope:'current complete native display hand and lip support; current dynamic rigid object and original authored fixtures'};
  }

  dispose() {
    for(const record of this.records.values())this._release(record);
    for(const item of [...this.items.values()])this._remove(item);
    for(const bag of this.bags.values())bag.traverse(o=>{if(o.isMesh)o.geometry.dispose();});
    this.scene.remove(this.group);for(const m of Object.values(this.materials))m.dispose();
  }
}

export default ItemWorld;
