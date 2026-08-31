"""Build one continuous Guilin viewer from existing numeric shards, without TIFF."""
from __future__ import annotations
import argparse,copy,json,shutil,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'pipeline'));sys.path.insert(0,str(ROOT/'tests'))
import numpy as np
from canonical_elevation_store import CanonicalElevationStore
from terrain_hydrology import build_overview,build_hydrology
from connected_routes import build_graph,repair_mainstems,select_connected_runtime,build_runtime_nodes,validate_runtime_semantics
from verify_store import verify,file_sha

def write_json(path:Path,data:dict,compact:bool=False)->None:
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(data,ensure_ascii=False,indent=None if compact else 2,separators=(',',':') if compact else None)+'\n',encoding='utf-8')

def make_index(m:dict)->dict:
    sizes={s['file']:s['bytes'] for s in m['physical_shards']['shards']}
    return {'schema':'guilin-canonical-render-index/v1','status':'pixel_exact_verified',
        'canonical_stream_sha256':m['canonical_row_major_stream']['sha256'],'canonical_data_bytes':423838710,
        'source':{'file':m['source_cold_backup']['file'],'bytes':m['source_cold_backup']['bytes'],
            'sha256':m['source_cold_backup']['sha256'],'role':'cold_backup_identity_only',
            'crs':m['spatial_reference']['crs'],'grid':m['spatial_reference']['source_grid'],
            'resolution_m':[12.5,12.5],'dtype':'int16','nodata':0},
        'aoi':{'geometry_sha256':m['aoi']['geometry_sha256'],'native_sample_window':m['aoi']['source_window'],
            'native_sample_center_bounds_epsg32649':m['aoi']['source_sample_center_bounds_epsg32649']},
        'chunk_matrix':{'rows':35,'columns':24,'count':840,'compression':'none','nominal_grid':[512,512]},
        'chunks':[{'id':c['id'],'matrix_index':c['matrix_index'],'grid':c['grid'],'shard':c['shard'],
                   'shard_bytes':sizes[c['shard']],'byte_offset':c['shard_byte_offset'],
                   'bytes':c['bytes'],'sha256':c['sha256']} for c in m['chunks']],
        'rules':{'height_image_texture_used':False,'reservoir_surface_asset_emitted':False,
                 'lake_surface_asset_emitted':False,'normal_production_tiff_read_allowed':False}}

def build_runtime(store_root:Path,target:Path,work:Path)->dict:
    m=json.loads((store_root/'CANONICAL_ELEVATION_MANIFEST.json').read_text(encoding='utf-8'));idx=make_index(m)
    target.mkdir(parents=True,exist_ok=True);work.mkdir(parents=True,exist_ok=True)
    write_json(target/'ELEVATION_INDEX.json',idx,True)
    with CanonicalElevationStore(store_root/'CANONICAL_ELEVATION_MANIFEST.json') as store:
        overview=build_overview(store,idx,target)
        hydro=build_hydrology(store,idx,ROOT/'truth/OSM_HYDROLOGY_IMMUTABLE.geojson',work)
    full=np.fromfile(work/'osm-waterway-segments.f32.bin',dtype='<f4').reshape(-1,13)
    graph=build_graph(full);repair=repair_mainstems(graph,full,idx)
    selected,metrics=select_connected_runtime(graph,full,repair['all_edges'])
    segments=np.asarray(full[selected],dtype='<f4');nodes=build_runtime_nodes(segments)
    semantic=validate_runtime_semantics(segments,repair['routes'],metrics)
    segments.tofile(target/'osm-waterway-segments.f32.bin');nodes.tofile(target/'osm-waterway-nodes.f32.bin')
    runtime=copy.deepcopy(hydro);runtime['status']='local_candidate_pending_public_acceptance'
    runtime['runtime']={'profile':'canonical-store-connected-routes-clean-v1','full_source_segment_count':len(full),
       'selected_segment_count':len(segments),'selection':metrics,
       'selection_is_complete_full_source_network':len(full)==len(segments),
       'full_source_file':'truth/OSM_HYDROLOGY_IMMUTABLE.geojson'}
    runtime['topology'].update({'full_source_segment_count':len(full),'source_segment_count':len(segments),
       'segment_count':len(segments),'node_count':len(nodes),'dropped_segment_count':0,
       'runtime_omitted_segment_count':len(full)-len(segments),
       'runtime_downstream_closure_failure_count':metrics['downstream_closure_failure_count']})
    runtime['styling'].update({'profile':'network-directed-physical-width-v6',
       'mainstem_segment_counts':semantic['mainstem_segment_counts'],'mainstem_routes':repair['routes'],
       'mainstem_progress_ranges':{n:[0,1] for n in ['li','xiang','zi']},
       'width_measurement_status':'inherited parameters; historical bank-to-bank widths not independently verified'})
    runtime['direction'].update({'flow_progress_monotonic':True,'flow_distance_monotonic':True,
       'li_gui_continuity':{'connected':True,'continues_south_of_yangshuo':True,'route':repair['routes']['li']}})
    for key,values in [('segments',segments),('nodes',nodes)]:
        p=target/f'osm-waterway-{key}.f32.bin'
        runtime[key].update({'file':p.name,'bytes':p.stat().st_size,'sha256':file_sha(p),'count':len(values)})
    write_json(target/'overview-direct-samples-manifest.json',overview)
    write_json(target/'osm-waterways-manifest.json',runtime)
    knowledge={'schema':'guilin-clean-knowledge-index/v1','canonical_stream_sha256':idx['canonical_stream_sha256'],
       'canonical_sample_count':211919355,'canonical_data_bytes':423838710,'native_spacing_m':12.5,
       'logical_chunks':840,'physical_shards':7,'tiff_runtime_reads':False,
       'all_terrain_values_are_in_the_numeric_store':True,'this_index_alone_cannot_reconstruct_all_elevation':True,
       'overview_is_a_display_only_exact_sample_subset':True,'overview_grid':[768,768],
       'aoi_source_window':m['aoi']['source_window'],'full_hydrology_segment_count':len(full),
       'runtime_segment_count':len(segments),'runtime_node_count':len(nodes),'full_osm_source_retained':True,
       'lake_surfaces':0,'reservoir_surfaces':0,'hydrology_semantic_qa':semantic,
       'historical_river_widths_verified':False,'publicDeploymentCompleted':False,
       'visualAcceptance':False,'productionReady':False}
    write_json(target/'KNOWLEDGE_INDEX.json',knowledge)
    files=[p for p in target.iterdir() if p.is_file() and p.name!='RUNTIME_INVENTORY.json']
    write_json(target/'RUNTIME_INVENTORY.json',{'schema':'guilin-clean-runtime-inventory/v1',
       'canonical_stream_sha256':idx['canonical_stream_sha256'],
       'files':[{'path':p.name,'bytes':p.stat().st_size,'sha256':file_sha(p)} for p in sorted(files)]})
    return {'schema':'guilin-clean-local-build/v1','passed':True,'source_tiff_read':False,
       'canonical_stream_sha256':idx['canonical_stream_sha256'],'canonical_data_bytes':423838710,
       'full_hydrology_segment_count':len(full),'runtime_segment_count':len(segments),'runtime_node_count':len(nodes),
       'semantic_qa':semantic,'hydrology_measurement_verified':False,'publicDeploymentCompleted':False,
       'visualAcceptance':False,'productionReady':False}

