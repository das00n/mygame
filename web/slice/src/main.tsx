// 그래픽 슬라이스 진입점 (12-graphic-slice). 플레이어블과 같은 토큰·러프 그림(견주기용)을 함께 싣는다.
import { render } from 'preact';
import '../../src/styles.css';
import '../../src/ui/scene/scene.css';
import './slice.css';
import { SliceApp } from './ui/app.tsx';

let root = document.getElementById('slice');
if (!root) {
  root = document.createElement('div');
  root.id = 'slice';
  document.body.appendChild(root);
}
render(<SliceApp />, root);
