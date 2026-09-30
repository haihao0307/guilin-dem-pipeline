'use strict';
importScripts('r03-core.js?v=20261001r03');
onmessage=e=>{const {seq,score,progress,quality}=e.data;try{const t=performance.now(),data=CoralCore.generate(score),g=CoralCore.geometry(data,progress,quality);postMessage({seq,geometry:g,ms:performance.now()-t},[g.surface.buffer,g.lines.buffer]);}catch(err){postMessage({seq,error:String(err.message||err)});}};
