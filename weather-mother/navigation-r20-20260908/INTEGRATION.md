# Weather Mother R20 cloud module

The module preserves the two accepted artistic cloud renderers. It exposes camera navigation and procedural time. Coordinates are artistic scene units, not meters; there is no real wind, physical density, or sun-position API in this revision.

```html
<div id="clouds" style="height:75vh"></div>
<script type="module">
  import { mountClouds } from './weather-clouds.js';
  const clouds = await mountClouds(document.querySelector('#clouds'), {
    scene: 'silver', // 'silver' or 'sea'
    controls: true
  });
  await clouds.setEnvironment({ playing: true, animationRate: 0.13 });
  await clouds.setCamera({ offset: [0, 0, 0.25], yaw: 0.3, pitch: 0 });
  const saved = (await clouds.getState()).snapshot;
  await clouds.suspend(true);
  await clouds.suspend(false);
  await clouds.restoreSnapshot(saved);
  // On host unmount:
  // clouds.destroy();
</script>
```

The default URL is `index.html` beside the SDK. A different host may pass a fixed public HTTPS URL via the `url` option. Mount returns only after the first GPU frame is ready. A load, initialization, or request failure rejects the promise. Parent/child commands use a versioned postMessage channel, verify the sender window, and return structured results. The SDK checks the child origin. The child accepts commands only from its own embedding parent. No arbitrary code or network commands are accepted.

Methods: `getState`, `setScene`, `setCamera`, `setEnvironment`, `restoreSnapshot`, `reset`, `suspend`, `focus`, `destroy`. Camera values must be finite; positions and angles are bounded. Environment accepts only finite `time`, finite `animationRate` (clamped to 0–1) and boolean `playing`. Snapshots use schema version 1. Scene switching preserves each cloud's camera/time/playback independently. Reset restores the reference pose and time while preserving the playback choice.

Host-controlled time: set `playing:false`, then send `setEnvironment({time})` from the host clock. There is no automatic weather-to-shader parameter mapping. Keep a fixed public version URL to avoid behavior drifting under an existing integration.

## Limits

| Scene | R19 forward limit | R20 forward limit | R19 yaw | R20 yaw |
|---|---:|---:|---:|---:|
| Silver | 0.30 | 0.50 | ±0.20 rad | ±0.60 rad |
| Sea | 8 | 15 | ±0.03 rad | ±0.08 rad |

Silver pitch is ±0.20 rad; sea pitch is ±0.02 rad. These are deliberately bounded views of the original fields. Deep interiors and unrestricted 360° flight remain experimental and are not advertised by this module. The separate original R14 flight module remains available in the main preview.

Delivery follows PUBLIC_PREVIEW_DELIVERY_RULE.md. The public fixed-version preview is the main user handoff; this SDK/documentation is an additional integration artifact.
