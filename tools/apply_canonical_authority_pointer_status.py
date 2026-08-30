from __future__ import annotations

from pathlib import Path


def main() -> int:
    path = Path("pipeline/build_online_assets_from_canonical_store.py")
    text = path.read_text(encoding="utf-8")
    old = 'if pointer.get("status") != "PIXEL_EXACT_VERIFIED_CUTOVER_PENDING":\n        raise RuntimeError("canonical store pointer is not in the verified cutover-pending state")'
    new = 'if pointer.get("status") not in {"PIXEL_EXACT_VERIFIED_CUTOVER_PENDING", "AUTHORITATIVE_PRODUCTION_SOURCE"}:\n        raise RuntimeError("canonical store pointer is not verified or authoritative")'
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"canonical pointer status guard: expected 1 occurrence, found {count}")
    path.write_text(text.replace(old, new), encoding="utf-8")
    print("canonical store builder now accepts the authoritative production pointer")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
