from dataclasses import dataclass
from enum import Enum


class Tri(str, Enum):
    YES = "yes"
    NO = "no"
    UNKNOWN = "unknown"
    NA = "n/a"


@dataclass(frozen=True)
class IndependenceVector:
    sample_split_independent: Tri
    instrument_source_independent: Tri
    retrieval_uses_model_under_test: Tri
    shared_upstream_prior_dependency: Tri

    def fully_independent_claim(self) -> Tri:
        """Conservative evidence-independence reducer.

        A fully-independent claim requires a genuinely different source and no
        known or unknown dependency on the model under test or a shared upstream
        prior. Unknown remains Unknown rather than being silently promoted.
        """
        if self.instrument_source_independent != Tri.YES:
            return Tri.NO if self.instrument_source_independent == Tri.NO else Tri.UNKNOWN

        for dependency in (
            self.retrieval_uses_model_under_test,
            self.shared_upstream_prior_dependency,
        ):
            if dependency == Tri.YES:
                return Tri.NO
            if dependency == Tri.UNKNOWN:
                return Tri.UNKNOWN

        return Tri.YES


CASES = {
    # A withheld sample can be statistically separate while still coming from
    # the same instrument/source family used to fit the empirical model.
    "same-instrument-holdout": IndependenceVector(
        Tri.YES, Tri.NO, Tri.UNKNOWN, Tri.UNKNOWN
    ),

    # SCIAMACHY was external to the six NRLMSIS 2.1 NO fitting instrument
    # families, but this bounded probe does not assert that every upstream
    # retrieval dependency is known to be independent.
    "sciamachy-external-sensor": IndependenceVector(
        Tri.YES, Tri.YES, Tri.UNKNOWN, Tri.UNKNOWN
    ),

    # The 2025 SABER NO v1.1 retrieval uses NRLMSIS 2.1 estimates of
    # temperature, O and O2, so it contributes new sensor/local-time evidence
    # but cannot be treated as fully independent confirmation of the model.
    "saber-no-v1.1": IndependenceVector(
        Tri.YES, Tri.YES, Tri.YES, Tri.UNKNOWN
    ),
}


if __name__ == "__main__":
    assert CASES["same-instrument-holdout"].fully_independent_claim() == Tri.NO
    assert CASES["sciamachy-external-sensor"].fully_independent_claim() == Tri.UNKNOWN
    assert CASES["saber-no-v1.1"].fully_independent_claim() == Tri.NO

    for name, vector in CASES.items():
        print(name, vector.fully_independent_claim().value)
