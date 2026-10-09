#!/usr/bin/env python3
"""Render the original R10 score. No samples, soundfonts or existing melody inputs.

Requires numpy, scipy and ffmpeg. Run from any directory; MP3 is written beside
this source. The seed fixes the performance's tiny timing/timbre variations.
"""
from pathlib import Path
import hashlib
import json
import subprocess
import tempfile
import numpy as np
from scipy import signal
from scipy.io import wavfile

HERE = Path(__file__).resolve().parent
SR = 44100
BPM = 86
BEAT = 60 / BPM
BARS = 32
DURATION = BARS * 4 * BEAT + 4.0
rng = np.random.default_rng(19730620)
mix = np.zeros((int(DURATION * SR), 2), dtype=np.float64)


def place(wave, when, level=1, pan=0):
    start = max(0, round(when * SR))
    count = min(len(wave), len(mix) - start)
    if count <= 0:
        return
    # Almost mono, as a small cabin radio, with gentle room width.
    angle = (pan + 1) * np.pi / 4
    mix[start:start + count, 0] += wave[:count] * level * np.cos(angle)
    mix[start:start + count, 1] += wave[:count] * level * np.sin(angle)


def frequency(midi):
    return 440 * 2 ** ((midi - 69) / 12)


def guitar(midi, seconds=2.4, melody=False):
    """Damped string modes, pluck-position filtering and a quiet wood attack."""
    t = np.arange(round(seconds * SR)) / SR
    f = frequency(midi) * 2 ** (rng.normal(0, 1.5) / 1200)
    pluck = .18 if melody else .24
    sound = np.zeros_like(t)
    # Partial decay grows with harmonic number. No unchanging oscillator tone.
    phase = 2 * np.pi * f * t + .022 * np.sin(2 * np.pi * 4.2 * t) * np.minimum(1, t / .5)
    for harmonic in range(1, min(34, int(12000 / f))):
        amplitude = np.sin(np.pi * harmonic * pluck) / harmonic ** 1.28
        decay = (.95 if melody else .72) / (1 + .14 * harmonic ** 1.16)
        envelope = np.exp(-t / decay) + .17 * np.exp(-t / (decay * 3.1))
        sound += amplitude * envelope * np.sin(harmonic * phase + .003 * harmonic * harmonic)
    attack = 1 - np.exp(-t / (.004 if melody else .0028))
    release = np.minimum(1, np.maximum(0, seconds - t) / .11)
    noise = rng.standard_normal(len(t))
    wood = signal.sosfilt(signal.butter(2, [110, 2200], btype='bandpass', fs=SR, output='sos'), noise)
    sound = sound * attack + .045 * wood * np.exp(-t / .021)
    return sound * release


def bass(midi, seconds=1.6):
    t = np.arange(round(seconds * SR)) / SR
    f = frequency(midi)
    phase = 2 * np.pi * f * (t + .000015 * np.sin(2 * np.pi * 3.1 * t))
    sound = sum(a * np.sin((i + 1) * phase) * np.exp(-t / (.78 / (1 + i * .28)))
                for i, a in enumerate([1, .3, .11, .04]))
    return sound * (1 - np.exp(-t / .015)) * np.minimum(1, (seconds - t) / .08)


def keys(midi, seconds=3.2):
    t = np.arange(round(seconds * SR)) / SR
    f = frequency(midi)
    # A soft, low-level electric-piano cushion, with no hard bell attack.
    phase = 2 * np.pi * f * t
    wave = np.sin(phase + .32 * np.exp(-t / .32) * np.sin(2 * phase))
    wave += .11 * np.sin(3 * phase) * np.exp(-t / .48)
    return wave * (1 - np.exp(-t / .025)) * np.exp(-t / 1.6) * np.minimum(1, (seconds - t) / .12)


def brush(seconds=.38, sweep=False):
    t = np.arange(round(seconds * SR)) / SR
    raw = rng.standard_normal(len(t))
    wave = signal.sosfilt(signal.butter(2, [650, 5500], btype='bandpass', fs=SR, output='sos'), raw)
    env = np.sin(np.pi * t / seconds) ** 1.3 if sweep else (1 - np.exp(-t / .007)) * np.exp(-t / .055)
    return wave * env


