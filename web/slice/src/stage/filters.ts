// 물 반사 필터(GLSL, WebGL): 가까울수록 크게 흔들리는 가로 물결 + 달기둥 반짝임. 물 겹 하나에만 건다.
// 필터 좌표 vTextureCoord 는 입력 텍스처 기준이라, 걸린 영역의 0~1 로 바꿔 쓴다(uInputSize · uOutputFrame 은 필터 시스템이 넣어 준다).

import { Filter, defaultFilterVert } from 'pixi.js';

const fragment = `
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform highp vec4 uInputSize;
uniform highp vec4 uOutputFrame;
uniform vec4 uInputClamp;
uniform float uTime;
uniform float uCalm;

void main(void)
{
    highp vec2 n = vTextureCoord * uInputSize.xy / uOutputFrame.zw;
    float depth = clamp(n.y, 0.0, 1.0);
    float k = mix(1.0, 0.15, uCalm);
    float band = sin(n.y * 120.0 / (0.18 + depth) - uTime * 1.6 + sin(n.x * 7.0 + uTime * 0.3) * 1.4);
    float band2 = sin(n.y * 47.0 / (0.25 + depth) + n.x * 9.0 - uTime * 0.9);
    float dxPx = (band * 0.65 + band2 * 0.35) * (1.0 + depth * 9.0) * k;
    float dyPx = sin(n.x * 38.0 + uTime * 1.3) * 0.6 * depth * k;
    vec2 uv = vTextureCoord + vec2(dxPx, dyPx) * uInputSize.zw;
    vec4 c = texture(uTexture, clamp(uv, uInputClamp.xy, uInputClamp.zw));
    // 물마루 반짝임: 밝은 자리(달기둥)에서만
    float lum = dot(c.rgb, vec3(0.3, 0.55, 0.15));
    float crest = smoothstep(0.55, 1.0, band * 0.5 + 0.5) * smoothstep(0.18, 0.5, lum);
    c.rgb += c.rgb * crest * 0.55 * k;
    finalColor = c;
}
`;

export function waterFilter(): Filter & { tick: (t: number, calm: boolean) => void } {
  const f = Filter.from({
    gl: { vertex: defaultFilterVert, fragment, name: 'slice-water' },
    resources: {
      waterUniforms: {
        uTime: { value: 0, type: 'f32' },
        uCalm: { value: 0, type: 'f32' },
      },
    },
    // 물 반사는 원래 흐릿하다 → 반 해상도로 그려 채움 비용을 줄인다
    resolution: 0.5,
  }) as Filter & { tick: (t: number, calm: boolean) => void };
  f.tick = (t: number, calm: boolean) => {
    const u = f.resources.waterUniforms.uniforms as { uTime: number; uCalm: number };
    u.uTime = t;
    u.uCalm = calm ? 1 : 0;
  };
  return f;
}
