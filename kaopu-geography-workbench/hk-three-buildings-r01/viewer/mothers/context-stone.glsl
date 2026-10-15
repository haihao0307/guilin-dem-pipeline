// Exact STONE_STUDY closure from the same verified heritage B Naga shader.
// KpSurface and KP_STONE constants are provided by kaopu-original.glsl.

vec3 st_hash33_(vec3 pIn_6) {
    vec3 p_13 = vec3(0.0);
    p_13 = fract((pIn_6 * vec3(0.1031, 0.103, 0.0973)));
    vec3 _e8 = p_13;
    vec3 _e9 = p_13;
    vec3 _e16 = p_13;
    p_13 = (_e16 + vec3(dot(_e8, (_e9.yxz + vec3(33.33)))));
    vec3 _e18 = p_13;
    vec3 _e20 = p_13;
    vec3 _e23 = p_13;
    return fract(((_e18.xxy + _e20.yxx) * _e23.zyx));
}

float st_valueNoise3_(vec3 p_14) {
    vec3 f_3 = vec3(0.0);
    vec3 i_7 = floor(p_14);
    f_3 = fract(p_14);
    vec3 _e4 = f_3;
    vec3 _e5 = f_3;
    vec3 _e7 = f_3;
    vec3 _e9 = f_3;
    vec3 _e10 = f_3;
    f_3 = (((_e4 * _e5) * _e7) * ((_e9 * ((_e10 * 6.0) - vec3(15.0))) + vec3(10.0)));
    vec3 _e21 = st_hash33_(i_7);
    vec3 _e28 = st_hash33_((i_7 + vec3(1.0, 0.0, 0.0)));
    float _e31 = f_3.x;
    vec3 _e38 = st_hash33_((i_7 + vec3(0.0, 1.0, 0.0)));
    vec3 _e45 = st_hash33_((i_7 + vec3(1.0, 1.0, 0.0)));
    float _e48 = f_3.x;
    float _e51 = f_3.y;
    vec3 _e58 = st_hash33_((i_7 + vec3(0.0, 0.0, 1.0)));
    vec3 _e65 = st_hash33_((i_7 + vec3(1.0, 0.0, 1.0)));
    float _e68 = f_3.x;
    vec3 _e75 = st_hash33_((i_7 + vec3(0.0, 1.0, 1.0)));
    vec3 _e82 = st_hash33_((i_7 + vec3(1.0, 1.0, 1.0)));
    float _e85 = f_3.x;
    float _e88 = f_3.y;
    float _e91 = f_3.z;
    return mix(mix(mix(_e21.x, _e28.x, _e31), mix(_e38.x, _e45.x, _e48), _e51), mix(mix(_e58.x, _e65.x, _e68), mix(_e75.x, _e82.x, _e85), _e88), _e91);
}

vec3 st_seedVector(float seed_2, float salt) {
    vec3 _e7 = st_hash33_(vec3((seed_2 * 0.001), salt, (seed_2 * 0.00013)));
    return (_e7 * 49.0);
}

vec3 st_srgbToLinear(vec3 c_1) {
    return mix((c_1 / vec3(12.92)), pow(((c_1 + vec3(0.055)) / vec3(1.055)), vec3(2.4)), step(vec3(0.04045), c_1));
}

float st_sf(vec3 p_15) {
    float _e1 = st_valueNoise3_(p_15);
    float _e9 = st_valueNoise3_(((p_15 * 2.07) + vec3(13.7)));
    float _e18 = st_valueNoise3_(((p_15 * 4.11) + vec3(27.2)));
    return (((_e1 * 0.57) + (_e9 * 0.28)) + (_e18 * 0.15));
}

vec3 st_warp(vec3 p_16, vec3 seed_3) {
    float _e5 = st_sf(((p_16 * 0.8) + seed_3));
    float _e12 = st_sf((((p_16 * 0.8) + seed_3) + vec3(7.0)));
    float _e19 = st_sf((((p_16 * 0.8) + seed_3) + vec3(19.0)));
    return (p_16 + (vec3(_e5, _e12, _e19) * 0.25));
}

float st_line(vec3 q_12, vec3 seed_4) {
    float _e16 = st_sf(((q_12 * 1.7) + seed_4));
    return abs(sin((((((q_12.x * 0.84) + (q_12.y * 0.37)) + (q_12.z * 0.51)) + (_e16 * 0.44)) * 12.0)));
}

