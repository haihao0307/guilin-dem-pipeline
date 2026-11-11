import assert from 'node:assert/strict';

export function evaluateDelivery(input) {
  const reasons = [];
  const thirdParty = input.thirdPartyMaterialPresent === true;
  if (!thirdParty) return { state: 'PASS_NO_THIRD_PARTY_MATERIAL', reasons };

  if (!input.sourceNoticeRetained) reasons.push('HOLD_SOURCE_NOTICE_MISSING');
  if (!input.exactSourceIdentityBound) reasons.push('HOLD_SOURCE_IDENTITY_UNBOUND');
  if (!input.modificationStatusDeclared) reasons.push('HOLD_MODIFICATION_STATUS_UNDECLARED');

  const visible = input.userVisibleProvenance === true;
  const linked = input.userVisibleProvenanceLink === true && input.linkTargetContainsRequiredAttribution === true;
  if (!visible && !linked) reasons.push('HOLD_USER_VISIBLE_PROVENANCE_HIDDEN');

  if (input.uiClaimsSoleProjectIdentity === true && !visible && !linked) {
    reasons.push('HOLD_RENDERED_CLAIM_SOURCE_TRUTH_MISMATCH');
  }

  return reasons.length ? { state: 'HOLD', reasons } : { state: 'PASS_PROVENANCE_DISCLOSURE_BOUND', reasons };
}

const cases = [
  {
    name: 'R49 visible original-reference label',
    input: {thirdPartyMaterialPresent:true,sourceNoticeRetained:true,exactSourceIdentityBound:true,modificationStatusDeclared:true,userVisibleProvenance:true,userVisibleProvenanceLink:false,linkTargetContainsRequiredAttribution:false,uiClaimsSoleProjectIdentity:false},
    expected: 'PASS_PROVENANCE_DISCLOSURE_BOUND'
  },
  {
    name: 'R50 hides original-reference label but keeps source comments',
    input: {thirdPartyMaterialPresent:true,sourceNoticeRetained:true,exactSourceIdentityBound:true,modificationStatusDeclared:true,userVisibleProvenance:false,userVisibleProvenanceLink:false,linkTargetContainsRequiredAttribution:false,uiClaimsSoleProjectIdentity:true},
    expected: 'HOLD'
  },
  {
    name: 'R51 hides teacher replica identity and teacher formula entry',
    input: {thirdPartyMaterialPresent:true,sourceNoticeRetained:true,exactSourceIdentityBound:true,modificationStatusDeclared:true,userVisibleProvenance:false,userVisibleProvenanceLink:false,linkTargetContainsRequiredAttribution:false,uiClaimsSoleProjectIdentity:true},
    expected: 'HOLD'
  },
  {
    name: 'compact UI links to accessible sources panel',
    input: {thirdPartyMaterialPresent:true,sourceNoticeRetained:true,exactSourceIdentityBound:true,modificationStatusDeclared:true,userVisibleProvenance:false,userVisibleProvenanceLink:true,linkTargetContainsRequiredAttribution:true,uiClaimsSoleProjectIdentity:false},
    expected: 'PASS_PROVENANCE_DISCLOSURE_BOUND'
  },
  {
    name: 'visible label cannot excuse missing source notice',
    input: {thirdPartyMaterialPresent:true,sourceNoticeRetained:false,exactSourceIdentityBound:true,modificationStatusDeclared:true,userVisibleProvenance:true,userVisibleProvenanceLink:false,linkTargetContainsRequiredAttribution:false,uiClaimsSoleProjectIdentity:false},
    expected: 'HOLD'
  },
  {
    name: 'own work needs no third-party disclosure',
    input: {thirdPartyMaterialPresent:false},
    expected: 'PASS_NO_THIRD_PARTY_MATERIAL'
  }
];

let passed = 0;
for (const test of cases) {
  const result = evaluateDelivery(test.input);
  assert.equal(result.state, test.expected, test.name);
  if (test.name.includes('R50') || test.name.includes('R51')) {
    assert(result.reasons.includes('HOLD_USER_VISIBLE_PROVENANCE_HIDDEN'));
    assert(result.reasons.includes('HOLD_RENDERED_CLAIM_SOURCE_TRUTH_MISMATCH'));
  }
  passed++;
}

console.log(JSON.stringify({passed,total:cases.length,status:'PASS',cases:cases.map(c=>c.name)},null,2));
