"""Observe actual depth-rendered eye component silhouettes; no face-photo inputs.

Pixel positions are renderer observations, not physical facial measurements.
Three colour dominance thresholds expose the anti-aliasing/quantization band.
"""
from collections import deque
from statistics import median

def skin_outside(rgb, width, height, channel, x, y, direction):
    """Find adjacent gray skin across at most three antialiasing pixels.

    Unknown black, another labelled component, or the viewport edge invalidates
    support; the search never jumps over such an occluder to a farther gray pixel.
    """
    for step in range(1, 4):
        yy = y + direction * step
        if not 0 <= yy < height: return False
        p = rgb[yy * width + x]
        if max(p) - min(p) <= 12 and 40 <= min(p) <= 230: return True
        other = [p[c] for c in range(3) if c != channel]
        if min(other) <= 10 or abs(other[0] - other[1]) > 12 or p[channel] < max(other): return False
    return False

def component_contours(rgb, width, height, channel, threshold=128):
    if channel not in (0, 1) or len(rgb) != width * height or width < 1 or height < 1:
        raise ValueError('Invalid component image')
    mask = {i for i, p in enumerate(rgb) if p[channel] >= 128 and all(p[channel] - p[c] >= threshold for c in range(3) if c != channel)}
    components = []
    unseen = set(mask)
    while unseen:
        start = unseen.pop(); group = [start]; queue = deque([start])
        while queue:
            i = queue.popleft(); x, y = i % width, i // width
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                xx, yy = x + dx, y + dy
                if 0 <= xx < width and 0 <= yy < height:
                    j = yy * width + xx
                    if j in unseen:
                        unseen.remove(j); group.append(j); queue.append(j)
        components.append(group)
    components.sort(key=len, reverse=True)
    if not components or len(components[0]) < 20:
        raise ValueError('No sufficiently resolved visible eye component')
    main = components[0]; columns = {}
    for i in main: columns.setdefault(i % width, []).append(i // width)
    samples = [{'x': x, 'upper': min(ys), 'lower': max(ys), 'pixels': len(ys),
                'upperSkin': skin_outside(rgb,width,height,channel,x,min(ys),-1),
                'lowerSkin': skin_outside(rgb,width,height,channel,x,max(ys),1)} for x, ys in sorted(columns.items())]
    return {'channel': channel, 'threshold': threshold, 'area': len(main), 'totalLabelPixels': len(mask),
            'secondaryAreas': [len(x) for x in components[1:]],
            'fragmented': bool(len(components) > 1 and len(components[1]) > .1 * len(main)),
            'bounds': [min(columns), min(i // width for i in main), max(columns), max(i // width for i in main)],
            'samples': samples}

def evaluate_image(rgb, width, height):
    return {'schema': 'actual-native-visible-eye-components/1', 'width': width, 'height': height,
            'coordinateConvention': 'Image pixels: x right, y down; not millimetres',
            'channelConvention': '0=red/native component1; 1=green/native component2. Anatomical side is not inferred from screen position.',
            'components': {str(c): {str(t): component_contours(rgb, width, height, c, t) for t in (64, 128, 192)} for c in (0, 1)}}

def compare_boundaries(baseline, candidate):
    if (baseline['width'], baseline['height']) != (candidate['width'], candidate['height']):
        raise ValueError('Different drawing buffer sizes')
    result = {}
    for c in ('0', '1'):
        center = baseline['components'][c]['128']; lo, _, hi, _ = center['bounds']
        points = []
        for fraction in (.2, .5, .8):
            x = round(lo + fraction * (hi - lo)); deltas = {'upper': [], 'lower': []}
            for threshold in ('64', '128', '192'):
                A = baseline['components'][c][threshold]; B = candidate['components'][c][threshold]
                if A['fragmented'] or B['fragmented']: raise ValueError('Fragmented eye label requires inspection')
                for edge in deltas:
                    aa = [s[edge] for s in A['samples'] if abs(s['x'] - x) <= 1 and s[edge+'Skin']]
                    bb = [s[edge] for s in B['samples'] if abs(s['x'] - x) <= 1 and s[edge+'Skin']]
                    if not aa or not bb: raise ValueError('No gray-skin-supported eye boundary at fixed baseline column')
                    deltas[edge].append(median(bb) - median(aa))
            points.append({'baselineX': x, 'baselineWidthFraction': fraction,
                           **{edge: {'deltaPx': values[1], 'thresholdEnvelopePx': [min(values), max(values)]} for edge, values in deltas.items()}})
        B = candidate['components'][c]['128']
        result[c] = {'segments': points, 'leftExtentDeltaPx': B['bounds'][0] - lo, 'rightExtentDeltaPx': B['bounds'][2] - hi,
                     'meaning': 'Gray-skin-supported visible full-eye boundary; .2/.8 denote screen-left/right baseline fractions, not inferred inner/outer anatomical labels'}
    return result
