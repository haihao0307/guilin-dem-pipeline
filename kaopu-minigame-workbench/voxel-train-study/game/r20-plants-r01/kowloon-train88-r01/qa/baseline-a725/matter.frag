#version 300 es

precision highp float;
precision highp int;

struct Params {
    vec3 eye;
    float age;
    vec3 forward;
    float fov;
    vec3 right;
    float aspect;
    vec3 up;
    float debug;
    vec2 resolution;
    vec2 pad;
};
struct KpSurface {
    float height;
    vec3 albedo;
    float roughness;
};
struct KpWoodParams {
    float seed;
    float ringFrequency;
    float ringScale;
    float ringWarp;
    float fiberFrequency;
    float fineFiberFrequency;
    float poreFrequency;
    float fiberStrength;
    float colorBias;
    float roughness;
    float angleOffset;
    float textureScale;
    float grainContrast;
    float detailFineness;
    float microReliefM;
    float parallaxM;
    float macroDisplacementM;
    float reliefScale;
    float reliefQuality;
    float parallaxSteps;
    float clearcoat;
    float clearcoatRoughness;
    float specularLevel;
    float distanceFadeStart;
    float distanceFadeEnd;
    float toolPhase;
    float crackPhase;
    float knotPhase;
    vec2 pithOffset;
    vec3 darkGrainColor;
    vec3 lightGrainColor;
    vec3 agedSurfaceColor;
    vec3 weatheredColor;
    vec3 freshCutColor;
    vec3 cavityColor;
};
struct KpWoodSample {
    KpSurface surface;
    float cavity;
    float clearcoat;
    float clearcoatRoughness;
    float specularLevel;
    float macroHeightM;
    float parallaxHeight01_;
};
struct KpPlasterParams {
    vec2 centerM;
    vec2 halfM;
    float thicknessM;
    float reliefM;
    float geometryMicroM;
    float minThicknessM;
    float maxThicknessM;
    float microM;
    vec3 paletteDark;
    vec3 paletteLight;
    float grainWavelengthM;
    float grainHeightM;
    float grainColor;
};
struct KpPlasterField {
    float macroTone;
    float micro;
    float thicknessM;
    KpSurface surface;
};
struct HitField {
    float d;
    uint id;
    vec3 q;
    float seed;
    float baseD;
    vec3 extent;
    float sourceSeed;
};
struct StationCandidates {
    uint count;
    HitField items[96];
};
struct StationState {
    float age;
    float wet;
    float repair;
    float retained;
};
struct StationMatter {
    float d;
    KpSurface surface;
    float metal;
    float cavity;
    float specular;
    float microHeight;
    uint layer;
    float clearcoat;
    float clearcoatRoughness;
    float parallaxHeight01_;
};
struct StationGeometry {
    float d;
    float loss;
    float thickness;
};
struct HostFrame {
    mat4x4 inverseProjection;
    mat4x4 cameraToLocal;
    mat4x4 localToClip;
    vec4 viewport;
    vec4 controls;
};
struct MatterRecord {
    vec4 albedoRoughness;
    vec4 response;
    vec4 finish;
};
const float KP_BRICK_PI = 3.1415927;
const float KP_BRICK_SCALE = 0.115384616;
const float KP_WOOD_PI = 3.1415927;
const float KP_WOOD_TAU = 6.2831855;
const float KP_STONE_SCALE_M = 0.12352941;
const int KP_STONE_KIND = 0;
const uint KP_STONE_MASTER_SEED = 8231u;
const float KP_STONE_COLOR_SEED = 8632.0;
const float KP_STONE_PORE_SEED = 8538.0;
const float KP_STONE_WEATHER_SEED = 8832.0;
const float SHED_FRONT = -10.0;
const float SHED_LENGTH = 135.0;
const float SHED_HALF = 67.5;
const float SHED_CENTER = -77.5;
const float SHED_BACK = -145.0;
const float SHED_BAYS = 18.0;
const float BENCH_WOOD_SCALE = 4.0;
const float BENCH_WOOD_CONTRAST = 0.36;
const float SHORE_X = 60.0;
const float GOODS_X = 41.5;
const float GOODS_HALF = 42.0;
const float GOODS_CENTER = -58.0;
const float HOST_ISLAND_NEAR_X = 6.5897;
const float HOST_ISLAND_FAR_X = 11.15;
const float HOST_ISLAND_CENTER_X = 8.86985;
const float HOST_ISLAND_HALF_WIDTH = 2.28015;
const float HOST_ISLAND_TOP_Y = 0.85;
const float HOST_BOARDING_ROW_X = 10.0;
const float HOST_BENCH_ROW_X = 8.8;
const float HOST_COPING_TOP_Y = 0.85;
const float HOST_COPING_CENTER_Y = 0.78;
const float HOST_COPING_HALF_HEIGHT = 0.07;
const float HOST_COPING_NEAR_X = 6.7697;
const float HOST_COPING_FAR_X = 10.97;
const float HOST_OUTER_SUPPORT_X = 30.0;
const float HOST_FOUNDATION_HALF = 0.42;
const float HOST_FOUNDATION_BOTTOM_Y = -0.25;
const float HOST_FOUNDATION_TOP_Y = 1.25;
const float HOST_TRUSS_START_X = -10.0;
const float HOST_TRUSS_END_X = 30.0;
const float HOST_TRUSS_BOTTOM_Y = 9.25;
const float HOST_TRUSS_DEPTH = 1.6;
const float HOST_CLEAR_MIN_X = 6.5897;
const float HOST_CLEAR_MAX_X = 13.415946;
const float HOST_CLEAR_MIN_Z = -73.56595;
const float HOST_CLEAR_MAX_Z = -13.658329;
const float HOST_EXIT_GROUND_Y = -0.11;
const float HOST_VACATED_POST_Z[8] = float[8](-17.5, -25.0, -32.5, -40.0, -47.5, -55.0, -62.5, -70.0);
const float HOST_RETAINED_POST_Z[19] = float[19](-10.0, -77.5, -81.25, -85.0, -88.75, -92.5, -96.25, -100.0, -103.75, -107.5, -111.25, -115.0, -118.75, -122.5, -126.25, -130.0, -133.75, -137.5, -145.0);
const float HOST_RETAINED_BENCH_Z[6] = float[6](-81.25, -88.75, -103.75, -111.25, -126.25, -133.75);
const float HOST_BENCH_SOURCE_Z[6] = float[6](-81.25, -13.75, -103.75, -36.25, -126.25, -58.75);
const float HOST_EXIT_MIN_Z[2] = float[2](-48.98072, -28.19372);
const float HOST_EXIT_MAX_Z[2] = float[2](-35.54533, -14.758329);
const float HOST_EXIT_APRON_MIN_Z[2] = float[2](-51.18072, -30.39372);
const float HOST_EXIT_PROFILE_X[6] = float[6](11.15, 11.3, 11.58, 11.86, 12.15, 13.415946);
const float HOST_EXIT_PROFILE_Y[6] = float[6](0.85, 0.85, 0.52, 0.19, -0.11, -0.11);
const uint STATION_CANDIDATE_CAPACITY = 96u;
const float RAIL_CENTER_OFFSET = 0.752425;
const float RAIL_HALF_WIDTH = 0.034925;
const float RAIL_CROWN = 0.0985;

layout(std140) uniform Params_block_0Fragment { Params _group_0_binding_0_fs; };

layout(std140) uniform HostFrame_block_1Fragment { HostFrame _group_0_binding_1_fs; };

uniform highp sampler2D _group_1_binding_0_fs;

uniform highp sampler2D _group_1_binding_1_fs;

uniform highp sampler2D _group_1_binding_2_fs;

uniform highp sampler2D _group_1_binding_3_fs;

layout(location = 0) out vec4 _fs2p_location0;
layout(location = 1) out vec4 _fs2p_location1;
layout(location = 2) out vec4 _fs2p_location2;

vec3 localPoint(vec4 v) {
    mat4x4 _e3 = _group_0_binding_1_fs.cameraToLocal;
    mat4x4 _e6 = _group_0_binding_1_fs.inverseProjection;
    vec4 p_41 = ((_e3 * _e6) * v);
    return (p_41.xyz / vec3(p_41.w));
}

mat2x3 hostRay(vec2 pixel_1) {
    vec2 ndc = vec2(0.0);
    vec4 _e3 = _group_0_binding_1_fs.viewport;
    ndc = (((pixel_1 / _e3.xy) * 2.0) - vec2(1.0));
    float _e15 = _group_0_binding_1_fs.viewport.z;
    if ((_e15 > 0.5)) {
        float _e20 = ndc.y;
        ndc.y = -(_e20);
    }
    vec2 _e22 = ndc;
    vec3 _e26 = localPoint(vec4(_e22, -1.0, 1.0));
    vec2 _e27 = ndc;
    vec3 _e31 = localPoint(vec4(_e27, 1.0, 1.0));
    return mat2x3(_e26, normalize((_e31 - _e26)));
}

vec2 stationRayInterval(vec3 ro, vec3 rd) {
    float near = 0.0;
    float far = 0.0;
    uint axis = 0u;
    vec3 lo_1 = vec3(-61.0, -4.0, -224.0);
    vec3 hi_1 = vec3(70.0, 49.0, 30.0);
    float _e15 = _group_0_binding_1_fs.controls.y;
    far = _e15;
    bool loop_init = true;
    while(true) {
        if (!loop_init) {
            uint _e64 = axis;
            axis = (_e64 + 1u);
        }
        loop_init = false;
        uint _e19 = axis;
        if ((_e19 < 3u)) {
        } else {
            break;
        }
        {
            uint _e22 = axis;
            if ((abs(rd[_e22]) < 1e-7)) {
                uint _e27 = axis;
                uint _e29 = axis;
                uint _e32 = axis;
                uint _e34 = axis;
                if (((ro[_e27] < lo_1[_e29]) || (ro[_e32] > hi_1[_e34]))) {
                    return vec2(1.0, -1.0);
                }
            } else {
                uint _e41 = axis;
                uint _e43 = axis;
                uint _e46 = axis;
                float a_7 = ((lo_1[_e41] - ro[_e43]) / rd[_e46]);
                uint _e49 = axis;
                uint _e51 = axis;
                uint _e54 = axis;
                float b_9 = ((hi_1[_e49] - ro[_e51]) / rd[_e54]);
                float _e57 = near;
                near = max(_e57, min(a_7, b_9));
                float _e60 = far;
                far = min(_e60, max(a_7, b_9));
            }
        }
    }
    float _e66 = near;
    float _e67 = far;
    return vec2(_e66, _e67);
}

float br_h11_(float p) {
    return fract((sin(((p * 127.1) + 311.7)) * 43758.547));
}

float br_hash31_(vec3 pIn) {
    vec3 p_1 = vec3(0.0);
    p_1 = fract((pIn * 0.1031));
    vec3 _e5 = p_1;
    vec3 _e6 = p_1;
    vec3 _e13 = p_1;
    p_1 = (_e13 + vec3(dot(_e5, (_e6.yzx + vec3(33.33)))));
    float _e16 = p_1.x;
    float _e18 = p_1.y;
    float _e21 = p_1.z;
    return fract(((_e16 + _e18) * _e21));
}

float br_noise3_(vec3 p_2) {
    vec3 f = vec3(0.0);
    vec3 i_6 = floor(p_2);
    f = fract(p_2);
    vec3 _e4 = f;
    vec3 _e5 = f;
    vec3 _e9 = f;
    f = ((_e4 * _e5) * (vec3(3.0) - (2.0 * _e9)));
    float _e14 = br_hash31_(i_6);
    float _e20 = br_hash31_((i_6 + vec3(1.0, 0.0, 0.0)));
    float _e22 = f.x;
    float _e29 = br_hash31_((i_6 + vec3(0.0, 1.0, 0.0)));
    float _e35 = br_hash31_((i_6 + vec3(1.0, 1.0, 0.0)));
    float _e37 = f.x;
    float _e40 = f.y;
    float _e47 = br_hash31_((i_6 + vec3(0.0, 0.0, 1.0)));
    float _e53 = br_hash31_((i_6 + vec3(1.0, 0.0, 1.0)));
    float _e55 = f.x;
    float _e62 = br_hash31_((i_6 + vec3(0.0, 1.0, 1.0)));
    float _e68 = br_hash31_((i_6 + vec3(1.0, 1.0, 1.0)));
    float _e70 = f.x;
    float _e73 = f.y;
    float _e76 = f.z;
    return mix(mix(mix(_e14, _e20, _e22), mix(_e29, _e35, _e37), _e40), mix(mix(_e47, _e53, _e55), mix(_e62, _e68, _e70), _e73), _e76);
}

float br_fbm(vec3 pIn_1) {
    vec3 p_3 = vec3(0.0);
    float s = 0.0;
    float a = 0.5;
    int i = 0;
    p_3 = pIn_1;
    bool loop_init_1 = true;
    while(true) {
        if (!loop_init_1) {
            int _e29 = i;
            i = (_e29 + 1);
        }
        loop_init_1 = false;
        int _e8 = i;
        if ((_e8 < 5)) {
        } else {
            break;
        }
        {
            float _e11 = a;
            vec3 _e12 = p_3;
            float _e13 = br_noise3_(_e12);
            float _e15 = s;
            s = (_e15 + (_e11 * _e13));
            vec3 _e17 = p_3;
            p_3 = ((_e17 * 2.03) + vec3(7.1, -3.7, 11.9));
            float _e26 = a;
            a = (_e26 * 0.5);
        }
    }
    float _e31 = s;
    return _e31;
}

float br_roundBox(vec3 p_4, vec3 b, float r) {
    vec3 q_13 = ((abs(p_4) - b) + vec3(r));
    return ((length(max(q_13, vec3(0.0))) + min(max(q_13.x, max(q_13.y, q_13.z)), 0.0)) - r);
}

float br_mid_x_m_m(float tIn) {
    float t = 0.0;
    t = tIn;
    float _e2 = t;
    t = clamp(_e2, -0.95, 0.95);
    float _e7 = t;
    float _e15 = t;
    float _e22 = t;
    float _e29 = t;
    return ((((0.0 - (0.01800174 * cos((9.424778 * _e7)))) + (0.00862492 * sin((9.424778 * _e15)))) - (0.00032245 * cos((12.566371 * _e22)))) - (0.00199262 * sin((12.566371 * _e29))));
}

float br_high_x_m_m(float tIn_1) {
    float t_1 = 0.0;
    t_1 = tIn_1;
    float _e2 = t_1;
    t_1 = clamp(_e2, -0.95, 0.95);
    float _e7 = t_1;
    float _e15 = t_1;
    float _e22 = t_1;
    float _e29 = t_1;
    float _e36 = t_1;
    float _e43 = t_1;
    float _e50 = t_1;
    float _e57 = t_1;
    float _e64 = t_1;
    float _e71 = t_1;
    float _e78 = t_1;
    float _e85 = t_1;
    float _e92 = t_1;
    float _e99 = t_1;
    float _e106 = t_1;
    float _e113 = t_1;
    float _e120 = t_1;
    float _e127 = t_1;
    float _e134 = t_1;
    float _e141 = t_1;
    float _e148 = t_1;
    float _e155 = t_1;
    float _e162 = t_1;
    float _e169 = t_1;
    return ((((((((((((((((((((((((0.0 - (0.01471101 * cos((15.707964 * _e7)))) - (0.00611511 * sin((15.707964 * _e15)))) + (0.00505069 * cos((18.849556 * _e22)))) - (0.01129023 * sin((18.849556 * _e29)))) + (0.00016204 * cos((21.99115 * _e36)))) - (0.00678541 * sin((21.99115 * _e43)))) + (0.00910669 * cos((25.132742 * _e50)))) - (0.00372102 * sin((25.132742 * _e57)))) + (0.0038662 * cos((28.274334 * _e64)))) + (0.00169141 * sin((28.274334 * _e71)))) + (0.00255569 * cos((31.415928 * _e78)))) + (0.00429621 * sin((31.415928 * _e85)))) - (0.00149008 * cos((34.55752 * _e92)))) + (0.00421699 * sin((34.55752 * _e99)))) - (0.00482651 * cos((37.699112 * _e106)))) + (0.00371242 * sin((37.699112 * _e113)))) - (0.00518212 * cos((40.840706 * _e120)))) - (0.00028101 * sin((40.840706 * _e127)))) - (0.00483069 * cos((43.9823 * _e134)))) - (0.00165143 * sin((43.9823 * _e141)))) - (0.00203463 * cos((47.12389 * _e148)))) - (0.00399068 * sin((47.12389 * _e155)))) + (0.00089974 * cos((50.265484 * _e162)))) - (0.00264073 * sin((50.265484 * _e169))));
}

float br_mid_x_m_p(float tIn_2) {
    float t_2 = 0.0;
    t_2 = tIn_2;
    float _e2 = t_2;
    t_2 = clamp(_e2, -0.95, 0.95);
    float _e7 = t_2;
    float _e15 = t_2;
    float _e22 = t_2;
    float _e29 = t_2;
    return ((((0.0 - (0.01135424 * cos((9.424778 * _e7)))) - (0.00403594 * sin((9.424778 * _e15)))) + (0.01141619 * cos((12.566371 * _e22)))) - (0.00155239 * sin((12.566371 * _e29))));
}

