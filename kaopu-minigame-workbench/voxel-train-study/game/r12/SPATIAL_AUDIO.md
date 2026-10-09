# R11 camera-relative sound and crew cues

The effects listener uses the final rendered camera world position, forward and up. Train sources use the train world matrix; platform sources use the nearest visible station group rather than the next-stop HUD index. This keeps a departing station behind the train. Music is an independent stereo context and does not pass through a point-source Panner.

Eight fixed mechanical/platform emitters and four reusable impact slots use HRTF PannerNodes. Point recordings are downmixed once at decode. A stereo ambience, if supplied, has separate channels mapped to distinct platform emitters; the currently shipped crowd file is mono, reused with different offsets, and stays off by default. It is modern Mandarin reference audio, not historical Hong Kong speech.

Inverse distance attenuation is followed by a smooth 120–180 m far-field fade. Turning the listener changes the HRTF; there is no global facing gain and no false “look away means all sound disappears” rule. The source cone remains omnidirectional. Up to 40 one-shot voices, 12 per role, four loops and four active impact clips are allowed. Ended, paused, reset and disposed sounds are bounded and cleaned up.

Steam chuffs keep four pulses per main-wheel revolution (.61 m radius). Cylinder, whistle and guard anchors refer to the actual meshes. The guard gives one closing-door cue; the departed event no longer repeats it. This is a readable fictional game cue, not a claim about a historical whistle count or flag ritual.

The driver uses the original head and cap mesh: forward while running, toward the platform when stopped, turning forward again during final door closing. The attendant occupies the cab apron outside real passenger door paths and raises one hand to the mouth during the saved door-close progress. Both freeze exactly when the game pauses. Character geometry remains a placeholder.

A stone impact is sounded only for a new real `stone-hit` event. Its train-local collision point becomes a world-space impact anchor with the matching event ID. Throws alone do not make collision sounds. The .24 s coach clunk is original procedural foley, not a recording. Impact feedback remains available regardless of the separate character-voice option. No authorized Cantonese voice is included, no speech synthesis is called, and unavailable voice requests are not queued for later replay.

The user rejected the R10 original score on 8 October 2026. R11 defaults that cue off while preserving an explicit opt-in and the frozen R10 entry. Playback tests do not imply that the music is aesthetically accepted or has been listened to.

## Verification

`audio-spatial.test.mjs` tests downmix, bounded nodes/voices, pause and repeat behavior, real Session miss/impact events and world anchors. `tests/spatial-audio-probe.html` renders identical actual sample input through the same HRTF/master/compressor path into stereo PCM, then measures near/far RMS, left/right levels and front/back differences. It also exposes the exact procedural impact input for the same measurements. `tests/r11-browser.cjs` verifies those outputs and the actual game listener binding, three viewport layouts, crew states, one guard cue, real collision feedback, pause and the R10 archive. Automated measurements are not a listening review or physical phone performance test.

Reference: W3C Web Audio spatialization, https://www.w3.org/TR/webaudio-1.0/#spatialization . Source orientation cones and listener orientation serve different purposes. The accepted station art is retained; black-and-white reference photographs do not establish a precise paint color.
