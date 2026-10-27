'use strict';
/* ================= POCKET BILLIES STUDIO · world, rules, art ================= */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/test-globals.js';
import { poolRunTag, runValuesFill, standInMark, worldMapLookTab } from '../../game/js/hooks.js';
import { $ } from '../../game/js/util.js';
import { WILD_TYPE_BOOSTS } from '../../game/js/logic/weather.js';
import { escapeHtml } from './game-stand-ins.js';
import {
  ACTIONS,
  SECTIONS,
  afterRender,
  ask,
  card,
  changed,
  checkboxField,
  clone,
  commit,
  formatThousands,
  grid,
  numberField,
  paneRoot,
  readPath,
  render,
  selectField,
  speciesName,
  speciesOptions,
  studioState,
  textField,
  toast,
  typeOptions,
  uniqueKey,
} from './studio-app.js';
import { mountPreviews, spritePreviewHTML } from './sprites.js';
import { RARITY_LABELS } from './data-editors.js';
/* eslint-disable no-func-assign */
expose({
  AMBIENT_PARTICLES: [() => AMBIENT_PARTICLES],
  BOWL_SVG: [() => BOWL_SVG],
  FISHING_WATERS: [() => FISHING_WATERS],
  LOCATION_KINDS: [() => LOCATION_KINDS],
  WORLD_TABS: [() => WORLD_TABS],
  bindWorldMap: [() => bindWorldMap, v => (bindWorldMap = v)],
  bowlSpotXY: [() => bowlSpotXY],
  drawWorldMarkers: [() => drawWorldMarkers, v => (drawWorldMarkers = v)],
  weightTable: [() => weightTable, v => (weightTable = v)],
  worldBackdrops: [() => worldBackdrops, v => (worldBackdrops = v)],
  worldFishing: [() => worldFishing, v => (worldFishing = v)],
  worldMapHTML: [() => worldMapHTML, v => (worldMapHTML = v)],
  worldPools: [() => worldPools, v => (worldPools = v)],
  worldRegions: [() => worldRegions, v => (worldRegions = v)],
  xpCurveText: [() => xpCurveText, v => (xpCurveText = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
const LOCATION_KINDS = [
  'city',
  'town',
  'grass',
  'golf',
  'thicket',
  'grotto',
  'canyon',
  'bins',
  'food',
  'mall',
  'pond',
  'farm',
  'ridge',
  'sea',
  'island',
  'volcano',
  'pass',
  'summit',
  'lake',
  'feedl',
  'silicon',
  'spore',
  'trench',
  'vault',
  'spire',
];
/* phase 10: the world map is a bowl seen from above (game/js/logic/bowl.js): the rim is the outer circle, the floor
   the dashed one, Copperleaf in the middle. A place's spot is { a, r }: degrees counter-clockwise from east and the
   share of the way out to the rim; a place reached only by lift hangs under another. 100 units here are the rim. */
const BOWL_SVG = 100;
const bowlSpotXY = (D, r) => {
  let b = r && r.bowl;
  for (let k = 0; b && 'under' in b && k < 4; k++) {
    const p = D.locations.find(o => o.id === b.under);
    b = p && p.bowl;
  }
  if (!b || !('a' in b)) return [0, 0];
  const w = (b.a * Math.PI) / 180;
  return [b.r * Math.cos(w) * BOWL_SVG, -b.r * Math.sin(w) * BOWL_SVG];
};
function worldMapHTML() {
  return `<div class="wmap bowl" id="wmap"><svg viewBox="-135 -135 270 270" id="wmapSvg"></svg></div><p class="help">The bowl seen from above: the rim is the circle, Copperleaf in the middle (the bowl curves up all the way to the rim). Drag a marker to move a place. On the bowl a map's north faces the centre and its east runs counter-clockwise, so roads must leave the way their exits face: the checks (tools/test/bowl-layout.test.mjs) say which road turns too far. A place reached only by lift hangs under its parent and moves with it.</p>`;
}
function drawWorldMarkers() {
  const svg = $('#wmapSvg');
  if (!svg) return;
  const D = studioState.D;
  let h = `<circle r="${BOWL_SVG}" class="rim"/>`;
  const pts = D.locations.map(r => bowlSpotXY(D, r));
  (D.roads || []).forEach(l => {
    const { a, b, kind } = PB_DATA.road(D, l);
    if (kind === 'seam' && pts[a] && pts[b])
      h += `<line x1="${pts[a][0]}" y1="${pts[a][1]}" x2="${pts[b][0]}" y2="${pts[b][1]}" class="trail"/>`;
  });
  D.locations.forEach((r, i) => {
    const [x, y] = pts[i],
      under = r.bowl && 'under' in r.bowl;
    h += `<g class="mk ${r.town ? 'town' : ''} ${under ? 'reg' : ''} ${studioState.sel.stop === i ? 'on' : ''}" ${under ? '' : `data-mk="${i}"`} transform="translate(${x},${y + (under ? 7 : 0)})"><circle r="${r.town ? 3.2 : 2.6}"/><text y="${under ? 9 : -5}">${i + 1}. ${escapeHtml(r.name)}${under ? ' (by lift)' : ''}</text></g>`;
  });
  svg.innerHTML = h;
}
function bindWorldMap() {
  const svg = $('#wmapSvg');
  if (!svg) return;
  drawWorldMarkers();
  let drag = null;
  const pos = ev => {
    const m = svg.getScreenCTM();
    if (!m) return [0, 0];
    const p = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(m.inverse());
    return [p.x / BOWL_SVG, -p.y / BOWL_SVG];
  };
  svg.addEventListener('pointerdown', ev => {
    const g = ev.target.closest('[data-mk]');
    if (!g) return;
    drag = +g.dataset.mk;
    svg.setPointerCapture(ev.pointerId);
    if (studioState.sel.stop !== drag) {
      studioState.sel.stop = drag;
      render();
    }
  });
  svg.addEventListener('pointermove', ev => {
    if (drag == null) return;
    let [x, y] = pos(ev);
    const r = Math.hypot(x, y);
    if (r > 1) {
      x /= r;
      y /= r;
    }
    const a = Math.round((((Math.atan2(y, x) * 180) / Math.PI + 360) % 360) * 10) / 10;
    studioState.D.locations[drag].bowl = { a: a % 360, r: Math.round(Math.min(1, r) * 1000) / 1000 };
    drawWorldMarkers();
  });
  svg.addEventListener('pointerup', () => {
    if (drag != null) {
      drag = null;
      changed();
      commit(true);
      render();
    }
  });
}
/* Studio plan T4.5: what a run reads (a run place's wild Billies come from the pool its biome names, biomes.json pool)
   and what is legacy (the old world's regions and world map) */
const WORLD_TABS = [
  ['pools', 'Wild encounters'],
  ['fishing', 'Fishing'],
  ['regions', 'Map (legacy)'],
  ['backdrops', 'Battle backdrops'],
  ['look', 'World map look (legacy)'],
];
SECTIONS.world = () => {
  const D = studioState.D,
    /* SA-3: Route stops are gone (the hub's own place is edited under Hub island); the section opens on Wild encounters */
    tab = WORLD_TABS.some(([k]) => k === studioState.sel.wtab) ? studioState.sel.wtab : 'pools';
  const body = {
    pools: worldPools,
    fishing: worldFishing,
    regions: worldRegions,
    backdrops: worldBackdrops,
    look: worldMapLookTab,
  }[tab]();
  return `<div class="ed-col solo"><div class="ed-head"><h2>World & encounters</h2></div><p class="help world-run-note">A run reads the wild encounters of the pools its biomes name (<code>biomes.json pool</code>), at the run’s own levels, and the battle backdrops. The regions and world map are the old world’s (legacy); the hub’s own place is under Hub island.</p><div class="seg-row tabs">${WORLD_TABS.map(([k, n]) => `<button class="seg ${k === tab ? 'on' : ''}" data-act="wtab" data-t="${k}">${n}</button>`).join('')}</div>${body}</div>`;
};
ACTIONS.wtab = d => {
  studioState.sel.wtab = d.t;
  render();
};
function weightTable(base, P) {
  /* Studio plan T4.3: a legacy id's stand-in, from the logic worker, once the table is on the page */
  afterRender(runValuesFill);
  const tot = P.list.reduce((a, b) => a + (+b[1] || 0), 0);
  return `<table class="tbl"><thead><tr><th>Billie</th><th>Weight</th><th>Chance</th><th></th></tr></thead><tbody>${P.list
    .map(
      ([id, w], j) =>
        `<tr><td>${spritePreviewHTML({ sp: id, still: 1, cls: 'mini' })}${standInMark(id)} <select data-p="${base}.list.${j}.0" data-k="sel" data-rr="1">${speciesOptions()
          .map(([v, n]) => `<option value="${v}" ${v === id ? 'selected' : ''}>${escapeHtml(n)}</option>`)
          .join(
            ''
          )}</select></td><td><input type="number" min="1" data-p="${base}.list.${j}.1" data-k="num" value="${w}"></td><td>${tot ? Math.round((w / tot) * 100) : 0}%</td><td><button class="x" data-act="wDel" data-b="${base}" data-j="${j}">✕</button></td></tr>`
    )
    .join('')}</tbody></table><button class="btn" data-act="wAdd" data-b="${base}">Add a Billie</button>`;
}
ACTIONS.wDel = d => {
  readPath(d.b).list.splice(+d.j, 1);
  changed();
  render();
};
ACTIONS.wAdd = d => {
  readPath(d.b).list.push([studioState.D.lines[0].id + '0', 10]);
  changed();
  render();
};
function worldPools() {
  const D = studioState.D;
  afterRender(() => mountPreviews(paneRoot()));
  return (
    Object.entries(D.pools)
      .map(([k, P]) =>
        card(
          `Pool “${escapeHtml(k)}” ${poolRunTag(k)}`,
          grid(
            numberField('Lowest level', `pools.${k}.lv.0`, { min: 1, max: 100, step: 1 }),
            numberField('Highest level', `pools.${k}.lv.1`, { min: 1, max: 100, step: 1 })
          ) + weightTable(`pools.${k}`, P),
          {
            sub: `Used by: ${escapeHtml(
              D.locations
                .filter(r => r.pool === k)
                .map(r => r.name)
                .join(', ') || 'no stop'
            )}`,
            acts: `<button class="btn danger subtle" data-act="poolDel" data-k="${k}">Delete pool</button>`,
          }
        )
      )
      .join('') +
    `<div class="seg-row"><input id="newPool" type="text" placeholder="new pool name"><button class="btn primary" data-act="poolNew">+ New pool</button></div>`
  );
}
/* v25: what bites in each kind of water; levels are added to the place's own wild levels */
const FISHING_WATERS = {
  pond: 'Ponds',
  stream: 'Streams',
  lake: 'Lakes',
  sea: 'The sea',
  canal: 'Canals',
  swamp: 'Swamps',
  spring: 'Springs',
  ice: 'Ice holes',
};
function worldFishing() {
  const D = studioState.D;
  D.fishing = D.fishing || {};
  afterRender(() => mountPreviews(paneRoot()));
  return (
    `<p class="help">Fishing: stand by water on the Walk screen and tap Fish. What bites depends on the kind of water (set in Walk scenes → Kinds of water). Levels are the place’s own wild levels plus these.</p>` +
    Object.entries(FISHING_WATERS)
      .map(([k, n]) => {
        const P = D.fishing[k];
        if (!P)
          return card(
            n,
            `<button class="btn" data-act="fishAdd" data-k="${k}">+ Fish in ${escapeHtml(n.toLowerCase())}</button>`
          );
        return card(
          n,
          grid(
            numberField('Level bonus, low', `fishing.${k}.lv.0`, { min: 0, max: 20, step: 1 }),
            numberField('Level bonus, high', `fishing.${k}.lv.1`, { min: 0, max: 20, step: 1 })
          ) + weightTable(`fishing.${k}`, P)
        );
      })
      .join('')
  );
}
ACTIONS.fishAdd = d => {
  const D = studioState.D;
  (D.fishing = D.fishing || {})[d.k] = { lv: [0, 2], list: [[D.lines[0].id + '0', 10]] };
  changed();
  render();
};
ACTIONS.poolNew = () => {
  const D = studioState.D,
    k = uniqueKey($('#newPool').value || 'pool', x => !!D.pools[x]);
  D.pools[k] = { lv: [5, 8], list: [[D.lines[0].id + '0', 10]] };
  changed();
  render();
};
ACTIONS.poolDel = async d => {
  const D = studioState.D;
  if (D.locations.some(r => r.pool === d.k))
    return toast('A route stop still uses this pool. Pick another pool for it first.', 'err');
  if (!(await ask('Delete this pool?', 'Delete'))) return;
  delete D.pools[d.k];
  changed();
  render();
};
/* RL-R1: the old regions beyond the route are in game/data/legacy/regions.json (the Inner Sun); regions.json is the
   run's region themes now */
function worldRegions() {
  afterRender(bindWorldMap);
  return card('Map', worldMapHTML());
}
export const AMBIENT_PARTICLES = [
  ['pollen', 'Pollen'],
  ['spore', 'Spores'],
  ['drip', 'Drips'],
  ['sand', 'Blowing sand'],
  ['dust', 'Sparkling dust'],
  ['none', 'Nothing'],
];
function worldBackdrops() {
  const D = studioState.D;
  return Object.entries(D.battleStages)
    .map(([k, b]) => {
      const p = `battleStages.${k}`;
      return card(
        escapeHtml(b.name || k),
        /* phase 06-3: battles happen in the 3D place you stand; a stage is a name, indoors or not, and what floats in
           the air (the painted ground, far land, walls, sky and haze are gone) */
        grid(
          textField('Name', `${p}.name`),
          checkboxField('Indoors', `${p}.indoor`, { num: 1, rr: 1 }),
          selectField('In the air', `${p}.amb`, AMBIENT_PARTICLES)
        ),
        {
          sub: `id ${escapeHtml(k)} · used by ${escapeHtml(
            D.locations
              .filter(r => r.battleStage === k)
              .map(r => r.name)
              .concat(
                Object.values(D.trainers || {})
                  .filter(T => T.battleStage === k)
                  .map(T => T.name)
              )
              .join(', ') || 'nothing yet'
          )}`,
          acts: `<button class="btn subtle" data-act="bpArea" data-k="${k}" title="Open it in the battle preview">▶ Preview</button><button class="btn subtle" data-act="bdDup" data-k="${k}">Duplicate</button>`,
        }
      );
    })
    .join('');
}
ACTIONS.bdDup = d => {
  const D = studioState.D,
    k = uniqueKey(d.k + 'b', x => !!D.battleStages[x]);
  D.battleStages[k] = clone(D.battleStages[d.k]);
  D.battleStages[k].name = (D.battleStages[k].name || d.k) + ' (copy)';
  D.battleStages[k].art = D.battleStages[d.k].art || d.k;
  changed();
  render();
};
/* ================= RULES ================= */
SECTIONS.rules = () => {
  const D = studioState.D,
    R = D.rules,
    s = 'rules.start',
    pg = 'rules.progression',
    eg = 'rules.eggs',
    bt = 'rules.battle',
    ca = 'rules.catching';
  const starters = `<div class="chips">${D.lines.map(L => `<label class="chk-chip"><input type="checkbox" data-act-chk="starter" value="${L.id}" ${R.start.starters.includes(L.id) ? 'checked' : ''}> ${escapeHtml(L.names[0])}</label>`).join('')}</div>`;
  const rival = R.start.starters
    .map(l =>
      selectField(`Rival’s pick if you choose ${escapeHtml(speciesName(l + '0'))}`, `${s}.rival.${l}`, speciesOptions())
    )
    .join('');
  const xpPrev = `<p class="help" id="xpPrev">${xpCurveText()}</p>`;
  const coinsStart = `<div class="grid">${Object.keys(D.pyramids)
    .map(c => numberField(D.pyramids[c].n, `${s}.pyramids.${c}`, { min: 0, step: 1 }))
    .join('')}${Object.keys(D.items)
    .map(i => numberField(D.items[i].n, `${s}.items.${i}`, { opt: 1, min: 0, step: 1 }))
    .join('')}</div>`;
  const rar = `<div class="grid">${Object.keys(R.catching.rarity)
    .map(k => numberField(`${RARITY_LABELS[k] || k}`, `${ca}.rarity.${k}`, { min: 0, max: 1, step: 0.01 }))
    .join(
      ''
    )}${R.catching.evolved.map((v, i) => numberField(`Evolved stage ${i + 2}`, `${ca}.evolved.${i}`, { min: 0, max: 1, step: 0.01 })).join('')}</div>`;
  const totals = `<div class="grid">${Object.entries(D.rarities)
    .map(([k, v]) =>
      v.totals
        .map((t, i) =>
          numberField(`${RARITY_LABELS[k] || k} · stage ${i + 1}`, `rarities.${k}.totals.${i}`, {
            min: 50,
            max: 900,
            step: 5,
          })
        )
        .join('')
    )
    .join('')}</div>`;
  return `<div class="ed-col solo"><div class="ed-head"><h2>Rules</h2><p class="sub">Every number here changes how the game plays. Defaults match the original game.</p></div>
 ${card(
   'What’s new',
   grid(textField('Version', 'meta.whatsNew.0.version', { opt: 1, ph: '0.1.0 alpha' })) +
     textField('What changed (a line each)', 'meta.whatsNew.0.text', { area: 1, rows: 4, opt: 1 }),
   {
     sub: 'Shown on the title under What’s new: the newest version, a few lines for players. (SA-3: moved here from World & encounters.)',
   }
 )}
 ${card(
   'Starting out',
   grid(
     selectField(
       'Where a new game starts',
       `${s}.locationId`,
       (D.locations || []).filter(r => r.town || r.kind === 'town').map(r => [r.id, r.name]),
       { none: 'The first stop', opt: 1 }
     ),
     numberField('Moneys', `${s}.se`, { min: 0, step: 50 }),
     numberField('Starter’s level', `${s}.starterLevel`, { min: 1, max: 100, step: 1 }),
     numberField('Encounters waiting', `${s}.starterEncounters`, { min: 0, max: 10, step: 1 })
   ) +
     '<h4>Pyramids and items</h4>' +
     coinsStart +
     '<h4>Starter choices</h4>' +
     starters +
     '<h4>Rival</h4>' +
     grid(rival)
 )}
 ${card(
   'Encounters',
   grid(
     numberField('Wild Billies on a route', `rules.encounters.route`, { min: 0, max: 10, step: 1 }),
     numberField('Wild Billies in a town with tall grass', `rules.encounters.townGrass`, {
       min: 0,
       max: 10,
       step: 1,
       help: 'Towns without tall grass and rooms have none.',
     }),
     numberField('One more wanders over every', `rules.encounters.refillMs`, {
       min: 5000,
       step: 5000,
       unit: 'ms',
       help: 'Of play time, until the place is full again.',
     }),
     numberField('Alpha odds: 1 in', `rules.encounters.alphaOdds`, {
       min: 2,
       step: 1,
       ph: '45',
       help: 'How rare an Alpha is among new encounters (once you have two Billies).',
     }),
     numberField('Prize for beating a wild Billie', `rules.encounters.prizePerLevel`, {
       min: 0,
       step: 1,
       unit: '$ a level',
       help: 'A level 10 Billie pays ten times this.',
     })
   )
 )}
 ${card(
   'Leveling',
   grid(
     numberField('XP curve factor', `${pg}.xpFactor`, {
       min: 0.1,
       max: 3,
       step: 0.05,
       help: 'XP to reach level L = factor × L³.',
     }),
     numberField('Highest level', `${pg}.maxLevel`, { min: 5, max: 250, step: 1 }),
     numberField('Team size', `${pg}.teamSize`, { min: 1, max: 12, step: 1 }),
     numberField('Move slots', `${pg}.moveSlots`, { min: 1, max: 8, step: 1 }),
     ...R.progression.xpYield.map((v, i) =>
       numberField(`XP for beating stage ${i + 1}`, `${pg}.xpYield.${i}`, { min: 1, step: 5 })
     ),
     numberField('Trainer battle XP bonus', `${pg}.trainerXpMult`, { min: 1, max: 5, step: 0.1, unit: '×' }),
     numberField('Bench XP share', `${pg}.teamXpShare`, {
       min: 0,
       max: 1,
       step: 0.05,
       help: 'Teammates who didn’t fight get this fraction.',
     })
   ) +
     xpPrev +
     '<h4>Stat totals by rarity</h4>' +
     totals
 )}
 ${card(
   'Eggs',
   grid(
     numberField('Eggs carried', `${eg}.capacity`, { min: 1, max: 30, step: 1 }),
     numberField('Incubators', `${eg}.slots`, { min: 1, max: 6, step: 1 }),
     numberField('Mythical odds, biggest egg: 1 in', `${eg}.mythOdds`, { min: 2, step: 1 }),
     selectField('The mythical', `${eg}.mythSpecies`, speciesOptions())
   )
 )}
 ${card(
   'Time and weather',
   grid(
     checkboxField('Billies ignore the hour and the weather', `rules.env.off`, {
       help: 'Off: some come out more at night, in the rain, in the snow and so on (the table below).',
     }),
     checkboxField('Weather doesn’t change battles', `rules.env.battleOff`, {
       help: 'Off: in the rain Water moves hit harder and Fire moves fizzle, at night Psychic and Dragon moves are stronger, and so on (v28).',
     })
   ) +
     `<details class="sub-d"><summary>Who comes out when (how much more often, by type; empty = the built-in value)</summary>${Object.entries(
       typeof WILD_TYPE_BOOSTS !== 'undefined' ? WILD_TYPE_BOOSTS : {}
     )
       .map(
         ([k, F]) =>
           `<h4>${escapeHtml({ night: 'At night', dusk: 'At dusk and dawn', sunny: 'On a fair day', rain: 'In the rain', storm: 'In a thunderstorm', snow: 'In the snow', fog: 'In fog', ash: 'In falling ash' }[k] || k)}</h4><div class="grid">${D.types.map(t => numberField(t.id, `rules.env.likes.${k}.${t.id}`, { opt: 1, min: 0, max: 5, step: 0.05, unit: '×', ph: F[t.id] != null ? String(F[t.id]) : '1' })).join('')}</div>`
       )
       .join('')}</details>`
 )}
 ${card('Riding across water', grid(numberField('Smallest Billie you can ride', `rules.ride.minHeight`, { unit: 'm', min: 0.3, max: 10, step: 0.1, help: 'Its height in the Field Guide. Needed for lake and sea crossings (stops marked as a water crossing).' })))}
 ${card(
   'Battle',
   grid(
     numberField('Same-type bonus', `${bt}.stab`, { unit: '×', min: 1, max: 3, step: 0.05 }),
     numberField('Critical damage', `${bt}.critMult`, { unit: '×', min: 1, max: 4, step: 0.05 }),
     ...R.battle.critChances.map((v, i) =>
       numberField(`Critical chance at +${i}`, `${bt}.critChances.${i}`, { min: 0, max: 1, step: 0.005 })
     ),
     numberField('Lowest damage roll', `${bt}.rollMin`, { min: 0.1, max: 1, step: 0.01 }),
     numberField('Status damage: 1 /', `${bt}.drainFraction`, {
       min: 2,
       max: 64,
       step: 1,
       help: 'Burn, sandstorm and Regrowth move this fraction of max HP each turn.',
     }),
     numberField('Sharp stones: 1 /', `${bt}.stonesFraction`, { min: 2, max: 64, step: 1 }),
     numberField('Paralysis lost-turn chance', `${bt}.paralysisSkip`, { min: 0, max: 1, step: 0.05 }),
     numberField('Confusion turns', `${bt}.hypeTurns`, { min: 1, max: 10, step: 1 }),
     numberField('Confusion self-hit chance', `${bt}.hypeSelfHit`, { min: 0, max: 1, step: 0.05 }),
     numberField('Sleep turns, least', `${bt}.subpoenaMin`, { min: 1, max: 10, step: 1 }),
     numberField('Sleep turns, most', `${bt}.subpoenaMax`, { min: 1, max: 10, step: 1 }),
     numberField('Stat stage limit', `${bt}.stageMax`, { min: 1, max: 12, step: 1 }),
     numberField('Trainer smarts', `${bt}.aiSmart`, {
       min: 0,
       max: 1,
       step: 0.05,
       help: 'Chance a trainer picks its best move.',
     }),
     numberField('Rest stop price (Moneys)', `${bt}.restCost`, { min: 0, step: 10 }),
     numberField('Losing fee', `${bt}.loseFee`, {
       min: 0,
       max: 1,
       step: 0.01,
       help: 'Fraction of your Moneys paid when your team is wiped out.',
     }),
     numberField('Strongest move power cap (doubling moves)', `${bt}.holdCap`, { min: 40, step: 10 }),
     numberField('Delayed attack turns', `${bt}.mailTurns`, { min: 1, max: 6, step: 1 })
   ) +
     '<h4>Type abilities</h4>' +
     grid(
       numberField('Wild Mind roll, low', `${bt}.wildMindRollMin`, { min: 0, max: 1, step: 0.05 }),
       numberField('Wild Mind roll, high', `${bt}.wildMindRollMax`, { min: 1, max: 3, step: 0.05 }),
       numberField('Live Wire: extra critical stages', `${bt}.liveWireCrit`, { min: 0, max: 3, step: 1 }),
       numberField('Kindling: Attack boost per turn', `${bt}.kindlingBoost`, { min: 0, max: 1, step: 0.01 }),
       numberField('Kindling turns', `${bt}.kindlingTurns`, { min: 1, max: 30, step: 1 }),
       numberField('Alloy bonus per teammate', `${bt}.alloyBoost`, { min: 0, max: 1, step: 0.01 }),
       numberField('Undertow boost', `${bt}.undertowMult`, { unit: '×', min: 1, max: 3, step: 0.05 }),
       numberField('Undertow below this share of HP', `${bt}.undertowHp`, { min: 0, max: 1, step: 0.01 }),
       selectField('Sandstorm type', `${bt}.shockType`, typeOptions()),
       numberField('Sandstorm boost', `${bt}.oilShockMult`, { unit: '×', min: 1, max: 3, step: 0.05 }),
       numberField('Sandstorm turns', `${bt}.shockTurns`, { min: 1, max: 20, step: 1 }),
       selectField('Soak turns the target into', `${bt}.spinType`, typeOptions()),
       numberField('Soak turns', `${bt}.spinTurns`, { min: 1, max: 10, step: 1 }),
       numberField('Fork turns (copied types)', `${bt}.forkTurns`, { min: 1, max: 10, step: 1 })
     ) +
     '<h4>Alphas and team battles</h4>' +
     grid(
       numberField('Alpha HP', `${bt}.alphaHp`, { unit: '×', min: 1, max: 10, step: 0.1, ph: '3' }),
       numberField('Alpha stats', `${bt}.alphaStats`, { unit: '×', min: 1, max: 3, step: 0.05, ph: '1.3' }),
       numberField('Alpha extra levels', `${bt}.alphaLevels`, { min: 0, max: 20, step: 1, ph: '3' }),
       numberField('Alpha moves per turn', `${bt}.alphaActs`, { min: 1, max: 4, step: 1, ph: '2' }),
       numberField('Your Billies against an Alpha', `${bt}.alphaTeam`, { min: 1, max: 3, step: 1, ph: '3' }),
       numberField('Alpha XP', `${bt}.alphaXp`, { unit: '×', min: 1, max: 10, step: 0.5, ph: '3' }),
       numberField('A caught Alpha keeps', `${bt}.alphaKeep`, {
         unit: '×',
         min: 1,
         max: 1.5,
         step: 0.01,
         ph: '1.08',
         help: 'Its stats compared with others of its kind.',
       }),
       numberField('Alpha shrugs off sleep', `${bt}.alphaSleepResist`, { min: 0, max: 1, step: 0.05, ph: '0.5' }),
       numberField('Moves that hit every foe', `${bt}.spreadMult`, {
         unit: '×',
         min: 0.3,
         max: 1,
         step: 0.05,
         ph: '0.75',
         help: 'Their power when there is more than one foe.',
       })
     )
 )}
 ${card(
   'Catching',
   '<h4>Base catch rate</h4>' +
     rar +
     grid(
       numberField('HP factor', `${ca}.hpFactor`, {
         min: 0,
         max: 1,
         step: 0.01,
         help: 'At full HP the rate is multiplied by (1 − this).',
       }),
       numberField('Asleep bonus', `${ca}.asleepCatch`, { unit: '×', min: 1, max: 5, step: 0.1 }),
       numberField('Other status bonus', `${ca}.status`, { unit: '×', min: 1, max: 5, step: 0.1 }),
       numberField('Soak bonus', `${ca}.spin`, { unit: '×', min: 1, max: 3, step: 0.05 }),
       numberField('Perfect ring bonus', `${ca}.ring`, {
         min: 0,
         max: 2,
         step: 0.05,
         help: 'A perfect throw multiplies the odds by 1 + this.',
       }),
       numberField('Balances-on-its-tip chance (a sure catch)', `${ca}.edge`, { min: 0, max: 0.2, step: 0.005 }),
       numberField('Alpha catch rate', `${ca}.alpha`, { unit: '×', min: 0.05, max: 1, step: 0.05, ph: '0.4' }),
       numberField('Pyramid penalty for luxury lines', `${ca}.luxuryPyramid`, {
         unit: '×',
         min: 0,
         max: 1,
         step: 0.05,
       })
     ) +
     '<h4>Luxury lines (sneer at plain Pyramids)</h4>' +
     `<div class="chips">${D.lines.map(L => `<label class="chk-chip"><input type="checkbox" data-act-chk="luxury" value="${L.id}" ${R.catching.luxury.includes(L.id) ? 'checked' : ''}> ${escapeHtml(L.names[0])}</label>`).join('')}</div>`
 )}</div>`;
};
function xpCurveText() {
  const f = studioState.D.rules.progression.xpFactor;
  return [5, 10, 20, 36, 50, 100].map(L => `Lv ${L}: ${formatThousands(Math.floor(f * L * L * L))} XP`).join(' · ');
}
studioState.hooks.rules = path => {
  if (path.includes('xpFactor')) {
    const e = $('#xpPrev');
    if (e) e.textContent = xpCurveText();
  }
};
document.addEventListener('change', ev => {
  const el = ev.target,
    k = el.dataset.actChk;
  if (!k) return;
  const R = studioState.D.rules,
    arr = k === 'starter' ? R.start.starters : R.catching.luxury,
    v = el.value;
  const i = arr.indexOf(v);
  if (el.checked && i < 0) arr.push(v);
  if (!el.checked && i >= 0) arr.splice(i, 1);
  if (k === 'starter') {
    if (!arr.length) {
      arr.push(v);
      el.checked = true;
      return toast('Keep at least one starter.', 'err');
    }
    if (el.checked && !R.start.rival[v]) R.start.rival[v] = studioState.D.lines[0].id + '0';
  }
  changed();
  commit(true);
  if (k === 'starter') render();
});
