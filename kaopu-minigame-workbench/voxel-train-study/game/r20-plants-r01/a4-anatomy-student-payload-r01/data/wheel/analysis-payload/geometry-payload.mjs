/** Buffer reader for wheel nodes only; no teacher object/fields or original POSITION is accepted. */
import {decodeWheelPositions} from './position-bindings.mjs';
export const GEOMETRY_PAYLOAD_SCHEMA='a4-wheel-student-geometry/1';
const C={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array};
function field(bytes,record){if(!Number.isInteger(record.byteOffset)||!Number.isInteger(record.byteLength)||record.byteOffset<0||record.byteLength<0||record.byteOffset+record.byteLength>bytes.byteLength)throw Error('INVALID_FIELD_RANGE');const Type=C[record.componentType];if(!Type)throw Error('UNSUPPORTED_COMPONENT_TYPE');const b=bytes.slice(record.byteOffset,record.byteOffset+record.byteLength);if(b.byteLength!==record.byteLength)throw Error('TRUNCATED_STUDENT_FIELD');return new Type(b.buffer,b.byteOffset,b.byteLength/Type.BYTES_PER_ELEMENT);}
export function decodeWheelGeometryPayload(manifest,bytes) {
 if(manifest.schema!==GEOMETRY_PAYLOAD_SCHEMA||manifest.sourcePositionBufferRequired!==false)throw Error('UNSUPPORTED_STUDENT_GEOMETRY_SCHEMA');
 if(!(bytes instanceof Uint8Array)||bytes.byteLength!==manifest.byteLength)throw Error('STUDENT_BYTES_LENGTH_MISMATCH');
 const bindings=field(bytes,manifest.positionBindings),residual=field(bytes,manifest.residualPositions),positions=decodeWheelPositions(bindings,residual,manifest.positionLayout),nodes={};
 for(const node of manifest.nodes){const attributes={position:{array:positions[node.node],itemSize:3,componentType:5126}};for(const[name,record]of Object.entries(node.attributes)){if(name==='position'||name==='POSITION')throw Error('ORIGINAL_POSITION_FIELD_FORBIDDEN');attributes[name]={array:field(bytes,record),itemSize:record.itemSize,componentType:record.componentType};}nodes[node.node]={attributes,index:field(bytes,node.index),materialIndex:node.materialIndex};}
 return {nodes,sourcePositionBufferUsed:false,originalRetainedFields:['normal','uv','index'],positionLayout:manifest.positionLayout};
}
export function createWheelGeometries(T,decoded){const geometries={};for(const[node,data]of Object.entries(decoded.nodes)){const g=new T.BufferGeometry();for(const[name,a]of Object.entries(data.attributes))g.setAttribute(name,new T.BufferAttribute(a.array,a.itemSize));g.setIndex(new T.BufferAttribute(data.index,1));g.computeBoundingBox();g.computeBoundingSphere();g.userData={studentPositionBindings:true,sourcePositionBufferUsed:false,sourceMaterialIndex:data.materialIndex};geometries[node]=g;}return geometries;}
