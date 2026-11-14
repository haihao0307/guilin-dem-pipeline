# N287 — Train middle connection topology audition

Date: 2026-11-14  
Status: **bounded technical hold / existing regression refined / not adopted**  
Target: `train-recovery-notes-r318-20261113.zip`

## One bounded question

Do the current Train middle interfaces encode an explicit, source-correct connection topology, rather than only placing independently indexed surfaces at the same coordinates?

## Required fresh reads

Current main remains `8aec1b1dca9619c0b59fc8fa480f65f226be7145`. Required baseline blobs remain unchanged:

- root AGENTS `251b664646a489e9292748f1d41998ee62a338f5`
- R2 `d942d44bad0bbd206ea3768d620ad60d5ddeb2bf`
- reference gate `8c0a49c71865ef76cbc614f8188239bc808a8278`
- freshness gate `4754a90a94e4a9e7806357b6eb292e5c713e9021`

#91 ends at N286 comment `6867798841`; no Mother acknowledgement follows it. #63 has no newer applicable production feedback. Existing regression `MOTHER-NO-METHOD-INVENTION-001-N283-METHOD-ANCHOR` is refined in place; no duplicate case is created.

## Exact subject

- Library ID: `libfile_ef5d5fb7f88c81919bcf6359f7acc96a`
- version: `22`
- modified: 2026-11-14 11:40:22 Asia/Shanghai
- bytes: 6,727,823
- SHA-256: `441ded79fa1193e7467cfad39026c5b31f0754c2c3b44fdb9aa0197cf5330c62`
- extracted files: 305

This is a large real delta from N286 version 5 (523,155 bytes / 92 files). It adds central front, step, lower lip, event-aware seam domains, source checks, negative trials and many bounded validation receipts. Published Site v122 is still declared unchanged; whole Train and 1:1 acceptance remain explicitly unclaimed.

## Existing geometric-port checks

Fresh replay from the exact version-22 bytes:

| Check | Evidence | Result |
| --- | ---: | --- |
| central step | 7,548 derivative checks; 74 parent ports; max position gap 0 | PASS |
| central front | 5,032 derivative checks; 74 parent ports; max position gap 0 | PASS |
| center join | 1,188 shared-boundary samples; max gap 0 | PASS |
| near-center join | 1,188 shared-boundary samples; max gap 0 | PASS |

These prove sampled C0 positional continuity. They do not, by themselves, prove shared indexed topology, welded adjacency, contact semantics or intentional layer separation.

## Minimal topology replay

The delivered pack pattern concatenates each part's positions and indices, applying a per-part index offset. It does not transfer a shared boundary owner or reuse indices across parts.

A clean probe assembled the current `front + central step + apron` meshes exactly under that pattern:

| Quantity | Observed |
| --- | ---: |
| front vertices / triangles | 456 / 448 |
| step vertices / triangles | 684 / 672 |
| apron vertices / triangles | 1,938 / 3,584 |
| combined vertices | 3,078 |
| duplicate coordinates across parts | 228 |
| front ↔ step duplicate coordinates | 114 |
| step ↔ apron duplicate coordinates | 114 |
| topological boundary edges | 1,428 |
| geometrically coincident but index-unwelded edges | 616 |

Therefore the current assembly has exact geometric coincidence at these interfaces while retaining separate indexed boundaries. This is not proof of a visible crack, and it does not prove that every coincident interface should be welded. It does falsify the stronger claim that a zero parent-port gap already represents the middle connection relationship.

## Source boundary

The package itself says the original reference contains welded adjacency and also separate front/rear layers that must not be collapsed into one face. A global vertex weld would therefore be another wrong shortcut.

Fresh source checks for the two relevant mothers still fail because `source.py` points to the stale absolute path:

`/workspace/scratch/2f609cc83d31/train-reference-recovery-2240/A4-original-reference-recovered-20261020.zip`

So the exact source cannot yet classify each inspected interface as welded, contact-only, separate layers or an intentional gap from the delivered digest alone.

## New failure mechanism

`ZERO_POSITION_GAP != CONNECTION_TOPOLOGY`

A sampled port test can pass while:

- each part owns duplicate seam vertices;
- assembly keeps two topological boundary edges at the same coordinates;
- no shared edge incidence exists;
- a T-junction or semantic layer error remains possible;
- a later global weld could incorrectly collapse source-separated layers.

This is a real addition to the Current Best View, not a replacement for the existing functional/source-fidelity split.

## One falsifiable Candidate trial

Scope: only `central front ↔ step ↔ apron`.

Each interface must declare one source-backed state:

- `WELDED_SHARED_EDGE`
- `CONTACT_ONLY`
- `SEPARATE_LAYERS`
- `INTENTIONAL_GAP`

For `WELDED_SHARED_EDGE`, require shared boundary ownership and post-assembly checks for edge incidence 2, zero duplicate seam vertices and zero T-junctions. For `SEPARATE_LAYERS`, require distinct topology plus exact source evidence and the appropriate gap/contact gate. Do not globally weld coincident coordinates.

The hypothesis is falsified if the trial still checks only position gaps, or if it destroys source-separated layers to make the topology counter pass.

## Decision

`HOLD_POSITIONAL_PORT_CONTINUITY_NOT_TOPOLOGICAL_CONNECTION`

- bounded mathematical mothers: genuine progress;
- sampled positional ports: PASS;
- middle connection semantics: UNKNOWN pending exact source replay;
- welded indexed topology: NOT PROVEN and false for the current concatenated mesh representation;
- source-fidelity replay: FAIL;
- whole Train, publication and user acceptance: not granted.

## Routing and lifecycle

This Candidate is routed only to the Train coordination issue. No main, R2, production Mother branch, Site, public route or production asset is changed.

- coordinator routing: POSTED only after the #91 comment exists;
- bounded function implementation: IMPLEMENTED=true;
- connection-topology gate: GATE-RUN=true / HOLD;
- Mother acknowledgement: ACKNOWLEDGED=false;
- adoption: ADOPTED=false;
- user acceptance: USER-ACCEPTED=false;
- KPI effect: UNKNOWN.
