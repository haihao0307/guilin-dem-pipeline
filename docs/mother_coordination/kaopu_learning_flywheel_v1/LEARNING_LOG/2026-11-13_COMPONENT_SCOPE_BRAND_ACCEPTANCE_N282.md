# N282 — component-scoped acceptance for official brand assets

Date: 2026-11-13  
Status: **Candidate / local history replay passed / not adopted**  
Target: Equipment/Vehicle Mother + any reference-locked asset containing a third-party brand mark

## One bounded question

When the user accepts the vehicle body/configuration but explicitly requires the brand mark to come from an official SVG/vector source and forbids self-drawing, can KAOPU preserve the accepted geometry while preventing the whole artifact from being reported as `USER-ACCEPTED`?

## Fresh baseline read

Current main is unchanged at `8aec1b1dca9619c0b59fc8fa480f65f226be7145`. Required baselines remain:

- root AGENTS `251b664646a489e9292748f1d41998ee62a338f5`
- R2 `d942d44bad0bbd206ea3768d620ad60d5ddeb2bf`
- reference gate `8c0a49c71865ef76cbc614f8188239bc808a8278`
- freshness gate `4754a90a94e4a9e7806357b6eb292e5c713e9021`

#91 has no comment after N281 (`issuecomment-6843161039`); #63 remains unchanged. Current main contains no excavator/Hitachi production object and no cloth solver or performance record. Hair has no ACK or new publication evidence.

## Real failure/feedback

In the user conversation before this run, the user accepted the excavator's large-boom configuration overall, with one explicit exception: the Hitachi logo must use an official SVG/vector asset and must not be self-drawn. The user asked to carry the same logic to other files/vehicles.

This feedback is scope-specific. Treating it as whole-artifact ACCEPT would waive the unresolved official-source requirement. Treating it as whole-artifact REJECT would discard a geometry decision the user already accepted.

The exact production artifact/head is not present in this repository, so this run does not claim that any vehicle file was inspected, modified, acknowledged or accepted in GitHub.

## Current Best View comparison

Existing controls already say:

- R2 §15 records user ACCEPT or REJECT;
- the reference gate forbids self-drawn substitutes and permits `SOURCE_ENTRY_REQUIRED` / `UNKNOWN`;
- source-to-visible-delta mapping is required.

The gap is not the ban on self-drawing. The gap is roll-up semantics: the current documents do not explicitly preserve a user-accepted component scope while an independent required scope remains unresolved. Therefore the external method is not a replacement for R2; it is a candidate local refinement.

## External method/evidence

NASA's Requirements Verification Matrix identifies each requirement by a unique ID and records its definitive source, success criteria, method and result rather than collapsing all requirements into one boolean:

- https://www.nasa.gov/reference/appendix-d-requirements-verification-matrix/
- https://nodis3.gsfc.nasa.gov/displayAll.cfm?Internal_ID=N_PR_7123_001B_&page_name=ALL

NASA configuration-management guidance also identifies configuration items, acceptance requirements and owners separately, and tracks anomalies/actions to closure:

- https://nodis3.gsfc.nasa.gov/displayAll.cfm?Internal_ID=N_PR_7123_0001_&page_name=ALL

NIST defines provenance as the history of origin, ownership and changes to a component/data, and its acceptance-testing scenario verifies the source and authenticity of a component artifact before establishing a baseline:

- https://csrc.nist.gov/glossary/term/provenance
- https://www.nccoe.nist.gov/publication/1800-34/VolC/index.html

Transferable principle: acceptance and provenance should be keyed to the exact requirement/configuration item, then rolled up to the product. We are not importing NASA/NIST process wholesale.

## Falsifiable hypothesis

A component-scoped acceptance receipt prevents both errors if and only if it:

1. preserves the accepted geometry scope;
2. keeps the official brand-mark scope at `SOURCE_ENTRY_REQUIRED` until provenance, rights and exact asset identity are bound;
3. keeps artifact-level `USER-ACCEPTED=false` while any required scope is open;
4. rejects `SELF_DRAWN` / `REJECTED_CREATIVE_SUBSTITUTE`;
5. does not auto-set artifact-level user acceptance merely because an official asset is later found.

## Minimal replay

Candidate `COMPONENT-SCOPE-ACCEPTANCE-OFFICIAL-BRAND-ASSET-001` was replayed against one real feedback pattern and four counterexamples.

Result: **5/5 expected classifications matched**.

- real partial acceptance preserved geometry and held the logo scope;
- false whole-artifact acceptance was rejected;
- discarding the accepted geometry scope was rejected;
- a self-drawn logo was rejected;
- a provenance-bound official asset became eligible for exact-artifact verification, but did not auto-create user acceptance.

This is a small history replay, not production evidence and not proof of KPI improvement.

## Candidate receipt delta

For affected Equipment/Vehicle tasks only, add a nested scope list to the existing Delivery Receipt:

```json
{
  "artifactUserAccepted": false,
  "acceptedScopes": [
    {
      "scopeId": "vehicle.geometry.big_boom_configuration",
      "status": "USER-ACCEPTED",
      "evidence": "user feedback"
    }
  ],
  "openScopes": [
    {
      "scopeId": "vehicle.brand_mark.hitachi",
      "status": "SOURCE_ENTRY_REQUIRED",
      "requiredSourceClass": "OFFICIAL_SVG_OR_VECTOR",
      "provenanceBound": false,
      "rightsChecked": false,
      "selfDrawnForbidden": true
    }
  ]
}
```

Roll-up audit rule:

`artifactUserAccepted == true` is forbidden while any required scope is `SOURCE_ENTRY_REQUIRED / UNKNOWN / REJECTED_CREATIVE_SUBSTITUTE`.

An official logo asset must bind source URL/repository, asset digest, license/rights note and exact rendered subject. Finding an official asset only enables verification; it does not create `USER-ACCEPTED`.

## Applicability and boundary

Apply only when the user gives scope-specific acceptance or rejection and the scopes can be independently identified. Do not use this to slice one coupled visual requirement into arbitrary micro-scopes or to promote an unverified composite artifact. For the current excavator feedback, Equipment/Vehicle Mother is the only intended route.

## Decision

`CANDIDATE_LOCAL_TRIAL_ONLY`

- institutional novelty: **yes, limited to component-scoped roll-up semantics**;
- external teacher registry change: none;
- R2/global gate change: no;
- production/Main/asset change: no;
- KPI effect: `UNKNOWN`.

Lifecycle: `POSTED=true` at [#91 issuecomment-6847245450](https://github.com/haihao0307/guilin-dem-pipeline/issues/91#issuecomment-6847245450); `ACKNOWLEDGED=false`; Candidate `IMPLEMENTED=true`; `GATE-RUN=true`; `ADOPTED=false`; `USER-ACCEPTED=false`.
