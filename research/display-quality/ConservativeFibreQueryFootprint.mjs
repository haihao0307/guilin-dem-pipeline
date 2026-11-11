import {localFibreQueryShaders} from './LocalFibreQueries.mjs';

// Conservative dispatch footprint only. The six-sided support bounds, source
// fibre IDs, curve solver and optical calculation remain unchanged. The two
// screen triangles issue queries; they are not object surface geometry. The
// existing positive-near-depth test and BVH fallback remain in the caller.
export function rectangularFibreQueryShaders(...args){
 const base=localFibreQueryShaders(...args);let vertex=base.vertex;
 function change(from,to){if(vertex.split(from).length!==2)throw Error('Fibre footprint source changed');vertex=vertex.replace(from,to);}
 change('queryFibreId=uint(gl_VertexID);vec4 lowWord=boundsWord(gl_VertexID*2);gl_PointSize=1.;','int fibre=int(gl_InstanceID);queryFibreId=uint(fibre);vec4 lowWord=boundsWord(fibre*2);');
 change('hi=boundsWord(gl_VertexID*2+1).xyz;', 'hi=boundsWord(fibre*2+1).xyz;');
 change('vec2 middle=(low+high)*.5,span=high-low;gl_PointSize=ceil(max(span.x,span.y))+2.;gl_Position=vec4(middle/uSize*2.-1.,0.,1.);', 'vec2 pixel=mix(low,high,vec2(float(gl_VertexID&1),float((gl_VertexID>>1)&1)));gl_Position=vec4(pixel/uSize*2.-1.,0.,1.);');
 return{...base,vertex};
}
