# N307 — Browser-Observed Runtime Route and Phase Receipt

## Bounded question

Can the delivery gate prove which renderer route actually ran and why startup was slow, rather than trusting source declarations or one boolean browserPassed?

## Existing coverage versus gap

PUBLIC_WEB_DELIVERY_GATE v1.2.0 already requires public HTTP, current-version body content, key-resource checks, real-browser startup, no fatal errors, and one interaction. This remains Current Best View.

The new user correction is narrower: some engineering-machinery and truck workbenches appear unusually slow and may not actually follow the required WebGL2 route. The current gate does not require the observed canvas context, fallback state, first valid frame, interaction acknowledgement latency, or resource-level attribution.

## External method

W3C Performance Timeline provides browser-native entries with start time and duration. Resource Timing attaches request initiator and transfer/timing attributes. Khronos WebGL 2.0 supplies the renderer contract. The transferable principle is to compare producer claims with browser observation and retain phase evidence in the Delivery Receipt.

## Minimal replay

- Correct WebGL2 and explicit probe budgets: pass.
- Faster WebGL1 fallback: hold for route mismatch.
- Producer claims WebGL2 while verifier observes WebGL1: hold for evidence conflict.
- Correct WebGL2 but first valid frame exceeds an explicit probe budget: hold and identify the largest-duration resource.
- Same slow trace with no authorized budget: renderer verified, latency budget unknown; no invented KPI.

## Candidate decision

TEACHER_CANDIDATE / AUDITION.

Create one deduplicated Candidate regression and trial the receipt on one actually affected engineering-machinery workbench. Do not alter PUBLIC_WEB_DELIVERY_GATE globally until an independent browser verifier has run against a real current subject and repeated measurements on the same device/browser profile are stable.

The Producer cannot self-approve runtime route or performance. A digest, context name, or timing trace does not prove visual quality, physical correctness, or user acceptance.