float br_high_x_m_p(float tIn_3) {
    float t_3 = 0.0;
    t_3 = tIn_3;
    float _e2 = t_3;
    t_3 = clamp(_e2, -0.95, 0.95);
    float _e7 = t_3;
    float _e15 = t_3;
    float _e22 = t_3;
    float _e29 = t_3;
    float _e36 = t_3;
    float _e43 = t_3;
    float _e50 = t_3;
    float _e57 = t_3;
    float _e64 = t_3;
    float _e71 = t_3;
    float _e78 = t_3;
    float _e85 = t_3;
    float _e92 = t_3;
    float _e99 = t_3;
    float _e106 = t_3;
    float _e113 = t_3;
    float _e120 = t_3;
    float _e127 = t_3;
    float _e134 = t_3;
    float _e141 = t_3;
    float _e148 = t_3;
    float _e155 = t_3;
    float _e162 = t_3;
    float _e169 = t_3;
    return ((((((((((((((((((((((((0.0 - (0.01111828 * cos((15.707964 * _e7)))) - (0.00524976 * sin((15.707964 * _e15)))) + (0.00926048 * cos((18.849556 * _e22)))) - (0.00196252 * sin((18.849556 * _e29)))) - (0.01080133 * cos((21.99115 * _e36)))) - (0.00236667 * sin((21.99115 * _e43)))) + (0.00682428 * cos((25.132742 * _e50)))) + (0.00034784 * sin((25.132742 * _e57)))) - (0.00988528 * cos((28.274334 * _e64)))) - (0.00067851 * sin((28.274334 * _e71)))) + (0.00392564 * cos((31.415928 * _e78)))) + (0.00248324 * sin((31.415928 * _e85)))) - (0.00639717 * cos((34.55752 * _e92)))) - (0.00103361 * sin((34.55752 * _e99)))) + (0.00224399 * cos((37.699112 * _e106)))) + (0.00279355 * sin((37.699112 * _e113)))) - (0.00234379 * cos((40.840706 * _e120)))) - (0.00034023 * sin((40.840706 * _e127)))) + (0.00154531 * cos((43.9823 * _e134)))) + (0.00135488 * sin((43.9823 * _e141)))) - (0.00041372 * cos((47.12389 * _e148)))) + (0.00081121 * sin((47.12389 * _e155)))) + (0.0017669 * cos((50.265484 * _e162)))) - (0.00017177 * sin((50.265484 * _e169))));
}

float br_mid_x_p_m(float tIn_4) {
    float t_4 = 0.0;
    t_4 = tIn_4;
    float _e2 = t_4;
    t_4 = clamp(_e2, -0.95, 0.95);
    float _e7 = t_4;
    float _e15 = t_4;
    float _e22 = t_4;
    float _e29 = t_4;
    return ((((0.0 - (0.01106844 * cos((9.424778 * _e7)))) + (0.00366009 * sin((9.424778 * _e15)))) + (0.00491573 * cos((12.566371 * _e22)))) - (0.00304459 * sin((12.566371 * _e29))));
}

float br_high_x_p_m(float tIn_5) {
    float t_5 = 0.0;
    t_5 = tIn_5;
    float _e2 = t_5;
    t_5 = clamp(_e2, -0.95, 0.95);
    float _e7 = t_5;
    float _e15 = t_5;
    float _e22 = t_5;
    float _e29 = t_5;
    float _e36 = t_5;
    float _e43 = t_5;
    float _e50 = t_5;
    float _e57 = t_5;
    float _e64 = t_5;
    float _e71 = t_5;
    float _e78 = t_5;
    float _e85 = t_5;
    float _e92 = t_5;
    float _e99 = t_5;
    float _e106 = t_5;
    float _e113 = t_5;
    float _e120 = t_5;
    float _e127 = t_5;
    float _e134 = t_5;
    float _e141 = t_5;
    float _e148 = t_5;
    float _e155 = t_5;
    float _e162 = t_5;
    float _e169 = t_5;
    return ((((((((((((((((((((((((0.0 - (0.00968863 * cos((15.707964 * _e7)))) + (0.00804842 * sin((15.707964 * _e15)))) - (0.00023933 * cos((18.849556 * _e22)))) - (0.0015963 * sin((18.849556 * _e29)))) - (0.00533428 * cos((21.99115 * _e36)))) + (0.00562751 * sin((21.99115 * _e43)))) - (0.00301718 * cos((25.132742 * _e50)))) - (0.00124667 * sin((25.132742 * _e57)))) - (0.00068517 * cos((28.274334 * _e64)))) + (0.00175252 * sin((28.274334 * _e71)))) - (0.00175606 * cos((31.415928 * _e78)))) - (0.00053161 * sin((31.415928 * _e85)))) + (0.00314901 * cos((34.55752 * _e92)))) - (0.00221809 * sin((34.55752 * _e99)))) - (2.768e-5 * cos((37.699112 * _e106)))) - (0.00050747 * sin((37.699112 * _e113)))) + (0.0032259 * cos((40.840706 * _e120)))) - (0.00372527 * sin((40.840706 * _e127)))) + (9.642e-5 * cos((43.9823 * _e134)))) + (0.00051161 * sin((43.9823 * _e141)))) + (0.00137602 * cos((47.12389 * _e148)))) - (0.00204386 * sin((47.12389 * _e155)))) - (0.00040926 * cos((50.265484 * _e162)))) + (0.00184796 * sin((50.265484 * _e169))));
}

float br_mid_x_p_p(float tIn_6) {
    float t_6 = 0.0;
    t_6 = tIn_6;
    float _e2 = t_6;
    t_6 = clamp(_e2, -0.95, 0.95);
    float _e7 = t_6;
    float _e15 = t_6;
    float _e22 = t_6;
    float _e29 = t_6;
    return ((((0.0 - (0.01568166 * cos((9.424778 * _e7)))) - (0.00042124 * sin((9.424778 * _e15)))) + (0.00873786 * cos((12.566371 * _e22)))) + (0.00638691 * sin((12.566371 * _e29))));
}

float br_high_x_p_p(float tIn_7) {
    float t_7 = 0.0;
    t_7 = tIn_7;
    float _e2 = t_7;
    t_7 = clamp(_e2, -0.95, 0.95);
    float _e7 = t_7;
    float _e15 = t_7;
    float _e22 = t_7;
    float _e29 = t_7;
    float _e36 = t_7;
    float _e43 = t_7;
    float _e50 = t_7;
    float _e57 = t_7;
    float _e64 = t_7;
    float _e71 = t_7;
    float _e78 = t_7;
    float _e85 = t_7;
    float _e92 = t_7;
    float _e99 = t_7;
    float _e106 = t_7;
    float _e113 = t_7;
    float _e120 = t_7;
    float _e127 = t_7;
    float _e134 = t_7;
    float _e141 = t_7;
    float _e148 = t_7;
    float _e155 = t_7;
    float _e162 = t_7;
    float _e169 = t_7;
    return ((((((((((((((((((((((((0.0 - (0.01295239 * cos((15.707964 * _e7)))) - (0.00380655 * sin((15.707964 * _e15)))) + (0.00244597 * cos((18.849556 * _e22)))) + (0.00179228 * sin((18.849556 * _e29)))) - (0.00822504 * cos((21.99115 * _e36)))) - (0.00912719 * sin((21.99115 * _e43)))) + (0.00818194 * cos((25.132742 * _e50)))) - (0.0022658 * sin((25.132742 * _e57)))) + (0.00200288 * cos((28.274334 * _e64)))) - (0.00217961 * sin((28.274334 * _e71)))) + (0.00524195 * cos((31.415928 * _e78)))) + (0.00335884 * sin((31.415928 * _e85)))) - (0.00236021 * cos((34.55752 * _e92)))) + (0.00141195 * sin((34.55752 * _e99)))) + (0.00291234 * cos((37.699112 * _e106)))) + (0.00156187 * sin((37.699112 * _e113)))) - (0.00192814 * cos((40.840706 * _e120)))) + (0.00280991 * sin((40.840706 * _e127)))) - (0.00040794 * cos((43.9823 * _e134)))) + (0.00126868 * sin((43.9823 * _e141)))) - (0.00433065 * cos((47.12389 * _e148)))) - (0.00021126 * sin((47.12389 * _e155)))) + (0.00012984 * cos((50.265484 * _e162)))) - (0.0020827 * sin((50.265484 * _e169))));
}

float br_mid_y_m_m(float tIn_8) {
    float t_8 = 0.0;
    t_8 = tIn_8;
    float _e2 = t_8;
    t_8 = clamp(_e2, -0.95, 0.95);
    float _e7 = t_8;
    float _e15 = t_8;
    float _e22 = t_8;
    float _e29 = t_8;
    return ((((0.0 - (0.00630336 * cos((9.424778 * _e7)))) + (0.00827031 * sin((9.424778 * _e15)))) + (0.00566717 * cos((12.566371 * _e22)))) + (0.00042867 * sin((12.566371 * _e29))));
}

float br_high_y_m_m(float tIn_9) {
    float t_9 = 0.0;
    t_9 = tIn_9;
    float _e2 = t_9;
    t_9 = clamp(_e2, -0.95, 0.95);
    float _e7 = t_9;
    float _e15 = t_9;
    float _e22 = t_9;
    float _e29 = t_9;
    float _e36 = t_9;
    float _e43 = t_9;
    float _e50 = t_9;
    float _e57 = t_9;
    float _e64 = t_9;
    float _e71 = t_9;
    float _e78 = t_9;
    float _e85 = t_9;
    float _e92 = t_9;
    float _e99 = t_9;
    float _e106 = t_9;
    float _e113 = t_9;
    float _e120 = t_9;
    float _e127 = t_9;
    float _e134 = t_9;
    float _e141 = t_9;
    float _e148 = t_9;
    float _e155 = t_9;
    float _e162 = t_9;
    float _e169 = t_9;
    return ((((((((((((((((((((((((0.0 - (0.00616945 * cos((15.707964 * _e7)))) + (0.00614401 * sin((15.707964 * _e15)))) + (0.00276823 * cos((18.849556 * _e22)))) - (0.00324009 * sin((18.849556 * _e29)))) - (0.00277462 * cos((21.99115 * _e36)))) + (0.00419118 * sin((21.99115 * _e43)))) + (0.00129222 * cos((25.132742 * _e50)))) - (0.0025167 * sin((25.132742 * _e57)))) - (0.00017492 * cos((28.274334 * _e64)))) + (0.00320414 * sin((28.274334 * _e71)))) - (0.00060079 * cos((31.415928 * _e78)))) - (0.00079424 * sin((31.415928 * _e85)))) + (0.00099889 * cos((34.55752 * _e92)))) + (0.00100195 * sin((34.55752 * _e99)))) - (0.00147204 * cos((37.699112 * _e106)))) + (0.00019719 * sin((37.699112 * _e113)))) + (0.00147029 * cos((40.840706 * _e120)))) - (0.00057325 * sin((40.840706 * _e127)))) - (0.00105959 * cos((43.9823 * _e134)))) + (0.00146526 * sin((43.9823 * _e141)))) + (0.00110262 * cos((47.12389 * _e148)))) - (0.00092602 * sin((47.12389 * _e155)))) - (0.00024836 * cos((50.265484 * _e162)))) + (0.00177536 * sin((50.265484 * _e169))));
}

float br_mid_y_m_p(float tIn_10) {
    float t_10 = 0.0;
    t_10 = tIn_10;
    float _e2 = t_10;
    t_10 = clamp(_e2, -0.95, 0.95);
    float _e7 = t_10;
    float _e15 = t_10;
    float _e22 = t_10;
    float _e29 = t_10;
    return ((((0.0 - (0.00456362 * cos((9.424778 * _e7)))) + (0.00232485 * sin((9.424778 * _e15)))) + (0.00364059 * cos((12.566371 * _e22)))) - (0.00296393 * sin((12.566371 * _e29))));
}

float br_high_y_m_p(float tIn_11) {
    float t_11 = 0.0;
    t_11 = tIn_11;
    float _e2 = t_11;
    t_11 = clamp(_e2, -0.95, 0.95);
    float _e7 = t_11;
    float _e15 = t_11;
    float _e22 = t_11;
    float _e29 = t_11;
    float _e36 = t_11;
    float _e43 = t_11;
    float _e50 = t_11;
    float _e57 = t_11;
    float _e64 = t_11;
    float _e71 = t_11;
    float _e78 = t_11;
    float _e85 = t_11;
    float _e92 = t_11;
    float _e99 = t_11;
    float _e106 = t_11;
    float _e113 = t_11;
    float _e120 = t_11;
    float _e127 = t_11;
    float _e134 = t_11;
    float _e141 = t_11;
    float _e148 = t_11;
    float _e155 = t_11;
    float _e162 = t_11;
    float _e169 = t_11;
    return ((((((((((((((((((((((((0.0 + (0.00058035 * cos((15.707964 * _e7)))) + (0.00351213 * sin((15.707964 * _e15)))) - (0.00311119 * cos((18.849556 * _e22)))) - (0.0008256 * sin((18.849556 * _e29)))) + (0.0044752 * cos((21.99115 * _e36)))) - (0.00080438 * sin((21.99115 * _e43)))) - (0.00625696 * cos((25.132742 * _e50)))) + (0.00100661 * sin((25.132742 * _e57)))) + (0.00468255 * cos((28.274334 * _e64)))) - (0.00231942 * sin((28.274334 * _e71)))) - (0.00397357 * cos((31.415928 * _e78)))) + (0.00223223 * sin((31.415928 * _e85)))) + (0.00344591 * cos((34.55752 * _e92)))) - (0.00145876 * sin((34.55752 * _e99)))) - (0.00081874 * cos((37.699112 * _e106)))) + (0.00036113 * sin((37.699112 * _e113)))) + (0.00095928 * cos((40.840706 * _e120)))) + (0.00022236 * sin((40.840706 * _e127)))) + (0.00016248 * cos((43.9823 * _e134)))) - (0.00163296 * sin((43.9823 * _e141)))) - (0.00041686 * cos((47.12389 * _e148)))) + (0.00173083 * sin((47.12389 * _e155)))) + (0.00042056 * cos((50.265484 * _e162)))) - (0.00171078 * sin((50.265484 * _e169))));
}

float br_mid_y_p_m(float tIn_12) {
    float t_12 = 0.0;
    t_12 = tIn_12;
    float _e2 = t_12;
    t_12 = clamp(_e2, -0.95, 0.95);
    float _e7 = t_12;
    float _e15 = t_12;
    float _e22 = t_12;
    float _e29 = t_12;
    return ((((0.0 - (0.00568083 * cos((9.424778 * _e7)))) + (0.00059518 * sin((9.424778 * _e15)))) + (0.00165756 * cos((12.566371 * _e22)))) - (0.00265243 * sin((12.566371 * _e29))));
}

float br_high_y_p_m(float tIn_13) {
    float t_13 = 0.0;
    t_13 = tIn_13;
    float _e2 = t_13;
    t_13 = clamp(_e2, -0.95, 0.95);
    float _e7 = t_13;
    float _e15 = t_13;
    float _e22 = t_13;
    float _e29 = t_13;
    float _e36 = t_13;
    float _e43 = t_13;
    float _e50 = t_13;
    float _e57 = t_13;
    float _e64 = t_13;
    float _e71 = t_13;
    float _e78 = t_13;
    float _e85 = t_13;
    float _e92 = t_13;
    float _e99 = t_13;
    float _e106 = t_13;
    float _e113 = t_13;
    float _e120 = t_13;
    float _e127 = t_13;
    float _e134 = t_13;
    float _e141 = t_13;
    float _e148 = t_13;
    float _e155 = t_13;
    float _e162 = t_13;
    float _e169 = t_13;
    return ((((((((((((((((((((((((0.0 - (0.00237719 * cos((15.707964 * _e7)))) + (0.00155711 * sin((15.707964 * _e15)))) - (0.001748 * cos((18.849556 * _e22)))) - (0.0003458 * sin((18.849556 * _e29)))) + (0.00109223 * cos((21.99115 * _e36)))) - (0.00076205 * sin((21.99115 * _e43)))) - (0.00183915 * cos((25.132742 * _e50)))) + (0.00169373 * sin((25.132742 * _e57)))) + (0.00166788 * cos((28.274334 * _e64)))) - (0.0019743 * sin((28.274334 * _e71)))) + (0.00023726 * cos((31.415928 * _e78)))) + (0.0020999 * sin((31.415928 * _e85)))) - (0.0001369 * cos((34.55752 * _e92)))) - (0.00204928 * sin((34.55752 * _e99)))) + (0.00149101 * cos((37.699112 * _e106)))) + (0.00080592 * sin((37.699112 * _e113)))) - (0.00168845 * cos((40.840706 * _e120)))) - (0.00052462 * sin((40.840706 * _e127)))) + (0.00199706 * cos((43.9823 * _e134)))) - (0.00016703 * sin((43.9823 * _e141)))) - (0.00114543 * cos((47.12389 * _e148)))) + (0.00067098 * sin((47.12389 * _e155)))) + (0.00132124 * cos((50.265484 * _e162)))) - (0.00060376 * sin((50.265484 * _e169))));
}

float br_mid_y_p_p(float tIn_14) {
    float t_14 = 0.0;
    t_14 = tIn_14;
    float _e2 = t_14;
    t_14 = clamp(_e2, -0.95, 0.95);
    float _e7 = t_14;
    float _e15 = t_14;
    float _e22 = t_14;
    float _e29 = t_14;
    return ((((0.0 - (0.01472244 * cos((9.424778 * _e7)))) + (0.00196068 * sin((9.424778 * _e15)))) + (0.00837774 * cos((12.566371 * _e22)))) - (0.00049031 * sin((12.566371 * _e29))));
}

float br_high_y_p_p(float tIn_15) {
    float t_15 = 0.0;
    t_15 = tIn_15;
    float _e2 = t_15;
    t_15 = clamp(_e2, -0.95, 0.95);
    float _e7 = t_15;
    float _e15 = t_15;
    float _e22 = t_15;
    float _e29 = t_15;
    float _e36 = t_15;
    float _e43 = t_15;
    float _e50 = t_15;
    float _e57 = t_15;
    float _e64 = t_15;
    float _e71 = t_15;
    float _e78 = t_15;
    float _e85 = t_15;
    float _e92 = t_15;
    float _e99 = t_15;
    float _e106 = t_15;
    float _e113 = t_15;
    float _e120 = t_15;
    float _e127 = t_15;
    float _e134 = t_15;
    float _e141 = t_15;
    float _e148 = t_15;
    float _e155 = t_15;
    float _e162 = t_15;
    float _e169 = t_15;
    return ((((((((((((((((((((((((0.0 - (0.00814206 * cos((15.707964 * _e7)))) - (0.00053856 * sin((15.707964 * _e15)))) + (0.00257906 * cos((18.849556 * _e22)))) - (0.00127762 * sin((18.849556 * _e29)))) - (0.0008612 * cos((21.99115 * _e36)))) + (0.0016501 * sin((21.99115 * _e43)))) - (0.00324482 * cos((25.132742 * _e50)))) - (0.00230772 * sin((25.132742 * _e57)))) + (0.00531309 * cos((28.274334 * _e64)))) + (0.0028567 * sin((28.274334 * _e71)))) - (0.00601731 * cos((31.415928 * _e78)))) - (0.00308967 * sin((31.415928 * _e85)))) + (0.0075677 * cos((34.55752 * _e92)))) + (0.00401337 * sin((34.55752 * _e99)))) - (0.0070424 * cos((37.699112 * _e106)))) - (0.00363779 * sin((37.699112 * _e113)))) + (0.00672339 * cos((40.840706 * _e120)))) + (0.00366736 * sin((40.840706 * _e127)))) - (0.00539581 * cos((43.9823 * _e134)))) - (0.00292112 * sin((43.9823 * _e141)))) + (0.00379057 * cos((47.12389 * _e148)))) + (0.0028041 * sin((47.12389 * _e155)))) - (0.00302659 * cos((50.265484 * _e162)))) - (0.00189233 * sin((50.265484 * _e169))));
}

