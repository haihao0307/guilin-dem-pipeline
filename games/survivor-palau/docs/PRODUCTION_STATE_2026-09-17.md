# Palau Survival — Production State — 2026-09-17

## Frozen baseline

- Repository: `haihao0307/guilin-dem-pipeline`
- Production branch: `game/survivor-palau-v001-20260917`
- Frozen production commit: `e3987961baade384b99539936167fef1ae31cd7d`
- Verified release: `V0.1.4.1`
- Exact V0.1.4.1 HTML SHA256: `5e5e037cf97c28d93e85fb9e1b0e9e3a02e003fb3627b8d11ebe03025b71b749`

The frozen production branch is not modified while gameplay candidates are under visual and browser QA.

## Current gameplay candidate

- Work branch: `work/survivor-palau-v0150-canoe-control-20260917`
- Verified publish commit: `dfe30a750d7bf76057280c6891008e2a2cbf1fe0`
- Candidate release: `V0.1.5.0 Canoe Control`

Implemented in the Game layer without taking ownership away from Ocean Mother:

- controllable procedural canoe;
- keyboard W/S/A/D and arrow-key input;
- mobile directional controls;
- Ocean Mother water/depth sampling for navigation;
- shallow-water speed reduction;
- grounding / very-shallow-water limit;
- rock / exposed-solid blocking;
- deep-water navigation;
- canoe-follow camera;
- 390x844 mobile layout pass;
- game QA telemetry for canoe position, speed, depth, grounding and collision state.

## QA result

GitHub Chromium QA passed after the test was changed to wait for a completed SwiftShader-rendered frame rather than assuming a 1.6 s wall-clock interval.

Verified sample during the browser run:

- WebGL2: pass;
- GL error: 0;
- console errors: 0;
- page errors: 0;
- request failures: 0;
- canoe movement: confirmed;
- measured open-water depth at test point: about 12.9 m;
- grounding flag: false at the deep-water test point;
- collision flag: false at the deep-water test point;
- desktop visual capture: pass after camera pull-back;
- 390x844 visual capture: controls separated from the status bar after mobile-layout correction.

The very low `fps` value reported by GitHub QA is a SwiftShader/software-rendering runner measurement. It is useful as a warning that this scene is expensive under software rendering, but it is not a valid estimate of player-device FPS. Real hardware performance still requires device-side measurement.

## What is not a game system yet

V0.1.5.0 still does not contain a complete player survival loop. The following are not yet production systems:

- player body / walking interaction;
- hunger, thirst and inventory;
- fishing cast, line, hook, bite, reel and catch states;
- fish ecology / habitat rules;
- cooking and food conversion;
- Japanese patrol avoidance;
- signaling and detection;
- PBY rescue sequence;
- save/load progression.

The earlier `deepfish` point was only a camera/location marker. It must not be described as an implemented fishing system.

## Next production slice

Do not jump directly to twenty decorative fish variants. First establish one reusable fishing loop against Ocean Mother depth/water queries:

1. representative fish-school runtime with habitat/depth limits and low-cost schooling;
2. visible fish / underwater readability at the fishing zone;
3. cast -> line -> hook -> bite -> reel -> catch state machine;
4. catch result -> inventory / food value bridge;
5. validate boat + fishing together on desktop and 390x844;
6. only then expand to multiple fish families, turtle, seabirds and coral through Mother bridge interfaces.

This ordering prevents decorative ecology from being mistaken for gameplay completion and keeps the Game layer from rebuilding animal/ocean truth that belongs to the relevant Mother systems.
