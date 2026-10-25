// Same whole-train candidate switch; no separate component demo or extra clock.
(function(){const D=DYNAMIC,C=MIDDLE_CHEST,prior=D.visible;
SCENE.sources.installation=C.source;SCENE.sources.stack+='\n'+C.movingSource;
SCENE.parts.push(...C.parts,...C.movingParts);
D.visible=(part,installation)=>part.source==='installation'?installation.mode==='candidate':prior(part,installation);
})();
