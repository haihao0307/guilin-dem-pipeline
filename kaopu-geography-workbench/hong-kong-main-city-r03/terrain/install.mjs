import {openCEDDTerrainIncrement} from './data/runtime/height-spectrum.mjs';
import * as clipModule from './clip-background-rects.js';
import * as seamModule from './close-terrain-seams.js';

export async function installCEDDTerrain({manifestURL=new URL('./data/manifest.json',import.meta.url),target=globalThis,fetchImpl=fetch}={}) {
  const source=await openCEDDTerrainIncrement(manifestURL,{fetchImpl});
  const clip=globalThis.HKBackgroundRectClip || clipModule.default;
  const seam=globalThis.HKTerrainSeamClosure || seamModule.default;
  if(!clip?.clipTerrainOutsideRects)throw Error('Terrain clipping runtime unavailable');
  if(!seam?.createTerrainSeamClosure)throw Error('Terrain seam-closure runtime unavailable');
  const rectangles=clip.rectanglesFromManifest(source.manifest);
  let appended=false,clipping=null,seamClosure=null;
  const overlaps=(a,b)=>Math.min(a[2],b[2])>Math.max(a[0],b[0])&&Math.min(a[3],b[3])>Math.max(a[1],b[1]);
  const api={
    manifest:source.manifest,
    appendAfterExisting(existing,HK){
      if(appended)throw Error('CEDD increment already appended');
      if(HK.origin[0]!==834000||HK.origin[1]!==827000)throw Error('CEDD map origin mismatch');
      for(const p of source.patches)for(const old of existing)if(overlaps(p.bounds_epsg2326,old.bounds_epsg2326))throw Error('CEDD increment overlaps protected old detail '+old.id);
      existing.push(...source.patches.map(p=>({...p,isCEDDIncrement:true})));appended=true;
    },
    clipBackground(positions,indices,grid){
      if(!appended)throw Error('Terrain patches not installed before clipping');
      const cache=clip.clipTerrainOutsideRects(positions,indices,rectangles);
      const closed=seam.createTerrainSeamClosure({patches:source.patches,backgroundPositions:positions,backgroundIndices:indices,grid});
      clipping={...cache.stats,sourceArraysUnmodified:true,cacheOnly:true,floatUpload:'Float32',outerDSMPlanesUnchanged:true};
      seamClosure={...closed.stats,role:'synthetic_display_seam_closure',measuredTerrain:false,retainingWall:false,sourceHeightsChanged:false,floorSamplerChanged:false};
      const vertices=new Float32Array(cache.positions.length+closed.positions.length);vertices.set(cache.positions);vertices.set(closed.positions,cache.positions.length);
      const outputIndices=new Uint32Array(cache.indices.length+closed.indices.length),offset=cache.positions.length/7;outputIndices.set(cache.indices);for(let i=0;i<closed.indices.length;i++)outputIndices[cache.indices.length+i]=closed.indices[i]+offset;
      return {positions:vertices,indices:outputIndices};
    },
    sampleHeight:source.sampleHeight,boundsCovered:source.boundsCovered,
    stats:()=>({ready:true,sceneIntegrated:appended,patches:source.patches.length,spacingM:2,nodes:source.patches.reduce((n,p)=>n+p.levels['2'].heights.length,0),decodedSourceNodesUnchanged:true,sourceVertical:'HKPD',displayVertical:'EGM2008_model',clipping,seamClosure,outerTransition:'no_height_blend; explicit_synthetic_vertical_display_closure',sourceBoundaryMaxDifferenceM:source.manifest.boundaryPolicy.externalBoundaryMaxAbsVsOldTriangleM,oldTerrainSourceModified:false,buildingHeightModified:false,foundationContactSurveyed:false})
  };
  target.HKCEDDTerrain=api;return api;
}

export function patchCEDDHost(html){
  const once=(a,b)=>{if(html.split(a).length!==2)throw Error('CEDD host anchor not unique: '+a.slice(0,70));html=html.replace(a,b);};
  once('\nfunction rectLocal(p)', '\nwindow.HKCEDDTerrain.appendAfterExisting(detailPatches,HK);\nfunction rectLocal(p)');
  once('function insideDetail(x,z){return detailPatches.some(p=>{','function insideDetail(x,z){return detailPatches.some(p=>{if(p.isCEDDIncrement)return false;');
  once("let l=p.levels[near?'2':'5'];", "let l=p.levels[near?'2':'5']||p.levels['2'];");
  once('const hkMeshData=hkMesh(hkV,hkI,7);','const hkClippedIncrement=window.HKCEDDTerrain.clipBackground(hkV,hkI,HK);const hkMeshData=hkMesh(hkClippedIncrement.positions,hkClippedIncrement.indices,7);');
  once('detailMetadata:detailSpec.metadata,','detailMetadata:{...detailSpec.metadata,incrementalCEDD:window.HKCEDDTerrain.manifest},');
  return html;
}