float st_lineAA(vec3 pos, vec3 seed_5, float line, float physicalFootprintM_3) {
    float e_1 = (max(physicalFootprintM_3, 0.0) / KP_STONE_SCALE_M);
    if ((e_1 == 0.0)) {
        return 0.008;
    }
    vec3 _e15 = st_warp((pos + vec3(e_1, 0.0, 0.0)), seed_5);
    float _e16 = st_line(_e15, seed_5);
    float dx = abs((_e16 - line));
    vec3 _e23 = st_warp((pos + vec3(0.0, e_1, 0.0)), seed_5);
    float _e24 = st_line(_e23, seed_5);
    float dy = abs((_e24 - line));
    vec3 _e31 = st_warp((pos + vec3(0.0, 0.0, e_1)), seed_5);
    float _e32 = st_line(_e31, seed_5);
    float dz = abs((_e32 - line));
    return max(((dx + dy) + dz), 0.008);
}

KpSurface kpStoneOriginalSurface(vec3 pLocalM_3, float sourceWet, float roughBias, float physicalFootprintM_4) {
    vec3 col = vec3(0.0);
    vec3 linear = vec3(0.0);
    vec3 pos_1 = (pLocalM_3 / vec3(0.12352941));
    vec3 _e9 = st_seedVector(KP_STONE_COLOR_SEED, 0.071);
    vec3 _e10 = st_warp(pos_1, _e9);
    float _e14 = st_sf(((_e10 * 1.35) + _e9));
    float _e21 = st_sf((((_e10 * 3.2) + _e9) + vec3(11.0)));
    vec3 _e26 = st_seedVector(KP_STONE_WEATHER_SEED, 0.09);
    float _e28 = st_sf(((_e10 * 2.2) + _e26));
    float _e29 = st_line(_e10, _e9);
    float _e30 = st_lineAA(pos_1, _e9, _e29, physicalFootprintM_4);
    float vein = ((1.0 - smoothstep(0.028, (0.064 + _e30), _e29)) * smoothstep(0.34, 0.63, _e21));
    vec3 _e45 = st_seedVector(KP_STONE_PORE_SEED, 0.061);
    float _e47 = st_sf(((_e10 * 19.0) + _e45));
    float pits = pow(max(0.0, ((_e47 - 0.57) / 0.43)), 2.0);
    col = mix(vec3(0.26, 0.31, 0.32), vec3(0.57, 0.59, 0.55), smoothstep(0.24, 0.73, _e14));
    vec3 _e69 = col;
    col = mix(_e69, vec3(0.49, 0.4, 0.29), (smoothstep(0.57, 0.76, _e28) * 0.65));
    float mineral = (vein * 0.7);
    vec3 _e82 = col;
    col = mix(_e82, vec3(0.83, 0.81, 0.7), (mineral * 0.9));
    float rough_2 = mix(0.79, 0.43, mineral);
    float h_21 = (((((_e14 - 0.5) * 0.018) + ((_e21 - 0.5) * 0.007)) + (vein * 0.004)) - (pits * 0.025));
    float cav = clamp(((0.0 * 0.55) + (pits * 1.4)), 0.0, 1.0);
    float wet_3 = clamp((sourceWet * (0.18 + (0.82 * smoothstep(0.32, 0.75, (_e28 + (cav * 0.25)))))), 0.0, 1.0);
    vec3 _e131 = col;
    float lum = dot(_e131, vec3(0.2126, 0.7152, 0.0722));
    vec3 _e138 = col;
    col = mix(vec3(lum), _e138, 1.0);
    vec3 _e141 = col;
    vec3 _e147 = st_srgbToLinear(clamp(_e141, vec3(0.025), vec3(0.95)));
    linear = _e147;
    vec3 _e153 = linear;
    linear = (_e153 * (1.0 - (wet_3 * 0.38)));
    vec3 _e157 = linear;
    return KpSurface((h_21 * KP_STONE_SCALE_M), _e157, clamp(mix((rough_2 + roughBias), 0.17, wet_3), 0.12, 0.98));
}

KpSurface kpStoneSurface(vec3 pLocalM_4, float age, float wet, float repair, float physicalFootprintM_5) {
    float a_7 = clamp(age, 0.0, 1.0);
    float r_1 = clamp(repair, 0.0, 1.0);
    float m_1 = clamp(wet, 0.0, 1.0);
    float retainedAge = (a_7 * (1.0 - r_1));
    float sourceWet_1 = clamp(((m_1 * (0.45 + (0.55 * retainedAge))) * (1.0 - (0.45 * r_1))), 0.0, 1.0);
    float roughBias_1 = (((0.07 * retainedAge) + 0.00375) - (0.06 * r_1));
    KpSurface _e37 = kpStoneOriginalSurface(pLocalM_4, sourceWet_1, roughBias_1, physicalFootprintM_5);
    return _e37;
}
