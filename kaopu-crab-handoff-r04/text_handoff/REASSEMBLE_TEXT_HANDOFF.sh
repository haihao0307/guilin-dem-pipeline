#!/usr/bin/env bash
set -euo pipefail
cat KAOPU_CRAB_R04_TEXT_HANDOFF.tar.xz.b64.part-* > KAOPU_CRAB_R04_TEXT_HANDOFF.tar.xz.b64
base64 -d KAOPU_CRAB_R04_TEXT_HANDOFF.tar.xz.b64 > KAOPU_CRAB_R04_TEXT_HANDOFF.tar.xz
tar -xJf KAOPU_CRAB_R04_TEXT_HANDOFF.tar.xz
sha256sum KAOPU_CRAB_R04_TEXT_HANDOFF.tar.xz
