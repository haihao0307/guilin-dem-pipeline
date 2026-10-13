import {contourShapes} from '../native/retained/branding/contours-injected.mjs';
import left from '../native/retained/branding/angel_left.mjs';
import right from '../native/retained/branding/angel_right.mjs';
export function addOwnedIdentity(T,M,parent,lettering,{width=2.6,at,side}){const recipe=side===1?left:right,shapes=contourShapes(T,recipe),scale=width/recipe.size_px[0]; // Scale the source flat contour once, then give it a new real 18mm solid depth.
 const g=new T.ExtrudeGeometry(shapes,{depth:.018/scale,bevelEnabled:false,curveSegments:1});g.scale(scale,scale,scale);g.translate(-width/2,width*recipe.size_px[1]/recipe.size_px[0]/2,0);const mesh=new T.Mesh(g,M.brass);mesh.name='保留自有飛行徽記 / 實體黃銅浮雕';mesh.applyMatrix4(lettering.sideMatrix(side,at));mesh.userData={sourceSha256:recipe.source_sha256,identityContoursUnchanged:true,extrusionM:.018,rasterTextures:0};parent.add(mesh);return mesh;}
