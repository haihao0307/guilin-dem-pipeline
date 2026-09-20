"""Validated parcel topology for the Farmland structural truth workbench.

The kernel consumes explicit planar survey/generation coordinates.  It does not
invent parcel dimensions, elevations or regional forms.  Rings are normalized
to counter-clockwise order before shared edges are registered, so caller order
and winding cannot change physical boundary identity.
"""

from __future__ import annotations

from math import hypot, isfinite


EPSILON = 1e-10


def _point(value, label):
    if not isinstance(value, (tuple, list)) or len(value) != 2:
        raise ValueError(f"{label} must be an x,y pair")
    x, y = value
    if any(type(v) not in (int, float) or not isfinite(v) for v in (x, y)):
        raise ValueError(f"{label} coordinates must be finite numbers")
    return float(x), float(y)


def _cross(a, b, c):
    return (b[0]-a[0])*(c[1]-a[1]) - (b[1]-a[1])*(c[0]-a[0])


def _signed_area(points):
    return .5*sum(a[0]*b[1]-b[0]*a[1]
                  for a, b in zip(points, points[1:]+points[:1]))


def _on_segment(a, b, p):
    return (abs(_cross(a, b, p)) <= EPSILON and
            min(a[0], b[0])-EPSILON <= p[0] <= max(a[0], b[0])+EPSILON and
            min(a[1], b[1])-EPSILON <= p[1] <= max(a[1], b[1])+EPSILON)


def _segments_intersect(a, b, c, d):
    ab_c, ab_d = _cross(a, b, c), _cross(a, b, d)
    cd_a, cd_b = _cross(c, d, a), _cross(c, d, b)
    if ((ab_c > EPSILON and ab_d < -EPSILON) or
        (ab_c < -EPSILON and ab_d > EPSILON)) and (
        (cd_a > EPSILON and cd_b < -EPSILON) or
        (cd_a < -EPSILON and cd_b > EPSILON)):
        return True
    return ((abs(ab_c) <= EPSILON and _on_segment(a, b, c)) or
            (abs(ab_d) <= EPSILON and _on_segment(a, b, d)) or
            (abs(cd_a) <= EPSILON and _on_segment(c, d, a)) or
            (abs(cd_b) <= EPSILON and _on_segment(c, d, b)))


def _strict_inside(point, polygon):
    if any(_on_segment(a, b, point)
           for a, b in zip(polygon, polygon[1:]+polygon[:1])):
        return False
    inside = False
    x, y = point
    for a, b in zip(polygon, polygon[1:]+polygon[:1]):
        if (a[1] > y) != (b[1] > y):
            x_hit = a[0] + (y-a[1])*(b[0]-a[0])/(b[1]-a[1])
            if x_hit > x:
                inside = not inside
    return inside


def _inside_triangle(p, a, b, c):
    return (_cross(a, b, p) >= -EPSILON and
            _cross(b, c, p) >= -EPSILON and
            _cross(c, a, p) >= -EPSILON)


def _triangulate(ids, coordinates):
    remaining = list(range(len(ids)))
    triangles = []
    while len(remaining) > 3:
        found = False
        for cursor, current in enumerate(remaining):
            previous = remaining[cursor-1]
            following = remaining[(cursor+1) % len(remaining)]
            a, b, c = coordinates[previous], coordinates[current], coordinates[following]
            if _cross(a, b, c) <= EPSILON:
                continue
            if any(_inside_triangle(coordinates[index], a, b, c)
                   for index in remaining
                   if index not in (previous, current, following)):
                continue
            triangles.append((ids[previous], ids[current], ids[following]))
            remaining.pop(cursor)
            found = True
            break
        if not found:
            raise ValueError("parcel ring cannot be triangulated")
    triangles.append(tuple(ids[index] for index in remaining))
    return tuple(triangles)


def _normalized_ring(cell, ring, vertices):
    if not isinstance(cell, str) or not cell.strip():
        raise ValueError("field identity required")
    if not isinstance(ring, (tuple, list)) or len(ring) < 3:
        raise ValueError(f"{cell} requires an open ring of at least three vertices")
    if len(set(ring)) != len(ring):
        raise ValueError(f"{cell} ring repeats a vertex")
    if any(vertex not in vertices for vertex in ring):
        raise ValueError(f"{cell} references an unknown vertex")
    ids = list(ring)
    points = [vertices[vertex] for vertex in ids]
    edge_count = len(points)
    for left in range(edge_count):
        a, b = points[left], points[(left+1) % edge_count]
        if hypot(b[0]-a[0], b[1]-a[1]) <= EPSILON:
            raise ValueError(f"{cell} has a zero-length edge")
        for right in range(left+1, edge_count):
            if right in (left, left+1) or (left == 0 and right == edge_count-1):
                continue
            c, d = points[right], points[(right+1) % edge_count]
            if _segments_intersect(a, b, c, d):
                raise ValueError(f"{cell} ring self-intersects")
    area = _signed_area(points)
    if abs(area) <= EPSILON:
        raise ValueError(f"{cell} has zero planar area")
    if area < 0:
        ids.reverse()
        points.reverse()
    return tuple(ids), tuple(points)


