import json
import os
import shutil
import sys
from pathlib import Path

from securesystemslib.signer import CryptoSigner

from in_toto.models.layout import Layout, Step
from in_toto.models.metadata import Metablock
from in_toto.runlib import in_toto_run
from in_toto.verifylib import in_toto_verify


ROOT = Path(__file__).resolve().parent
NODE = shutil.which("node")
if NODE is None:
    raise RuntimeError("node executable is required")


def public_dict(signer):
    value = signer.public_key.to_dict()
    value["keyid"] = signer.public_key.keyid
    return value


def build_layout(owner, producer, require_hidden=False):
    layout = Layout()
    layout.set_relative_expiration(months=1)
    layout.add_functionary_key(public_dict(producer))

    step = Step(name="execute")
    step.pubkeys = [producer.public_key.keyid]
    step.threshold = 1
    step.set_expected_command_from_string(f"{NODE} runner.mjs")
    step.add_material_rule_from_string("ALLOW runner.mjs")
    step.add_material_rule_from_string("ALLOW declared-command-binding.mjs")
    if require_hidden:
        step.add_material_rule_from_string("REQUIRE hidden-runtime-wrapper.mjs")
        step.add_material_rule_from_string("ALLOW hidden-runtime-wrapper.mjs")
    step.add_material_rule_from_string("DISALLOW *")
    step.add_product_rule_from_string("CREATE result.json")
    step.add_product_rule_from_string("DISALLOW *")
    layout.steps = [step]

    metadata = Metablock(signed=layout)
    metadata.create_signature(owner)
    return metadata


def run_fixture(name, producer, material_list):
    work = ROOT / name
    old = Path.cwd()
    os.chdir(work)
    try:
        for path in work.glob("execute.*.link"):
            path.unlink()
        result = work / "result.json"
        if result.exists():
            result.unlink()
        link = in_toto_run(
            name="execute",
            material_list=material_list,
            product_list=["result.json"],
            link_cmd_args=[NODE, "runner.mjs"],
            signer=producer,
        )
        observed = json.loads(result.read_text())
        return link, observed
    finally:
        os.chdir(old)


def verify(layout, owner, fixture):
    try:
        in_toto_verify(
            layout,
            {owner.public_key.keyid: public_dict(owner)},
            link_dir_path=str(ROOT / fixture),
        )
        return {"passed": True, "errorType": None}
    except Exception as exc:  # probe records the exact fail-closed class
        return {"passed": False, "errorType": type(exc).__name__}


owner = CryptoSigner.generate_ed25519()
producer = CryptoSigner.generate_ed25519()
attacker = CryptoSigner.generate_ed25519()

declared_only = ["runner.mjs", "declared-command-binding.mjs"]
standard_layout = build_layout(owner, producer, require_hidden=False)
closure_layout = build_layout(owner, producer, require_hidden=True)

pristine_link, pristine_result = run_fixture("pristine", producer, declared_only)
pristine_verify = verify(standard_layout, owner, "pristine")

mutated_link, mutated_result = run_fixture("mutated", producer, declared_only)
mutated_verify = verify(standard_layout, owner, "mutated")
closure_verify = verify(closure_layout, owner, "mutated")

attacker_link, _ = run_fixture("mutated", attacker, declared_only)
attacker_verify = verify(standard_layout, owner, "mutated")

output = {
    "schema": "kaopu.in-toto-hidden-runtime-probe/1.0",
    "pinnedReferenceImplementation": "in-toto==3.1.0",
    "standardLayout": {
        "materialsRules": [
            "ALLOW runner.mjs",
            "ALLOW declared-command-binding.mjs",
            "DISALLOW *",
        ],
        "authorizedFunctionary": "producer",
    },
    "pristine": {
        "semanticOutput": pristine_result,
        "recordedMaterials": sorted(pristine_link.signed.materials),
        "hiddenWrapperRecorded": "hidden-runtime-wrapper.mjs"
        in pristine_link.signed.materials,
        "verification": pristine_verify,
    },
    "mutatedHiddenWrapper": {
        "semanticOutput": mutated_result,
        "recordedMaterials": sorted(mutated_link.signed.materials),
        "hiddenWrapperRecorded": "hidden-runtime-wrapper.mjs"
        in mutated_link.signed.materials,
        "standardVerification": mutated_verify,
        "independentLayoutRequiresHiddenWrapper": closure_verify,
    },
    "unauthorizedFunctionary": {
        "recordedMaterials": sorted(attacker_link.signed.materials),
        "standardVerification": attacker_verify,
    },
}

expected = (
    pristine_result == {"side": 1}
    and mutated_result == {"side": -1}
    and pristine_verify["passed"]
    and mutated_verify["passed"]
    and not closure_verify["passed"]
    and not attacker_verify["passed"]
    and "hidden-runtime-wrapper.mjs" not in mutated_link.signed.materials
)
output["probeStatus"] = "PASS_EXPECTED_BOUNDARY" if expected else "FAIL_UNEXPECTED"
print(json.dumps(output, indent=2, sort_keys=True))
sys.exit(0 if expected else 1)
