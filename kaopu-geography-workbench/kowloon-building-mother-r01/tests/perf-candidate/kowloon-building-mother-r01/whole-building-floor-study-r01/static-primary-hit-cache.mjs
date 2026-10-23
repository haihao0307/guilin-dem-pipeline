/** Exact same-camera static ray-hit storage, not color or image reprojection.
 * Three RGBA32F attachments: hit, normal/instance, local/provenance.
 * Only complete GPU frames commit. All secondary rays remain uncached. */
export function staticPrimaryCacheKey({revision,generation,collectionIds,staticState,width,height,tileSize,cullTiles,source,design,clipDesign,coreOnly,visibleFloorIds,options:o}){
 return JSON.stringify([revision,generation,collectionIds,staticState,width,height,tileSize,cullTiles,source,design,clipDesign,coreOnly,visibleFloorIds,
  o.eye,o.target,o.fov,o.cut,o.clipNormal,o.clipOffset,o.sliceY??null,o.primitiveTileIndex!==false,o.apertureTileIndex!==false,o.pruneHitQueries!==false]);
}
export class StaticPrimaryHitCache{
 constructor(gl){this.gl=gl;this.target=null;this.validKey=null;this.pendingKey=null;this.objects=new WeakMap();this.nextId=0;this.failure=null;this.allocations=0;this.releases=0;}
 identity(value){if(!value)return 0;if(!this.objects.has(value))this.objects.set(value,++this.nextId);return this.objects.get(value);}
 release(){const g=this.gl;if(this.target){for(const t of this.target.textures)g.deleteTexture(t);g.deleteFramebuffer(this.target.fbo);this.releases++;}this.target=null;this.validKey=null;this.pendingKey=null;}
 invalidate(){this.validKey=null;this.pendingKey=null;}
 ensure(width,height){
  if(this.target?.width===width&&this.target?.height===height)return true;
  this.release();this.failure=null;const g=this.gl,b={width,height,textures:[],fbo:null,bytes:width*height*3*4*4};
  // Never misattribute an earlier failed model/dynamic upload to this optional cache.
  const prior=g.getError();if(prior!==g.NO_ERROR)throw Error('Pre-cache GL error '+prior);
  try{b.fbo=g.createFramebuffer();if(!b.fbo)throw Error('cache framebuffer unavailable');g.bindFramebuffer(g.FRAMEBUFFER,b.fbo);
   for(let i=0;i<3;i++){const t=g.createTexture();if(!t)throw Error('cache texture unavailable');b.textures.push(t);g.bindTexture(g.TEXTURE_2D,t);g.texImage2D(g.TEXTURE_2D,0,g.RGBA32F,width,height,0,g.RGBA,g.FLOAT,null);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.NEAREST);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,g.NEAREST);g.framebufferTexture2D(g.FRAMEBUFFER,g.COLOR_ATTACHMENT0+i,g.TEXTURE_2D,t,0);}
   g.drawBuffers([0,1,2].map(i=>g.COLOR_ATTACHMENT0+i));if(g.checkFramebufferStatus(g.FRAMEBUFFER)!==g.FRAMEBUFFER_COMPLETE)throw Error('cache Float32 MRT unavailable');
   const error=g.getError();if(error!==g.NO_ERROR)throw Object.assign(Error('cache allocation GL '+error),{glError:error});
   this.target=b;this.allocations++;return true;
  }catch(e){for(const t of b.textures)g.deleteTexture(t);if(b.fbo)g.deleteFramebuffer(b.fbo);this.failure=String(e.message);const pending=g.getError();if(e.glError&&e.glError!==g.OUT_OF_MEMORY||pending!==g.NO_ERROR&&pending!==g.OUT_OF_MEMORY)throw e;return false;}
 }
 begin({enabled,key,width,height}){
  const info={enabled:Boolean(enabled),reused:false,buildTiles:0,reuseTiles:0,copyOperations:0,bytes:this.target?.bytes??0,textures:this.target?.textures.length??0,fallback:null};
  if(!enabled)return info;
  if(!this.ensure(width,height)){info.enabled=false;info.fallback=this.failure;info.bytes=0;info.textures=0;return info;}
  info.bytes=this.target.bytes;info.textures=3;info.reused=this.validKey===key;
  if(!info.reused){this.validKey=null;this.pendingKey=key;}return info;
 }
 copyTile(src,tile){
  const g=this.gl,b=this.target;if(!b||!src||src===b)throw Error('Invalid immutable static cache copy');
  g.bindFramebuffer(g.READ_FRAMEBUFFER,src.fbo);g.bindFramebuffer(g.DRAW_FRAMEBUFFER,b.fbo);
  for(let i=0;i<3;i++){g.readBuffer(g.COLOR_ATTACHMENT0+i);g.drawBuffers([0,1,2].map(j=>j===i?g.COLOR_ATTACHMENT0+j:g.NONE));g.blitFramebuffer(tile.x,tile.y,tile.x+tile.width,tile.y+tile.height,tile.x,tile.y,tile.x+tile.width,tile.y+tile.height,g.COLOR_BUFFER_BIT,g.NEAREST);}
  g.drawBuffers([0,1,2].map(i=>g.COLOR_ATTACHMENT0+i));g.readBuffer(g.COLOR_ATTACHMENT0);
 }
 commit(key){if(this.target&&this.pendingKey===key){this.validKey=key;this.pendingKey=null;}}
 snapshot(){return{valid:Boolean(this.validKey),bytes:this.target?.bytes??0,textures:this.target?.textures.length??0,allocations:this.allocations,releases:this.releases,fallback:this.failure};}
}
