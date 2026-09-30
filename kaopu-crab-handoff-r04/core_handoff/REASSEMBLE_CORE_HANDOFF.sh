#!/usr/bin/env bash
set -euo pipefail
cat KAOPU_CRAB_R04_CORE_HANDOFF.tar.xz.b64.part-* > KAOPU_CRAB_R04_CORE_HANDOFF.tar.xz.b64
base64 -d KAOPU_CRAB_R04_CORE_HANDOFF.tar.xz.b64 > KAOPU_CRAB_R04_CORE_HANDOFF.tar.xz
echo "ed42411b143e8bbc7a2295d87516915bf269fdef00d41dc161a4b71c0e1dc66d  KAOPU_CRAB_R04_CORE_HANDOFF.tar.xz" | sha256sum -c -
tar -xJf KAOPU_CRAB_R04_CORE_HANDOFF.tar.xz
