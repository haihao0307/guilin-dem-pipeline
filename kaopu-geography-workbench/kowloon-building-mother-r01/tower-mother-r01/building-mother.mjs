import{growMother}from'../building-mother-workbench/shared-core/mother.mjs';
import{growSquareSpiral,squareStairOpening}from'./square-spiral-rule.mjs';
import{towerGuards}from'./boundary-rails.mjs';
const tower={id:'tower',defaults:{floors:8,width:6,depth:6,roofVisible:true},maxFloors:8,roofAccess:true,emitBaseLanding:false,opening:squareStairOpening,stair:growSquareSpiral,guards:towerGuards};
export const growBuilding=input=>growMother(input,tower);
