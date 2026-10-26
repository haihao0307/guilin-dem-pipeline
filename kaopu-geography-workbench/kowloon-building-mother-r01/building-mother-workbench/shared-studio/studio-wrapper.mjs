import{buildStudioShade}from'./studio-shade.mjs';
export function withStudio(Base,originalShade,adapter){return class SharedStudioRenderer extends Base{
 setModel(model,source){super.setModel(model,source);this.studioAdapterState=null;if(!this.sharedStudioProgram)this.sharedStudioProgram=this.compile('shared-gray-two-light-visibility',buildStudioShade(originalShade,adapter.glsl));this.shadeProgram=this.sharedStudioProgram;}
 async render(options={}){if(this.busy)throw Error('GPU frame already in progress');options={...options,source:options.source??this.options.source,design:options.design??this.options.design};this.studioRenderOptions=options;adapter.prepare(this,this.model,this.measured,options);return super.render(options);}
 camera(program,w,h,options){const L=super.camera(program,w,h,options);if(program===this.sharedStudioProgram){const g=this.gl,b=this.model.bounds;g.uniform3fv(L('uStudioMin'),b.min);g.uniform3fv(L('uStudioMax'),b.max);g.uniform1i(L('uStudioClip'),this.studioRenderOptions?.clipDesign?1:0);g.uniform3fv(L('uStudioClipNormal'),options.clipNormal);g.uniform1f(L('uStudioClipOffset'),options.clipOffset);adapter.bind(this,program,L);}return L;}
};}
