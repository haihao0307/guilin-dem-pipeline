/** One independent invocation per scheduling row. This consumes the ACTUAL
 * uploaded index texture, preserving corrupt-upload fallback, without inlining
 * metadata validation/list verification in every geometry-fragment program.
 * No geometry, field queries, primitive order or material/optical work changes.
 */
import {buildPrimaryTileAssemblyGLSL,PRIMARY_TILE_INDEX_GLSL} from './primary-tile-index.mjs';
import {buildPrimaryTileAperturesGLSL,PRIMARY_APERTURE_INDEX_GLSL} from './primary-aperture-index.mjs';
export const TILE_VALIDATION_GLSL=`#version 300 es
precision highp float;precision highp int;
uniform highp sampler2D uIndex;uniform int uMagic,uToken,uRows;out vec4 outRange;
vec4 record(int n){int w=textureSize(uIndex,0).x;return texelFetch(uIndex,ivec2(n%w,n/w),0);}
bool integer(float v,float lo,float hi){return v>=lo&&v<=hi&&floor(v)==v;}
void main(){outRange=vec4(-1.,-1.,-1.,float(uToken));int row=int(gl_FragCoord.x)+1;if(row<1||row>uRows)return;
 ivec2 size=textureSize(uIndex,0);int capacity=size.x*size.y;if(capacity<2)return;
 vec4 head=record(0);float token=float(uToken);if(head.x!=float(uMagic)||head.y!=token||!integer(token,1.,16777215.)||!integer(head.z,1.,float(capacity-1))||!integer(head.w,head.z+1.,float(capacity))||row>int(head.z))return;
 vec4 range=record(row);if(!integer(range.z,1.,256.)||range.w!=token||!integer(range.x,head.z+1.,head.w)||!integer(range.y,0.,range.z)||range.x+range.y>head.w)return;
 int start=int(range.x),count=int(range.y),primitiveCount=int(range.z);if(count==primitiveCount)return;
 int previous=-1;for(int j=0;j<count;j++){float encoded=record(start+j).x;if(!integer(encoded,1.,float(primitiveCount)))return;int k=int(encoded)-1;if(k<=previous)return;previous=k;}
 outRange=range;
}
`;
const ASSEMBLY=`
uniform highp sampler2D uPrimaryTileIndex,uValidatedAssemblyIndex;
uniform bool uPrimaryTileIndexEnabled;
uniform int uPrimaryTileIndexToken;
uniform ivec4 uPrimaryTileIndexRows[8];
int floorPrimaryCandidateInstance=-1;
vec4 floorPrimaryIndexRecord(int record){int width=textureSize(uPrimaryTileIndex,0).x;return texelFetch(uPrimaryTileIndex,ivec2(record%width,record/width),0);}
ivec2 floorPrimaryCandidateRange(int primitiveCount){
 if(!uPrimaryTileIndexEnabled||floorPrimaryCandidateInstance<0||floorPrimaryCandidateInstance>=32)return ivec2(-1,primitiveCount);
 int row=uPrimaryTileIndexRows[floorPrimaryCandidateInstance/4][floorPrimaryCandidateInstance%4];
 if(row<1||row>textureSize(uValidatedAssemblyIndex,0).x)return ivec2(-1,primitiveCount);
 vec4 range=texelFetch(uValidatedAssemblyIndex,ivec2(row-1,0),0);
 if(range.x<0.||range.z!=float(primitiveCount)||range.w!=float(uPrimaryTileIndexToken))return ivec2(-1,primitiveCount);
 return ivec2(range.xy);
}
`;
const APERTURE=`
uniform highp sampler2D uPrimaryApertureIndex,uValidatedApertureIndex;
uniform bool uPrimaryApertureIndexEnabled;
uniform int uPrimaryApertureIndexToken,uPrimaryApertureIndexRow;
bool floorPrimaryApertureRay=false;
vec4 floorApertureIndexRecord(int record){int width=textureSize(uPrimaryApertureIndex,0).x;return texelFetch(uPrimaryApertureIndex,ivec2(record%width,record/width),0);}
ivec2 floorApertureCandidateRange(int primitiveCount){
 if(!uPrimaryApertureIndexEnabled||!floorPrimaryApertureRay)return ivec2(-1,primitiveCount);
 int row=uPrimaryApertureIndexRow;if(row<1||row>textureSize(uValidatedApertureIndex,0).x)return ivec2(-1,primitiveCount);
 vec4 range=texelFetch(uValidatedApertureIndex,ivec2(row-1,0),0);
 if(range.x<0.||range.z!=float(primitiveCount)||range.w!=float(uPrimaryApertureIndexToken))return ivec2(-1,primitiveCount);
 return ivec2(range.xy);
}
`;
function replaceHeader(source,old,replacement){if(!source.startsWith(old)||source.split(old).length!==2)throw Error('Frozen scheduling header drift');return replacement+source.slice(old.length);}
export function buildValidatedAssemblyGLSL(spec){return replaceHeader(buildPrimaryTileAssemblyGLSL(spec),PRIMARY_TILE_INDEX_GLSL,ASSEMBLY);}
export function buildValidatedApertureGLSL(input){return replaceHeader(buildPrimaryTileAperturesGLSL(input),PRIMARY_APERTURE_INDEX_GLSL,APERTURE);}
export const VALIDATED_RANGE_HEADERS={assembly:ASSEMBLY,aperture:APERTURE};
