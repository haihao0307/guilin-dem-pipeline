#!/usr/bin/env python3
"""Bounded semantic probe for R20 instrumentation comparison contracts.

This does not execute WRF/HRRR and contains no atmospheric truth values. It
models the comparison semantics needed for a control/instrumented pair where
instrumentation intentionally adds re_cloud/re_ice/re_snow.
"""

import hashlib
import json
import struct

EXPECTED_ADDED = {"re_cloud", "re_ice", "re_snow"}


def f64_bits(value):
    return struct.pack(">d", float(value))


def values_equal(a, b, value_type):
    if value_type == "real":
        return len(a) == len(b) and all(f64_bits(x) == f64_bits(y) for x, y in zip(a, b))
    return a == b


def dataset_hash(dataset):
    payload = json.dumps(dataset, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def compare_control_instrumented(control, instrumented, allowed_added):
    errors = []

    if control["times"] != instrumented["times"]:
        errors.append("time_axis")
    if control["dims"] != instrumented["dims"]:
        errors.append("global_dims")

    control_vars = set(control["vars"])
    instrumented_vars = set(instrumented["vars"])

    if not control_vars.issubset(instrumented_vars):
        errors.append("missing_control_vars")

    added = instrumented_vars - control_vars
    if added != set(allowed_added):
        errors.append("added_var_manifest")

    for name in sorted(control_vars & instrumented_vars):
        lhs = control["vars"][name]
        rhs = instrumented["vars"][name]

        if lhs["type"] != rhs["type"]:
            errors.append(f"{name}:type")
        if lhs["dims"] != rhs["dims"]:
            errors.append(f"{name}:dims")
        if lhs.get("attrs", {}) != rhs.get("attrs", {}):
            errors.append(f"{name}:attrs")
        if not values_equal(lhs["values"], rhs["values"], lhs["type"]):
            errors.append(f"{name}:values")

    return errors


def clone(obj):
    return json.loads(json.dumps(obj))


def main():
    control = {
        "times": ["2026-09-10_00:00:00"],
        "dims": {"x": 3, "y": 3, "z": 4},
        "vars": {
            "T": {
                "type": "real",
                "dims": ["x", "y", "z"],
                "attrs": {"units": "K", "stagger": ""},
                "values": [270.0, 271.0],
            },
            "ITIMESTEP": {
                "type": "int",
                "dims": [],
                "attrs": {"units": "1"},
                "values": [10],
            },
        },
    }

    instrumented = clone(control)
    for name in sorted(EXPECTED_ADDED):
        instrumented["vars"][name] = {
            "type": "real",
            "dims": ["x", "y", "z"],
            "attrs": {"units": "m", "stagger": ""},
            "values": [1.0e-5, 2.0e-5],
        }

    tests = []

    tests.append((
        "whole_file_hash_must_differ_with_expected_added_fields",
        dataset_hash(control) != dataset_hash(instrumented),
    ))

    tests.append((
        "allowlisted_asymmetric_state_compare_passes",
        compare_control_instrumented(control, instrumented, EXPECTED_ADDED) == [],
    ))

    bad = clone(instrumented)
    bad["vars"]["UNEXPECTED"] = {"type": "real", "dims": [], "attrs": {}, "values": [1.0]}
    tests.append((
        "unexpected_added_var_rejected",
        "added_var_manifest" in compare_control_instrumented(control, bad, EXPECTED_ADDED),
    ))

    bad = clone(instrumented)
    bad["vars"]["ITIMESTEP"]["values"] = [11]
    tests.append((
        "integer_shared_state_change_detected",
        "ITIMESTEP:values" in compare_control_instrumented(control, bad, EXPECTED_ADDED),
    ))

    bad = clone(instrumented)
    bad["vars"]["T"]["attrs"]["units"] = "C"
    tests.append((
        "shared_metadata_change_detected",
        "T:attrs" in compare_control_instrumented(control, bad, EXPECTED_ADDED),
    ))

    bad = clone(instrumented)
    bad["times"].append("2026-09-10_00:01:00")
    tests.append((
        "extra_time_record_detected",
        "time_axis" in compare_control_instrumented(control, bad, EXPECTED_ADDED),
    ))

    bad = clone(instrumented)
    bad["vars"]["T"]["values"][1] = 271.0000000001
    tests.append((
        "real_field_bit_change_detected",
        "T:values" in compare_control_instrumented(control, bad, EXPECTED_ADDED),
    ))

    zero_control = clone(control)
    zero_control["vars"]["T"]["values"] = [0.0, 271.0]
    bad = clone(instrumented)
    bad["vars"]["T"]["values"] = [-0.0, 271.0]
    tests.append((
        "bitwise_policy_distinguishes_signed_zero",
        "T:values" in compare_control_instrumented(zero_control, bad, EXPECTED_ADDED),
    ))

    passed = 0
    for name, ok in tests:
        print(("PASS" if ok else "FAIL"), name)
        passed += int(ok)

    print(f"{passed}/{len(tests)} PASS")
    raise SystemExit(0 if passed == len(tests) else 1)


if __name__ == "__main__":
    main()
