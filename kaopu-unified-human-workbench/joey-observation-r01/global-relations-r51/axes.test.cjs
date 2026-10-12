const{test}=require('node:test'),assert=require('node:assert/strict'),{axes,applyDelta}=require('./axes.cjs');
const a={state:{anny:{localChanges:{'head-scale-vert-incr':-.25}},gnm:{identity:[.1,0]}}};
test('probe clones archive and changes only explicitly named native locals',()=>{const before=structuredClone(a),b=applyDelta(a,axes[0],.25);assert.deepEqual(a,before);assert.equal(b.state.anny.localChanges['head-scale-vert-incr'],0);assert.deepEqual(b.state.gnm,a.state.gnm)});
test('bilateral semantic axes move both labels together',()=>{const axis=axes.find(x=>x.id==='cheek-volume'),b=applyDelta(a,axis,.2);assert.equal(b.state.anny.localChanges[axis.labels[0]],.2);assert.equal(b.state.anny.localChanges[axis.labels[1]],.2)});
test('invalid ranges and nonfinite input are rejected',()=>{for(const d of[NaN,Infinity,-Infinity,2])assert.throws(()=>applyDelta(a,axes[0],d));assert.throws(()=>applyDelta(a,{labels:[]},.2))});
