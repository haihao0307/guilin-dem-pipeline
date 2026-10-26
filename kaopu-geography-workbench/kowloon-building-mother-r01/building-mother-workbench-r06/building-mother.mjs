import{growMother}from'../building-mother-workbench/shared-core/mother.mjs';
import{growStair,stairOpening}from'../building-mother-workbench-r05/stair-rule.mjs';
const room={id:'room',defaults:{width:4,depth:5},maxFloors:2,opening:stairOpening,stair:growStair};
export const growBuilding=input=>growMother(input,room);
