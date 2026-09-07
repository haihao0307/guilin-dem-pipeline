# Object DNA Kernel V0.1

## 1. Identity

Every concrete entity has a stable `entityId`. Identity is continuous across growth, ageing, motion, wear, repair, repainting, configuration changes and ordinary part replacement. Identity changes only through explicit lifecycle termination, splitting, merging or creation rules.

Separate:
- `essentialType`: broad identity class, normally stable
- `configurationType`: version/configuration that may change through time
- `ontologyPath`: hierarchical classification

Examples of ontology paths:
- PhysicalObject > Artifact > Machine > Vehicle > Aircraft > MilitaryAircraft > Bomber > HeavyBomber > B-24
- PhysicalObject > LivingThing > Animal > Mammal > Canine > DomesticDog
- PhysicalSystem > NaturalSystem > Landscape > KarstLandscape

## 2. Semantics

An entity is decomposed into stable semantic parts and interfaces. Each part may itself become an entity when its history, replacement, ownership, independent behavior or lifecycle matters.

Minimum semantic records:
- partId
- name
- role
- parent/containment relation
- interfaces
- evidence status
- confidence

## 3. FunctionGraph

Describe why parts exist and how the entity works at the level required for historical visualization and simulation.

Reusable relation classes:
- material/flow relation
- energy relation
- control relation
- support/load relation
- sensing relation
- containment relation
- maintenance relation

For regulated or hazardous objects, the graph remains at a safe high-level visualization scope and excludes fabrication, optimization and operational instructions.

## 4. EvidenceGraph

Every important claim can reference one or more evidence nodes.

Evidence node fields:
- evidenceId
- kind: model/photo/drawing/manual/measurement/observation/research
- source reference
- date or revision
- applicability
- inspected scope
- confidence
- claim status: known/inferred/estimated/unknown
- conflicts

A catalog listing is a lead until the actual page or image is inspected.

## 5. MeasurementGraph

Measurements are relational constraints, not isolated numbers.

Core measurement types:
- axes
- datum planes
- anchors
- normalized envelopes
- sections
- profiles
- curvature
- hole/slot axes
- angles
- relative offsets
- symmetry/asymmetry
- repetition patterns
- adjacency and containment

Each measurement records provenance, method, uncertainty, applicability and confidence.

Reference Twin and Native Twin must share a declared comparison frame. Source reference geometry remains read-only and temporary.

## 6. GeometryProgram

Permanent product geometry is stored as readable construction rules and exceptions, such as:
- profile
- shell
- plate
- tube
- sweep
- hole
- slot
- fillet
- fastener
- pattern
- bracket
- interface
- constraint

Runtime Mesh/B-Rep/GPU buffers are compiler outputs. Irregular regions may remain explicit local rules instead of being forced into misleading primitives.

## 7. SurfaceCoordinateProgram

Surface coordinates are semantic coordinate fields. Traditional UV is one possible compiled representation.

Examples:
- longitudinal/circumferential tube coordinates
- plate-local coordinates
- top/side/front semantic frames
- fastener-local coordinates
- world/environment coordinates

Every surface coordinate field carries orientation, scale, domain, seam policy and version.

## 8. MaterialProgram

Material is cause-based rather than a collection of unrelated sliders.

Suggested layers:
- substrate
- surface treatment/coating
- manufacturing traces
- use/contact
- maintenance film
- contamination/dust
- oxidation/corrosion candidate
- damage
- environmental response

Each cause may affect base color, roughness, metalness, normals/micro-relief and other outputs through separate response functions.

## 9. LifecycleGraph

Lifecycle describes valid stages, transitions and terminal states.

Generic fields:
- validFrom
- validTo
- birth/manufacture/start event
- lifecycle stage
- expected transition rules
- terminal state

A living thing, building, machine, field and landscape can all use the same lifecycle protocol while defining domain-specific stages.

## 10. EvolutionGraph

Time is a first-class input.

Conceptually:
`State(t + dt) = F(State(t), EnvironmentHistory, UsageHistory, MaintenanceHistory, EventHistory, MaterialProperties, dt)`

Age alone does not determine state. Two entities of the same age may differ because their histories differ.

Store two separate concepts:
- `possibleEvolution`: what the rules allow
- `actualHistory`: what this exact entity experienced

## 11. BehaviorGraph

Behavior and animation are generated from valid state and function relationships.

Behavior records:
- preconditions
- participating parts/entities
- state transition
- visible motion/change
- timing scale
- evidence/confidence
- invalidation conditions

Animation must not claim a relationship that FunctionGraph or World Kernel has not validated.

## 12. EventHistory

Events are discrete changes that may alter continuous evolution.

Examples across domains:
- manufacture/birth
- installation
- maintenance
- repair
- replacement
- relocation
- collision
- weather event
- damage
- harvest
- death/decommission

Events carry time, place, participants, causes, evidence and effects.

## 13. World Interface

Every entity exported to World Kernel provides:
- entityId
- ontologyPath
- essentialType
- configurationType
- world-valid time interval
- geographic anchor or container
- local/world transform
- physical capabilities relevant to reachability
- lifecycle state
- material DNA references
- behavior capabilities
- current relations
- evidence/confidence summary
- visual-world profile

## 14. ApprovalLedger

Keep separate states for:
- research complete/incomplete
- measurement validated/unvalidated
- geometry candidate/accepted
- material candidate/accepted
- behavior candidate/accepted
- visual acceptance
- production readiness

No later layer can silently promote an earlier unresolved layer.

## 15. Web-first runtime

Primary runtime is the browser.

Versioned permanent data lives in GitHub. Browser runtime compiles object rules into temporary GPU geometry, material and behavior state. Desktop CAD/DCC tools may be used as temporary measurement or verification instruments, not as the permanent runtime target.
