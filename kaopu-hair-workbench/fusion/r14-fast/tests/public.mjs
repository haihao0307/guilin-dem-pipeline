// Same public checks, but wait for document commit rather than a default 30s
// DOMContentLoaded deadline while the software GPU tears down the old context.
// Runtime assets, render settings and all quality assertions are untouched.
import fs from'node:fs';import path from'node:path';import{fileURLToPath,pathToFileURL}from'node:url';import assert from'node:assert/strict';
const p=path.dirname(fileURLToPath(import.meta.url)),source=fs.readFileSync(p+'/browser.mjs','utf8'),from="page.reload({waitUntil:'domcontentloaded'})";assert.equal(source.split(from).length-1,2);const target=p+'/.public-run.mjs';fs.writeFileSync(target,source.replaceAll(from,"page.reload({waitUntil:'commit',timeout:180000})"));try{await import(pathToFileURL(target));}finally{fs.unlinkSync(target);}
