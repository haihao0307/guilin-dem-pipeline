# 九龍晨光 · 首程 / Kowloon Morning · First Leg

An original score made for the user's KCR R10 train workbench, 8 October 2026.
The assistant composed, arranged and procedurally rendered this synthetic
performance from the included Python score. It uses no recordings, sampled
music, soundfonts, third-party tune input, singing or speech. It is new game
music with a warm period-inspired sound, not an archival KCR recording or a
claim of human musicians performing.

The arrangement is 32 bars in D major, 4/4 at 86 BPM: nylon-string lead and
fingerpicked accompaniment, rounded bass, quiet electric-piano harmony and
soft brushes. The four eight-bar sections introduce the melody, vary it,
develop a contrasting phrase, then return to a cadence. Small deterministic
timing and tuning variations, string-mode decay and short room reflections
soften the synthesized performance. No periodic single-tone alert is used.

`kowloon-morning-original-r10.mp3` is the deployment asset: stereo 44.1 kHz,
160 kbit/s, approximately 93.3 seconds and 1.87 MB. `manifest.json` records
the exact duration, byte count, SHA-256 and provenance. This original generated
asset is supplied for inclusion and publication in the user-authorized train
workbench; it has no third-party music licensing dependency.

## Rebuild

Run `python3 music/render_first_leg.py` with Python, NumPy, SciPy and FFmpeg
installed. It renders the entire piece from the written score and DSP; no
network access or external music assets are required. The temporary PCM WAV
is removed after MP3 encoding. The seed is fixed; encoder/package versions
can affect the final compressed hash.

## Runtime contract

Import `createJourneyMusic` from `../music.mjs` and create one instance. Its
separate music volume defaults to 32%, independent from locomotive effects.

- `unlock()` is called from a user activation. It creates the single audio
  context, fetches and decodes the MP3, and resumes only if music is enabled,
  the game is not paused and the document is visible. Repeated/concurrent
  unlocks do not fetch or create a second source.
- `update(view)` runs every frame with the actual Session view. The cue starts
  when station index 1 is active: Kowloon doors have closed and Yaumati is the
  target. Waiting at Kowloon does not consume the track. The source is one-shot,
  with no repeated whole-track loop.
- `setPaused(true)` fades out in 18 milliseconds and suspends the context. A
  newer resume cancels an older pending suspension. The source
  stays in place and the audio clock freezes. `setPaused(false)` is used by
  the user-gesture resume handler. `update` itself never resumes a context.
- `setEnabled(bool)` controls only music, preserving its position when off.
  Turning it on while the game is paused cannot resume playback. The UI can
  call `unlock` from the same gesture if no context has yet been created.
- `setVolume(0..1)` sets only the music level.
- `getState()` exposes `loaded/ready`, `state`, `audioClock`, `sourceStarts`,
  `activeSources`, `cueStarted`, `finished`, `position`, `stage`, `gainTarget`,
  `duckFactor`, `duckReasons`, `enabled`, `paused`, `volume` and `errors`.
- `dispose()` stops and disconnects the source, closes its context and removes
  the visibility listener. Pending decode cannot create a source afterward.

Whistle, departure whistle, steam and door events cause short gain reductions;
braking and station approach also lower the music. Effects get priority quickly,
and the music returns gradually. At Yaumati, the theme rises quietly after the
arrival sounds, then fades over the final nine seconds of a fifteen-second
  settlement. Going beyond Yaumati ends it within four seconds, or immediately
  when disabled/paused so a later station cannot restart it. Loading a saved
game already past Yaumati, or already boarded there, does not start the cue.
A new Session with a lower tick or elapsed time resets the score and stops its
old source. Playback never overlaps between runs.

## Verification and limits

Run `node --test music.test.mjs`. Tests exercise first-departure gating,
concurrent unlock, pause/enable interactions, source count, visibility,
ducking/recovery, first-leg scope, new-session reset, old-save suppression,
pause/dispose during decode, missing-asset reporting, manifest/hash consistency,
and full FFmpeg decoding of the actual deployment MP3 to bounded non-clipping
stereo PCM. These checks establish file and playback behavior. They do not
constitute a human listening review or prove that its timbre sounds like a real
acoustic recording. No actual listening is claimed in this delivery.

`tests/music-browser.cjs` is the separate real-browser regression, run with
`TRAIN_BROWSER=chromium` or `TRAIN_BROWSER=webkit` and `TRAIN_GAME_URL` pointing
to the served game directory. It uses native controls at 844×390, downloads and
decodes the actual MP3, advances the original Session after a trusted start,
and checks pause/resume, independent controls, single-source playback, ducking,
first-leg settlement, restart and a real replay-backed later-station save.
`node tests/music-browser.cjs --validate-only` checks syntax/local inputs only;
it does not run a browser. Results distinguish these two verification stages.
