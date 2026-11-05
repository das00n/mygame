// 러프 소리 (10-presentation §6.5): Web Audio 로 합성한 짧은 소리 7개. 기본은 꺼 둔다(전투 위 「소리」 단추).
// 장구 덩·쿵(잡음 + 낮은 사인파) · 징(110Hz + 긴 감쇠 + 미세 맥놀이) · 방울(높은 사인파 셋) · 종이(걸러 낸 잡음) · 나무(짧은 딱).
// 녹음·샘플이 아니다 — 11단계에서 국악 연주자 녹음으로 바꾼다.

export type Cue = 'card' | 'bat' | 'turn' | 'haewon' | 'kill' | 'down' | 'bell';

const KEY = 'jeoseunggut.sound';
let on = false;
try {
  on = globalThis.localStorage?.getItem(KEY) === '1';
} catch {
  on = false;
}
let ctx: AudioContext | null = null;

export function soundOn(): boolean {
  return on;
}

export function setSound(v: boolean): void {
  on = v;
  try {
    globalThis.localStorage?.setItem(KEY, v ? '1' : '0');
  } catch {
    /* 저장소가 없어도 소리는 켜고 끌 수 있다 */
  }
  if (v) {
    ensure();
    cue('bell');
  }
}

function ensure(): AudioContext | null {
  if (ctx) return ctx;
  const AC = (globalThis as unknown as { AudioContext?: typeof AudioContext }).AudioContext;
  if (!AC) return null;
  try {
    ctx = new AC();
  } catch {
    ctx = null;
  }
  return ctx;
}

function tone(ac: AudioContext, t: number, freq: number, dur: number, gain: number, type: OscillatorType = 'sine', bend = 1): void {
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (bend !== 1) o.frequency.exponentialRampToValueAtTime(freq * bend, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ac.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise(ac: AudioContext, t: number, dur: number, gain: number, filter: BiquadFilterType, freq: number): void {
  const n = Math.max(1, Math.floor(ac.sampleRate * dur));
  const buf = ac.createBuffer(1, n, ac.sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = ac.createBufferSource();
  src.buffer = buf;
  const f = ac.createBiquadFilter();
  f.type = filter;
  f.frequency.value = freq;
  const g = ac.createGain();
  g.gain.value = gain;
  src.connect(f).connect(g).connect(ac.destination);
  src.start(t);
}

/** 장구: 덩(낮고 길게) · 쿵(더 낮게) */
function janggu(ac: AudioContext, t: number, low: boolean): void {
  tone(ac, t, low ? 72 : 110, low ? 0.32 : 0.22, 0.5, 'sine', 0.7);
  noise(ac, t, 0.06, 0.25, 'lowpass', low ? 400 : 900);
}

export function cue(kind: Cue): void {
  if (!on) return;
  const ac = ensure();
  if (!ac) return;
  if (ac.state === 'suspended') void ac.resume().catch(() => {});
  const t = ac.currentTime + 0.01;
  switch (kind) {
    case 'card': // 종이 스침
      noise(ac, t, 0.12, 0.18, 'bandpass', 2400);
      break;
    case 'bat': // 받는소리: 덩 + 쿵
      janggu(ac, t, false);
      janggu(ac, t + 0.14, true);
      break;
    case 'turn': // 턴이 넘어간다: 장구 한 타
      janggu(ac, t, true);
      break;
    case 'haewon': // 징 한 번 (110Hz + 미세 맥놀이)
      tone(ac, t, 110, 2.4, 0.35);
      tone(ac, t, 111.6, 2.4, 0.25);
      tone(ac, t, 220.5, 1.2, 0.08);
      break;
    case 'kill': // 낮은 둔음
      tone(ac, t, 58, 0.4, 0.45, 'triangle', 0.6);
      noise(ac, t, 0.18, 0.15, 'lowpass', 300);
      break;
    case 'down': // 목인이 넘어지는 "탁"
      noise(ac, t, 0.05, 0.4, 'highpass', 1800);
      tone(ac, t, 820, 0.08, 0.2, 'square', 0.8);
      break;
    case 'bell': // 방울
      for (const [k, f] of [2093, 2637, 3136].entries()) tone(ac, t + k * 0.03, f, 0.5, 0.06);
      break;
  }
}