float br_mid_z_m_m(float tIn_16) {
    float t_16 = 0.0;
    t_16 = tIn_16;
    float _e2 = t_16;
    t_16 = clamp(_e2, -0.95, 0.95);
    float _e7 = t_16;
    float _e15 = t_16;
    float _e22 = t_16;
    float _e29 = t_16;
    return ((((0.0 - (0.0344543 * cos((9.424778 * _e7)))) - (0.00282014 * sin((9.424778 * _e15)))) + (0.03501842 * cos((12.566371 * _e22)))) + (0.00267835 * sin((12.566371 * _e29))));
}

float br_high_z_m_m(float tIn_17) {
    float t_17 = 0.0;
    t_17 = tIn_17;
    float _e2 = t_17;
    t_17 = clamp(_e2, -0.95, 0.95);
    float _e7 = t_17;
    float _e15 = t_17;
    float _e22 = t_17;
    float _e29 = t_17;
    float _e36 = t_17;
    float _e43 = t_17;
    float _e50 = t_17;
    float _e57 = t_17;
    float _e64 = t_17;
    float _e71 = t_17;
    float _e78 = t_17;
    float _e85 = t_17;
    float _e92 = t_17;
    float _e99 = t_17;
    float _e106 = t_17;
    float _e113 = t_17;
    float _e120 = t_17;
    float _e127 = t_17;
    float _e134 = t_17;
    float _e141 = t_17;
    float _e148 = t_17;
    float _e155 = t_17;
    float _e162 = t_17;
    float _e169 = t_17;
    return ((((((((((((((((((((((((0.0 - (0.0313497 * cos((15.707964 * _e7)))) - (0.00507503 * sin((15.707964 * _e15)))) + (0.02759835 * cos((18.849556 * _e22)))) + (0.00467492 * sin((18.849556 * _e29)))) - (0.02453092 * cos((21.99115 * _e36)))) - (0.00547356 * sin((21.99115 * _e43)))) + (0.02023931 * cos((25.132742 * _e50)))) + (0.00660731 * sin((25.132742 * _e57)))) - (0.0169969 * cos((28.274334 * _e64)))) - (0.00634397 * sin((28.274334 * _e71)))) + (0.01361088 * cos((31.415928 * _e78)))) + (0.00712487 * sin((31.415928 * _e85)))) - (0.01008559 * cos((34.55752 * _e92)))) - (0.00675053 * sin((34.55752 * _e99)))) + (0.00780155 * cos((37.699112 * _e106)))) + (0.00722028 * sin((37.699112 * _e113)))) - (0.00529194 * cos((40.840706 * _e120)))) - (0.00638835 * sin((40.840706 * _e127)))) + (0.00336004 * cos((43.9823 * _e134)))) + (0.00624403 * sin((43.9823 * _e141)))) - (0.00209103 * cos((47.12389 * _e148)))) - (0.00553015 * sin((47.12389 * _e155)))) + (0.00084286 * cos((50.265484 * _e162)))) + (0.00479951 * sin((50.265484 * _e169))));
}

float br_mid_z_m_p(float tIn_18) {
    float t_18 = 0.0;
    t_18 = tIn_18;
    float _e2 = t_18;
    t_18 = clamp(_e2, -0.95, 0.95);
    float _e7 = t_18;
    float _e15 = t_18;
    float _e22 = t_18;
    float _e29 = t_18;
    return ((((0.0 - (0.01307475 * cos((9.424778 * _e7)))) + (0.00450446 * sin((9.424778 * _e15)))) + (0.00682105 * cos((12.566371 * _e22)))) + (0.00639899 * sin((12.566371 * _e29))));
}

float br_high_z_m_p(float tIn_19) {
    float t_19 = 0.0;
    t_19 = tIn_19;
    float _e2 = t_19;
    t_19 = clamp(_e2, -0.95, 0.95);
    float _e7 = t_19;
    float _e15 = t_19;
    float _e22 = t_19;
    float _e29 = t_19;
    float _e36 = t_19;
    float _e43 = t_19;
    float _e50 = t_19;
    float _e57 = t_19;
    float _e64 = t_19;
    float _e71 = t_19;
    float _e78 = t_19;
    float _e85 = t_19;
    float _e92 = t_19;
    float _e99 = t_19;
    float _e106 = t_19;
    float _e113 = t_19;
    float _e120 = t_19;
    float _e127 = t_19;
    float _e134 = t_19;
    float _e141 = t_19;
    float _e148 = t_19;
    float _e155 = t_19;
    float _e162 = t_19;
    float _e169 = t_19;
    return ((((((((((((((((((((((((0.0 - (0.00571077 * cos((15.707964 * _e7)))) + (0.00346485 * sin((15.707964 * _e15)))) + (0.00609629 * cos((18.849556 * _e22)))) + (0.00059963 * sin((18.849556 * _e29)))) - (0.00710636 * cos((21.99115 * _e36)))) - (0.00381479 * sin((21.99115 * _e43)))) + (0.00135812 * cos((25.132742 * _e50)))) + (0.00135282 * sin((25.132742 * _e57)))) - (0.00506045 * cos((28.274334 * _e64)))) - (0.00360239 * sin((28.274334 * _e71)))) + (0.00308686 * cos((31.415928 * _e78)))) + (0.00261325 * sin((31.415928 * _e85)))) - (0.00270687 * cos((34.55752 * _e92)))) - (0.00449361 * sin((34.55752 * _e99)))) + (0.00262569 * cos((37.699112 * _e106)))) + (0.00311502 * sin((37.699112 * _e113)))) - (0.00162438 * cos((40.840706 * _e120)))) - (0.00306571 * sin((40.840706 * _e127)))) + (0.00251715 * cos((43.9823 * _e134)))) + (0.00290793 * sin((43.9823 * _e141)))) - (0.0008765 * cos((47.12389 * _e148)))) - (0.00290014 * sin((47.12389 * _e155)))) + (0.00095675 * cos((50.265484 * _e162)))) + (0.00161494 * sin((50.265484 * _e169))));
}

float br_mid_z_p_m(float tIn_20) {
    float t_20 = 0.0;
    t_20 = tIn_20;
    float _e2 = t_20;
    t_20 = clamp(_e2, -0.95, 0.95);
    float _e7 = t_20;
    float _e15 = t_20;
    float _e22 = t_20;
    float _e29 = t_20;
    return ((((0.0 - (0.00543148 * cos((9.424778 * _e7)))) - (0.01245624 * sin((9.424778 * _e15)))) + (0.01205722 * cos((12.566371 * _e22)))) + (0.00758454 * sin((12.566371 * _e29))));
}

float br_high_z_p_m(float tIn_21) {
    float t_21 = 0.0;
    t_21 = tIn_21;
    float _e2 = t_21;
    t_21 = clamp(_e2, -0.95, 0.95);
    float _e7 = t_21;
    float _e15 = t_21;
    float _e22 = t_21;
    float _e29 = t_21;
    float _e36 = t_21;
    float _e43 = t_21;
    float _e50 = t_21;
    float _e57 = t_21;
    float _e64 = t_21;
    float _e71 = t_21;
    float _e78 = t_21;
    float _e85 = t_21;
    float _e92 = t_21;
    float _e99 = t_21;
    float _e106 = t_21;
    float _e113 = t_21;
    float _e120 = t_21;
    float _e127 = t_21;
    float _e134 = t_21;
    float _e141 = t_21;
    float _e148 = t_21;
    float _e155 = t_21;
    float _e162 = t_21;
    float _e169 = t_21;
    return ((((((((((((((((((((((((0.0 - (0.01318042 * cos((15.707964 * _e7)))) - (0.01120445 * sin((15.707964 * _e15)))) + (0.00622728 * cos((18.849556 * _e22)))) + (0.0064346 * sin((18.849556 * _e29)))) - (0.00641567 * cos((21.99115 * _e36)))) - (0.00656035 * sin((21.99115 * _e43)))) + (0.00075536 * cos((25.132742 * _e50)))) + (0.00936163 * sin((25.132742 * _e57)))) - (0.00227068 * cos((28.274334 * _e64)))) - (0.00692473 * sin((28.274334 * _e71)))) + (0.00018661 * cos((31.415928 * _e78)))) + (0.00740915 * sin((31.415928 * _e85)))) - (9.489e-5 * cos((34.55752 * _e92)))) - (0.00591066 * sin((34.55752 * _e99)))) - (0.00047542 * cos((37.699112 * _e106)))) + (0.0043875 * sin((37.699112 * _e113)))) + (0.0003427 * cos((40.840706 * _e120)))) - (0.0032469 * sin((40.840706 * _e127)))) - (0.00151968 * cos((43.9823 * _e134)))) + (0.00176894 * sin((43.9823 * _e141)))) + (0.00166849 * cos((47.12389 * _e148)))) - (0.0012368 * sin((47.12389 * _e155)))) - (0.00146369 * cos((50.265484 * _e162)))) + (0.00149355 * sin((50.265484 * _e169))));
}

float br_mid_z_p_p(float tIn_22) {
    float t_22 = 0.0;
    t_22 = tIn_22;
    float _e2 = t_22;
    t_22 = clamp(_e2, -0.95, 0.95);
    float _e7 = t_22;
    float _e15 = t_22;
    float _e22 = t_22;
    float _e29 = t_22;
    return ((((0.0 - (0.00388179 * cos((9.424778 * _e7)))) + (0.00390139 * sin((9.424778 * _e15)))) + (0.00238573 * cos((12.566371 * _e22)))) - (0.00329681 * sin((12.566371 * _e29))));
}

float br_high_z_p_p(float tIn_23) {
    float t_23 = 0.0;
    t_23 = tIn_23;
    float _e2 = t_23;
    t_23 = clamp(_e2, -0.95, 0.95);
    float _e7 = t_23;
    float _e15 = t_23;
    float _e22 = t_23;
    float _e29 = t_23;
    float _e36 = t_23;
    float _e43 = t_23;
    float _e50 = t_23;
    float _e57 = t_23;
    float _e64 = t_23;
    float _e71 = t_23;
    float _e78 = t_23;
    float _e85 = t_23;
    float _e92 = t_23;
    float _e99 = t_23;
    float _e106 = t_23;
    float _e113 = t_23;
    float _e120 = t_23;
    float _e127 = t_23;
    float _e134 = t_23;
    float _e141 = t_23;
    float _e148 = t_23;
    float _e155 = t_23;
    float _e162 = t_23;
    float _e169 = t_23;
    return ((((((((((((((((((((((((0.0 - (0.00010459 * cos((15.707964 * _e7)))) + (0.00147038 * sin((15.707964 * _e15)))) + (0.00066299 * cos((18.849556 * _e22)))) - (0.00479755 * sin((18.849556 * _e29)))) + (0.00106469 * cos((21.99115 * _e36)))) + (0.00323743 * sin((21.99115 * _e43)))) - (0.0003419 * cos((25.132742 * _e50)))) - (0.00098051 * sin((25.132742 * _e57)))) + (0.00303712 * cos((28.274334 * _e64)))) + (0.00124931 * sin((28.274334 * _e71)))) - (0.00262919 * cos((31.415928 * _e78)))) - (0.00150538 * sin((31.415928 * _e85)))) + (0.00194169 * cos((34.55752 * _e92)))) - (0.00037848 * sin((34.55752 * _e99)))) - (0.00197504 * cos((37.699112 * _e106)))) + (0.00095933 * sin((37.699112 * _e113)))) + (0.00272261 * cos((40.840706 * _e120)))) - (0.00108356 * sin((40.840706 * _e127)))) - (0.00067581 * cos((43.9823 * _e134)))) + (0.00082625 * sin((43.9823 * _e141)))) + (0.00043735 * cos((47.12389 * _e148)))) - (0.00193681 * sin((47.12389 * _e155)))) - (0.00039229 * cos((50.265484 * _e162)))) + (0.00197941 * sin((50.265484 * _e169))));
}

float br_midX(float t_24, float sy, float sz) {
    if ((sy < 0.0)) {
        if ((sz < 0.0)) {
            float _e7 = br_mid_x_m_m(t_24);
            return _e7;
        }
        float _e8 = br_mid_x_m_p(t_24);
        return _e8;
    }
    if ((sz < 0.0)) {
        float _e11 = br_mid_x_p_m(t_24);
        return _e11;
    }
    float _e12 = br_mid_x_p_p(t_24);
    return _e12;
}

float br_midY(float t_25, float sx, float sz_1) {
    if ((sx < 0.0)) {
        if ((sz_1 < 0.0)) {
            float _e7 = br_mid_y_m_m(t_25);
            return _e7;
        }
        float _e8 = br_mid_y_m_p(t_25);
        return _e8;
    }
    if ((sz_1 < 0.0)) {
        float _e11 = br_mid_y_p_m(t_25);
        return _e11;
    }
    float _e12 = br_mid_y_p_p(t_25);
    return _e12;
}

float br_midZ(float t_26, float sx_1, float sy_1) {
    if ((sx_1 < 0.0)) {
        if ((sy_1 < 0.0)) {
            float _e7 = br_mid_z_m_m(t_26);
            return _e7;
        }
        float _e8 = br_mid_z_m_p(t_26);
        return _e8;
    }
    if ((sy_1 < 0.0)) {
        float _e11 = br_mid_z_p_m(t_26);
        return _e11;
    }
    float _e12 = br_mid_z_p_p(t_26);
    return _e12;
}

float br_highX(float t_27, float sy_2, float sz_2) {
    if ((sy_2 < 0.0)) {
        if ((sz_2 < 0.0)) {
            float _e7 = br_high_x_m_m(t_27);
            return _e7;
        }
        float _e8 = br_high_x_m_p(t_27);
        return _e8;
    }
    if ((sz_2 < 0.0)) {
        float _e11 = br_high_x_p_m(t_27);
        return _e11;
    }
    float _e12 = br_high_x_p_p(t_27);
    return _e12;
}

float br_highY(float t_28, float sx_2, float sz_3) {
    if ((sx_2 < 0.0)) {
        if ((sz_3 < 0.0)) {
            float _e7 = br_high_y_m_m(t_28);
            return _e7;
        }
        float _e8 = br_high_y_m_p(t_28);
        return _e8;
    }
    if ((sz_3 < 0.0)) {
        float _e11 = br_high_y_p_m(t_28);
        return _e11;
    }
    float _e12 = br_high_y_p_p(t_28);
    return _e12;
}

float br_highZ(float t_29, float sx_3, float sy_3) {
    if ((sx_3 < 0.0)) {
        if ((sy_3 < 0.0)) {
            float _e7 = br_high_z_m_m(t_29);
            return _e7;
        }
        float _e8 = br_high_z_m_p(t_29);
        return _e8;
    }
    if ((sy_3 < 0.0)) {
        float _e11 = br_high_z_p_m(t_29);
        return _e11;
    }
    float _e12 = br_high_z_p_p(t_29);
    return _e12;
}

float br_nf(float c, float h, float s_1, float band) {
    return smoothstep((h - band), (h + 0.003), (s_1 * c));
}

float br_chipWear(float vIn) {
    float v_4 = max((vIn - 0.0018), 0.0);
    return ((0.02 * tanh((v_4 / 0.02))) * smoothstep(0.001, 0.006, v_4));
}

float br_contour(float v_1) {
    return (0.0048 * tanh((v_1 / 0.03)));
}

float br_contourLong(float v_2) {
    float _e1 = br_contour(v_2);
    if ((_e1 >= -0.0022)) {
        return _e1;
    }
    return (-0.0022 + (0.00045 * tanh(((_e1 + 0.0022) / 0.00045))));
}

float br_mx(vec3 q, vec3 b_1, float sy_4, float sz_4) {
    float _e7 = br_nf(q.y, b_1.y, sy_4, 0.042);
    float _e11 = br_nf(q.z, b_1.z, sz_4, 0.054);
    return (_e7 * _e11);
}

float br_my(vec3 q_1, vec3 b_2, float sx_4, float sz_5) {
    float _e7 = br_nf(q_1.x, b_2.x, sx_4, 0.062);
    float _e11 = br_nf(q_1.z, b_2.z, sz_5, 0.054);
    return (_e7 * _e11);
}

float br_mz(vec3 q_2, vec3 b_3, float sx_5, float sy_5) {
    float _e7 = br_nf(q_2.x, b_3.x, sx_5, 0.062);
    float _e11 = br_nf(q_2.y, b_3.y, sy_5, 0.042);
    return (_e7 * _e11);
}

float br_ck(vec3 q_3, vec3 b_4, float sx_6, float sy_6, float sz_6) {
    float _e8 = br_nf(q_3.x, b_4.x, sx_6, 0.08);
    float _e12 = br_nf(q_3.y, b_4.y, sy_6, 0.052);
    float _e17 = br_nf(q_3.z, b_4.z, sz_6, 0.064);
    return ((_e8 * _e12) * _e17);
}

