# Object DNA Kernel V0.1 — handoff to Xiaoma / World Kernel

Date: 2026-09-07

This package freezes the current conceptual agreement between the Object DNA production line and Xiaoma's World Kernel coordination layer.

## Responsibility split

### Object DNA Kernel
Owns the internal truth of one entity:
- stable Entity ID and ontology path
- semantic parts and functions
- evidence and confidence
- measurements and constraints
- geometry program
- surface-coordinate program
- material program
- lifecycle and state
- behavior and animation state
- event history
- actual history versus possible evolution
- review and approval ledger

The current Aircraft Browning M2 / AN/M2 work is the first pilot object.

### World Kernel — Xiaoma
Owns the shared world that all entities inhabit:
- one world time system
- one geography and coordinate system
- world physics and chemistry rules
- ecology and social relations
- environment fields such as weather, water, light and terrain
- cross-object relationships
- event scheduling and reachability
- world consistency gates
- shared visual-world profile

Object DNA must not invent a private world. World Kernel must not overwrite an entity's identity or internal evidence without an explicit versioned update.

## Core principles

1. Identity is stable; state changes through time.
2. Every entity exists in a common time and common space.
3. Absolute world pose and relative observer pose are separate concepts.
4. Change is normal; apparent stability is a temporary state.
5. Each conclusion carries evidence, applicability, confidence and known/inferred/estimated/unknown status.
6. Mesh, UV and rendered textures are optional compiled outputs, not the permanent identity of the object.
7. The target runtime is the browser. GitHub stores versioned rules, evidence references and histories. GPU geometry is generated transiently.
8. Time, location and identity are mandatory context for any world event.
9. A world event must pass identity, time, location, reachability, physics, function and history constraints.
10. Previous accepted or reviewable states remain versioned; no silent history rewrite.

## Shared world equation

Conceptually:

`World(t) = {Time, Space, Physics, Chemistry, Ecology, Style, Entities, Relations}`

For an entity:

`Object_i(t) = {Identity, Ontology, Structure, Function, Material, Lifecycle, State, Behavior, History}`

State evolution is conceptually:

`State_i(t + dt) = F(State_i(t), Relations_i(t), Environment(t), History_i(t), dt)`

Discrete events may create state jumps:

`State_i(t+) = Psi(State_i(t-), Event)`

## Spatial rule

Each entity has a World Frame pose and its own Object Frame. Any observer has an Observer Frame. Left/right/front/back are relative statements and must identify the reference frame. A dog can be left of one observer and right of another while its world position remains unchanged.

## Time rule

Every entity has a validity interval and a lifecycle. An object cannot participate in a world state before its valid start or after its valid end unless the system is explicitly in historical replay, hypothetical simulation or another declared mode.

## Handoff contract

See `WORLD_OBJECT_CONTRACT_V0_1.json` for the minimum bridge from Object DNA to World Kernel.

See `OBJECT_DNA_KERNEL_V0_1.md` for the internal schema.

See `BROWNING_M2_PILOT_PLAN.md` for the first practical validation path.

Status: conceptual V0.1 frozen for pilot implementation. This does not grant visual acceptance or production readiness to the current Aircraft Browning M2 asset.