def cached_runtime_valid(root:Path)->bool:
    p=root/'RUNTIME_INVENTORY.json'
    if not p.exists():return False
    inv=json.loads(p.read_text(encoding='utf-8'))
    if inv.get('canonical_stream_sha256')!='91154cbe7c29220c9da41efc98105f1d36b614a343636543f7dd230735da079a':return False
    return all((root/r['path']).is_file() and (root/r['path']).stat().st_size==r['bytes'] and file_sha(root/r['path'])==r['sha256'] for r in inv['files'])

def main()->int:
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--payload',type=Path,required=True)
    p.add_argument('--out',type=Path,required=True);p.add_argument('--rebuild-runtime',action='store_true');p.add_argument('--receipt',type=Path)
    a=p.parse_args();payload=a.payload.resolve();out=a.out.resolve()
    if out==ROOT or out==payload or payload in out.parents:raise ValueError('Output must be outside source and payload')
    validation=verify(payload/'canonical');work=out.parent/(out.name+'-work')
    if a.rebuild_runtime or not cached_runtime_valid(payload/'runtime'):
        receipt=build_runtime(payload/'canonical',payload/'runtime',work)
    else:
        k=json.loads((payload/'runtime/KNOWLEDGE_INDEX.json').read_text(encoding='utf-8'))
        receipt={'schema':'guilin-clean-local-build/v1','passed':True,'source_tiff_read':False,
           'used_verified_runtime_cache':True,'canonical_stream_sha256':validation['canonical_stream_sha256'],
           'semantic_qa':k['hydrology_semantic_qa'],'publicDeploymentCompleted':False}
    marker=out/'.guilin-generated-output'
    if out.exists():
        if not marker.exists():raise ValueError('Refusing to replace unmarked output directory')
        shutil.rmtree(out)
    (out/'guilin/data').mkdir(parents=True);(out/'guilin-elevation-store-v1/shards').mkdir(parents=True)
    marker.write_text('Generated locally from one canonical store.\n',encoding='utf-8')
    for n in ['index.html','app.js','styles.css']:shutil.copy2(ROOT/'viewer'/n,out/'guilin'/n)
    for f in (payload/'runtime').iterdir():
        if f.is_file():shutil.copy2(f,out/'guilin/data'/f.name)
    for f in (payload/'canonical/shards').iterdir():
        if f.is_file():shutil.copy2(f,out/'guilin-elevation-store-v1/shards'/f.name)
    shutil.copy2(payload/'canonical/CANONICAL_ELEVATION_MANIFEST.json',out/'guilin-elevation-store-v1/CANONICAL_ELEVATION_MANIFEST.json')
    (out/'.nojekyll').touch()
    write_json(out/'guilin/version.json',{'schema':'guilin-clean-canonical-viewer/v1','build':'numeric-only-handoff-20260831-v2',
       'canonical_stream_sha256':validation['canonical_stream_sha256'],'canonical_data_bytes':423838710,
       'native_spacing_m':12.5,'source_tiff_read':False,'legacy_tile_dependency':False,
       'byte_range_required':True,'maximum_chunk_bytes':524288,'one_continuous_map':True,
       'hydrology_style_profile':'network-directed-physical-width-v6','publicDeploymentCompleted':False,
       'visualAcceptance':False,'productionReady':False})
    receipt['viewer_directory_bytes']=sum(f.stat().st_size for f in (out/'guilin').rglob('*') if f.is_file())
    receipt['html_bytes']=(out/'guilin/index.html').stat().st_size
    receipt['runtime_data_bytes']=sum(f.stat().st_size for f in (out/'guilin/data').rglob('*') if f.is_file())
    if a.receipt:write_json(a.receipt,receipt)
    print(json.dumps(receipt,ensure_ascii=False,indent=2));return 0
if __name__=='__main__':raise SystemExit(main())
