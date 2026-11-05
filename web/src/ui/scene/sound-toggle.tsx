// 러프 소리 켜기/끄기 (기본 끔). 켤 때 사용자의 누르기로 AudioContext 를 연다.

import { useState } from 'preact/hooks';
import { setSound, soundOn } from './audio.ts';

export function SoundToggle() {
  const [on, setOn] = useState(soundOn());
  return (
    <button class={`btn small ghost ${on ? 'on' : ''}`} data-testid="sound-toggle" aria-pressed={on} title="합성한 짧은 소리 7개 (장구·징·방울·종이·나무)" onClick={() => { setSound(!on); setOn(!on); }}>
      소리 {on ? '켬' : '끔'}
    </button>
  );
}