vec3 br_ax(vec3 q_4, vec3 b_5, float sy_7, float sz_7) {
    float _e4 = br_mx(q_4, b_5, sy_7, sz_7);
    float t_30 = (q_4.x / b_5.x);
    float _e8 = br_midX(t_30, sy_7, sz_7);
    float _e9 = br_highX(t_30, sy_7, sz_7);
    float _e11 = br_chipWear((_e8 + _e9));
    float _e13 = br_contourLong(_e8);
    return vec3((_e11 * _e4), (_e13 * _e4), _e4);
}

vec3 br_ay(vec3 q_5, vec3 b_6, float sx_7, float sz_8) {
    float _e4 = br_my(q_5, b_6, sx_7, sz_8);
    float t_31 = (q_5.y / b_6.y);
    float _e8 = br_midY(t_31, sx_7, sz_8);
    float _e9 = br_highY(t_31, sx_7, sz_8);
    float _e11 = br_chipWear((_e8 + _e9));
    float _e13 = br_contour(_e8);
    return vec3((_e11 * _e4), (_e13 * _e4), _e4);
}

vec3 br_az(vec3 q_6, vec3 b_7, float sx_8, float sy_8) {
    float _e4 = br_mz(q_6, b_7, sx_8, sy_8);
    float t_32 = (q_6.z / b_7.z);
    float _e8 = br_midZ(t_32, sx_8, sy_8);
    float _e9 = br_highZ(t_32, sx_8, sy_8);
    float _e11 = br_chipWear((_e8 + _e9));
    float _e13 = br_contour(_e8);
    return vec3((_e11 * _e4), (_e13 * _e4), _e4);
}

float br_surfaceDelta(vec3 q_7, vec3 b_8) {
    vec3 sum = vec3(0.0);
    vec3 _e7 = br_ax(q_7, b_8, -1.0, -1.0);
    vec3 _e8 = sum;
    sum = (_e8 + _e7);
    vec3 _e12 = br_ax(q_7, b_8, -1.0, 1.0);
    vec3 _e13 = sum;
    sum = (_e13 + _e12);
    vec3 _e17 = br_ax(q_7, b_8, 1.0, -1.0);
    vec3 _e18 = sum;
    sum = (_e18 + _e17);
    vec3 _e22 = br_ax(q_7, b_8, 1.0, 1.0);
    vec3 _e23 = sum;
    sum = (_e23 + _e22);
    vec3 _e27 = br_ay(q_7, b_8, -1.0, -1.0);
    vec3 _e28 = sum;
    sum = (_e28 + _e27);
    vec3 _e32 = br_ay(q_7, b_8, -1.0, 1.0);
    vec3 _e33 = sum;
    sum = (_e33 + _e32);
    vec3 _e37 = br_ay(q_7, b_8, 1.0, -1.0);
    vec3 _e38 = sum;
    sum = (_e38 + _e37);
    vec3 _e42 = br_ay(q_7, b_8, 1.0, 1.0);
    vec3 _e43 = sum;
    sum = (_e43 + _e42);
    vec3 _e47 = br_az(q_7, b_8, -1.0, -1.0);
    vec3 _e48 = sum;
    sum = (_e48 + _e47);
    vec3 _e52 = br_az(q_7, b_8, -1.0, 1.0);
    vec3 _e53 = sum;
    sum = (_e53 + _e52);
    vec3 _e57 = br_az(q_7, b_8, 1.0, -1.0);
    vec3 _e58 = sum;
    sum = (_e58 + _e57);
    vec3 _e62 = br_az(q_7, b_8, 1.0, 1.0);
    vec3 _e63 = sum;
    sum = (_e63 + _e62);
    float _e69 = br_ck(q_7, b_8, -1.0, -1.0, 1.0);
    float _e72 = sum.x;
    sum.x = (_e72 + (0.0017 * _e69));
    float _e78 = br_ck(q_7, b_8, -1.0, 1.0, 1.0);
    float _e81 = sum.x;
    sum.x = (_e81 + (0.022 * _e78));
    float _e87 = br_ck(q_7, b_8, 1.0, 1.0, -1.0);
    float _e90 = sum.x;
    sum.x = (_e90 + (0.014 * _e87));
    float _e96 = br_ck(q_7, b_8, 1.0, 1.0, 1.0);
    float _e99 = sum.x;
    sum.x = (_e99 + (0.007 * _e96));
    float _e102 = sum.x;
    float _e111 = sum.y;
    float _e113 = sum.z;
    return ((0.038 * tanh(((_e102 * 1.1) / 0.038))) + (_e111 / max(1.0, _e113)));
}

vec3 br_variant(vec3 qIn, int variant) {
    vec3 q_8 = vec3(0.0);
    q_8 = qIn;
    if (((variant & 1) == 1)) {
        float _e9 = q_8.x;
        q_8.x = -(_e9);
    }
    if (((variant & 2) == 2)) {
        float _e17 = q_8.z;
        q_8.z = -(_e17);
    }
    vec3 _e19 = q_8;
    return _e19;
}

float kpBrickBaseDistance(vec3 pLocalM, float seed, int variant_1, float variation) {
    vec3 _e7 = br_variant((pLocalM / vec3(0.115384616)), variant_1);
    vec3 b_10 = vec3(1.04, 0.265, 0.48);
    float _e14 = br_h11_((seed + 7.1));
    float gain = mix(1.0, (0.9 + (0.2 * _e14)), variation);
    float _e23 = br_roundBox(_e7, b_10, 0.055);
    float _e24 = br_surfaceDelta(_e7, b_10);
    return (KP_BRICK_SCALE * (_e23 + (_e24 * gain)));
}

float kpBrickAnalyticBoundDistance(vec3 pLocalM_1) {
    float _e10 = br_roundBox((pLocalM_1 / vec3(0.115384616)), vec3(1.04, 0.265, 0.48), 0.055);
    return (KP_BRICK_SCALE * _e10);
}

vec3 br_xi(vec3 q_9) {
    float rr = max(length(q_9), 0.0001);
    float radial2_ = dot(q_9.xy, q_9.xy);
    float angularRadius = sqrt((radial2_ + ((1.235 * 1.235) * exp((-(radial2_) / (1.235 * 1.235))))));
    float angle = acos(clamp((q_9.y / angularRadius), -0.999999, 0.999999));
    return vec3((log2(rr) - 2.0), ((-(q_9.z) / rr) - 1.0), angle);
}

float br_microscope(vec3 q_10, float qFootprint) {
    float s_2 = 0.0;
    float sc = 1.0;
    int j = 0;
    vec3 _e2 = br_xi(q_10);
    float e = max(qFootprint, 1e-7);
    vec3 _e9 = br_xi((q_10 + vec3(e, 0.0, 0.0)));
    vec3 _e16 = br_xi((q_10 + vec3(0.0, e, 0.0)));
    vec3 _e23 = br_xi((q_10 + vec3(0.0, 0.0, e)));
    float fp_21 = max(length((_e9 - _e2)), max(length((_e16 - _e2)), length((_e23 - _e2))));
    bool loop_init_2 = true;
    while(true) {
        if (!loop_init_2) {
            int _e75 = j;
            j = (_e75 + 1);
        }
        loop_init_2 = false;
        int _e34 = j;
        if ((_e34 < 17)) {
        } else {
            break;
        }
        {
            float _e37 = sc;
            float gate = (1.0 - smoothstep(0.48, 1.1, (fp_21 * _e37)));
            float _e44 = sc;
            vec3 x_1 = (_e2 * _e44);
            float _e67 = sc;
            float _e69 = s_2;
            s_2 = (_e69 + ((gate * (cos((((cos(x_1.z) * cos(x_1.x)) + (cos(x_1.y) * cos(x_1.y))) + (cos(x_1.y) * cos(x_1.x)))) - 0.6556965)) / _e67));
            float _e72 = sc;
            sc = (_e72 * 2.0);
        }
    }
    float _e77 = s_2;
    return _e77;
}

KpSurface kpBrickOriginalSurface(vec3 pLocalM_2, float seed_1, int variant_2, float variation_1, float physicalFootprintM) {
    vec3 q_11 = vec3(0.0);
    vec3 base = vec3(0.0);
    float _e7 = br_h11_((seed_1 + 1.2));
    float _e10 = br_h11_((seed_1 + 2.7));
    float _e13 = br_h11_((seed_1 + 4.9));
    float _e16 = br_h11_((seed_1 + 8.3));
    vec3 _e20 = br_variant((pLocalM_2 / vec3(0.115384616)), variant_2);
    q_11 = _e20;
    float ang = (((_e7 - 0.5) * 2.2) * variation_1);
    float ca = cos(ang);
    float sa = sin(ang);
    vec3 _e29 = q_11;
    vec2 oldXZ = _e29.xz;
    q_11.x = ((ca * oldXZ.x) + (sa * oldXZ.y));
    q_11.z = ((-(sa) * oldXZ.x) + (ca * oldXZ.y));
    vec3 _e58 = q_11;
    q_11 = (_e58 + (variation_1 * vec3(((_e10 - 0.5) * 18.0), ((_e13 - 0.5) * 12.0), ((_e16 - 0.5) * 16.0))));
    vec3 _e60 = q_11;
    float _e68 = br_fbm(((_e60 * 1.15) + vec3(-2.7, 4.1, 8.3)));
    vec3 _e69 = q_11;
    float _e77 = br_fbm(((_e69 * 2.65) + vec3(7.1, -5.2, 1.7)));
    float firing = smoothstep(0.27, 0.79, ((0.66 * _e68) + (0.34 * _e77)));
    vec3 _e86 = q_11;
    float _e94 = br_fbm(((_e86 * 0.82) + vec3(12.1, 1.4, -9.7)));
    float reduction = (smoothstep(0.69, 0.88, _e94) * smoothstep(0.38, 0.82, firing));
    vec3 _e102 = q_11;
    float _e110 = br_noise3_(((_e102 * 29.7) + vec3(2.3, 9.1, -4.4)));
    vec3 _e111 = q_11;
    float _e119 = br_noise3_(((_e111 * 61.3) + vec3(-7.2, 3.7, 14.6)));
    float pore = (smoothstep(0.79, 0.92, _e110) * smoothstep(0.64, 0.84, _e119));
    vec3 _e127 = q_11;
    float _e135 = br_fbm(((_e127 * 5.1) + vec3(1.9, -3.2, 11.4)));
    float skin = smoothstep(0.36, 0.76, _e135);
    vec3 _e139 = q_11;
    float _e148 = br_microscope((_e139 * 9.5), ((max(physicalFootprintM, 0.0) / KP_BRICK_SCALE) * 9.5));
    base = mix(vec3(0.235, 0.043, 0.023), vec3(0.455, 0.105, 0.048), smoothstep(0.14, 0.76, firing));
    vec3 _e162 = base;
    base = mix(_e162, vec3(0.625, 0.205, 0.082), (smoothstep(0.58, 0.92, firing) * 0.34));
    vec3 _e173 = base;
    base = mix(_e173, vec3(0.19, 0.055, 0.038), (reduction * 0.63));
    float rough_1 = clamp((((0.9 - (0.1 * firing)) + (0.055 * reduction)) + (0.075 * pore)), 0.68, 0.985);
    float h_10 = (((((_e68 - 0.5) * 0.01) + ((skin - 0.5) * 0.004)) + (_e148 * 0.0034)) - (pore * 0.0048));
    vec3 _e215 = base;
    base = (_e215 * (0.965 + (0.07 * (skin - 0.5))));
    float _e219 = br_h11_((seed_1 + 19.7));
    vec3 _e226 = base;
    base = (_e226 * mix(1.0, (0.93 + (0.14 * _e219)), variation_1));
    vec3 _e230 = base;
    return KpSurface((h_10 * KP_BRICK_SCALE), _e230, rough_1);
}

KpWoodParams kpWoodDefaultParams() {
    KpWoodParams p_5 = KpWoodParams(0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, vec2(0.0), vec3(0.0), vec3(0.0), vec3(0.0), vec3(0.0), vec3(0.0), vec3(0.0));
    p_5.seed = 0.7598925;
    p_5.ringFrequency = 22.0;
    p_5.ringScale = 1.124012;
    p_5.ringWarp = 1.1748252;
    p_5.fiberFrequency = 8.73036;
    p_5.fineFiberFrequency = 72.0;
    p_5.poreFrequency = 280.0;
    p_5.fiberStrength = 0.34;
    p_5.colorBias = -0.01529341;
    p_5.roughness = 0.8928439;
    p_5.angleOffset = 0.7194436;
    p_5.textureScale = 1.0;
    p_5.grainContrast = 0.20902698;
    p_5.detailFineness = 1.0188769;
    p_5.microReliefM = 0.00028;
    p_5.parallaxM = 0.00105;
    p_5.macroDisplacementM = 0.00056;
    p_5.reliefScale = 0.77416193;
    p_5.reliefQuality = 3.0;
    p_5.parallaxSteps = 12.0;
    p_5.clearcoat = 0.0;
    p_5.clearcoatRoughness = 1.0;
    p_5.specularLevel = 0.13;
    p_5.distanceFadeStart = 9.0;
    p_5.distanceFadeEnd = 28.0;
    p_5.toolPhase = 0.24993351;
    p_5.crackPhase = 1.1871775;
    p_5.knotPhase = 1.4286764;
    p_5.pithOffset = vec2(0.042447302, -0.07805895);
    p_5.darkGrainColor = vec3(0.10224173, 0.064803265, 0.0409152);
    p_5.lightGrainColor = vec3(0.31398872, 0.19461784, 0.114435375);
    p_5.agedSurfaceColor = vec3(0.18782078, 0.13563333, 0.09758735);
    p_5.weatheredColor = vec3(0.23455058, 0.2158605, 0.18782078);
    p_5.freshCutColor = vec3(0.39157248, 0.26225066, 0.16202937);
    p_5.cavityColor = vec3(0.0409152, 0.027320892, 0.020288562);
    KpWoodParams _e91 = p_5;
    return _e91;
}

float kwSaturate(float value, KpWoodParams wp, float fp) {
    return clamp(value, 0.0, 1.0);
}

float kwHash31_(vec3 pIn_2, KpWoodParams wp_1, float fp_1) {
    vec3 p_6 = vec3(0.0);
    p_6 = pIn_2;
    vec3 _e4 = p_6;
    p_6 = fract(((_e4 * 0.1031) + (wp_1.seed * vec3(13.71, 47.13, 91.77))));
    vec3 _e15 = p_6;
    vec3 _e16 = p_6;
    vec3 _e23 = p_6;
    p_6 = (_e23 + vec3(dot(_e15, (_e16.yzx + vec3(33.33)))));
    float _e26 = p_6.x;
    float _e28 = p_6.y;
    float _e31 = p_6.z;
    return fract(((_e26 + _e28) * _e31));
}

float kwValueNoise(vec3 p_7, KpWoodParams wp_2, float fp_2) {
    vec3 i_1 = vec3(0.0);
    vec3 f_1 = vec3(0.0);
    i_1 = floor(p_7);
    f_1 = fract(p_7);
    vec3 _e7 = f_1;
    vec3 _e8 = f_1;
    vec3 _e12 = f_1;
    f_1 = ((_e7 * _e8) * (vec3(3.0) - (2.0 * _e12)));
    vec3 _e17 = i_1;
    float _e23 = kwHash31_((_e17 + vec3(0.0, 0.0, 0.0)), wp_2, fp_2);
    vec3 _e24 = i_1;
    float _e30 = kwHash31_((_e24 + vec3(1.0, 0.0, 0.0)), wp_2, fp_2);
    float _e32 = f_1.x;
    vec3 _e34 = i_1;
    float _e40 = kwHash31_((_e34 + vec3(0.0, 1.0, 0.0)), wp_2, fp_2);
    vec3 _e41 = i_1;
    float _e47 = kwHash31_((_e41 + vec3(1.0, 1.0, 0.0)), wp_2, fp_2);
    float _e49 = f_1.x;
    float _e52 = f_1.y;
    vec3 _e54 = i_1;
    float _e60 = kwHash31_((_e54 + vec3(0.0, 0.0, 1.0)), wp_2, fp_2);
    vec3 _e61 = i_1;
    float _e67 = kwHash31_((_e61 + vec3(1.0, 0.0, 1.0)), wp_2, fp_2);
    float _e69 = f_1.x;
    vec3 _e71 = i_1;
    float _e77 = kwHash31_((_e71 + vec3(0.0, 1.0, 1.0)), wp_2, fp_2);
    vec3 _e78 = i_1;
    float _e84 = kwHash31_((_e78 + vec3(1.0, 1.0, 1.0)), wp_2, fp_2);
    float _e86 = f_1.x;
    float _e89 = f_1.y;
    float _e92 = f_1.z;
    return mix(mix(mix(_e23, _e30, _e32), mix(_e40, _e47, _e49), _e52), mix(mix(_e60, _e67, _e69), mix(_e77, _e84, _e86), _e89), _e92);
}

float kwFbm(vec3 pIn_3, KpWoodParams wp_3, float fp_3) {
    vec3 p_8 = vec3(0.0);
    float result = 0.0;
    float amplitude = 0.5;
    mat3x3 rotation = mat3x3(vec3(0.0, 0.8, 0.6), vec3(-0.8, 0.36, -0.48), vec3(-0.6, -0.48, 0.64));
    int i_2 = 0;
    p_8 = pIn_3;
    bool loop_init_3 = true;
    while(true) {
        if (!loop_init_3) {
            int _e47 = i_2;
            i_2 = (_e47 + 1);
        }
        loop_init_3 = false;
        int _e24 = i_2;
        if ((_e24 < 5)) {
        } else {
            break;
        }
        {
            float _e27 = amplitude;
            vec3 _e28 = p_8;
            float _e29 = kwValueNoise(_e28, wp_3, fp_3);
            float _e31 = result;
            result = (_e31 + (_e27 * _e29));
            mat3x3 _e33 = rotation;
            vec3 _e34 = p_8;
            p_8 = (((_e33 * _e34) * 2.03) + vec3(7.1, 3.7, 5.9));
            float _e44 = amplitude;
            amplitude = (_e44 * 0.5);
        }
    }
    float _e49 = result;
    return _e49;
}

