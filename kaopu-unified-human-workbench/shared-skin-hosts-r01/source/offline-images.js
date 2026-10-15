(()=>{'use strict';if(!parent.__SKIN_OFFLINE_IMAGE_URL__)return;window.__SKIN_OFFLINE_IMAGE_URL__=parent.__SKIN_OFFLINE_IMAGE_URL__;
 const convert=value=>{try{return parent.__SKIN_OFFLINE_IMAGE_URL__(new URL(String(value),document.baseURI).href)||value;}catch{return value;}};
 const property=Object.getOwnPropertyDescriptor(Element.prototype,'innerHTML');
 Object.defineProperty(Element.prototype,'innerHTML',{...property,set(value){const text=String(value).replace(/(<img\b[^>]*\bsrc\s*=\s*)(["'])(.*?)\2/gi,(_,prefix,quote,src)=>prefix+quote+convert(src)+quote);property.set.call(this,text);}});
 const set=Element.prototype.setAttribute;Element.prototype.setAttribute=function(name,value){if(this instanceof HTMLImageElement&&String(name).toLowerCase()==='src')value=convert(value);return set.call(this,name,value);};
})();
