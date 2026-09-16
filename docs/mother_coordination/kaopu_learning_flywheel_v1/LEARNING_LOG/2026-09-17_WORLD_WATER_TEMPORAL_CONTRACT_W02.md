# KAOPU Learning Log — Water temporal exchange contract W02

## Question

How can Weather, Landscape and Farmland exchange accumulated depth, rate and volume across unequal 15/30/60-minute steps without silent mass creation or loss?

## Evidence and bounded method

The locked stable CF Conventions 1.13 says interval-representative values need coordinate bounds; without bounds an application cannot know whether cells overlap, touch or contain gaps. Its cell methods distinguish extensive accumulated precipitation (`time: sum`) from intensive rates. EPA SWMM 5.2 independently separates runoff-computation, routing and reporting steps and identifies overly long computational steps as a continuity-error source.

A CPU fixture tested accumulated amounts, equal and unequal rate intervals, aggregation, disaggregation, overlap and gap counterexamples. All seventeen checks passed.

## Observation

- Four 15-minute accumulated depths `2+4+3+3` correctly aggregate to 12 mm.
- Four 15-minute rate means `2,4,3,3 mm/h` integrate to 3 mm; simply adding their numeric values gives 12 and a fourfold error.
- For unequal intervals, a 2 mm/h quarter-hour followed by 4 mm/h for 45 minutes integrates to 3.5 mm. The correct hourly mean is 3.5 mm/h, not the unweighted 3 mm/h.
- Half-open adjacent intervals partition time without overlap. Overlap and gaps are rejected when complete coverage is claimed.
- An hourly accumulated amount can be split only under an explicit within-interval policy; the fixture's constant-rate policy preserves the parent total but is not an observed rainfall shape.

## Candidate / Current Best View

Extend W01 fluxes with:

- canonical half-open `[start,end)` bounds;
- quantity class (`extensive amount`, `intensive rate`, `instantaneous point/state`);
- unit and temporal cell method (`sum`, `mean`, `point`);
- aggregation/disaggregation lineage and policy.

Sum extensive amounts. Integrate intensive rates by duration. Compute duration-weighted means. Never reapply reporting aggregates as physical input. Reject ambiguous point timestamps for interval accumulations, overlaps, gaps and implicit disaggregation.

## Rejected

- “All values with matching field names may be added regardless of whether they are amounts or rates.”
- “A timestamp alone identifies the support of accumulated rainfall.”
- “A 15-minute mean rate can be treated as a 15-minute amount.”
- “Arithmetic mean is valid for unequal-duration rate cells.”
- “A reporting time step is automatically a simulation or mutation time step.”
- “Splitting an hourly total into substeps reveals the true within-hour rainfall pattern.”

## Unknown

- Real Mother calendars, clocks, solver steps and late/out-of-order event handling remain unverified.
- Real rainfall shape inside reporting intervals is unknown without finer source data.
- Numerical stability, physical calibration, browser/device execution and joint Mother adoption remain unverified.

## Next gate

Mother-owned isolated trial: freeze one UTC interval calendar, exchange both a 15-minute rate series and an hourly accumulated amount, and require conservative reconciliation into a common mutation grid. Record source bounds and lineage; include overlap, gap, repeated-report and late-event negative controls.

Mother feedback before this round: none found for W01. Routing remains prepared, not acknowledged or adopted.

First-tier expert AI: not called.
