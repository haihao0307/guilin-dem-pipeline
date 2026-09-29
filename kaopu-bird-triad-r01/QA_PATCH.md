# Bird Triad R01 corrected UI candidate

Exact standalone HTML SHA256: f8525a61b27f46f6fdbf2a779440d5488adb6c32b64f66f2f908265eb0c1cd3a

Instrument and score data remain unchanged. First browser run verified actual rendering and score-only changes, then correctly stopped on an inaccessible workbench-save control. This candidate places that control in the main export area, fixes the reference-photo option, and clears generated controls on restored-workbench boot so IDs do not duplicate.

All existing browser and isolated-player checks must pass. No visual or production acceptance is inferred from code/test success.
