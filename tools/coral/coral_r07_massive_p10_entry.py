from __future__ import annotations

"""Corrected production entrypoint for R07-P10.

The frozen P09 page has two intentional copies of the build-marker contract:
one in the runtime QA object and one in the publication marker.  P10 must
update both together.  It also still names the old distribution statistic
``siteJitterRms`` before the P10 patch replaces it with Poisson spacing stats.
"""

import coral_r07_massive_p10_poisson_corallites as base


_original_regex_once = base.regex_once
_original_replace_once = base.replace_once


def corrected_regex_once(text: str, pattern: str, replacement: str, label: str) -> str:
    if label == "P10 Poisson sites and subtle integrated corallites":
        pattern = pattern.replace("siteNearestNeighborCv=.*?;", "siteJitterRms=.*?;")
    return _original_regex_once(text, pattern, replacement, label)


def corrected_replace_once(text: str, old: str, new: str, label: str) -> str:
    if label == "P10 build marker distribution evidence":
        count = text.count(old)
        base.require(count == 2, f"{label}: expected two synchronized markers, found {count}")
        return text.replace(old, new)
    return _original_replace_once(text, old, new, label)


base.regex_once = corrected_regex_once
base.replace_once = corrected_replace_once


if __name__ == "__main__":
    base.main()
