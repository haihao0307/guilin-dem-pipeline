from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    path = ROOT / "pipeline" / "build_online_assets.py"
    text = path.read_text(encoding="utf-8")
    old = '    3: ("资江", "資江", "资水", "資水", "zi river", "zi jiang", "zijiang", "zi shui", "zishui"),'
    new = '    3: ("资江", "資江", "资水", "資水", "夫夷水", "夫夷江", "zi river", "zi jiang", "zijiang", "zi shui", "zishui", "fuyi river", "fu yi river", "fuyi shui"),'
    if old not in text:
        if new in text:
            print("Zi mainstem aliases already present")
            return
        raise RuntimeError("Zi mainstem pattern anchor missing")
    text = text.replace(old, new, 1)
    styling_anchor = '            "mainstem_names": ["漓江", "湘江", "资江"],'
    if styling_anchor in text:
        text = text.replace(
            styling_anchor,
            styling_anchor + '\n            "mainstem_aliases": {"zi": ["夫夷水", "夫夷江", "Fuyi River"]},',
            1,
        )
    path.write_text(text, encoding="utf-8")
    print("Mapped Fuyi upper reach to the Zi River mainstem hierarchy")


if __name__ == "__main__":
    main()