def build_parcel_topology(vertex_coordinates, cell_vertex_rings):
    """Validate simple field polygons and return one record per physical edge.

    Coordinates may be measured or generated, but their provenance must be
    stored by the caller.  This function establishes topology only; it does not
    certify terrain fit, field elevation, bund section or regional authenticity.
    """
    if not isinstance(vertex_coordinates, dict) or not vertex_coordinates:
        raise ValueError("vertex coordinate registry required")
    if not isinstance(cell_vertex_rings, dict) or not cell_vertex_rings:
        raise ValueError("field ring registry required")
    vertices = {}
    coordinate_ids = {}
    for vertex, value in sorted(vertex_coordinates.items()):
        if not isinstance(vertex, str) or not vertex.strip():
            raise ValueError("vertex identity required")
        point = _point(value, vertex)
        if point in coordinate_ids:
            raise ValueError("one coordinate cannot carry multiple vertex identities")
        vertices[vertex] = point
        coordinate_ids[point] = vertex

    rings = {}
    points = {}
    for cell, ring in sorted(cell_vertex_rings.items()):
        rings[cell], points[cell] = _normalized_ring(cell, ring, vertices)
    used_vertices = {vertex for ring in rings.values() for vertex in ring}
    unused_vertices = sorted(set(vertices)-used_vertices)
    if unused_vertices:
        raise ValueError(f"unused topology vertices: {unused_vertices}")

    # A vertex on another ring's edge interior is a T-junction/mismatched split.
    for vertex, point in vertices.items():
        for cell, ids in rings.items():
            if vertex in ids:
                continue
            for a_id, b_id in zip(ids, ids[1:]+ids[:1]):
                if _on_segment(vertices[a_id], vertices[b_id], point):
                    raise ValueError("mismatched boundary subdivision or T-junction")

    # Separate parcel interiors must not overlap. Whole shared edges are legal.
    cells = sorted(rings)
    for index, left in enumerate(cells):
        for right in cells[index+1:]:
            if any(_strict_inside(point, points[right]) for point in points[left]) or \
               any(_strict_inside(point, points[left]) for point in points[right]):
                raise ValueError(f"field interiors overlap: {left}, {right}")
            left_edges = list(zip(rings[left], rings[left][1:]+rings[left][:1]))
            right_edges = list(zip(rings[right], rings[right][1:]+rings[right][:1]))
            for a_id, b_id in left_edges:
                for c_id, d_id in right_edges:
                    if {a_id, b_id} == {c_id, d_id}:
                        continue
                    if _segments_intersect(vertices[a_id], vertices[b_id],
                                           vertices[c_id], vertices[d_id]):
                        shared_end = {a_id, b_id}.intersection((c_id, d_id))
                        if len(shared_end) == 1:
                            continue
                        raise ValueError(f"field boundaries cross: {left}, {right}")

    boundaries = {}
    field_records = []
    for cell in cells:
        ids = rings[cell]
        edge_ids = []
        for a, b in zip(ids, ids[1:]+ids[:1]):
            key = tuple(sorted((a, b)))
            boundary_id = "boundary:"+":".join(key)
            record = boundaries.setdefault(key, {
                "id": boundary_id,
                "vertices": key,
                "served_fields": [],
                "length_m": hypot(vertices[a][0]-vertices[b][0],
                                  vertices[a][1]-vertices[b][1]),
            })
            record["served_fields"].append(cell)
            if len(record["served_fields"]) > 2:
                raise ValueError("non-manifold boundary serves more than two fields")
            edge_ids.append(boundary_id)
        area = abs(_signed_area(list(points[cell])))
        triangles = _triangulate(ids, points[cell])
        triangle_area = sum(abs(_signed_area([vertices[v] for v in triangle]))
                            for triangle in triangles)
        if abs(triangle_area-area) > max(EPSILON, area*1e-10):
            raise ValueError("triangulation does not conserve parcel area")
        field_records.append({
            "id": cell,
            "ring": ids,
            "boundary_refs": tuple(edge_ids),
            "area_m2": area,
            "triangles": triangles,
        })
    boundary_records = []
    for key, record in sorted(boundaries.items()):
        record["served_fields"] = tuple(sorted(record["served_fields"]))
        record["kind"] = "shared" if len(record["served_fields"]) == 2 else "perimeter"
        boundary_records.append(record)
    return {
        "model": "survey_input_planar_parcel_topology_r023",
        "vertices": vertices,
        "fields": tuple(field_records),
        "boundaries": tuple(boundary_records),
        "scope": "plan_topology_only_requires_external_provenance_elevation_and_sections",
    }
