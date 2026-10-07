"""Read-only audit of an already-authorized Blender scene, NOT HumanPro code.

Run with auto-execution disabled:
  blender --background --disable-autoexec scene.blend --python humanpro_scene_audit.py -- --output /private/path/audit.json

The output can contain third-party node graphs and driver expressions. Keep it
private until code/asset licensing is reviewed. This tool does not install an
add-on, evaluate drivers itself, render, modify the scene, or save a .blend.
"""
import argparse
import json
import os
import sys
from pathlib import Path


def scalar(value):
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if hasattr(value, "to_list"):
        return value.to_list()
    try:
        return [scalar(x) for x in value]
    except TypeError:
        return {"name": getattr(value, "name", type(value).__name__)}


def values(obj, names):
    return {name: scalar(getattr(obj, name)) for name in names if hasattr(obj, name)}


def drivers(owner):
    animation = getattr(owner, "animation_data", None)
    if not animation:
        return []
    result = []
    for fc in animation.drivers:
        d = fc.driver
        result.append({
            "path": fc.data_path, "array_index": fc.array_index,
            "type": d.type, "expression_as_text_only": d.expression,
            "variables": [{"name": v.name, "type": v.type, "targets": [
                dict(values(t, ["data_path", "bone_target", "transform_type", "transform_space"]),
                     id_name=getattr(getattr(t, "id", None), "name", None))
                for t in v.targets]} for v in d.variables],
        })
    return result


def audit(bpy):
    trees = {}

    def tree_key(tree):
        return str(tree.as_pointer())

    def tree_record(tree):
        if tree is None:
            return None
        key = tree_key(tree)
        if key in trees:
            return key
        record = {"name": tree.name, "nodes": [], "links": [], "drivers": drivers(tree)}
        trees[key] = record
        for n in tree.nodes:
            item = dict(values(n, ["name", "label", "bl_idname", "mute", "operation", "blend_type", "data_type", "subsurface_method", "distribution", "space", "uv_map", "interpolation", "extension", "projection"]),
                        inputs=[dict(values(s, ["name", "identifier", "type", "is_linked"]),
                                     default_value=scalar(getattr(s, "default_value", None))) for s in n.inputs])
            if getattr(n, "image", None):
                item["image_name"] = n.image.name
            if getattr(n, "node_tree", None):
                item["group_tree_key"] = tree_record(n.node_tree)
            if hasattr(n, "color_ramp"):
                item["color_ramp"] = dict(values(n.color_ramp, ["interpolation", "color_mode", "hue_interpolation"]),
                                          elements=[{"position": e.position, "color": scalar(e.color)} for e in n.color_ramp.elements])
            record["nodes"].append(item)
        record["links"] = [{"from_node": x.from_node.name, "from_socket": x.from_socket.identifier,
                            "to_node": x.to_node.name, "to_socket": x.to_socket.identifier}
                           for x in tree.links]
        return key

    materials = []
    for m in bpy.data.materials:
        materials.append(dict(values(m, ["name", "use_nodes", "diffuse_color", "surface_render_method", "displacement_method"]),
                              tree_key=tree_record(m.node_tree),
                              library_name=os.path.basename(m.library.filepath) if m.library else None))
    images = []
    for im in bpy.data.images:
        resolved = bpy.path.abspath(im.filepath, library=im.library) if im.filepath else None
        images.append(dict(values(im, ["name", "source", "size", "channels", "depth", "is_float", "alpha_mode"]),
                           filename=os.path.basename(im.filepath),
                           colorspace=im.colorspace_settings.name,
                           packed=bool(im.packed_file or len(im.packed_files)),
                           external_file_exists=os.path.isfile(resolved) if resolved else None,
                           tiles=[{"number": t.number, "label": t.label} for t in im.tiles]))
    objects = []
    for o in bpy.data.objects:
        item = dict(values(o, ["name", "type", "scale", "dimensions", "matrix_world"]),
                    material_slots=[{"name": s.name, "material": s.material.name if s.material else None} for s in o.material_slots],
                    drivers=drivers(o),
                    modifiers=[values(m, ["name", "type", "show_viewport", "show_render", "levels", "render_levels", "subdivision_type"]) for m in o.modifiers])
        if o.type == "MESH":
            item["mesh"] = {"vertices": len(o.data.vertices), "polygons": len(o.data.polygons), "uv_layers": [u.name for u in o.data.uv_layers]}
            keys = o.data.shape_keys
            item["shape_keys"] = [{"name": k.name, "value": k.value, "slider_min": k.slider_min, "slider_max": k.slider_max} for k in keys.key_blocks] if keys else []
            item["shape_key_drivers"] = drivers(keys) if keys else []
        elif o.type == "LIGHT":
            item["light"] = values(o.data, ["type", "color", "energy", "shape", "size", "size_y", "shadow_soft_size"])
        elif o.type == "CAMERA":
            item["camera"] = values(o.data, ["type", "lens", "sensor_width", "sensor_height", "clip_start", "clip_end"])
            item["depth_of_field"] = values(o.data.dof, ["use_dof", "focus_distance", "aperture_fstop"])
        objects.append(item)
    scene = bpy.context.scene
    world_key = tree_record(scene.world.node_tree) if scene.world else None
    return {
        "schema_version": 1,
        "notice": "PRIVATE SCENE INVENTORY. Not proof of HumanPro provenance, licensing, complete parsing, or visual equivalence.",
        "blender_version": bpy.app.version_string,
        "scene_filename": os.path.basename(bpy.data.filepath),
        "scene_units": values(scene.unit_settings, ["system", "scale_length", "length_unit"]),
        "render": values(scene.render, ["engine", "resolution_x", "resolution_y", "resolution_percentage", "film_transparent"]),
        "cycles": values(scene.cycles, ["samples", "use_denoising", "adaptive_threshold", "use_adaptive_sampling", "seed", "device"]),
        "view": values(scene.view_settings, ["view_transform", "look", "exposure", "gamma"]),
        "display": values(scene.display_settings, ["display_device"]),
        "frame": scene.frame_current,
        "world_tree_key": world_key,
        "materials": materials, "node_trees": trees, "images": images, "objects": objects,
        "limitations": ["Does not determine author/license authenticity", "Does not audit add-on operators or installation", "Does not execute or visually validate drivers", "Does not render or prove image fidelity", "Node-specific properties not listed by this schema may be absent; retain original blend privately"],
    }


def main():
    import bpy
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True)
    args = parser.parse_args(argv)
    out = Path(args.output)
    if out.exists():
        raise FileExistsError(f"Refusing to overwrite existing report: {out}")
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("x", encoding="utf-8") as stream:
        json.dump(audit(bpy), stream, ensure_ascii=False, indent=2)
    print(f"Read-only scene inventory written to {out}; visual validation NOT performed")


if __name__ == "__main__":
    main()
