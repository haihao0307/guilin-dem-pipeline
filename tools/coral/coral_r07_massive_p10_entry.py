from __future__ import annotations

"""Corrected production entrypoint for R07-P10.

The first P10 run failed before browser startup because the exact P09 baseline
still names the old distribution statistic ``siteJitterRms``.  The P10 patch
looked for the future ``siteNearestNeighborCv`` name too early.  This wrapper
corrects only that frozen-baseline match and then runs the original builder.
"""

import coral_r07_massive_p10_poisson_corallites as base


_original_regex_once = base.regex_once


def corrected_regex_once(text: str, pattern: str, replacement: str, label: str) -> str:
    if label == "P10 Poisson sites and subtle integrated corallites":
        pattern = pattern.replace("siteNearestNeighborCv=.*?;", "siteJitterRms=.*?;")
    return _original_regex_once(text, pattern, replacement, label)


base.regex_once = corrected_regex_once


if __name__ == "__main__":
    base.main()
