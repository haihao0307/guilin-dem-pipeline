// Bound outstanding GPU work without mistaking a submitted frame for a
// completed one. Completion callbacks remain handled even during disposal.
export class BoundedGpuCompletionQueue{
 constructor(wait,{limit=2,now=()=>performance.now()}={}){
  if(typeof wait!=='function'||!Number.isInteger(limit)||limit<1)throw Error('Invalid GPU queue configuration');
  this.wait=wait;this.limit=limit;this.now=now;this.items=[];this.submitted=0;this.completed=0;this.failures=0;this.highWater=0;this.latestCompleted=null;this.error=null;this.closed=false;
 }
 compact(){this.items=this.items.filter(item=>!item.settled);}
 check(){if(this.closed)throw Error('GPU queue disposed');if(this.error)throw this.error;}
 async beforeSubmit(){
  this.check();this.compact();
  while(this.items.length>=this.limit){await this.items[0].promise;this.check();this.compact();}
 }
 submit(startedAt){
  this.check();this.compact();if(this.items.length>=this.limit)throw Error('GPU queue limit exceeded');
  if(!Number.isFinite(startedAt))throw Error('Invalid GPU submission time');
  const item={sequence:++this.submitted,startedAt,settled:false};this.items.push(item);this.highWater=Math.max(this.highWater,this.items.length);
  let waiting;try{waiting=this.wait();}catch(error){waiting=Promise.reject(error);}
  item.promise=Promise.resolve(waiting).then(()=>{
   item.settled=true;this.completed++;
   if(!this.latestCompleted||item.sequence>this.latestCompleted.sequence)this.latestCompleted={sequence:item.sequence,completionMs:this.now()-item.startedAt};
  },error=>{item.settled=true;if(!this.closed){this.failures++;this.error=error instanceof Error?error:Error(String(error));}});
  return item.sequence;
 }
 async drain(){this.check();await Promise.all(this.items.map(item=>item.promise));this.check();this.compact();}
 report(){this.compact();return{submitted:this.submitted,completed:this.completed,failures:this.failures,pending:this.items.length,limit:this.limit,highWater:this.highWater,latestCompleted:this.latestCompleted?{...this.latestCompleted}:null};}
 dispose(){this.closed=true;}
}
