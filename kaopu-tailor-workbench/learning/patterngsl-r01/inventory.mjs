import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {initialDesign,parameterState,parameterLabel,GROUP_NAMES} from '../../catalogue/catalogue-controls.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../..');
const schemaPath=path.join(root,'garment-pattern-catalogue-r01/browser/parameter-schema.json'),stylesPath=path.join(root,'garment-pattern-catalogue-r01/browser/styles.json');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const schema=read(schemaPath),raw=read(stylesPath),styles=Array.isArray(raw)?raw:raw.styles;
if(!Array.isArray(styles)||!Array.isArray(schema.parameters))throw Error('Unsupported native inventory schema');
const configurations=styles.map(style=>({style,design:initialDesign(schema,style)}));
const parameters=schema.parameters.map(p=>{
 const states=configurations.map(({style,design})=>({recipeId:style.id,...parameterState(p.path,design)}));
 return{...p,label:parameterLabel(p.path),group:p.path.split('.')[0],declaredEnabledInDefaultRecipes:states.filter(s=>s.enabled).map(s=>s.recipeId),
  declaredDisabledReasons:[...new Set(states.filter(s=>!s.enabled).map(s=>s.reason))],
  evaluatedAgainst:'existing UI activation rules; not a source-execution/fit test of every possible value'};
});
const groups=[...new Set(parameters.map(p=>p.group))].map(id=>({id,label:GROUP_NAMES[id]??id,count:parameters.filter(p=>p.group===id).length}));
const result={schema:'kaopu-teacher-feature-inventory@1',upstream:'GarmentCode, not PatternGSL',nativeSourceCommit:schema.sourceCommit,
 generatedFrom:{parameterSchemaSHA256:sha(schemaPath),stylesSHA256:sha(stylesPath),activationRulesSHA256:sha(path.join(root,'catalogue/catalogue-controls.mjs'))},
 counts:{defaultRecipeEntries:styles.length,originalDesignFields:parameters.length,uiGroups:groups.length},
 groups,activationNotes:schema.activationNotes,samplingDomainMeaning:schema.domainMeaning,
 recipes:styles,parameters,
 allParameterValuesExecuted:false,allRecipesDrapingCertified:false,PatternGSLCheckpointIntegrated:false,
 important:'Some controls are intentionally inactive for the current combination. Declared active does not prove the upstream program consumed a parameter or that its resulting garment fits.'};
const output=process.argv[2]??path.join(here,'PARAMETER_INVENTORY.json');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({output,counts:result.counts,groups},null,2));
