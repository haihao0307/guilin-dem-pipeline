# WSD Codex source bundle V0.1.0

This directory stores the exact Codex-oriented source package as Base64 chunks because the connector write path is text-only.

## Rebuild

```bash
python3 reconstruct_package.py
unzip ../World_Spectrum_DNA_Codex_Source_V0.1.0_2026-09-08.zip -d ../World_Spectrum_DNA_Codex_Source_V0.1.0_2026-09-08
cd ../World_Spectrum_DNA_Codex_Source_V0.1.0_2026-09-08
cat START_HERE.md
cd prototype && npm test
```

Expected archive SHA256:

`04846fbbc31593e680eb976734460b4df4c31f29391236de02c883d9f7751507`

Parts: 6