# Original 32-bar harmonic form. Four sections develop a six-note central idea.
# Guitar voicings fit an open-position acoustic range; D major, 4/4, 86 BPM.
chords = {
    'D6': (38, [50, 57, 59, 66, 69]),
    'D9': (38, [50, 57, 64, 66, 69]),
    'Bm7': (35, [47, 54, 57, 62, 66]),
    'Em9': (40, [52, 55, 62, 66, 71]),
    'A13': (33, [45, 55, 61, 66, 69]),
    'Gmaj7': (31, [43, 54, 59, 62, 67]),
    'Fsm7': (30, [42, 52, 57, 61, 66]),
    'Asus': (33, [45, 52, 57, 62, 64]),
    'G6': (31, [43, 52, 55, 59, 62]),
    'A7': (33, [45, 52, 55, 61, 64]),
}
progression = [
    'D6', 'D9', 'Bm7', 'Bm7', 'Em9', 'A13', 'Gmaj7', 'Asus',
    'D6', 'Fsm7', 'Bm7', 'Em9', 'Gmaj7', 'A13', 'D6', 'D9',
    'Gmaj7', 'G6', 'Fsm7', 'Bm7', 'Em9', 'Gmaj7', 'Asus', 'A7',
    'D6', 'Fsm7', 'Bm7', 'Em9', 'Gmaj7', 'A13', 'D9', 'D6',
]

# (onset in beats, MIDI pitch, length in beats). Breathing spaces are intentional.
# Not derived from, or intended to reproduce, any existing recording/composition.
melodies = [
    [], [(2, 66, .7), (3, 69, .6), (3.7, 71, .3)],
    [(0, 74, 1.4), (1.7, 71, .6), (2.5, 69, 1.1)],
    [(.5, 66, .7), (1.5, 69, .7), (2.5, 71, 1.0)],
    [(0, 67, 1.3), (1.75, 66, .65), (2.6, 64, 1.0)],
    [(.4, 66, .65), (1.3, 64, .5), (2, 61, 1.3)],
    [(0, 62, 1.2), (1.7, 66, .7), (2.65, 64, 1.0)],
    [(0, 62, 2.4)],
    [(.35, 66, .65), (1.25, 69, .65), (2.3, 74, 1.2)],
    [(0, 73, .8), (1.2, 69, .7), (2.2, 66, 1.4)],
    [(.1, 71, 1.1), (1.6, 74, .6), (2.5, 78, 1.2)],
    [(0, 76, 1), (1.4, 74, .55), (2.25, 71, 1.35)],
    [(0, 74, 1.2), (1.8, 71, .55), (2.6, 69, 1.0)],
    [(.25, 66, .7), (1.3, 64, .65), (2.3, 61, 1.1)],
    [(0, 62, 1.6), (2.15, 64, .5), (3, 66, .8)],
    [(0, 69, 2.5)],
    [(.3, 71, .7), (1.3, 74, .7), (2.5, 78, 1.1)],
    [(0, 79, 1.4), (1.9, 78, .6), (2.75, 74, .8)],
    [(.2, 76, .9), (1.5, 73, .6), (2.5, 69, 1.0)],
    [(0, 71, 1.7), (2.25, 69, .55), (3.1, 66, .7)],
    [(0, 67, 1.0), (1.4, 71, .65), (2.45, 74, 1.2)],
    [(0, 71, 1.25), (1.8, 69, .6), (2.75, 67, .9)],
    [(.3, 66, .7), (1.4, 64, .65), (2.5, 62, 1.0)],
    [(0, 61, 1.5), (2.2, 64, .55), (3.05, 69, .7)],
    [(0, 74, 1.3), (1.7, 71, .55), (2.65, 69, 1.0)],
    [(.3, 66, .8), (1.6, 69, .6), (2.65, 73, 1.0)],
    [(0, 74, 1.3), (1.75, 71, .65), (2.75, 69, .8)],
    [(.3, 67, .8), (1.6, 66, .6), (2.6, 64, 1.0)],
    [(0, 62, 1.3), (1.8, 66, .65), (2.8, 67, .7)],
    [(.15, 66, .85), (1.5, 64, .65), (2.65, 61, 1.0)],
    [(0, 62, 1.5), (2.1, 64, .55), (3, 66, .7)],
    [(0, 62, 3.3)],
]

