# Mother interfaces for Stone Money Island

Read STONE_MONEY_ISLAND_START_HERE.md first. This is a KAOPU world instance, not a traditional asset assembly project. Do not restore the previous visibility/LOD-policy field or rename that policy to evade the user's direction.

## Ownership

Game owns player intent, scenario and mission state, exploration records, inventory transactions and interaction feedback. It does not independently redefine a Mother's authoritative object.

Ocean owns its source-defined sea/cloud relationship, wave and weather state, surface queries and the accepted coast/bathymetry expressions. Landscape owns accepted rock/island generation definitions. Plant and Animal/Bird own their actual body and motion definitions. Candidate stand-ins remain explicitly candidate; importing an example does not silently promote its parameters to ecological truth.

## Proposed shared contract — not yet a validated universal adapter

Every participating object needs an objectId, source identity/revision, definition and state revisions, a typed world frame, units, a world time/epoch, dependency identities and evidence/acceptance status. Generated display buffers are derived outputs, not replacement object identities.

Queries must state their meaning: rendered sea elevation vs numerical sea elevation; vertical height vs surface normal/velocity; ground/rock surface vs coarse collision approximation. Where these differ, return the distinction and bounds rather than asserting perfect agreement. New habitat or shoreline expressions must be reused by readers, not independently re-created for fish, boats and graphics.

Actions should carry an actionId, target objectId, worldTime, prerequisites and observed outcome. A completed capture/release/harvest transaction must be idempotent and preserve the object's inventory/world relationship. Cancelling an action invalidates stale completion callbacks.

## Current actual implementation boundary

V0.1.6.0 retains the original Ocean Mother V001 source byte-for-byte and adds a context/camera/time adapter. Original wave/cloud shader defaults are unchanged. The game and sea use one WebGL canvas; near-coast rendering consumes the same sky radiance. This alone does not prove a complete KAOPU object system or full optical/physical coupling.

White-sand ring/cove descriptors feed CPU and shader ground queries. Their layout and shoreline profiles are authored candidates, not measured Palau truth. Sea-eroded rock instances coexist with sandy instances. The existing rock field and canoe collision approximation still need source-shape/contact comparison.

Current public runtime aliases OceanIsland and PalauSurvivalGame are retained for compatibility; StoneMoneyIslandGame identifies the renamed game. Fish/bird body integration and playable fishing are not implemented by the ocean-restoration step.

## Coordination

Resource request was posted to knowledge Issue #63, comment 5717038176. Await actual response and concrete files; a posted request is not a conversation with another running agent and is not adoption approval.
