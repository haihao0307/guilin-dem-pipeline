"""Recover original multi-edge sewing interfaces without changing the pattern.

Per-edge length differences can be caused by intentional gathering or by the
upstream approximate subdivision. A group keeps both facts, never equalizes UV.
"""
import contextlib,copy,io,math,os
from validate_pattern import digest

def build_sewing_plan(request,pattern):
    import pattern_catalogue as source
    body=copy.deepcopy(request['bodyCm']);design=source.normalize_design(request['design'])
    bp=object.__new__(source.BodyParameters);bp.params=body;bp.eval_dependencies()
    old=os.getcwd();os.chdir(source.ROOT/'runtime')
    try:
        with contextlib.redirect_stdout(io.StringIO()):
            garment=source.MetaGarment('generated',bp,copy.deepcopy(design))
            garment.assert_non_empty();garment.assert_skirt_waistband();garment.assert_total_length()
            garment.assembly()
    finally:os.chdir(old)
    lookup={(s['a']['panelId'],s['a']['edge'],s['b']['panelId'],s['b']['edge']):s for s in pattern['seams']}
    groups=[];covered=[]
    def coeff(interface,i):return next(float(sec['coeff']) for sec in interface.ruffle if sec['sec'][0]<=i<sec['sec'][1])
    for component in source._walk(garment):
        for rule in component.stitching_rules.rules:
            a,b=rule.int1,rule.int2
            refs=[]
            for i,(ea,eb) in enumerate(zip(a.edges,b.edges)):
                key=(a.panel[i].name,ea.geometric_id,b.panel[i].name,eb.geometric_id)
                if key not in lookup:raise ValueError(f'Unbound original sewing interface {key}')
                seam=lookup[key];covered.append(seam['id']);refs.append(seam)
            raw_a=[coeff(a,i) for i in range(len(a.edges))];raw_b=[coeff(b,i) for i in range(len(b.edges))]
            effective_a=raw_a.copy();effective_b=raw_b.copy();declarations=[]
            # These two published source constructors change pattern widths from
            # design factors but do not carry that factor onto their final interface.
            # Preserve raw fields, attach an explicit separate construction decision.
            if type(component).__name__=='SkirtLevels' and all(math.isclose(x,1) for x in raw_a+raw_b):
                factor=design['levels-skirt']['level_ruffle']['v']
                if factor!=1:
                    effective_b=[x*factor for x in raw_b]
                    declarations.append({'path':'levels-skirt.level_ruffle','value':factor,'appliedTo':'b',
                        'source':'assets/garment_programs/skirt_levels.py: lbody waist = ruffle * previous bottom length'})
            if type(component).__name__=='PantsHalf' and hasattr(component,'cuff') and b is component.cuff.interfaces['top'] and all(math.isclose(x,1) for x in raw_a+raw_b):
                factor=design['pants']['cuff']['top_ruffle']['v']
                if factor!=1:
                    effective_a=[x*factor for x in raw_a]
                    declarations.append({'path':'pants.cuff.top_ruffle','value':factor,'appliedTo':'a',
                        'source':'assets/garment_programs/pants.py: cuff width = pant_bottom length / top_ruffle'})
            sum_a=sum(s['lengthAMm']/c for s,c in zip(refs,effective_a))
            sum_b=sum(s['lengthBMm']/c for s,c in zip(refs,effective_b))
            difference=sum_a-sum_b
            segments=[{'sourceSeamId':s['id'],'a':s['a'],'b':s['b'],
                'materialLengthAMm':s['lengthAMm'],'materialLengthBMm':s['lengthBMm'],
                'rawRuffleA':ra,'rawRuffleB':rb,'plannedRuffleA':ca,'plannedRuffleB':cb,
                'plannedProjectedDifferenceMm':s['lengthAMm']/ca-s['lengthBMm']/cb,
                'materialCoordinatesAltered':False} for s,ra,rb,ca,cb in zip(refs,raw_a,raw_b,effective_a,effective_b)]
            key=digest([{'a':s['a'],'b':s['b']} for s in refs])[:16]
            groups.append({'id':'interface-'+key,'owner':component.name,'ownerClass':type(component).__name__,
                'phase':'darts' if all(s['isDart'] for s in refs) else 'assembly',
                'sourceSeams':[s['id'] for s in refs],'segments':segments,'constructionDeclarations':declarations,
                'projectedGroupLengthAMm':sum_a,'projectedGroupLengthBMm':sum_b,'groupDifferenceMm':difference,
                'groupLengthsWithinSource3mmReviewThreshold':abs(difference)<=3,
                'perPairPartitionReviewRequired':any(abs(x['plannedProjectedDifferenceMm'])>3 for x in segments),
                'rawMaterialLengthAMm':sum(s['lengthAMm'] for s in refs),'rawMaterialLengthBMm':sum(s['lengthBMm'] for s in refs),
                'automaticEdgeScalingAllowed':False,'solverExecuted':False})
    if len(covered)!=len(set(covered)) or set(covered)!={s['id'] for s in pattern['seams']}:
        raise ValueError('Original seam coverage must be exact, with no duplicated sewing operation')
    groups.sort(key=lambda g:(g['phase']!='darts',g['id']))
    review=[g['id'] for g in groups if not g['groupLengthsWithinSource3mmReviewThreshold']]
    return {'schema':'kaopu-source-interface-sewing-plan@1','groups':groups,'allSourceSeamsCoveredExactlyOnce':True,
        'sourceDimensionsAltered':False,'constructionDeclarationsAreSeparateFromRawSource':True,
        'groupLengthReview':review,'requiresTrialSewing':True,'physicalSolveRun':False,
        'meaning':'original multi-edge operation groups and explicit source design gathering; original paper and raw stitch pairs stay intact'}