float kwAaSine(float coordinate, KpWoodParams wp_4, float fp_4) {
    float footprint = 0.0;
    float attenuation = 0.0;
    footprint = fp_4;
    float _e4 = footprint;
    attenuation = (1.0 - smoothstep(0.42, 1.15, _e4));
    float _e16 = attenuation;
    return (0.5 + ((0.5 * sin((KP_WOOD_TAU * coordinate))) * _e16));
}

float kwAaThinLine(float coordinate_1, float width, KpWoodParams wp_5, float fp_5) {
    float distanceToLine = 0.0;
    float footprint_1 = 0.0;
    distanceToLine = abs(sin((KP_WOOD_PI * coordinate_1)));
    footprint_1 = min(0.22, (fp_5 * 0.75));
    float _e14 = footprint_1;
    float _e18 = footprint_1;
    float _e20 = distanceToLine;
    return (1.0 - smoothstep((width + _e14), ((width + 0.085) + _e18), _e20));
}

float kwFlatAcross(vec3 g, vec3 localNormal, KpWoodParams wp_6, float fp_6) {
    return ((abs(localNormal.y) > abs(localNormal.z)) ? g.z : g.y);
}

float kwFlatDepth(vec3 g_1, vec3 localNormal_1, KpWoodParams wp_7, float fp_7) {
    return ((abs(localNormal_1.y) > abs(localNormal_1.z)) ? g_1.y : g_1.z);
}

float kwSidePhase(vec3 g_2, vec2 crossPosition, vec3 localNormal_2, float multiplier, KpWoodParams wp_8, float fp_8) {
    float _e6 = kwFlatAcross(g_2, localNormal_2, wp_8, fp_8);
    return ((_e6 * wp_8.fiberFrequency) * multiplier);
}

float kwSideAnisotropicNoise(vec3 g_3, vec2 crossPosition_1, vec3 localNormal_3, float axialFrequency, float crossFrequency, float phase, KpWoodParams wp_9, float fp_9) {
    float planarAcross = 0.0;
    float planarDepth = 0.0;
    vec3 planarCoordinate = vec3(0.0);
    float _e8 = kwFlatAcross(g_3, localNormal_3, wp_9, fp_9);
    planarAcross = _e8;
    float _e10 = kwFlatDepth(g_3, localNormal_3, wp_9, fp_9);
    planarDepth = _e10;
    float _e15 = planarAcross;
    float _e21 = planarDepth;
    planarCoordinate = vec3(((g_3.x * axialFrequency) + phase), ((_e15 * crossFrequency) + (wp_9.seed * 4.7)), ((_e21 * 0.72) + (wp_9.seed * 9.1)));
    vec3 _e30 = planarCoordinate;
    float _e31 = kwFbm(_e30, wp_9, fp_9);
    return _e31;
}

float kwSideValueNoise(vec3 g_4, vec2 crossPosition_2, vec3 localNormal_4, float axialFrequency_1, float crossFrequency_1, float phase_1, KpWoodParams wp_10, float fp_10) {
    float planarAcross_1 = 0.0;
    float planarDepth_1 = 0.0;
    vec3 planarCoordinate_1 = vec3(0.0);
    float _e8 = kwFlatAcross(g_4, localNormal_4, wp_10, fp_10);
    planarAcross_1 = _e8;
    float _e10 = kwFlatDepth(g_4, localNormal_4, wp_10, fp_10);
    planarDepth_1 = _e10;
    float _e15 = planarAcross_1;
    float _e21 = planarDepth_1;
    planarCoordinate_1 = vec3(((g_4.x * axialFrequency_1) + phase_1), ((_e15 * crossFrequency_1) + (wp_10.seed * 6.3)), ((_e21 * 0.54) + (wp_10.seed * 3.8)));
    vec3 _e30 = planarCoordinate_1;
    float _e31 = kwValueNoise(_e30, wp_10, fp_10);
    return _e31;
}

float kwRidgeFromNoise(float value_1, KpWoodParams wp_11, float fp_11) {
    return (1.0 - abs(((value_1 * 2.0) - 1.0)));
}

float kwKnotSignal(vec3 g_5, vec2 crossPosition_3, vec3 localNormal_5, KpWoodParams wp_12, float fp_12) {
    float broad = 0.0;
    float compact = 0.0;
    float _e10 = kwSideAnisotropicNoise(g_5, crossPosition_3, localNormal_5, 0.34, 1.35, (wp_12.knotPhase + 8.0), wp_12, fp_12);
    broad = _e10;
    float _e19 = kwSideValueNoise(g_5, crossPosition_3, localNormal_5, 0.72, 2.25, ((wp_12.knotPhase * 0.37) + 17.0), wp_12, fp_12);
    compact = _e19;
    float _e21 = broad;
    float _e25 = compact;
    return (smoothstep(0.71, 0.91, _e21) * smoothstep(0.58, 0.86, _e25));
}

vec4 kwWoodSignals(vec3 g_6, vec3 localNormal_6, float surfaceClass, KpWoodParams wp_13, float fp_13) {
    float crossSection = 0.0;
    float driftY = 0.0;
    float driftZ = 0.0;
    vec2 longWarp = vec2(0.0);
    vec2 crossPosition_4 = vec2(0.0);
    float theta = 0.0;
    float oval = 0.0;
    vec2 ringPosition = vec2(0.0);
    float radial = 0.0;
    float ringNoise = 0.0;
    float ringCoordinate = 0.0;
    float ringLine = 0.0;
    float ringBody = 0.0;
    float ring = 0.0;
    float broad_1 = 0.0;
    float flow = 0.0;
    float medium = 0.0;
    float knot = 0.0;
    float phaseWarp = 0.0;
    float coarseLine = 0.0;
    float coarseVein = 0.0;
    float coarseFiber = 0.0;
    float mediumLine = 0.0;
    float mediumFiber = 0.0;
    float crackGate = 0.0;
    float sideCrack = 0.0;
    float radialGate = 0.0;
    float radialCrack = 0.0;
    float cracks = 0.0;
    crossSection = step(0.72, abs(localNormal_6.x));
    float _e20 = kwFbm(vec3(((g_6.x * 0.24) + (wp_13.seed * 3.1)), 1.17, 7.93), wp_13, fp_13);
    driftY = (_e20 - 0.5);
    float _e34 = kwFbm(vec3(((g_6.x * 0.21) - (wp_13.seed * 4.7)), 9.31, 2.41), wp_13, fp_13);
    driftZ = (_e34 - 0.5);
    float _e38 = driftY;
    float _e39 = driftZ;
    longWarp = ((vec2(_e38, _e39) * wp_13.ringWarp) * 0.115);
    vec2 _e49 = longWarp;
    crossPosition_4 = ((g_6.yz + wp_13.pithOffset) + _e49);
    float _e53 = crossPosition_4.y;
    float _e55 = crossPosition_4.x;
    theta = atan(_e53, _e55);
    oval = (0.075 * sin(((wp_13.seed * 31.0) + wp_13.angleOffset)));
    vec2 _e67 = crossPosition_4;
    float _e68 = oval;
    float _e71 = oval;
    ringPosition = (_e67 * vec2((1.0 + _e68), (1.0 - _e71)));
    vec2 _e77 = ringPosition;
    radial = length(_e77);
    float _e88 = ringPosition.x;
    float _e92 = ringPosition.y;
    float _e96 = kwFbm(vec3(((g_6.x * 0.18) + (wp_13.seed * 2.4)), (_e88 * 2.2), (_e92 * 2.2)), wp_13, fp_13);
    ringNoise = _e96;
    float _e98 = radial;
    ringCoordinate = ((_e98 * wp_13.ringFrequency) * wp_13.ringScale);
    float _e104 = ringNoise;
    float _e111 = ringCoordinate;
    ringCoordinate = (_e111 + (((_e104 - 0.5) * wp_13.ringWarp) * 1.18));
    float _e113 = theta;
    float _e125 = ringCoordinate;
    ringCoordinate = (_e125 + ((sin(((_e113 * 2.0) + (wp_13.seed * 13.0))) * 0.12) * wp_13.ringWarp));
    float _e127 = theta;
    float _e139 = ringCoordinate;
    ringCoordinate = (_e139 + ((sin(((_e127 * 5.0) - (wp_13.seed * 7.0))) * 0.045) * wp_13.ringWarp));
    float _e141 = ringCoordinate;
    float _e143 = kwAaThinLine(_e141, 0.06, wp_13, fp_13);
    ringLine = _e143;
    float _e145 = ringCoordinate;
    float _e146 = ringNoise;
    float _e152 = kwAaSine((_e145 + ((_e146 - 0.5) * 0.16)), wp_13, fp_13);
    ringBody = _e152;
    float _e154 = ringBody;
    float _e157 = ringLine;
    float _e161 = kwSaturate(((_e154 * 0.62) + (_e157 * 0.38)), wp_13, fp_13);
    ring = _e161;
    vec2 _e163 = crossPosition_4;
    float _e167 = kwSideAnisotropicNoise(g_6, _e163, localNormal_6, 0.18, 1.55, wp_13.angleOffset, wp_13, fp_13);
    broad_1 = _e167;
    vec2 _e169 = crossPosition_4;
    float _e177 = kwSideAnisotropicNoise(g_6, _e169, localNormal_6, 0.42, 3.35, ((wp_13.seed * 11.0) + 2.4), wp_13, fp_13);
    flow = _e177;
    vec2 _e179 = crossPosition_4;
    float _e187 = kwSideAnisotropicNoise(g_6, _e179, localNormal_6, 0.88, 7.2, ((wp_13.seed * 17.0) + 4.7), wp_13, fp_13);
    medium = _e187;
    vec2 _e189 = crossPosition_4;
    float _e190 = kwKnotSignal(g_6, _e189, localNormal_6, wp_13, fp_13);
    knot = _e190;
    float _e192 = broad_1;
    float _e197 = flow;
    phaseWarp = (((_e192 - 0.5) * 5.4) + ((_e197 - 0.5) * 2.9));
    float _e207 = theta;
    float _e218 = phaseWarp;
    phaseWarp = (_e218 + (sin((((g_6.x * 0.58) + (_e207 * 1.7)) + (wp_13.seed * 19.0))) * 0.5));
    float _e220 = knot;
    float _e232 = phaseWarp;
    phaseWarp = (_e232 + (_e220 * (4.0 + (1.6 * sin(((g_6.x * 1.05) + wp_13.knotPhase))))));
    vec2 _e234 = crossPosition_4;
    float _e236 = kwSidePhase(g_6, _e234, localNormal_6, 0.58, wp_13, fp_13);
    float _e237 = phaseWarp;
    float _e244 = kwAaThinLine(((_e236 + _e237) + (wp_13.angleOffset / KP_WOOD_TAU)), 0.065, wp_13, fp_13);
    coarseLine = _e244;
    float _e246 = flow;
    float _e247 = kwRidgeFromNoise(_e246, wp_13, fp_13);
    coarseVein = _e247;
    float _e249 = broad_1;
    float _e252 = coarseVein;
    float _e256 = coarseLine;
    float _e260 = kwSaturate((((_e249 * 0.47) + (_e252 * 0.31)) + (_e256 * 0.22)), wp_13, fp_13);
    coarseFiber = _e260;
    vec2 _e262 = crossPosition_4;
    float _e264 = kwSidePhase(g_6, _e262, localNormal_6, 1.85, wp_13, fp_13);
    float _e265 = phaseWarp;
    float _e274 = kwAaThinLine(((_e264 + (_e265 * 1.72)) + (wp_13.seed * 7.0)), 0.04, wp_13, fp_13);
    mediumLine = _e274;
    float _e276 = medium;
    float _e279 = flow;
    float _e282 = medium;
    float _e286 = kwRidgeFromNoise(((_e279 * 0.62) + (_e282 * 0.38)), wp_13, fp_13);
    float _e290 = mediumLine;
    float _e294 = kwSaturate((((_e276 * 0.47) + (_e286 * 0.37)) + (_e290 * 0.16)), wp_13, fp_13);
    mediumFiber = _e294;
    vec2 _e296 = crossPosition_4;
    float _e302 = kwSideValueNoise(g_6, _e296, localNormal_6, 0.32, 3.1, (wp_13.crackPhase + 13.0), wp_13, fp_13);
    crackGate = smoothstep(0.79, 0.94, _e302);
    vec2 _e307 = crossPosition_4;
    float _e309 = kwSidePhase(g_6, _e307, localNormal_6, 0.17, wp_13, fp_13);
    float _e310 = phaseWarp;
    float _e319 = kwAaThinLine(((_e309 + (_e310 * 0.16)) + (wp_13.crackPhase / KP_WOOD_TAU)), 0.014, wp_13, fp_13);
    float _e320 = crackGate;
    sideCrack = (_e319 * _e320);
    float _e323 = radial;
    float _e333 = kwValueNoise(vec3((_e323 * 1.9), (g_6.x * 0.27), (wp_13.seed * 9.0)), wp_13, fp_13);
    radialGate = smoothstep(0.72, 0.93, _e333);
    float _e338 = theta;
    float _e348 = radial;
    float _e353 = radialGate;
    radialCrack = ((pow(max(0.0, sin(((_e338 * 7.0) + wp_13.crackPhase))), 26.0) * smoothstep(0.08, 0.27, _e348)) * _e353);
    float _e356 = sideCrack;
    float _e357 = sideCrack;
    float _e360 = radialCrack;
    float _e362 = crossSection;
    cracks = mix(_e356, max((_e357 * 0.12), _e360), _e362);
    float _e365 = ring;
    float _e366 = coarseFiber;
    float _e367 = mediumFiber;
    float _e368 = cracks;
    return vec4(_e365, _e366, _e367, _e368);
}

vec4 kwSecondarySignals(vec3 g_7, vec3 localNormal_7, KpWoodParams wp_14, float fp_14) {
    vec2 crossPosition_5 = vec2(0.0);
    float broadWarp = 0.0;
    float fineNoise = 0.0;
    float fineLine = 0.0;
    float fineFiber = 0.0;
    float poreNoise = 0.0;
    float poreGate = 0.0;
    float pores = 0.0;
    float toolWave = 0.0;
    float toolMask = 0.0;
    float tool = 0.0;
    float knot_1 = 0.0;
    crossPosition_5 = (g_7.yz + wp_14.pithOffset);
    vec2 _e8 = crossPosition_5;
    float _e16 = kwSideAnisotropicNoise(g_7, _e8, localNormal_7, 0.46, 4.4, ((wp_14.seed * 21.0) + 1.7), wp_14, fp_14);
    broadWarp = _e16;
    vec2 _e18 = crossPosition_5;
    float _e30 = kwSideAnisotropicNoise(g_7, _e18, localNormal_7, 1.55, (18.0 * max(wp_14.detailFineness, 0.45)), ((wp_14.seed * 29.0) + 5.3), wp_14, fp_14);
    fineNoise = _e30;
    vec2 _e32 = crossPosition_5;
    float _e38 = kwSidePhase(g_7, _e32, localNormal_7, (4.6 * max(wp_14.detailFineness, 0.45)), wp_14, fp_14);
    float _e39 = broadWarp;
    float _e50 = kwAaThinLine(((_e38 + ((_e39 - 0.5) * 8.5)) + (wp_14.seed * 19.0)), 0.026, wp_14, fp_14);
    fineLine = _e50;
    float _e52 = fineNoise;
    float _e55 = fineNoise;
    float _e56 = kwRidgeFromNoise(_e55, wp_14, fp_14);
    float _e60 = fineLine;
    float _e64 = kwSaturate((((_e52 * 0.53) + (_e56 * 0.3)) + (_e60 * 0.17)), wp_14, fp_14);
    fineFiber = _e64;
    vec2 _e66 = crossPosition_5;
    float _e82 = kwSideValueNoise(g_7, _e66, localNormal_7, (4.2 * max(wp_14.detailFineness, 0.45)), (38.0 * max(wp_14.detailFineness, 0.45)), ((wp_14.seed * 23.0) + 11.0), wp_14, fp_14);
    poreNoise = _e82;
    vec2 _e84 = crossPosition_5;
    float _e92 = kwSideValueNoise(g_7, _e84, localNormal_7, 0.85, 7.0, ((wp_14.seed * 31.0) + 2.0), wp_14, fp_14);
    poreGate = _e92;
    float _e94 = poreNoise;
    float _e98 = poreGate;
    pores = (smoothstep(0.865, 0.982, _e94) * smoothstep(0.52, 0.82, _e98));
    float _e107 = kwFlatAcross(g_7, localNormal_7, wp_14, fp_14);
    float _e115 = kwAaSine((((g_7.x * 1.45) + (_e107 * 0.22)) + (wp_14.toolPhase / KP_WOOD_TAU)), wp_14, fp_14);
    toolWave = _e115;
    vec2 _e117 = crossPosition_5;
    float _e123 = kwSideValueNoise(g_7, _e117, localNormal_7, 0.54, 2.3, (wp_14.toolPhase + 5.0), wp_14, fp_14);
    toolMask = smoothstep(0.79, 0.96, _e123);
    float _e128 = toolWave;
    float _e129 = toolMask;
    tool = (_e128 * _e129);
    vec2 _e132 = crossPosition_5;
    float _e133 = kwKnotSignal(g_7, _e132, localNormal_7, wp_14, fp_14);
    knot_1 = _e133;
    float _e135 = fineFiber;
    float _e136 = pores;
    float _e137 = tool;
    float _e138 = knot_1;
    return vec4(_e135, _e136, _e137, _e138);
}

float kwMacroSignal(vec3 g_8, KpWoodParams wp_15, float fp_15) {
    float _e13 = kwFbm(((g_8 * vec3(0.12, 0.7, 0.7)) + vec3((wp_15.seed * 5.0))), wp_15, fp_15);
    return _e13;
}

