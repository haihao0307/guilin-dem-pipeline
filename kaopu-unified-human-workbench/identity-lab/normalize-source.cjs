// Narrow source migration for ES2022's unary-minus/exponentiation grammar.
// These exact textual replacements preserve the Gaussian arithmetic.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const file=path.join(__dirname,'TraitMaps.mjs');let source=fs.readFileSync(file,'utf8');
for(const [before,after] of [
 ['Math.exp(-((y-287)/18)**2)','Math.exp(-Math.pow((y-287)/18,2))'],
 ['Math.exp(-(Math.abs(x)/(24+38*s.freckleSpread))**4)','Math.exp(-Math.pow(Math.abs(x)/(24+38*s.freckleSpread),4))']
]){
 if(source.includes(after))continue;
 assert.equal(source.split(before).length,2,'Expected unique arithmetic anchor');
 source=source.replace(before,after);
}
fs.writeFileSync(file,source);