for bar, chord in enumerate(progression):
    root, notes = chords[chord]
    start = bar * 4 * BEAT + .12
    dynamic = .79 if bar < 2 else (1.0 if bar < 16 else (1.09 if bar < 24 else .91))
    if bar >= 30:
        dynamic *= .85
    # A thumb/finger pattern, slightly laid back. Pattern changes every second bar.
    pattern = [0, 2, 3, 1, 4, 2, 3, 1] if bar % 2 == 0 else [0, 3, 2, 4, 1, 3, 2, 4]
    if bar == 31:
        pattern = [0, 1, 2, 3, 4]
    for j, index in enumerate(pattern):
        swing = .025 if j % 2 else 0
        at = start + (j * .5 + swing) * BEAT + rng.uniform(-.008, .009)
        level = (.12 if j in [0, 4] else .089) * dynamic * rng.uniform(.9, 1.07)
        place(guitar(notes[index]), at, level, -.2)
    place(bass(root, 2.0), start, .14 * dynamic, -.04)
    if bar < 31:
        place(bass(root + (7 if bar % 2 else 12), 1.4), start + 2.2 * BEAT, .105 * dynamic, -.04)
    if bar >= 2:
        for midi in notes[-3:]:
            place(keys(midi, 3.5), start + .023, .018 * dynamic, .18)
    if 2 <= bar < 31:
        for beat in [1, 3]:
            place(brush(.24), start + beat * BEAT + rng.uniform(.006, .024), .046 * dynamic, .12)
        if bar % 2 == 0:
            place(brush(.7, sweep=True), start + 2.8 * BEAT, .013 * dynamic, -.1)
    for onset, midi, length in melodies[bar]:
        duration = min(3.8, length * BEAT + .75)
        place(guitar(midi, duration, melody=True), start + onset * BEAT + .014,
              .24 * dynamic * rng.uniform(.96, 1.04), .12)
        # Restrained phrase-ending harmony, not a constant doubled melody.
        if bar in [7, 15, 31] and onset == 0:
            harmony = 57 if bar != 15 else 66
            place(guitar(harmony, duration, melody=True), start + .035, .065 * dynamic, -.13)

# A modest early room reflection and darker diffuse tail; no vinyl gimmick noise.
dry = mix.copy()
for delay, level, cross in [(.037, .10, True), (.073, .065, False), (.127, .048, True),
                            (.193, .036, False), (.281, .025, True)]:
    n = round(delay * SR)
    tail = signal.sosfilt(signal.butter(1, 3200, fs=SR, output='sos'), dry[:-n], axis=0)
    mix[n:] += level * (tail[:, ::-1] if cross else tail)
# Warm radio colour without crushing musical dynamics or making the lead shrill.
mix = signal.sosfilt(signal.butter(2, 64, btype='highpass', fs=SR, output='sos'), mix, axis=0)
mix = signal.sosfilt(signal.butter(2, 6200, fs=SR, output='sos'), mix, axis=0)
mix = np.tanh(mix * 1.45) / 1.45
mix *= .79 / max(np.max(np.abs(mix)), .00001)
fade_in = np.minimum(1, np.arange(len(mix)) / (SR * .7))
fade_out = np.minimum(1, (len(mix) - 1 - np.arange(len(mix))) / (SR * 2.8))
mix *= (fade_in * fade_out)[:, None]

asset = HERE / 'kowloon-morning-original-r10.mp3'
with tempfile.TemporaryDirectory() as temp:
    wav = Path(temp) / 'score.wav'
    wavfile.write(wav, SR, np.round(np.clip(mix, -1, 1) * 32767).astype(np.int16))
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(wav),
                    '-codec:a', 'libmp3lame', '-b:a', '160k', '-id3v2_version', '3',
                    '-metadata', 'title=Kowloon Morning - First Leg',
                    '-metadata', 'artist=Original procedural composition for KCR R10',
                    '-metadata', 'comment=Original synthetic performance; no archival recording or sampled music',
                    str(asset)], check=True)
meta = {
    'id': 'kowloon-morning-original-r10',
    'title': '九龍晨光 · 首程',
    'titleEnglish': 'Kowloon Morning · First Leg',
    'authorship': 'Original composition, arrangement and procedural synthetic performance created by the assistant for this user\u2019s KCR R10 workbench, 2026-10-08.',
    'provenance': 'Generated entirely from the score and DSP in render_first_leg.py. No external samples, soundfonts, recordings or existing tune inputs.',
    'historicalStatus': 'A newly made period-inspired game score, not a historical KCR recording. No singing, speech or claimed human performance.',
    'style': 'Warm nylon-string melody and fingerpicking, round bass, quiet electric-piano harmony and soft brushes; gentle radio/room colouring.',
    'tempoBpm': BPM,
    'key': 'D major',
    'metre': '4/4',
    'bars': BARS,
    'form': '8-bar introduction/theme, 8-bar variation, 8-bar contrasting phrase, 8-bar returning theme and cadence',
    'renderedDurationSeconds': round(DURATION, 6),
    'sampleRate': SR,
    'channels': 2,
    'encoding': 'MP3, 160 kbit/s',
    'file': asset.name,
    'bytes': asset.stat().st_size,
    'sha256': hashlib.sha256(asset.read_bytes()).hexdigest(),
    'scoreSource': 'render_first_leg.py',
    'publication': 'Original generated asset supplied for inclusion and publication in the user-authorized train workbench. No third-party music licensing dependency.',
    'validation': 'Rendered from deterministic source; numerical level and decode verification are recorded separately. No claim of a human listening review.',
}
(HERE / 'manifest.json').write_text(json.dumps(meta, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(meta, ensure_ascii=False, indent=2))
print('PCM peak', float(np.max(np.abs(mix))), 'RMS', float(np.sqrt(np.mean(mix ** 2))))
