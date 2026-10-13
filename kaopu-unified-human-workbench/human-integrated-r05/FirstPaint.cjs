const assert=require('node:assert/strict');
exports.adapt=function(app){const edit=(a,b)=>{assert.equal(app.split(a).length,2,'First-paint input drift: '+a);app=app.replace(a,()=>b);};
 app="import{firstState,portraitId,portraitFinish}from'../../human-integrated-r05/FirstPortrait.mjs';\n"+app;
 edit('const model=loaded.model;model.compute(defaultState());',"const model=loaded.model,r05First=!savedArchive&&pendingPreset==='r02-adult-male-sturdy';model.compute(r05First?firstState():defaultState());");
 edit('if(savedArchive)model.restore(savedArchive);',"if(r05First){portraitFinish(model,portraitId());model.r05FirstPortrait=portraitId();pendingPreset=null;}if(savedArchive)model.restore(savedArchive);");
 edit("window.portraitBank?.apply(new URLSearchParams(location.hash.slice(1)).get('portrait')||'P01')","window.portraitBank?.apply(portraitId(),{initial:true})");
 return app;
};
