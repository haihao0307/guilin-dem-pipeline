import{loading,phase,failLoading,bindStop}from'./load-status.mjs';
bindStop();phase('正在载入三栋显示模块…');
try{await import('./semantic-app.mjs');}catch(error){failLoading(error);console.error(error);}
