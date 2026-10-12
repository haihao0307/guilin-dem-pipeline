export function functionNesting(source,name='terminalHallQuery'){
 const src=source.replace(/\/\/[^\n]*/g,'').replace(/\/\*[\s\S]*?\*\//g,''),at=src.indexOf(name+'(');if(at<0)throw Error('Function absent');const open=src.indexOf('{',at),stack=[],start=open+1;let maxBlockDepth=0,maxControlDepth=0,controls=0,last=start,end=start;
 for(let i=start;i<src.length;i++){if(src[i]==='{'){const prefix=src.slice(last,i),control=/\b(?:if|for|while|switch)\s*\([^{}]*\)\s*$/.test(prefix)||/\b(?:else|loop)\s*$/.test(prefix);stack.push(control);if(control)controls++;maxBlockDepth=Math.max(maxBlockDepth,stack.length);maxControlDepth=Math.max(maxControlDepth,controls);last=i+1;}else if(src[i]==='}'){if(!stack.length){end=i;break;}if(stack.pop())controls--;last=i+1;}}
 return{maxBlockDepth,maxControlDepth,functionBytes:end-open+1,definition:'nesting inside function body; anonymous scopes counted only in block depth'};
}
