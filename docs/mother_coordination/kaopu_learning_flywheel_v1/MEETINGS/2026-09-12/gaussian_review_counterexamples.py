"""Independent R33 CPU counterexamples; no real encoder/trainer/GPU proof.

The JavaScript statements are executed by Node to preserve JS undefined/NaN,
rounding, and bitwise semantics. This script does not modify R33 or assets.
"""
import json
import subprocess

JS = r'''
const validate = ({storageCoordinateSystem, hasCoordinateExtension, shDegree}) => {
  const errors = [];
  if (storageCoordinateSystem !== 'RUB' || hasCoordinateExtension)
    errors.push('three-r186-coordinate-extension-unsupported');
  if (shDegree > 3)
    errors.push('three-r186-sh-degree-over-3-is-truncated');
  return errors;
};
const base = {storageCoordinateSystem:'RUB',hasCoordinateExtension:false};
const declarations = [
  ['missing', {...base}],
  ['NaN-runtime-only-not-valid-JSON', {...base,shDegree:NaN}],
  ['null', {...base,shDegree:null}],
  ['negative', {...base,shDegree:-1}],
  ['fractional', {...base,shDegree:2.5}],
  ['string', {...base,shDegree:'3'}],
  ['valid3', {...base,shDegree:3}],
  ['unsupported4', {...base,shDegree:4}],
].map(([inputLabel, input]) => ({inputLabel, errors:validate(input)}));
function quantizeLogScale(v) {
  const byte = Math.max(0,Math.min(255,Math.round((v+10)*16)));
  return {byte, decoded:byte/16-10};
}
const logScale = [-11,-10,-2.131,5.9375,6].map(v=>{
  const q=quantizeLogScale(v);
  return {input:v,...q,relativeError:Math.abs(Math.exp(q.decoded-v)-1)};
});
// This deliberately truncates to 24 bits. It is NOT the actual SPZ encoder.
const uncheckedInt24 = n => ((n&255)<<8|((n>>>8)&255)<<16|((n>>>16)&255)<<24)>>8;
const f=12, step=2**-f, lo=-(2**23)*step, hi=(2**23-1)*step;
const int24 = [lo-step,lo,hi,hi+step].map(v=>({
  input:v,integer:Math.round(v/step),
  uncheckedLow24BitDecode:uncheckedInt24(Math.round(v/step))*step,
  inRepresentableCenterRange:v>=lo && v<=hi,
}));
process.stdout.write(JSON.stringify({
  declarationValidator:declarations,
  logScale,
  unclippedLogScaleRelativeBound:Math.exp(1/32)-1,
  int24AtFractionalBits12:{step,min:lo,max:hi,cases:int24},
  unitExamples:[1,1000].map(metersPerStoredUnit=>({metersPerStoredUnit,
    halfStepPositionErrorMeters:step/2*metersPerStoredUnit}))
}));
'''

def main():
    result = subprocess.run(["node", "-e", JS], check=True,
                            text=True, capture_output=True)
    evidence = json.loads(result.stdout)
    by_label = {r["inputLabel"]: r["errors"]
                for r in evidence["declarationValidator"]}
    assert by_label["missing"] == []
    assert by_label["NaN-runtime-only-not-valid-JSON"] == []
    assert by_label["unsupported4"]
    assert evidence["logScale"][0]["relativeError"] > 1.7
    assert evidence["logScale"][-1]["relativeError"] > 0.06
    assert evidence["int24AtFractionalBits12"]["cases"][-1]["uncheckedLow24BitDecode"] == -2048
    output = {
        "schema": "kaopu-independent-r33-counterexamples/1",
        "status": "counterexamples-reproduced",
        "scope": {
            "javascriptExecutedBy": "node",
            "r33ValidatorExpressionReproduced": True,
            "realThreeLoaderExecuted": False,
            "realSpzEncoderExecuted": False,
            "realTrainingExecuted": False,
            "gpuExecuted": False,
            "productionCodeChanged": False,
            "roundingPolicy": "JavaScript Math.round; actual encoder tie handling not verified here",
            "boundScope": "Ideal nearest log-scale quantization without saturation; excludes Float32, exponent evaluation, quaternion and covariance error",
            "note": "Int24 low-bit wrap demonstrates a hazard, not actual encoder behavior. Quantization bounds are in stored units, not an inferred metric accuracy claim."
        },
        "evidence": evidence,
    }
    print(json.dumps(output, indent=2, allow_nan=False))

if __name__ == "__main__":
    main()
