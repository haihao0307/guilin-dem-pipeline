"""Reference for the exact JSON transport used by the browser, without altering the teacher.
Python's 1.0 and JavaScript's 1 serialize differently, despite identical scalar values.
Preserve both recipe hashes; never relabel byte equality as geometric equality.
"""
import copy,gzip,importlib,json,sys,tempfile,zipfile
from build import P,SOURCE,audit,canonical_geometry,write

def js_numbers(x):
    if isinstance(x,float) and x.is_integer():return int(x)
    if isinstance(x,list):return [js_numbers(v) for v in x]
    if isinstance(x,dict):return {k:js_numbers(v) for k,v in x.items()}
    return x

def main():
    row=json.loads(gzip.decompress((P/'data/T05.json.gz').read_bytes()))
    original={'bodyCm':row['bodyCm'],'design':row['design']}
    transported=js_numbers(copy.deepcopy(original))
    with tempfile.TemporaryDirectory() as tmp:
        with zipfile.ZipFile(SOURCE/'browser/pattern-runtime.zip') as z:z.extractall(tmp)
        sys.path.insert(0,tmp);generator=importlib.import_module('pattern_catalogue')
        result=generator.generatePattern(transported);audit(result)
    same=canonical_geometry(row)==canonical_geometry(result)
    assert row['bodyCm']==result['bodyCm'] and row['design']==result['design'] and same
    report={'schema':'kaopu-json-transport-parity@1','preset':'T05','nativeRecipeHash':row['recipeHash'],
      'browserTransportExpectedRecipeHash':result['recipeHash'],'sameNumericDesign':row['design']==result['design'],
      'sameNumericBody':row['bodyCm']==result['bodyCm'],'sameCanonicalPaperGeometry':same,
      'hashesNeedNotMatchAcrossNumericSerializations':True,
      'scope':'native teacher on native input versus JavaScript integer-number transport; actual browser geometry is separately checked',
      'browserExecutionCertified':False,'physicalFitAccepted':False}
    write('BACKEND_PARITY.json',report)
    print('P01_JSON_TRANSPORT_PARITY',json.dumps(report),flush=True)
if __name__=='__main__':main()
