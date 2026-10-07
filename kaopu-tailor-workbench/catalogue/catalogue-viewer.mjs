import {Viewer} from '../unified/viewer.mjs';
// Defer canvas buffer sizing outside the ResizeObserver delivery cycle.
// Rendering, geometry, materials and all physics stay in the existing viewer.
export class CatalogueViewer extends Viewer{
 resize(){if(this.disposed||this.resizeRAF)return;this.resizeRAF=requestAnimationFrame(()=>{this.resizeRAF=0;if(this.disposed||!this.renderer)return;const box=this.container.getBoundingClientRect(),size=[Math.round(box.width),Math.round(box.height)];if(size[0]<=0||size[1]<=0)return;if(this.lastSize?.[0]===size[0]&&this.lastSize?.[1]===size[1])return;this.lastSize=size;super.resize();});}
 dispose(){cancelAnimationFrame(this.resizeRAF);this.resizeRAF=0;this.lastSize=null;return super.dispose();}
}