float kwCoarseRelief(vec3 g_9, vec3 localNormal_8, float surfaceClass_1, KpWoodParams wp_16, float fp_16) {
    float crossSection_1 = 0.0;
    vec2 crossPosition_6 = vec2(0.0);
    float theta_1 = 0.0;
    float radial_1 = 0.0;
    float broadWarp_1 = 0.0;
    float sideBand = 0.0;
    float ringBand = 0.0;
    float sparseGate = 0.0;
    float sideCrack_1 = 0.0;
    float radialCrack_1 = 0.0;
    float sideHeight = 0.0;
    float endHeight = 0.0;
    crossSection_1 = step(0.72, abs(localNormal_8.x));
    crossPosition_6 = (g_9.yz + wp_16.pithOffset);
    float _e15 = crossPosition_6.y;
    float _e17 = crossPosition_6.x;
    theta_1 = atan(_e15, _e17);
    vec2 _e20 = crossPosition_6;
    radial_1 = length(_e20);
    vec2 _e26 = crossPosition_6;
    float _e35 = kwValueNoise((vec3((g_9.x * 0.18), (_e26 * 2.4)) + vec3((wp_16.seed * 3.1))), wp_16, fp_16);
    broadWarp_1 = _e35;
    vec2 _e37 = crossPosition_6;
    float _e39 = kwSidePhase(g_9, _e37, localNormal_8, 0.62, wp_16, fp_16);
    float _e40 = broadWarp_1;
    float _e50 = kwAaSine(((_e39 + ((_e40 - 0.5) * 3.2)) + (wp_16.angleOffset / KP_WOOD_TAU)), wp_16, fp_16);
    sideBand = _e50;
    float _e52 = radial_1;
    float _e57 = broadWarp_1;
    float _e65 = kwAaSine((((_e52 * wp_16.ringFrequency) * wp_16.ringScale) + (((_e57 - 0.5) * wp_16.ringWarp) * 0.55)), wp_16, fp_16);
    ringBand = _e65;
    vec2 _e72 = crossPosition_6;
    float _e76 = kwValueNoise(vec3(((g_9.x * 0.31) + wp_16.crackPhase), (_e72 * 4.1)), wp_16, fp_16);
    sparseGate = smoothstep(0.84, 0.965, _e76);
    vec2 _e81 = crossPosition_6;
    float _e83 = kwSidePhase(g_9, _e81, localNormal_8, 0.2, wp_16, fp_16);
    float _e84 = broadWarp_1;
    float _e95 = kwAaThinLine(((_e83 + ((_e84 - 0.5) * 0.22)) + (wp_16.crackPhase / KP_WOOD_TAU)), 0.015, wp_16, fp_16);
    float _e96 = sparseGate;
    sideCrack_1 = (_e95 * _e96);
    float _e99 = theta_1;
    float _e109 = radial_1;
    float _e114 = sparseGate;
    radialCrack_1 = ((pow(max(0.0, sin(((_e99 * 7.0) + wp_16.crackPhase))), 24.0) * smoothstep(0.08, 0.28, _e109)) * _e114);
    float _e117 = sideBand;
    float _e122 = sideCrack_1;
    sideHeight = (((_e117 - 0.5) * 0.36) - (_e122 * 0.6));
    float _e127 = ringBand;
    float _e132 = radialCrack_1;
    endHeight = (((_e127 - 0.5) * 0.34) - (_e132 * 0.68));
    float _e137 = sideHeight;
    float _e138 = endHeight;
    float _e139 = crossSection_1;
    float _e143 = kwSaturate((0.5 + mix(_e137, _e138, _e139)), wp_16, fp_16);
    return _e143;
}

float kwVertexHash(vec3 pIn_4, KpWoodParams wp_17, float fp_17) {
    vec3 p_9 = vec3(0.0);
    p_9 = pIn_4;
    vec3 _e4 = p_9;
    p_9 = fract(((_e4 * 0.1031) + (wp_17.seed * vec3(17.17, 41.73, 83.11))));
    vec3 _e15 = p_9;
    vec3 _e16 = p_9;
    vec3 _e23 = p_9;
    p_9 = (_e23 + vec3(dot(_e15, (_e16.yzx + vec3(31.32)))));
    float _e26 = p_9.x;
    float _e28 = p_9.y;
    float _e31 = p_9.z;
    return fract(((_e26 + _e28) * _e31));
}

float kwVertexNoise(vec3 p_10, KpWoodParams wp_18, float fp_18) {
    vec3 i_3 = vec3(0.0);
    vec3 f_2 = vec3(0.0);
    i_3 = floor(p_10);
    f_2 = fract(p_10);
    vec3 _e7 = f_2;
    vec3 _e8 = f_2;
    vec3 _e12 = f_2;
    f_2 = ((_e7 * _e8) * (vec3(3.0) - (2.0 * _e12)));
    vec3 _e17 = i_3;
    float _e23 = kwVertexHash((_e17 + vec3(0.0, 0.0, 0.0)), wp_18, fp_18);
    vec3 _e24 = i_3;
    float _e30 = kwVertexHash((_e24 + vec3(1.0, 0.0, 0.0)), wp_18, fp_18);
    float _e32 = f_2.x;
    vec3 _e34 = i_3;
    float _e40 = kwVertexHash((_e34 + vec3(0.0, 1.0, 0.0)), wp_18, fp_18);
    vec3 _e41 = i_3;
    float _e47 = kwVertexHash((_e41 + vec3(1.0, 1.0, 0.0)), wp_18, fp_18);
    float _e49 = f_2.x;
    float _e52 = f_2.y;
    vec3 _e54 = i_3;
    float _e60 = kwVertexHash((_e54 + vec3(0.0, 0.0, 1.0)), wp_18, fp_18);
    vec3 _e61 = i_3;
    float _e67 = kwVertexHash((_e61 + vec3(1.0, 0.0, 1.0)), wp_18, fp_18);
    float _e69 = f_2.x;
    vec3 _e71 = i_3;
    float _e77 = kwVertexHash((_e71 + vec3(0.0, 1.0, 1.0)), wp_18, fp_18);
    vec3 _e78 = i_3;
    float _e84 = kwVertexHash((_e78 + vec3(1.0, 1.0, 1.0)), wp_18, fp_18);
    float _e86 = f_2.x;
    float _e89 = f_2.y;
    float _e92 = f_2.z;
    return mix(mix(mix(_e23, _e30, _e32), mix(_e40, _e47, _e49), _e52), mix(mix(_e60, _e67, _e69), mix(_e77, _e84, _e86), _e89), _e92);
}

float kwMacroField(vec3 pIn_5, KpWoodParams wp_19, float fp_19) {
    vec3 p_11 = vec3(0.0);
    float result_1 = 0.0;
    float amplitude_1 = 0.58;
    int i_4 = 0;
    p_11 = pIn_5;
    bool loop_init_4 = true;
    while(true) {
        if (!loop_init_4) {
            int _e31 = i_4;
            i_4 = (_e31 + 1);
        }
        loop_init_4 = false;
        int _e10 = i_4;
        if ((_e10 < 3)) {
        } else {
            break;
        }
        {
            float _e13 = amplitude_1;
            vec3 _e14 = p_11;
            float _e15 = kwVertexNoise(_e14, wp_19, fp_19);
            float _e17 = result_1;
            result_1 = (_e17 + (_e13 * _e15));
            vec3 _e19 = p_11;
            p_11 = ((_e19 * 2.07) + vec3(5.2, 9.1, 3.7));
            float _e28 = amplitude_1;
            amplitude_1 = (_e28 * 0.45);
        }
    }
    float _e33 = result_1;
    return (_e33 / 0.94);
}

float kpWoodMacroDisplacement(vec3 pSourceM, float surfaceClass_2, KpWoodParams wp_20) {
    float broad_2 = 0.0;
    float longWave = 0.0;
    float macroHeight = 0.0;
    float classWeight = 1.0;
    vec3 grain = (pSourceM * max(wp_20.textureScale, 0.001));
    float _e18 = kwMacroField(((grain * vec3(0.28, 1.15, 1.15)) + vec3((wp_20.seed * 7.0))), wp_20, 0.0);
    broad_2 = _e18;
    float _e27 = broad_2;
    longWave = (0.5 + (0.5 * sin((((grain.x * 0.82) + (wp_20.seed * 29.0)) + (_e27 * 1.55)))));
    float _e37 = broad_2;
    float _e42 = longWave;
    macroHeight = (((_e37 - 0.5) * 0.78) + ((_e42 - 0.5) * 0.22));
    if (((surfaceClass_2 > 0.5) && (surfaceClass_2 < 2.5))) {
        classWeight = 0.0;
    } else {
        if (((surfaceClass_2 > 2.5) && (surfaceClass_2 < 3.5))) {
            classWeight = 1.08;
        }
    }
    float _e63 = macroHeight;
    float _e68 = classWeight;
    return (((_e63 * wp_20.macroDisplacementM) * wp_20.reliefScale) * _e68);
}

float kpWoodCoordinateFootprint(float physicalFootprintM_1, KpWoodParams wp_21) {
    return ((max(physicalFootprintM_1, 0.0) * max(wp_21.textureScale, 0.001)) * max((wp_21.ringFrequency * wp_21.ringScale), ((wp_21.fiberFrequency * 4.6) * max(wp_21.detailFineness, 0.45))));
}

KpWoodSample kpWoodOriginalSample(vec3 pSourceM_1, vec3 normalIn, float surfaceClass_3, KpWoodParams wp_22, float physicalFootprintM_2, float cameraDistanceM) {
    vec3 baseColor = vec3(0.0);
    float heightMeters = 0.0;
    float roughness = 0.0;
    float cavity = 1.0;
    vec4 signals = vec4(0.0);
    vec4 secondary = vec4(0.0);
    float ring_1 = 0.0;
    float coarseFiber_1 = 0.0;
    float mediumFiber_1 = 0.0;
    float cracks_1 = 0.0;
    float fineFiber_1 = 0.0;
    float pores_1 = 0.0;
    float tool_1 = 0.0;
    float knot_2 = 0.0;
    float macroTone = 0.0;
    float crossSection_2 = 0.0;
    vec2 crossPosition_7 = vec2(0.0);
    float radial_2 = 0.0;
    float endRay = 0.0;
    float longitudinalTone = 0.0;
    float endTone = 0.0;
    float grainTone = 0.0;
    float grainMix = 0.0;
    vec3 grainColor = vec3(0.0);
    float distanceToCamera = 0.0;
    float detailFade = 0.0;
    float sideMicro = 0.0;
    float endMicro = 0.0;
    float microSignal = 0.0;
    vec3 localNormal_9 = normalize(normalIn);
    vec3 g_11 = (pSourceM_1 * max(wp_22.textureScale, 0.001));
    float _e11 = kpWoodCoordinateFootprint(physicalFootprintM_2, wp_22);
    roughness = wp_22.roughness;
    vec4 _e21 = kwWoodSignals(g_11, localNormal_9, surfaceClass_3, wp_22, _e11);
    signals = _e21;
    vec4 _e23 = kwSecondarySignals(g_11, localNormal_9, wp_22, _e11);
    secondary = _e23;
    float _e26 = signals.x;
    ring_1 = _e26;
    float _e29 = signals.y;
    coarseFiber_1 = _e29;
    float _e32 = signals.z;
    mediumFiber_1 = _e32;
    float _e35 = signals.w;
    cracks_1 = _e35;
    float _e38 = secondary.x;
    fineFiber_1 = _e38;
    float _e41 = secondary.y;
    pores_1 = _e41;
    float _e44 = secondary.z;
    tool_1 = _e44;
    float _e47 = secondary.w;
    knot_2 = _e47;
    float _e49 = kwMacroSignal(g_11, wp_22, _e11);
    macroTone = _e49;
    crossSection_2 = step(0.72, abs(localNormal_9.x));
    crossPosition_7 = (g_11.yz + wp_22.pithOffset);
    vec2 _e60 = crossPosition_7;
    radial_2 = length(_e60);
    float _e64 = crossPosition_7.y;
    float _e66 = crossPosition_7.x;
    float _e72 = radial_2;
    float _e80 = kwAaSine(((((atan(_e64, _e66) * 3.0) / KP_WOOD_TAU) + (_e72 * 2.0)) + (wp_22.seed * 7.0)), wp_22, _e11);
    endRay = _e80;
    float _e82 = coarseFiber_1;
    float _e87 = mediumFiber_1;
    float _e93 = macroTone;
    float _e99 = fineFiber_1;
    float _e105 = knot_2;
    float _e109 = cracks_1;
    float _e113 = pores_1;
    longitudinalTone = ((((((((_e82 - 0.5) * 1.02) + ((_e87 - 0.5) * 0.43)) + ((_e93 - 0.5) * 0.56)) + ((_e99 - 0.5) * 0.11)) + (_e105 * 0.26)) - (_e109 * 0.7)) - (_e113 * 0.08));
    float _e118 = ring_1;
    float _e123 = endRay;
    float _e129 = macroTone;
    float _e135 = cracks_1;
    float _e139 = pores_1;
    endTone = ((((((_e118 - 0.5) * 1.08) + ((_e123 - 0.5) * 0.19)) + ((_e129 - 0.5) * 0.38)) - (_e135 * 0.72)) - (_e139 * 0.05));
    float _e144 = longitudinalTone;
    float _e145 = endTone;
    float _e146 = crossSection_2;
    grainTone = (mix(_e144, _e145, _e146) + wp_22.colorBias);
    float _e151 = grainTone;
    float _e158 = kwSaturate((0.5 + ((_e151 * wp_22.grainContrast) * 2.72)), wp_22, _e11);
    grainMix = _e158;
    float _e162 = grainMix;
    grainColor = mix(wp_22.lightGrainColor, wp_22.darkGrainColor, _e162);
    vec3 _e166 = grainColor;
    baseColor = mix(wp_22.agedSurfaceColor, _e166, 0.78);
    if (((surfaceClass_3 > 0.5) && (surfaceClass_3 < 1.5))) {
        vec3 _e174 = baseColor;
        baseColor = mix(_e174, wp_22.freshCutColor, 0.2);
    } else {
        if (((surfaceClass_3 > 1.5) && (surfaceClass_3 < 2.5))) {
            vec3 _e183 = baseColor;
            baseColor = mix(_e183, wp_22.freshCutColor, 0.27);
        } else {
            if (((surfaceClass_3 > 2.5) && (surfaceClass_3 < 3.5))) {
                vec3 _e192 = baseColor;
                baseColor = mix(_e192, wp_22.weatheredColor, 0.53);
                float _e196 = roughness;
                roughness = min(0.98, (_e196 + 0.045));
            }
        }
    }
    float _e201 = macroTone;
    vec3 _e206 = baseColor;
    baseColor = (_e206 * (0.905 + (_e201 * 0.19)));
    vec3 _e208 = baseColor;
    float _e210 = cracks_1;
    float _e213 = pores_1;
    float _e217 = knot_2;
    baseColor = mix(_e208, wp_22.cavityColor, (((_e210 * 0.4) + (_e213 * 0.065)) + (_e217 * 0.025)));
    distanceToCamera = cameraDistanceM;
    float _e225 = distanceToCamera;
    detailFade = (1.0 - smoothstep(wp_22.distanceFadeStart, wp_22.distanceFadeEnd, _e225));
    float _e230 = coarseFiber_1;
    float _e235 = mediumFiber_1;
    float _e241 = fineFiber_1;
    float _e247 = pores_1;
    float _e251 = cracks_1;
    float _e255 = tool_1;
    float _e259 = knot_2;
    sideMicro = ((((((((_e230 - 0.5) * 0.32) + ((_e235 - 0.5) * 0.24)) + ((_e241 - 0.5) * 0.12)) - (_e247 * 0.3)) - (_e251 * 0.94)) - (_e255 * 0.13)) + (_e259 * 0.09));
    float _e264 = ring_1;
    float _e269 = fineFiber_1;
    float _e275 = pores_1;
    float _e279 = cracks_1;
    endMicro = (((((_e264 - 0.5) * 0.34) + ((_e269 - 0.5) * 0.05)) - (_e275 * 0.22)) - (_e279 * 1.0));
    float _e284 = sideMicro;
    float _e285 = endMicro;
    float _e286 = crossSection_2;
    microSignal = mix(_e284, _e285, _e286);
    float _e289 = microSignal;
    float _e294 = detailFade;
    heightMeters = (((_e289 * wp_22.microReliefM) * wp_22.reliefScale) * _e294);
    float _e296 = roughness;
    float _e297 = pores_1;
    float _e301 = cracks_1;
    float _e305 = macroTone;
    roughness = clamp(((((_e296 + (_e297 * 0.045)) + (_e301 * 0.075)) + ((0.5 - _e305) * 0.022)) - (wp_22.clearcoat * 0.085)), 0.18, 0.98);
    float _e318 = cracks_1;
    float _e323 = pores_1;
    float _e327 = ring_1;
    float _e328 = crossSection_2;
    cavity = clamp((((1.0 - (_e318 * 0.34)) - (_e323 * 0.06)) - ((_e327 * _e328) * 0.035)), 0.6, 1.0);
    float _e336 = heightMeters;
    vec3 _e337 = baseColor;
    float _e338 = roughness;
    float _e340 = cavity;
    float _e344 = kpWoodMacroDisplacement(pSourceM_1, surfaceClass_3, wp_22);
    float _e345 = kwCoarseRelief(g_11, localNormal_9, surfaceClass_3, wp_22, _e11);
    return KpWoodSample(KpSurface(_e336, _e337, _e338), _e340, wp_22.clearcoat, wp_22.clearcoatRoughness, wp_22.specularLevel, _e344, _e345);
}

vec3 st_hash33_(vec3 pIn_6) {
    vec3 p_12 = vec3(0.0);
    p_12 = fract((pIn_6 * vec3(0.1031, 0.103, 0.0973)));
    vec3 _e8 = p_12;
    vec3 _e9 = p_12;
    vec3 _e16 = p_12;
    p_12 = (_e16 + vec3(dot(_e8, (_e9.yxz + vec3(33.33)))));
    vec3 _e18 = p_12;
    vec3 _e20 = p_12;
    vec3 _e23 = p_12;
    return fract(((_e18.xxy + _e20.yxx) * _e23.zyx));
}

