// Water track WA-5a: the new kinds' play (game/js/logic/water-play.js): the hot spring's heal once a run, the reeds'
// finds once a run, the marsh's and the bog's own wild Billies
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  WATER_HEAL_FLAG,
  waterHealDue,
  waterHurt,
  waterMarshOf,
  waterReedAt,
  waterReedFlag,
  waterWildOdds,
} from '../../game/js/logic/water-play.js';
import { wadeKindAt } from '../../game/js/logic/wading.js';

/* a 6 x 4 m place: shallows with a hot spring's rectangle in the east */
const spring = () => ({
  w: 6,
  h: 4,
  tiles: ['gggggg', 'gwwwwg', 'gwwwwg', 'gggggg'],
  waterKind: 'pond',
  waters: [{ x: 3, z: 1, w: 2, h: 2, k: 'hotspring' }],
  props: [],
});

test('the hot spring heals once a run, only with someone hurt, only in its own water', () => {
  const sc = spring(),
    flags = {};
  assert.equal(waterHealDue(wadeKindAt(sc, 1.5, 1.5), flags, true), false, 'the pond beside it does not heal');
  assert.equal(waterHealDue(wadeKindAt(sc, 3.5, 1.5), flags, false), false, 'nobody hurt: kept for later');
  assert.equal(waterHealDue(wadeKindAt(sc, 3.5, 1.5), flags, true), true, 'in the spring, someone hurt');
  flags[WATER_HEAL_FLAG] = 1;
  assert.equal(waterHealDue(wadeKindAt(sc, 3.5, 1.5), flags, true), false, 'once a run');
  assert.equal(waterHealDue('hotspring', {}, true), true, 'a new run (its own flags) heals again');
  assert.equal(waterHurt({ hp: 10 }, 10), false);
  assert.equal(waterHurt({ hp: 9 }, 10), true);
  assert.equal(waterHurt({ hp: 10, status: 'burn' }, 10), true);
});

test('a reed gives what it hides once, as you pass it, the same reed from either side of a seam', () => {
  const sc = {
      props: [
        { k: 'bulrush', x: 4, z: 2 },
        { k: 'bulrush', x: 8, z: 2, hide: 'potion' },
      ],
    },
    flags = {};
  assert.equal(waterReedAt(sc, 4, 2, flags), null, 'a reed with nothing');
  assert.equal(waterReedAt(sc, 6, 2, flags), null, 'too far');
  const R = waterReedAt(sc, 7.4, 2.2, flags);
  assert.deepEqual(R, { k: 'potion', flag: waterReedFlag(8, 2) });
  flags[R.flag] = 1;
  assert.equal(waterReedAt(sc, 8, 2, flags), null, 'found already');
  /* a joined view whose box starts 5 m east sees the same reed at x 3 */
  const view = { props: [{ k: 'bulrush', x: 3, z: 2, hide: 'potion' }] };
  assert.equal(waterReedAt(view, 3, 2, flags, 5, 0), null, "the same reed in a neighbour's view");
});

test('a marsh or a bog draws more of its own Billies; other water and dry places as they are', () => {
  const wet = { tiles: ['gwg'], waterKind: 'swamp' };
  assert.equal(waterMarshOf(wet), 'swamp');
  assert.equal(waterMarshOf({ ...wet, waters: [{ x: 1, z: 0, w: 1, h: 1, k: 'bog' }] }), 'bog');
  assert.equal(waterMarshOf({ tiles: ['ggg'], waterKind: 'swamp' }), '', 'no water');
  assert.equal(waterMarshOf({ tiles: ['gwg'], waterKind: 'pond' }), '');
  const types = { a: ['Water'], b: ['Fire'], c: ['Ground'] },
    list = [
      ['a', 10],
      ['b', 10],
      ['c', 10],
    ],
    of = id => types[id];
  const marsh = Object.fromEntries(waterWildOdds(list, 'swamp', of)),
    bog = Object.fromEntries(waterWildOdds(list, 'bog', of));
  assert.ok(marsh.a > 10 && marsh.b === 10 && marsh.c === 10, JSON.stringify(marsh));
  assert.ok(bog.c > bog.a && bog.a > 10 && bog.b === 10, JSON.stringify(bog));
  assert.equal(waterWildOdds(list, '', of), list);
});
