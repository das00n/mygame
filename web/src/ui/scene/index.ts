// 러프 그래픽 장면 원시 도형 (10-presentation §4.2). 화면은 여기서 가져다 쓴다.
import './scene.css';

export { SceneDefs } from './defs.tsx';
export { HeroBust, HeroFigure, HeroParts, Shadow, type HeroLook, type Mask, type Pose } from './hero.tsx';
export { Palanquin, SoulWisp, SpiritParts, SpiritShadow, Villager, TIER_SCALE, type SpiritState, type Tier } from './spirit.tsx';
export { Backdrop, BigGate, Geumjul, Hongsalmun, LightVignette, type BackdropVariant } from './backdrop.tsx';
export { Boat, Cairn, Campfire, DangsanTree, GutsangTable, Hanok, SignPost, Sotdae, Tablet, TrapMark, VText } from './props.tsx';
export { CombatStage, HpBar, Stage, SW, SH, FY } from './stage.tsx';
export { forgetBattle, recallBattle, rememberBattle, useCombatFx } from './fx.ts';
export { cue, setSound, soundOn } from './audio.ts';
export { SoundToggle } from './sound-toggle.tsx';