float st_valueNoise3_(vec3 p_13) {
    vec3 f_3 = vec3(0.0);
    vec3 i_7 = floor(p_13);
    f_3 = fract(p_13);
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

float st_sf(vec3 p_14) {
    float _e1 = st_valueNoise3_(p_14);
    float _e9 = st_valueNoise3_(((p_14 * 2.07) + vec3(13.7)));
    float _e18 = st_valueNoise3_(((p_14 * 4.11) + vec3(27.2)));
    return (((_e1 * 0.57) + (_e9 * 0.28)) + (_e18 * 0.15));
}

vec3 st_warp(vec3 p_15, vec3 seed_3) {
    float _e5 = st_sf(((p_15 * 0.8) + seed_3));
    float _e12 = st_sf((((p_15 * 0.8) + seed_3) + vec3(7.0)));
    float _e19 = st_sf((((p_15 * 0.8) + seed_3) + vec3(19.0)));
    return (p_15 + (vec3(_e5, _e12, _e19) * 0.25));
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
    float h_11 = (((((_e14 - 0.5) * 0.018) + ((_e21 - 0.5) * 0.007)) + (vein * 0.004)) - (pits * 0.025));
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
    return KpSurface((h_11 * KP_STONE_SCALE_M), _e157, clamp(mix((rough_2 + roughBias), 0.17, wet_3), 0.12, 0.98));
}

KpSurface kpStoneSurface(vec3 pLocalM_4, float age, float wet, float repair, float physicalFootprintM_5) {
    float a_8 = clamp(age, 0.0, 1.0);
    float r_1 = clamp(repair, 0.0, 1.0);
    float m_1 = clamp(wet, 0.0, 1.0);
    float retainedAge = (a_8 * (1.0 - r_1));
    float sourceWet_1 = clamp(((m_1 * (0.45 + (0.55 * retainedAge))) * (1.0 - (0.45 * r_1))), 0.0, 1.0);
    float roughBias_1 = (((0.07 * retainedAge) + 0.00375) - (0.06 * r_1));
    KpSurface _e37 = kpStoneOriginalSurface(pLocalM_4, sourceWet_1, roughBias_1, physicalFootprintM_5);
    return _e37;
}

float mt_kh(vec3 pIn_7) {
    vec3 p_16 = vec3(0.0);
    p_16 = fract((pIn_7 * 0.1031));
    vec3 _e5 = p_16;
    vec3 _e6 = p_16;
    vec3 _e13 = p_16;
    p_16 = (_e13 + vec3(dot(_e5, (_e6.yzx + vec3(33.33)))));
    float _e16 = p_16.x;
    float _e18 = p_16.y;
    float _e21 = p_16.z;
    return fract(((_e16 + _e18) * _e21));
}

float mt_kn(vec3 p_17) {
    vec3 f_4 = vec3(0.0);
    vec3 i_8 = floor(p_17);
    f_4 = fract(p_17);
    vec3 _e4 = f_4;
    vec3 _e5 = f_4;
    vec3 _e9 = f_4;
    f_4 = ((_e4 * _e5) * (vec3(3.0) - (2.0 * _e9)));
    float _e14 = mt_kh(i_8);
    float _e20 = mt_kh((i_8 + vec3(1.0, 0.0, 0.0)));
    float _e22 = f_4.x;
    float _e29 = mt_kh((i_8 + vec3(0.0, 1.0, 0.0)));
    float _e35 = mt_kh((i_8 + vec3(1.0, 1.0, 0.0)));
    float _e37 = f_4.x;
    float _e40 = f_4.y;
    float _e47 = mt_kh((i_8 + vec3(0.0, 0.0, 1.0)));
    float _e53 = mt_kh((i_8 + vec3(1.0, 0.0, 1.0)));
    float _e55 = f_4.x;
    float _e62 = mt_kh((i_8 + vec3(0.0, 1.0, 1.0)));
    float _e68 = mt_kh((i_8 + vec3(1.0, 1.0, 1.0)));
    float _e70 = f_4.x;
    float _e73 = f_4.y;
    float _e76 = f_4.z;
    return mix(mix(mix(_e14, _e20, _e22), mix(_e29, _e35, _e37), _e40), mix(mix(_e47, _e53, _e55), mix(_e62, _e68, _e70), _e73), _e76);
}

float mt_kfb(vec3 p_18) {
    float _e1 = mt_kn(p_18);
    float _e6 = mt_kn((p_18 * 2.13));
    float _e12 = mt_kn((p_18 * 4.17));
    return (((0.57 * _e1) + (0.28 * _e6)) + (0.15 * _e12));
}

float kpMetalCorrosion(vec3 p_19, float age_1, float wet_1, float repair_1) {
    float contact = ((1.0 - smoothstep(0.02, 0.07, abs((p_19.y - 1.07)))) * 0.7);
    float joint = ((1.0 - smoothstep(0.06, 0.18, p_19.y)) + ((1.0 - smoothstep(0.01, 0.08, abs((p_19.y - 0.98)))) * 0.28));
    return clamp((((age_1 * (1.0 - repair_1)) * ((wet_1 * 0.7) + (joint * 0.55))) * (1.0 - contact)), 0.0, 1.0);
}

KpSurface kpMetalSurface(vec3 p_20, float age_2, float wet_2, float repair_2, float footprintM) {
    vec3 color = vec3(0.0);
    vec3 kq = (p_20 + vec3(19.0));
    float _e10 = mt_kfb((kq * 3.1));
    float contact_1 = ((1.0 - smoothstep(0.02, 0.07, abs((p_20.y - 1.07)))) * 0.7);
    float joint_1 = ((1.0 - smoothstep(0.06, 0.18, p_20.y)) + ((1.0 - smoothstep(0.01, 0.08, abs((p_20.y - 0.98)))) * 0.28));
    float retained = (age_2 * (1.0 - repair_2));
    float _e43 = kpMetalCorrosion(p_20, age_2, wet_2, repair_2);
    color = (vec3(0.17, 0.235, 0.2) * (0.94 + (0.09 * _e10)));
    vec3 _e54 = color;
    color = mix(_e54, vec3(0.21, 0.082, 0.025), (_e43 * 0.8));
    vec3 _e66 = color;
    color = (_e66 * (1.0 - (wet_2 * 0.18)));
    float _e70 = mt_kn((kq * 9.0));
    float rough_3 = clamp(((((0.53 + ((_e70 - 0.5) * 0.12)) + (_e43 * 0.22)) - (contact_1 * 0.22)) - (wet_2 * 0.12)), 0.12, 0.97);
    float _e91 = mt_kn((kq * 65.0));
    float originalHeight = (((_e91 - 0.5) * 0.00025) * (1.0 - smoothstep(0.4, 1.6, (footprintM * 65.0))));
    vec3 _e107 = color;
    return KpSurface((originalHeight - (_e43 * 0.0008)), _e107, rough_3);
}

KpSurface kpConcreteStation(vec3 p_21, float age_3, float wetness, float repair_3, float footprint_2) {
    float fine = 0.5;
    vec3 color_1 = vec3(0.0);
    vec3 q_14 = (p_21 + vec3(19.0, 13.49, 7.03));
    float _e12 = mt_kn((q_14 * 0.63));
    float _e15 = mt_kn((q_14 * 3.7));
    if ((footprint_2 < 0.021)) {
        float _e22 = mt_kn((q_14 * 127.0));
        fine = mix(_e22, 0.5, smoothstep(0.003, 0.021, footprint_2));
    }
    float moisturePatch = (smoothstep(0.43, 0.72, _e12) * smoothstep(0.28, 0.62, _e15));
    float damp = clamp(((moisturePatch * (0.42 + (_e12 * 0.58))) * (1.0 - (repair_3 * 0.85))), 0.0, 1.0);
    float wet_4 = (wetness * clamp(((damp + (smoothstep(0.6, 0.81, _e12) * 0.38)) + 0.22), 0.0, 1.0));
    vec3 base_1 = vec3(0.468, 0.451, 0.381);
    float gray = (((moisturePatch * age_3) * 0.18) * (1.0 - repair_3));
    color_1 = mix(base_1, ((base_1 * 0.69) + vec3(0.027, 0.03, 0.025)), gray);
    float _e81 = mt_kn((q_14 * 23.0));
    float chip = ((smoothstep(0.64, 0.81, _e81) * smoothstep(0.46, 0.76, _e15)) * age_3);
    vec3 _e90 = color_1;
    color_1 = mix(_e90, (base_1 * vec3(0.59, 0.56, 0.49)), (chip * 0.42));
    vec3 _e99 = color_1;
    color_1 = mix(_e99, (base_1 * vec3(0.5, 0.56, 0.5)), ((damp * age_3) * 0.72));
    vec3 _e109 = color_1;
    color_1 = mix(_e109, mix(base_1, vec3(0.8, 0.78, 0.69), 0.17), (repair_3 * 0.85));
    vec3 _e123 = color_1;
    color_1 = (_e123 * (1.0 - (wet_4 * 0.13)));
    float _e125 = fine;
    float height = (((_e125 - 0.5) * 0.00042) - (chip * 0.0007));
    float _e133 = fine;
    float rough_4 = clamp(((0.87 + ((_e133 - 0.5) * 0.07)) - (wet_4 * 0.23)), 0.23, 1.0);
    vec3 _e146 = color_1;
    return KpSurface(height, _e146, rough_4);
}

vec3 pl_rotate(vec3 v_3, vec3 axis_1, float a_1) {
    float c_2 = cos(a_1);
    float s_3 = sin(a_1);
    return (((v_3 * c_2) + (cross(axis_1, v_3) * s_3)) + ((axis_1 * dot(axis_1, v_3)) * (1.0 - c_2)));
}

vec3 pl_warp(vec3 p_22, vec3 phase_2) {
    vec3 c1_ = (vec3(0.12, 1.42, 0.04) + (0.035 * phase_2));
    vec3 a1_ = normalize(vec3(0.38, 0.82, 0.42));
    vec3 v1_ = (p_22 - c1_);
    float t1_ = ((0.65 * exp((-(dot(v1_, v1_)) / 5.76))) * sin((((1.45 * dot(a1_, v1_)) + 0.7) + phase_2.x)));
    vec3 _e31 = pl_rotate(v1_, a1_, t1_);
    vec3 q_15 = (c1_ + _e31);
    vec3 c2_ = (vec3(-0.16, 1.63, -0.06) + (0.025 * phase_2));
    vec3 a2_ = normalize(vec3(-0.67, 0.15, 0.73));
    vec3 v2_ = (q_15 - c2_);
    float t2_ = ((0.2 * exp((-(dot(v2_, v2_)) / 4.41))) * sin((((4.1 * dot(a2_, v2_)) + 2.0) + phase_2.y)));
    vec3 _e62 = pl_rotate(v2_, a2_, t2_);
    return (c2_ + _e62);
}

vec3 pl_xi(vec3 p_23, vec3 phase_3) {
    vec3 _e2 = pl_warp(p_23, phase_3);
    vec3 q_16 = (_e2 + vec3(2.73, 0.91, 1.37));
    float r_2 = max(length(q_16), 0.0001);
    return vec3((log2(r_2) - 2.0), (-(q_16.z) / r_2), atan(q_16.x, q_16.y));
}

float pl_cell(vec3 xi, float sc_1) {
    float a_9 = (((cos((sc_1 * xi.z)) * cos((sc_1 * xi.x))) + (cos((sc_1 * xi.y)) * cos((sc_1 * xi.y)))) + (cos((sc_1 * xi.y)) * cos((sc_1 * xi.x))));
    return (cos(a_9) - 0.6556966);
}

float pl_macroFast(vec3 p_24) {
    vec3 _e5 = pl_xi(p_24, vec3(0.7, -1.3, 2.1));
    float _e7 = pl_cell(_e5, 1.0);
    float _e9 = pl_cell(_e5, 2.0);
    float _e14 = pl_cell(_e5, 4.0);
    float _e19 = pl_cell(_e5, 8.0);
    float _e24 = pl_cell(_e5, 16.0);
    float s_4 = ((((_e7 + (_e9 * 0.5)) + (_e14 * 0.25)) + (_e19 * 0.125)) + (_e24 * 0.0625));
    return tanh((0.78 * s_4));
}

float pl_microFast(vec3 p_25) {
    vec3 _e5 = pl_xi(p_25, vec3(0.7, -1.3, 2.1));
    float _e7 = pl_cell(_e5, 16.0);
    float _e11 = pl_cell(_e5, 32.0);
    float _e16 = pl_cell(_e5, 64.0);
    float s_5 = (((_e7 * 0.0625) + (_e11 * 0.03125)) + (_e16 * 0.015625));
    return tanh((10.5 * s_5));
}

vec3 pl_q(vec3 p_26, KpPlasterParams a_2) {
    return vec3(((p_26.xy - a_2.centerM) / max(a_2.halfM, vec2(0.08))), (p_26.z * 2.0));
}

float kpPlasterMacro(vec3 p_27, KpPlasterParams a_3) {
    vec3 _e2 = pl_q(p_27, a_3);
    float _e8 = pl_macroFast((_e2 + vec3(-0.17, 0.31, 0.09)));
    float coarse = (sin(((p_27.x * 2.7) + (p_27.y * 0.9))) * sin(((p_27.y * 3.2) - (p_27.x * 0.7))));
    return clamp(((0.48 * _e8) + (0.52 * coarse)), -1.0, 1.0);
}

float kpPlasterMicro(vec3 p_28, KpPlasterParams a_4) {
    vec3 _e2 = pl_q(p_28, a_4);
    float _e13 = pl_microFast(((_e2 * vec3(2.65, 2.52, 3.55)) + vec3(-0.27, 0.44, -0.19)));
    float r_3 = (sin((((p_28.x * 47.0) - (p_28.y * 39.0)) + (p_28.z * 58.0))) * sin((((p_28.x * 31.0) + (p_28.y * 37.0)) - (p_28.z * 43.0))));
    return clamp(((0.78 * _e13) + (0.22 * r_3)), -1.0, 1.0);
}

float pl_observed(vec3 p_29, KpPlasterParams a_5, float physicalFootprintM_6) {
    float sum_1 = 0.0;
    float sc_2 = 1.0;
    int i_5 = 0;
    vec3 _e3 = pl_q(p_29, a_5);
    vec3 phase_4 = vec3(-1.3, 4.7, 2.2);
    vec3 _e8 = pl_xi(_e3, phase_4);
    float e_2 = max(physicalFootprintM_6, 1e-7);
    vec3 dq = vec3((e_2 / max(a_5.halfM.x, 0.08)), (e_2 / max(a_5.halfM.y, 0.08)), (e_2 * 2.0));
    vec3 _e29 = pl_xi((_e3 + vec3(dq.x, 0.0, 0.0)), phase_4);
    vec3 _e37 = pl_xi((_e3 + vec3(0.0, dq.y, 0.0)), phase_4);
    vec3 _e45 = pl_xi((_e3 + vec3(0.0, 0.0, dq.z)), phase_4);
    float fp_22 = max(length((_e29 - _e8)), max(length((_e37 - _e8)), length((_e45 - _e8))));
    bool loop_init_5 = true;
    while(true) {
        if (!loop_init_5) {
            int _e77 = i_5;
            i_5 = (_e77 + 1);
        }
        loop_init_5 = false;
        int _e56 = i_5;
        if ((_e56 < 17)) {
        } else {
            break;
        }
        {
            float _e59 = sc_2;
            float gate_1 = (1.0 - smoothstep(0.44, 1.12, (fp_22 * _e59)));
            float _e66 = sc_2;
            float _e67 = pl_cell(_e8, _e66);
            float _e69 = sc_2;
            float _e71 = sum_1;
            sum_1 = (_e71 + ((gate_1 * _e67) / _e69));
            float _e74 = sc_2;
            sc_2 = (_e74 * 2.0);
        }
    }
    float _e79 = sum_1;
    return tanh((0.86 * _e79));
}

KpPlasterField kpPlasterOriginalField(vec3 pLocalM_5, KpPlasterParams a_6, float physicalFootprintM_7) {
    float _e3 = kpPlasterMacro(pLocalM_5, a_6);
    float _e4 = kpPlasterMicro(pLocalM_5, a_6);
    float _e5 = pl_observed(pLocalM_5, a_6, physicalFootprintM_7);
    float wave = max(a_6.grainWavelengthM, 0.0003);
    float phase_5 = (dot(pLocalM_5, normalize(vec3(83.0, -61.0, 97.0))) * (6.2831855 / wave));
    float grain_1 = (sin(phase_5) * (1.0 - smoothstep(0.35, 0.9, (physicalFootprintM_7 / wave))));
    float microGate = (1.0 - smoothstep(0.008, 0.02, physicalFootprintM_7));
    float h_12 = (((microGate * a_6.microM) * ((0.26 * _e5) + (0.18 * _e4))) + (a_6.grainHeightM * grain_1));
    vec3 base_2 = (mix(a_6.paletteDark, a_6.paletteLight, ((0.58 + (0.08 * _e5)) + (0.22 * _e3))) * (0.94 + (a_6.grainColor * grain_1)));
    float rough_5 = clamp((0.95 + (0.032 * -(_e5))), 0.86, 0.997);
    float thickness = clamp(((a_6.thicknessM + (a_6.reliefM * _e3)) + (a_6.geometryMicroM * _e4)), a_6.minThicknessM, a_6.maxThicknessM);
    return KpPlasterField(_e3, _e4, thickness, KpSurface(h_12, base_2, rough_5));
}

KpPlasterParams stationPlasterParams(vec3 extent) {
    float _e9 = _group_0_binding_0_fs.age;
    return KpPlasterParams(vec2(0.0), max(extent.xy, vec2(0.08)), 0.0165, (0.0012 + (0.0018 * _e9)), 0.0, 0.013, 0.02, 0.0001, vec3(0.48, 0.44, 0.35), vec3(0.82, 0.76, 0.64), 0.0008, 8e-6, 0.018);
}

float rep(float x, float pitch, float lo, float hi) {
    return (x - (clamp(roundEven((x / pitch)), lo, hi) * pitch));
}

float stateWet(vec3 p_30) {
    float _e5 = rep(p_30.x, 7.5, -4.0, 4.0);
    float drain = (1.0 - smoothstep(0.12, 0.75, abs(_e5)));
    float rain = ((1.0 - smoothstep(7.5, 12.0, p_30.y)) * smoothstep(0.1, 0.4, p_30.y));
    float _e25 = _group_0_binding_0_fs.age;
    return (((_e25 * 0.12) * (0.15 + (drain * rain))) + ((1.0 - smoothstep(0.2, 1.8, p_30.y)) * 0.15));
}

float repairAt(vec3 p_31) {
    return (0.08 + ((0.65 * (1.0 - smoothstep(0.9, 1.4, abs((p_31.x - 15.0))))) * (1.0 - smoothstep(1.1, 2.2, p_31.y))));
}

vec3 brickQ(vec3 p_32, uint axis_2, float d) {
    float row = floor((p_32.y / 0.073));
    float shift = (((int(row) & 1) == 1) ? 0.125 : 0.0);
    float face = ((axis_2 == 12u) ? p_32.z : p_32.x);
    return vec3(((fract(((face + shift) / 0.25)) * 0.25) - 0.125), ((fract((p_32.y / 0.073)) * 0.073) - 0.0365), (0.055384614 + d));
}

StationState resolveStationState(vec3 p_33) {
    float _e1 = repairAt(p_33);
    float _e4 = _group_0_binding_0_fs.age;
    float _e5 = stateWet(p_33);
    float _e8 = _group_0_binding_0_fs.age;
    return StationState(_e4, _e5, _e1, (_e8 * (1.0 - _e1)));
}

KpWoodParams stationWoodParams(HitField h_1, StationState st) {
    KpWoodParams wp_23 = KpWoodParams(0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, vec2(0.0), vec3(0.0), vec3(0.0), vec3(0.0), vec3(0.0), vec3(0.0), vec3(0.0));
    KpWoodParams _e2 = kpWoodDefaultParams();
    wp_23 = _e2;
    if (((h_1.seed == 38.0) || (h_1.seed == 39.0))) {
        wp_23.textureScale = BENCH_WOOD_SCALE;
        wp_23.grainContrast = BENCH_WOOD_CONTRAST;
    }
    float _e17 = wp_23.seed;
    wp_23.seed = fract((_e17 + (h_1.sourceSeed * 0.618034)));
    float _e29 = wp_23.reliefScale;
    wp_23.reliefScale = (_e29 * (0.35 + (0.85 * st.retained)));
    float _e33 = wp_23.roughness;
    wp_23.roughness = clamp(((_e33 + (0.07 * st.retained)) - (0.12 * st.repair)), 0.2, 0.98);
    vec3 _e47 = wp_23.freshCutColor;
    vec3 _e49 = wp_23.agedSurfaceColor;
    wp_23.agedSurfaceColor = mix(_e47, _e49, (0.4 + (0.6 * st.retained)));
    wp_23.clearcoat = (0.12 * st.repair);
    KpWoodParams _e60 = wp_23;
    return _e60;
}

vec3 stationMaterialDirection(HitField h_2, vec3 p_34, vec3 d_1) {
    if (((h_2.id == 4u) && (h_2.seed == 38.0))) {
        return d_1.zxy;
    }
    if (((h_2.id == 4u) && (h_2.seed == 39.0))) {
        return vec3(d_1.x, d_1.y, (d_1.z * ((p_34.z >= 0.0) ? 1.0 : -1.0)));
    }
    return d_1;
}

float stationWoodClass(HitField h_3) {
    vec3 face_1 = (abs(h_3.q) - h_3.extent);
    return ((face_1.x >= max(face_1.y, face_1.z)) ? 1.0 : 0.0);
}

float stationStoneHeight(vec3 qM) {
    vec3 pos_2 = (qM / vec3(0.12352941));
    vec3 _e6 = st_seedVector(KP_STONE_COLOR_SEED, 0.071);
    vec3 _e7 = st_warp(pos_2, _e6);
    float _e11 = st_sf(((_e7 * 1.35) + _e6));
    float _e18 = st_sf((((_e7 * 3.2) + _e6) + vec3(11.0)));
    float _e19 = st_line(_e7, _e6);
    float vein_1 = ((1.0 - smoothstep(0.028, 0.072, _e19)) * smoothstep(0.34, 0.63, _e18));
    vec3 _e33 = st_seedVector(KP_STONE_PORE_SEED, 0.061);
    float _e35 = st_sf(((_e7 * 19.0) + _e33));
    float pits_1 = pow(max(0.0, ((_e35 - 0.57) / 0.43)), 2.0);
    return ((((((_e11 - 0.5) * 0.018) + ((_e18 - 0.5) * 0.007)) + (vein_1 * 0.004)) - (pits_1 * 0.025)) * KP_STONE_SCALE_M);
}

float stationConcreteHeight(vec3 p_35, float age_4) {
    vec3 q_17 = (p_35 + vec3(19.0, 13.49, 7.03));
    float _e9 = mt_kn((q_17 * 3.7));
    float _e12 = mt_kn((q_17 * 127.0));
    float _e15 = mt_kn((q_17 * 23.0));
    float chip_1 = ((smoothstep(0.64, 0.81, _e15) * smoothstep(0.46, 0.76, _e9)) * age_4);
    return (((_e12 - 0.5) * 0.00042) - (chip_1 * 0.0007));
}

float stationCoatingThickness(HitField h_4, vec3 p_36, StationState st_1) {
    KpPlasterParams _e4 = stationPlasterParams(h_4.extent);
    float _e6 = kpPlasterMacro(h_4.q, _e4);
    float sourceThickness = clamp((_e4.thicknessM + (_e4.reliefM * _e6)), _e4.minThicknessM, _e4.maxThicknessM);
    float exposure = clamp(((st_1.wet * 2.8) + ((1.0 - smoothstep(0.2, 1.8, p_36.y)) * 0.18)), 0.0, 1.0);
    float decay = clamp((st_1.retained * exposure), 0.0, 1.0);
    float defect = ((_e6 * 0.5) + 0.5);
    float coverage = smoothstep(((decay * 0.9) - 0.03), ((decay * 0.9) + 0.04), defect);
    return (sourceThickness * coverage);
}

vec3 stationMetalCoordinates(HitField h_5, vec3 p_37) {
    bool rail = ((h_5.id == 3u) && (h_5.seed == 55.0));
    return vec3(h_5.q.x, (rail ? (p_37.y + 0.97150004) : p_37.y), h_5.q.z);
}

bool isStationRoof(HitField h_6) {
    return ((h_6.id == 15u) || ((h_6.id == 3u) && (((h_6.seed == 8.0) || (h_6.seed == 94.0)) || (h_6.seed == 96.0))));
}

float stationRoofPaintCoverage(HitField h_7, vec3 p_38, StationState st_2) {
    vec3 _e3 = stationMetalCoordinates(h_7, p_38);
    float _e7 = kpMetalCorrosion(_e3, st_2.age, st_2.wet, st_2.repair);
    return (1.0 - (_e7 * 0.8));
}

StationGeometry evaluateStationGeometry(HitField h_8, vec3 p_39, StationState st_3) {
    StationGeometry g_10 = StationGeometry(0.0, 0.0, 0.0);
    g_10 = StationGeometry(h_8.d, 0.0, 0.0);
    if (((h_8.id == 1u) || (h_8.id == 12u))) {
        vec3 _e17 = brickQ(p_39, h_8.id, h_8.d);
        float seed_6 = ((19.0 + (floor((p_39.y / 0.073)) * 13.0)) + floor(((p_39.x + p_39.z) / 0.25)));
        int variant_3 = (int(abs(seed_6)) % 4);
        float _e38 = kpBrickBaseDistance(_e17, seed_6, variant_3, 0.42);
        float _e39 = kpBrickAnalyticBoundDistance(_e17);
        float macroSignal = (_e38 - _e39);
        g_10.loss = clamp(((st_3.retained * st_3.wet) * (0.0004 + (max(0.0, macroSignal) * 0.6))), 0.0, 0.0016);
        float _e60 = g_10.loss;
        g_10.d = min((h_8.d + 0.006), (_e38 + _e60));
    }
    if ((h_8.id == 2u)) {
        float _e71 = stationStoneHeight((h_8.q * 0.19));
        g_10.d = (h_8.d - clamp((_e71 * (0.25 + (0.75 * st_3.retained))), -0.004, 0.004));
    }
    if (((h_8.id == 3u) || (h_8.id == 15u))) {
        vec3 _e90 = stationMetalCoordinates(h_8, p_39);
        float _e94 = kpMetalCorrosion(_e90, st_3.age, st_3.wet, st_3.repair);
        g_10.loss = (_e94 * 0.0008);
        float _e100 = g_10.loss;
        g_10.d = (h_8.d + _e100);
        bool _e102 = isStationRoof(h_8);
        if (_e102) {
            float _e104 = stationRoofPaintCoverage(h_8, p_39, st_3);
            g_10.thickness = (6e-5 * _e104);
            float _e109 = g_10.thickness;
            float _e110 = g_10.d;
            g_10.d = (_e110 - _e109);
        }
    }
    if ((h_8.id == 4u)) {
        float _e118 = stationWoodClass(h_8);
        KpWoodParams _e119 = stationWoodParams(h_8, st_3);
        float _e120 = kpWoodMacroDisplacement(h_8.q, _e118, _e119);
        g_10.d = (h_8.d - _e120);
    }
    if ((h_8.id == 17u)) {
        float _e129 = stationConcreteHeight(h_8.q, st_3.retained);
        g_10.d = (h_8.d - _e129);
    }
    if ((h_8.id == 13u)) {
        float _e135 = stationCoatingThickness(h_8, p_39, st_3);
        g_10.thickness = _e135;
        float _e141 = stationStoneHeight((h_8.q * 0.19));
        float _e149 = g_10.thickness;
        g_10.d = ((h_8.d - clamp((_e141 * 0.25), -0.001, 0.001)) - _e149);
    }
    StationGeometry _e151 = g_10;
    return _e151;
}

StationMatter evaluateStationMatter(HitField h_9, vec3 p_40, vec3 normal, float fp_20) {
    StationMatter m = StationMatter(0.0, KpSurface(0.0, vec3(0.0), 0.0), 0.0, 0.0, 0.0, 0.0, 0u, 0.0, 0.0, 0.0);
    StationState _e4 = resolveStationState(p_40);
    StationGeometry _e5 = evaluateStationGeometry(h_9, p_40, _e4);
    m = StationMatter(_e5.d, KpSurface(0.0, vec3(0.34, 0.33, 0.28), 0.85), 0.0, 1.0, 1.0, 0.0, 0u, 0.0, 1.0, 0.0);
    if (((h_9.id == 1u) || (h_9.id == 12u))) {
        vec3 _e33 = brickQ(p_40, h_9.id, h_9.d);
        float seed_7 = ((19.0 + (floor((p_40.y / 0.073)) * 13.0)) + floor(((p_40.x + p_40.z) / 0.25)));
        int variant_4 = (int(abs(seed_7)) % 4);
        float loss = _e5.loss;
        KpSurface _e56 = kpBrickOriginalSurface(_e33, seed_7, variant_4, 0.42, fp_20);
        m.surface = _e56;
        float edge = min((0.125 - abs(_e33.x)), (0.0365 - abs(_e33.y)));
        if ((edge < 0.004)) {
            m.surface = KpSurface(0.0, vec3(0.28, 0.26, 0.21), 0.94);
        }
        vec3 _e86 = m.surface.albedo;
        m.surface.albedo = (_e86 * ((1.0 - (_e4.wet * 0.18)) - (loss * 60.0)));
        float _e92 = m.surface.roughness;
        m.surface.roughness = clamp((_e92 + (loss * 50.0)), 0.15, 0.98);
        float _e102 = m.surface.height;
        m.microHeight = _e102;
        m.layer = 1u;
    }
    if ((h_9.id == 2u)) {
        float relief = (0.25 + (0.75 * _e4.retained));
        KpSurface _e122 = kpStoneSurface((h_9.q * 0.19), _e4.age, _e4.wet, _e4.repair, (fp_20 * 0.19));
        m.surface = _e122;
        float _e125 = m.surface.height;
        m.surface.height = (_e125 * relief);
        m.layer = 2u;
    }
    if (((h_9.id == 3u) || (h_9.id == 15u))) {
        float loss_1 = _e5.loss;
        vec3 _e138 = stationMetalCoordinates(h_9, p_40);
        KpSurface _e142 = kpMetalSurface(_e138, _e4.age, _e4.wet, _e4.repair, fp_20);
        m.surface = _e142;
        bool _e143 = isStationRoof(h_9);
        if (_e143) {
            vec3 _e144 = stationMetalCoordinates(h_9, p_40);
            vec3 pigmentDelta = vec3(-0.104, -0.162, -0.122);
            float _e156 = mt_kfb(((_e144 + vec3(19.0)) * 3.1));
            float _e162 = stationRoofPaintCoverage(h_9, p_40, _e4);
            vec3 _e170 = m.surface.albedo;
            m.surface.albedo = (_e170 + (((pigmentDelta * (0.94 + (0.09 * _e156))) * _e162) * (1.0 - (_e4.wet * 0.18))));
        }
        m.metal = 0.0;
        if (((h_9.id == 3u) && (h_9.seed == 55.0))) {
            vec3 _e181 = stationMetalCoordinates(h_9, p_40);
            float contact_2 = (1.0 - smoothstep(0.01, 0.035, abs((_e181.y - 1.07))));
            vec3 _e194 = stationMetalCoordinates(h_9, p_40);
            float _e198 = kpMetalCorrosion(_e194, _e4.age, _e4.wet, _e4.repair);
            m.metal = ((0.88 * contact_2) * (1.0 - _e198));
        }
        float _e205 = m.surface.height;
        m.microHeight = (_e205 + loss_1);
        m.layer = 3u;
    }
    if ((h_9.id == 4u)) {
        KpWoodParams _e212 = stationWoodParams(h_9, _e4);
        float _e213 = stationWoodClass(h_9);
        vec3 _e214 = stationMaterialDirection(h_9, p_40, normal);
        vec3 _e218 = _group_0_binding_0_fs.eye;
        KpWoodSample _e221 = kpWoodOriginalSample(h_9.q, _e214, _e213, _e212, fp_20, length((p_40 - _e218)));
        m.surface = _e221.surface;
        m.cavity = _e221.cavity;
        m.specular = _e221.specularLevel;
        m.microHeight = _e221.surface.height;
        m.layer = 4u;
        m.clearcoat = _e221.clearcoat;
        m.clearcoatRoughness = _e221.clearcoatRoughness;
        m.parallaxHeight01_ = _e221.parallaxHeight01_;
    }
    if ((h_9.id == 17u)) {
        KpSurface _e247 = kpConcreteStation(h_9.q, _e4.retained, _e4.wet, _e4.repair, fp_20);
        m.surface = _e247;
        m.layer = 17u;
    }
    if ((h_9.id == 13u)) {
        KpPlasterParams _e254 = stationPlasterParams(h_9.extent);
        float thickness_1 = _e5.thickness;
        KpPlasterField _e258 = kpPlasterOriginalField(h_9.q, _e254, fp_20);
        m.surface = _e258.surface;
        float revealed = (1.0 - smoothstep(0.0001, 0.001, thickness_1));
        if ((revealed > 0.0)) {
            KpSurface _e275 = kpStoneSurface((h_9.q * 0.19), _e4.age, _e4.wet, _e4.repair, (fp_20 * 0.19));
            vec3 _e280 = m.surface.albedo;
            m.surface.albedo = mix(_e280, _e275.albedo, revealed);
            float _e287 = m.surface.roughness;
            m.surface.roughness = mix(_e287, _e275.roughness, revealed);
        }
        vec3 _e297 = m.surface.albedo;
        m.surface.albedo = (_e297 * (1.0 - (_e4.wet * 0.18)));
        float _e302 = m.surface.height;
        m.microHeight = (_e302 * (1.0 - revealed));
        m.layer = ((revealed > 0.5) ? 2u : 13u);
    }
    StationMatter _e312 = m;
    return _e312;
}

void main() {
    vec4 pixel = gl_FragCoord;
    vec3 albedo = vec3(0.0);
    float rough = 0.0;
    ivec2 ij = ivec2(pixel.xy);
    vec4 tr = texelFetch(_group_1_binding_0_fs, ij, 0);
    if ((tr.w != 1.0)) {
        MatterRecord _tmp_return = MatterRecord(vec4(0.0), vec4(0.0), vec4(0.0));
        _fs2p_location0 = _tmp_return.albedoRoughness;
        _fs2p_location1 = _tmp_return.response;
        _fs2p_location2 = _tmp_return.finish;
        return;
    }
    vec4 a_10 = texelFetch(_group_1_binding_1_fs, ij, 0);
    vec4 b_11 = texelFetch(_group_1_binding_2_fs, ij, 0);
    vec4 c_3 = texelFetch(_group_1_binding_3_fs, ij, 0);
    mat2x3 _e26 = hostRay(pixel.xy);
    vec3 p_42 = (_e26[0] + (_e26[1] * tr.x));
    HitField h_13 = HitField(c_3.w, uint(tr.y), a_10.xyz, a_10.w, c_3.w, b_11.xyz, b_11.w);
    float _e46 = _group_0_binding_0_fs.fov;
    float _e51 = _group_0_binding_1_fs.viewport.y;
    float fp_23 = max(1e-5, (((tr.x * 2.0) * _e46) / _e51));
    StationMatter _e56 = evaluateStationMatter(h_13, p_42, c_3.xyz, fp_23);
    albedo = _e56.surface.albedo;
    rough = _e56.surface.roughness;
    if ((h_13.id == 7u)) {
        albedo = vec3(0.82, 0.77, 0.62);
        rough = 0.3;
    }
    if ((h_13.id == 8u)) {
        albedo = vec3(0.025, 0.031, 0.028);
        rough = 0.35;
    }
    if ((h_13.id == 9u)) {
        albedo = vec3(0.045, 0.105, 0.075);
        rough = 0.27;
    }
    vec3 _e87 = albedo;
    float _e88 = rough;
    MatterRecord _tmp_return = MatterRecord(vec4(_e87, _e88), vec4(_e56.metal, _e56.cavity, _e56.specular, _e56.microHeight), vec4(_e56.clearcoat, _e56.clearcoatRoughness, _e56.parallaxHeight01_, 0.0));
    _fs2p_location0 = _tmp_return.albedoRoughness;
    _fs2p_location1 = _tmp_return.response;
    _fs2p_location2 = _tmp_return.finish;
    return;
}

