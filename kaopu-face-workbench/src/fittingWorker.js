import {fitMultiPhoto} from './MultiPhotoFit.js';
self.onmessage=({data})=>{try{self.postMessage({id:data.id,result:fitMultiPhoto(data.model,data.frames)});}catch(e){self.postMessage({id:data.id,error:e.message});}};
