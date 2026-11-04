// 설계 데이터(JSON)를 정적 import 로 묶는다. Node(tsx)와 브라우저 번들(Vite) 모두 같은 방식으로 읽는다.
// 파일 시스템에 기대지 않으므로 엔진이 환경에 묶이지 않는다. 경로 키는 data.ts 의 readJson 인자와 같다.

import manshin from '../../data/cards/manshin.json' with { type: 'json' };
import jaebi from '../../data/cards/jaebi.json' with { type: 'json' };
import posu from '../../data/cards/posu.json' with { type: 'json' };
import baksu from '../../data/cards/baksu.json' with { type: 'json' };
import seungnyeo from '../../data/cards/seungnyeo.json' with { type: 'json' };
import beopsa from '../../data/cards/beopsa.json' with { type: 'json' };
import talggun from '../../data/cards/talggun.json' with { type: 'json' };
import chasa from '../../data/cards/chasa.json' with { type: 'json' };
import duo from '../../data/cards/duo.json' with { type: 'json' };
import common from '../../data/cards/common.json' with { type: 'json' };
import heroes from '../../data/design/heroes.json' with { type: 'json' };
import region1 from '../../data/design/region1.json' with { type: 'json' };
import region2 from '../../data/design/region2.json' with { type: 'json' };
import region3 from '../../data/design/region3.json' with { type: 'json' };
import synergy from '../../data/design/synergy.json' with { type: 'json' };

export const RAW_JSON: Readonly<Record<string, unknown>> = {
  'data/cards/manshin.json': manshin,
  'data/cards/jaebi.json': jaebi,
  'data/cards/posu.json': posu,
  'data/cards/baksu.json': baksu,
  'data/cards/seungnyeo.json': seungnyeo,
  'data/cards/beopsa.json': beopsa,
  'data/cards/talggun.json': talggun,
  'data/cards/chasa.json': chasa,
  'data/cards/duo.json': duo,
  'data/cards/common.json': common,
  'data/design/heroes.json': heroes,
  'data/design/region1.json': region1,
  'data/design/region2.json': region2,
  'data/design/region3.json': region3,
  'data/design/synergy.json': synergy,
};
