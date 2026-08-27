export const vertexSource = `#version 300 es
precision highp float;
precision highp int;
layout(location=0) in vec2 aUV;
uniform highp usampler2D uHeight;
uniform highp usampler2D uMask;
uniform mat4 uMVP;
uniform vec2 uWorldSize;
uniform ivec2 uGridSize;
uniform float uHeightOffset;
uniform float uHeightScale;
uniform float uMeanElevation;
uniform float uVerticalScale;
out vec2 vUV;
flat out uint vValid;
float decodeHeight(ivec2 pixel) {
  uint raw = texelFetch(uHeight, clamp(pixel, ivec2(0), uGridSize - 1), 0).r;
  return uHeightOffset + float(raw) * uHeightScale;
}
void main() {
  ivec2 pixel = ivec2(round(aUV * vec2(uGridSize - 1)));
  float elevation = decodeHeight(pixel);
  vValid = texelFetch(uMask, clamp(pixel, ivec2(0), uGridSize - 1), 0).r;
  vec3 world = vec3(
    (aUV.x - 0.5) * uWorldSize.x,
    (elevation - uMeanElevation) * uVerticalScale,
    (0.5 - aUV.y) * uWorldSize.y
  );
  vUV = aUV;
  gl_Position = uMVP * vec4(world, 1.0);
}`;

export const fragmentSource = `#version 300 es
precision highp float;
precision highp int;
in vec2 vUV;
flat in uint vValid;
out vec4 outColor;
uniform highp usampler2D uHeight;
uniform sampler2D uHydrology;
uniform ivec2 uGridSize;
uniform vec2 uSpacing;
uniform float uHeightOffset;
uniform float uHeightScale;
uniform float uMinElevation;
uniform float uMaxElevation;
uniform float uVerticalScale;
uniform int uMode;
float heightAt(ivec2 pixel) {
  uint raw = texelFetch(uHeight, clamp(pixel, ivec2(0), uGridSize - 1), 0).r;
  return uHeightOffset + float(raw) * uHeightScale;
}
vec3 earthPalette(float t, float slope) {
  vec3 low = vec3(0.26, 0.235, 0.19);
  vec3 middle = vec3(0.43, 0.355, 0.255);
  vec3 high = vec3(0.58, 0.50, 0.39);
  vec3 rock = vec3(0.69, 0.65, 0.59);
  vec3 color = t < 0.48 ? mix(low, middle, t / 0.48) : mix(middle, high, (t - 0.48) / 0.52);
  return mix(color, rock, clamp(slope * 1.30 + t * 0.10, 0.0, 0.76));
}
void main() {
  if (vValid == uint(0)) discard;
  ivec2 pixel = ivec2(round(vUV * vec2(uGridSize - 1)));
  float center = heightAt(pixel);
  float leftH = heightAt(pixel + ivec2(-1, 0));
  float rightH = heightAt(pixel + ivec2(1, 0));
  float downH = heightAt(pixel + ivec2(0, -1));
  float upH = heightAt(pixel + ivec2(0, 1));
  float dx = (rightH - leftH) / max(0.001, 2.0 * uSpacing.x);
  float dz = (upH - downH) / max(0.001, 2.0 * uSpacing.y);
  vec3 normal = normalize(vec3(-dx * uVerticalScale, 1.0, dz * uVerticalScale));
  float slope = clamp(1.0 - normal.y, 0.0, 1.0);
  float curvature = clamp(abs(leftH + rightH + downH + upH - 4.0 * center) / max(1.0, (uMaxElevation - uMinElevation) * 0.018), 0.0, 1.0);
  float t = clamp((center - uMinElevation) / max(0.001, uMaxElevation - uMinElevation), 0.0, 1.0);
  vec3 light = normalize(vec3(-0.52, 0.78, 0.35));
  float diffuse = max(dot(normal, light), 0.0);
  float shade = 0.57 + 0.47 * diffuse;
  vec4 hydro = texture(uHydrology, vUV);
  vec3 color = earthPalette(t, slope) * shade;
  if (uMode == 1) {
    float flat = 1.0 - smoothstep(0.035, 0.28, slope);
    float bench = flat * smoothstep(0.025, 0.44, curvature);
    vec3 base = mix(vec3(0.16, 0.18, 0.17), vec3(0.55, 0.46, 0.33), clamp(slope * 1.45, 0.0, 1.0));
    color = mix(base, vec3(0.98, 0.67, 0.16), bench * 0.92);
    color = mix(color, vec3(0.29, 0.73, 0.89), smoothstep(0.42, 0.84, curvature) * (1.0 - flat) * 0.50);
  } else if (uMode == 2) {
    color = mix(vec3(0.19, 0.21, 0.20), color, 0.33);
    float waterArea = hydro.r;
    float mainRiver = hydro.g;
    float minorRiver = hydro.b;
    float coastOrWet = hydro.a;
    vec3 water = mix(vec3(0.03, 0.27, 0.48), vec3(0.17, 0.69, 0.90), clamp(mainRiver + minorRiver * 0.55, 0.0, 1.0));
    color = mix(color, water, clamp(waterArea * 0.94 + mainRiver * 0.90 + minorRiver * 0.72, 0.0, 0.95));
    color = mix(color, vec3(0.94, 0.78, 0.29), coastOrWet * 0.75);
  } else if (uMode == 3) {
    vec3 flatColor = vec3(0.18, 0.31, 0.47);
    vec3 steepColor = vec3(0.89, 0.27, 0.16);
    color = mix(flatColor, steepColor, smoothstep(0.02, 0.58, slope));
    color = mix(color, vec3(0.99, 0.83, 0.28), curvature * 0.34);
    color *= 0.74 + 0.30 * diffuse;
  } else {
    float realWater = clamp(hydro.r * 0.72 + hydro.g * 0.58 + hydro.b * 0.34, 0.0, 0.68);
    color = mix(color, vec3(0.05, 0.36, 0.56), realWater);
    color = mix(color, vec3(0.76, 0.66, 0.40), hydro.a * 0.10);
  }
  outColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}`;
