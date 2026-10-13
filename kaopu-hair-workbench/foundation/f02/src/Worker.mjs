import {prepare,domain,summary,validate} from './BoundaryKernel.mjs';
let state,head;
self.onmessage=e=>{const{id,type,settings}=e.data;try{const r=validate(settings),t=performance.now();if(type==='init'){head=e.data.head;state=prepare(head,r);}else{state={...state,domain:domain(head,r),settings:r};state.summary=summary(state.roots,state.domain,r);}self.postMessage({id,...state,buildMS:performance.now()-t});}catch(e){self.postMessage({id,error:String(e.stack||e)});}};
