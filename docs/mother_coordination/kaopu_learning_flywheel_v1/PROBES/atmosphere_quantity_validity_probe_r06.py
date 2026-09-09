from dataclasses import dataclass
from typing import Optional
import math


@dataclass(frozen=True)
class QuantityContract:
    model_domain_km: tuple[float, float]
    quantity_min_km: float
    threshold_status: str
    missing_numeric_sentinel: Optional[float] = None
    sentinel_status: str = "Unknown"


NO = QuantityContract(
    model_domain_km=(0.0, 1000.0),
    quantity_min_km=72.5,
    threshold_status="Observation-primary-paper",
    missing_numeric_sentinel=9.999e-38,
    sentinel_status="Candidate-mirror-source",
)


def classify_no(z_km: float) -> str:
    if not (NO.model_domain_km[0] <= z_km <= NO.model_domain_km[1]):
        return "outside-model-domain"
    return "quantity-valid" if z_km >= NO.quantity_min_km else "quantity-unsupported"


def parse_density(raw: float, sentinel: Optional[float]) -> dict:
    if sentinel is not None and raw == sentinel:
        return {"status": "missing", "value": None}
    if raw <= 0:
        raise ValueError("density must be positive or explicitly missing")
    return {"status": "value", "value": raw}


def main() -> None:
    assert classify_no(70.0) == "quantity-unsupported"
    assert classify_no(72.49) == "quantity-unsupported"
    assert classify_no(72.5) == "quantity-valid"
    assert classify_no(500.0) == "quantity-valid"

    safe = parse_density(NO.missing_numeric_sentinel, NO.missing_numeric_sentinel)
    assert safe["status"] == "missing"

    # Deliberately demonstrate the failure mode if a source sentinel is treated
    # as a physical density before source-aware parsing.
    unsafe_log10 = math.log10(NO.missing_numeric_sentinel)

    validation_contract = {
        "first15": "fit",
        "second15": "validation",
        "samplingWithReplacement": True,
        "crossEnsembleDuplicatePossible": True,
        "sampleDisjointnessGuaranteed": False,
    }
    assert validation_contract["sampleDisjointnessGuaranteed"] is False

    print(
        {
            "classifications": {
                z: classify_no(z)
                for z in (0, 50, 70, 72.49, 72.5, 73, 100, 500, 1000)
            },
            "safeSentinelParse": safe,
            "unsafeLog10IfNotMasked": unsafe_log10,
            "validationContract": validation_contract,
        }
    )


if __name__ == "__main__":
    main()
