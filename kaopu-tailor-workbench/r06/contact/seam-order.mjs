// Stable physical ordering without renumbering upstream seams or changing paper.
export function orderedSeams(seams){
 const end=e=>JSON.stringify([e.panelId,String(e.edge),!!e.reverse]);
 const key=s=>[end(s.a),end(s.b)].sort().join('|');
 return [...seams].sort((a,b)=>{const x=key(a),y=key(b);return x<y?-1:x>y?1:0;});
}
