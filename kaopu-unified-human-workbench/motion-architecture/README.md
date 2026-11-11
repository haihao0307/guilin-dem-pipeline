# KAOPU Motion Library R02

This module builds a data-only motion catalogue. It does not store character meshes, textures, preview images, videos, thumbnails, or unrelated source metadata.

## Accepted source categories

Only source identifiers beginning with `CMU` or `Mesh2Motion` are accepted. The builder excludes R41/R4E identifiers and every other source family, including Quaternius prototypes. The source clips themselves are not deleted; the returned library simply does not include them.

Each exported clip record contains only its action identity, source category, shared skeleton reference, frame rate, frame count, and channel/family references. Skeleton definitions are stored once. Channel payloads are content-addressed and stored once.

## Compression

1. Exact duplicate channels share one payload.
2. Similar clips with the same category, skeleton, frame rate, frame count, and channel topology may share a parent action.
3. Each variant stores per-axis affine parameters plus a bounded residual track. The variant is accepted only if decoded error stays within `maxError` and serialized channel data is at least `minSavings` smaller than storing the clip independently.
4. If a clip does not qualify, it remains an independent channel record. The encoder does not force a poor fit.

The family table exposes `parentChannelRefs` and variant residual packets. Resolve those references through the top-level `channels` object, then call `decodeParameterizedVariant(parentChannels, variantPacket)`.

## Jitter handling

- `smoothVectorTrack` is an adaptive low-pass filter for vector tracks. When a contact mask is supplied, horizontal planted-foot coordinates are held at the contact anchor; endpoint correction does not move those axes.
- `smoothQuaternionTrack` uses shortest-arc quaternion interpolation and normalizes every output quaternion, avoiding q/-q representation flips.
- These functions are offline preprocessing utilities. They are not automatically applied to a live player's data until that runtime explicitly calls them. Filtering is not a substitute for correct retargeting, rest-pose alignment, contact labels, or frame-rate metadata.

## Size accounting

`stats.inputActionBytes` measures the serialized action-only input (CMU/Mesh2Motion records and the required skeleton/channel data). `stats.encodedBytes` measures the serialized compact library payload, including its skeleton registry, action index, channel table, and family residuals. This is not a measurement of the separate 1.49 GB Atlas site bundle or of a deployed website.

## Verification

Run:

```sh
node --test kaopu-unified-human-workbench/tests/motion-library-r02.test.mjs
```

Tests cover delta round-trip error, category filtering, R41/R4E/Quaternius exclusion, shared skeletons and channels, parent/parameter/residual compression, planted-foot anchoring, and quaternion normalization.
