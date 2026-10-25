# A4 teacher-axis observations

This package contains only a readable report, compact numerical observations and independently written read-only analysis scripts. It contains no original source meshes, position/index buffers, textures, source archive, vendor code, private Library metadata or source-geometry inspection images.

## Read first

- TEACHER_AXIS_REPORT.zh-CN.md: results and explicit evidence boundaries.
- AXIS_SUMMARY.json: compact machine-readable observations.
- scripts/: reproducible read-only analysis.

The observed teacher is timblewee's “Train Class A4 Union of South Africa,” licensed CC BY 4.0 in the reference archive:
https://sketchfab.com/3d-models/train-class-a4-union-of-south-africa-636ed4890b72429da4a10abec0551373

All linear values remain uncalibrated source units. No middle-cylinder axis has been identified in the inspected source geometry. Do not turn missing observations into a proof that all hidden geometry is absent. The displaced middle-axle ring's mechanical function is unresolved.

## Reproduce privately

Use Python 3 with NumPy, SciPy and matplotlib. Independently obtain an authorized original source-assets/a4 directory containing object.json and fields.bin.gz. No network/download is performed by these scripts.

```sh
python3 scripts/run_measurements.py \
  --source /absolute/path/to/authorized/source-assets/a4 \
  --output /absolute/path/to/private-a4-measurement-run
```

The output directory must be outside the source directory. Scripts verify every stored binary-field hash, use glTF column-major matrices and XYZW quaternions, and account for the difference between rest/default nodes and the first animated pose.

Detailed component bounds and numeric tables are written under results/. Source-derived inspection plots are written under private-inspection/. Both are private reproduction output; do not recursively include them in public Git or release archives. Only the compact AXIS_SUMMARY.json was selected for this deliverable.

PCA rod axes are statistical geometry directions, not fitted joint-center lines. Samples are discrete, not a continuous collision proof. Source-model observations must not be represented as independently verified historical locomotive geometry.
