// 저승굿 Prototype ② — 브라우저 진입점. 엔진(src/core)을 그대로 번들에 싣는다.
import { render } from 'preact';
import './styles.css';
import { App } from './app.tsx';

let root = document.getElementById('app');
if (!root) {
  root = document.createElement('div');
  root.id = 'app';
  document.body.appendChild(root);
}
render(<App />, root);
