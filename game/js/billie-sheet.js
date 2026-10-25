'use strict';
/* ================= BILLIE SHEET ================= */
/* UI-5: a Billie's details sheet (Summary, Build, Moves, Evolves) and the pickers it opens, moved from ui.js as they were; its buttons in billieSheetAction, called from ui.js's click switch at the same place */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { billyUnit, render, unitBotBuildHTML, unitBuildHTML } from './hooks.js';
import { $ } from './util.js';
import { ITEMS, LINE_BY_ID, LOCATIONS, MOVES, SPECIES, STAT_IDS, STAT_NAMES } from './game-data.js';
import { graftOf } from './logic/graft-art.js';
import { isRobot, speciesOf } from './logic/fighters.js';
import {
  allBillies,
  billyName,
  billyPrime,
  billyTypes,
  cleanName,
  evolutionHint,
  feedLevels,
  findBilly,
  maxHp,
  partSlots,
  stat,
  teamSize,
  toBox,
  toTeam,
} from './logic/rules.js';
import { heldGive, heldIds, heldTake } from './logic/held.js';
import { applyItem, canUse } from './logic/battle-engine.js';
import { escapeHtml, save, saveData, uiState } from './game-state.js';
import { uiIconHTML } from './art.js';
import { rigCanvasHTML } from './skeleton-rig.js';
import { itemIcon } from './battle.js';
import { hpBar, progressBarHTML, typeBadgeHTML } from './ui-bits.js';
import { closeModal, modal, nextModal, toast } from './overlay.js';
import { runEvolution } from './pending-windows.js';
import { billyConditionHTML, meter, needsCare, plateVars, xpLeft, xpProgress } from './team.js';
/* eslint-disable no-func-assign */
expose({
  addPick: [() => addPick, v => (addPick = v)],
  billieSheetAction: [() => billieSheetAction, v => (billieSheetAction = v)],
  billySheet: [() => billySheet, v => (billySheet = v)],
  donateItem: [() => donateItem, v => (donateItem = v)],
  healPick: [() => healPick, v => (healPick = v)],
  heldPick: [() => heldPick, v => (heldPick = v)],
  swapPick: [() => swapPick, v => (swapPick = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
function donateItem() {
  const k = Object.keys(ITEMS)
    .filter(k => !ITEMS[k].evoItem && saveData.items[k] > 0)
    .sort((a, b) => saveData.items[b] - saveData.items[a])[0];
  return k || null;
}
function billySheet(m) {
  const s = speciesOf(m),
    inTeam = saveData.team.includes(m),
    e = s.evo,
    mx = maxHp(m),
    lead = saveData.team[0] === m,
    bud = saveData.buddy === m.uid,
    acts = [];
  const nick = {
    f: () => {
      const nn = cleanName($('#nick').value, 16),
        changed = nn && nn !== m.nick;
      m.nick = nn;
      save();
      if (changed && e && e.k === 'rename' && m.lvl >= e.min) {
        runEvolution(m, 'It loves its new name.');
        return;
      }
      closeModal();
      render();
      toast(nn ? `Nickname saved: ${nn}.` : 'Nickname cleared.');
    },
  };
  if (inTeam && !lead)
    acts.push({
      ic: 'spark',
      l: m.hp > 0 ? 'Make lead' : 'Fainted, can’t lead',
      dis: m.hp <= 0,
      f: () => {
        saveData.team.splice(saveData.team.indexOf(m), 1);
        saveData.team.unshift(m);
        save();
        closeModal();
        render();
        toast(`${billyName(m)} leads the team now.`);
      },
    });
  if (!bud)
    acts.push({
      ic: 'walk',
      l: 'Make buddy',
      f: () => {
        saveData.buddy = m.uid;
        save();
        closeModal();
        render();
        toast(`${billyName(m)} is your buddy now.`);
      },
    });
  if (needsCare(m))
    acts.push({
      ic: 'heart',
      l: 'Heal',
      c: 'green',
      f: () => {
        uiState.modal = null;
        healPick(m, true);
      },
    });
  if (inTeam && saveData.team.length > 1 && !saveData.run)
    acts.push({
      ic: 'bag',
      l: 'Move to storage',
      f: () => {
        toBox(m);
        save();
        closeModal();
        render();
        toast(`${billyName(m)} is resting in storage.`);
      },
    });
  if (!inTeam)
    acts.push(
      saveData.team.length < teamSize()
        ? {
            ic: 'team',
            l: 'Move to team',
            f: () => {
              toTeam(m);
              save();
              closeModal();
              render();
              toast(`${billyName(m)} joined your team.`);
            },
          }
        : {
            ic: 'team',
            l: 'Swap into team',
            f: () => {
              uiState.modal = null;
              swapPick(m);
            },
          }
    );
  if (e && e.k === 'item' && m.lvl >= e.min) {
    const ik = e.item || 'bell',
      I = ITEMS[ik] || { n: 'Shining Stone' },
      have = saveData.items[ik] || 0;
    acts.push({
      ic: 'spark',
      l: have ? `Use ${I.n} (${have} left)` : `Use ${I.n} (you have none)`,
      c: have ? 'gold' : '',
      dis: !have,
      f: () => {
        saveData.items[ik]--;
        runEvolution(m, `The ${I.n} began to glow.`);
      },
    });
  }
  /* RL-12c: the held-item slot: give one from the bag (swapping the one held), or take it off */
  const heldBag = heldIds(ITEMS).filter(k => saveData.items[k] > 0 && k !== m.held);
  if (heldBag.length)
    acts.push({
      ic: 'bag',
      l: m.held ? 'Swap held item' : 'Give a held item',
      f: () => {
        uiState.modal = null;
        heldPick(m);
      },
    });
  if (m.held)
    acts.push({
      ic: 'bag',
      l: `Take off ${escapeHtml((ITEMS[m.held] || { n: 'item' }).n)}`,
      f: () => {
        const n = (ITEMS[m.held || ''] || { n: 'item' }).n;
        heldTake(saveData, m);
        save();
        uiState.modal = null;
        render();
        billySheet(m);
        toast(`${n} went back in your bag.`);
      },
    });
  /* RL-12b: a level item (the Protein Bar), never in battle */
  for (const ik of Object.keys(ITEMS).filter(k => ITEMS[k].lvlUp && saveData.items[k] > 0 && !isRobot(m)))
    acts.push({
      ic: 'plus',
      l: `Feed a ${ITEMS[ik].n} (${saveData.items[ik]} left)`,
      f: () => {
        const said = /** @type {string[]} */ ([]);
        if (!feedLevels(m, ITEMS[ik].lvlUp || 1, t => said.push(t))) {
          toast(`${billyName(m)} can't grow any more.`);
          return;
        }
        saveData.items[ik]--;
        save();
        closeModal();
        render();
        toast(said.join(' '));
      },
    });
  if (e && e.k === 'donate') {
    const it = donateItem();
    acts.push({
      c: 'gold',
      ic: 'spark',
      l: it ? `Give away a ${ITEMS[it].n}` : 'Give away an item (you have none)',
      dis: !it,
      f: () => {
        saveData.items[it]--;
        m.donated = (m.donated || 0) + 1;
        save();
        if (m.donated >= e.n && m.lvl >= e.min) {
          runEvolution(m, 'Its kindness paid off.');
          return;
        }
        toast(`${billyName(m)} gave away a ${ITEMS[it].n}. ${m.donated} of ${e.n}.`);
        closeModal();
        render();
      },
    });
  }
  if (e && e.k === 'merge' && m.lvl >= e.min) {
    const other = allBillies()
      .filter(o => o !== m && o.sp === m.sp)
      .sort((x, y) => x.lvl - y.lvl)[0];
    acts.push({
      c: 'gold',
      ic: 'spark',
      l: other ? `Combine with another ${s.name}` : `Combine (needs another ${s.name})`,
      dis: !other,
      f: () => {
        uiState.modal = null;
        modal({
          title: `Combine two ${s.name}s?`,
          html: `<p>${escapeHtml(billyName(other))} (Lv ${other.lvl}) will join with ${escapeHtml(billyName(m))}. This can’t be undone.</p>`,
          btns: [
            {
              l: 'Combine them',
              c: 'dark',
              f: () => {
                saveData.team = saveData.team.filter(x => x !== other);
                saveData.box = saveData.box.filter(x => x !== other);
                if (saveData.buddy === other.uid) saveData.buddy = m.uid;
                runEvolution(m, 'The two became one.');
              },
            },
            { l: 'Cancel', c: 'quiet', f: closeModal },
          ],
        });
      },
    });
  }
  /* alpha 0.5: the details open on a summary (meters, a stat chart, where it joined you, what it's like), with tabs
    for the exact stats, the moves and how it evolves */
  const base = s.base || [],
    st = STAT_IDS.map((k, i) => {
      const v = k === 'hp' ? mx : stat(m, k),
        b = base[i] || 0;
      return `<div class="ms-bar"><span>${STAT_NAMES[k]}</span><i><b style="width:${Math.round(Math.min(1, b / 150) * 100)}%;--c:${['#4E9A4A', '#D9532F', '#E3A12F', '#3478C8', '#7D52C2', '#2BA7A0'][i] || '#888'}"></b></i><em class="tnum">${v}</em></div>`;
    }).join('');
  const metR = m.met
    ? (() => {
        const r = LOCATIONS.find(x => (x.id || '') === m.met.n) || LOCATIONS[m.met.n];
        return `<div class="ms-met">${uiIconHTML('flag', 14)}<span>Joined you in <b>${escapeHtml(r ? r.name : 'a place that’s gone')}</b> · ${new Date(m.met.t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</span></div>`;
      })()
    : '';
  /* RL-12c: what it holds */
  const HI = m.held ? ITEMS[m.held] : null,
    heldR = HI
      ? `<div class="ms-met">${itemIcon(m.held || '', 14)}<span>Holding <b>${escapeHtml(HI.n)}</b> · ${escapeHtml(HI.d.replace(/^Held: /, ''))}</span></div>`
      : '';
  const line = LINE_BY_ID[s.line],
    evo = line
      ? line.names
          .map((n, i) => {
            const id = s.line + i;
            if (!SPECIES[id]) return '';
            const seen = saveData.seen[id] || saveData.caught[id] || id === m.sp;
            return `<div class="ms-evo ${id === m.sp ? 'on' : ''}">${seen ? rigCanvasHTML(id, 64, {}) : '<span class="ms-q">?</span>'}<b>${seen ? escapeHtml(SPECIES[id].name) : '???'}</b></div>`;
          })
          .join('<span class="ms-arr" aria-hidden="true">›</span>')
      : '';
  const tabs = [
    ['sum', 'Summary'],
    ['build', 'Build'],
    ['moves', 'Moves'],
    ['evo', 'Evolves'],
  ];
  modal({
    title: escapeHtml(billyName(m)),
    cls: 'mon-sheet',
    acts,
    top: `<div class="ms-plate" style="${plateVars(m)}">${lead ? '<span class="tm-ribbon">Lead</span>' : ''}${bud ? `<span class="tm-ribbon bud">${uiIconHTML('heart', 11)} Buddy</span>` : ''}${!isRobot(m) && billyPrime(m) ? '<span class="tm-ribbon prime">Prime</span>' : ''}${rigCanvasHTML(m.sp, 128, { build: m.build, coat: m.coat, graft: graftOf(m) })}</div>`,
    html: `<p class="row ms-chips">${billyTypes(m).map(typeBadgeHTML).join('')}${billyConditionHTML(m)}<b class="lv tnum">Lv ${m.lvl}</b>${m.nick ? `<span class="ms-sp">${escapeHtml(s.name)}</span>` : ''}</p>
  <div class="ms-tabs" role="tablist" aria-label="About ${escapeHtml(billyName(m))}" data-on="sum">${tabs.map(([k, l]) => `<button role="tab" data-a="ms-tab" data-k="${k}" aria-selected="${k === 'sum'}">${l}</button>`).join('')}</div>
  <div class="ms-pane" data-k="sum"><div class="ms-meters">${meter('HP', hpBar(m.hp, mx), `${m.hp}/${mx}`)}${meter('XP', progressBarHTML(xpProgress(m), 'xpb'), xpLeft(m))}</div>
   <div class="ms-chart">${st}</div>${metR}${heldR}
   ${acts.length ? `<div class="ms-acts">${acts.map((b, i) => `<button class="pb small ${b.c || ''}" data-a="mact" data-i="${i}" ${b.dis ? 'disabled' : ''}>${b.ic ? uiIconHTML(b.ic, 15) : ''}<span>${b.l}</span></button>`).join('')}</div>` : ''}
   <p class="note ms-about">${escapeHtml(s.blurb)}</p>
   <div class="ms-nick"><label class="field-l">Nickname<input id="nick" maxlength="16" value="${escapeHtml(m.nick)}" placeholder="${escapeHtml(s.name)}" autocomplete="off" enterkeyhint="done"></label><button class="pb small" data-a="mnick">Save</button></div></div>
  <div class="ms-pane" data-k="build" hidden>${isRobot(m) ? unitBotBuildHTML(m) : unitBuildHTML(billyUnit(m), partSlots())}</div>
  <div class="ms-pane" data-k="moves" hidden><div class="mvlist">${m.moves
    .map(id => {
      const M = MOVES[id];
      return `<div class="mvi"><div class="mh"><span>${M.n}</span>${typeBadgeHTML(M.t)}</div><div class="md">${M.p ? `${M.p} power, ${M.a}% accuracy. ` : ''}${M.d}</div></div>`;
    })
    .join('')}</div></div>
  <div class="ms-pane" data-k="evo" hidden>${evo ? `<div class="ms-line">${evo}</div>` : ''}<p class="note">${escapeHtml(evolutionHint(m))}</p></div>`,
    nick,
    btns: [{ l: 'Close', c: 'quiet', f: closeModal }],
  });
}
/* pick an item to heal one billionaire; back=true returns to its sheet afterwards */
document.addEventListener('click', ev => {
  const b = ev.target.closest && ev.target.closest('[data-a="ms-tab"]');
  if (!b) return;
  const box = b.closest('.sheet') || document;
  const k = b.dataset.k;
  box.querySelectorAll('[data-a="ms-tab"]').forEach(x => x.setAttribute('aria-selected', String(x.dataset.k === k)));
  box.querySelectorAll('.ms-pane').forEach(p => (p.hidden = p.dataset.k !== k));
});
function healPick(m, back) {
  const its = Object.keys(ITEMS).filter(k => canUse(k, m));
  modal({
    title: `Heal ${escapeHtml(billyName(m))}`,
    html: `<div class="ms-meters">${meter('HP', hpBar(m.hp, maxHp(m)), `${m.hp}/${maxHp(m)}`)}</div>${
      its.length
        ? `<div class="list">${its.map(k => `<button class="pickrow" data-a="mhealuse" data-u="${m.uid}" data-it="${k}"${back ? ' data-b="1"' : ''}>${itemIcon(k, 34)}<span class="pr-t"><b>${escapeHtml(ITEMS[k].n)}</b><small>${escapeHtml(ITEMS[k].d)}</small></span><span class="pr-n tnum">×${saveData.items[k]}</span></button>`).join('')}</div>`
        : `<p>None of your items can help right now.</p><p class="note">Rest at a town clinic for free, or buy Potions at a town shop.</p>`
    }`,
    btns: [
      {
        l: 'Cancel',
        c: 'quiet',
        f: () => {
          if (back) {
            uiState.modal = null;
            billySheet(m);
          } else closeModal();
        },
      },
    ],
  });
}
/* RL-12c: pick a held item from the bag for a Billie (back to its sheet afterwards) */
function heldPick(m) {
  const its = heldIds(ITEMS).filter(k => saveData.items[k] > 0 && k !== m.held);
  modal({
    title: `Give ${escapeHtml(billyName(m))} an item to hold`,
    html: `${m.held ? `<p class="note">It gives back its ${escapeHtml(ITEMS[m.held].n)}.</p>` : ''}<div class="list">${its.map(k => `<button class="pickrow" data-a="mheldgive" data-u="${m.uid}" data-it="${k}">${itemIcon(k, 34)}<span class="pr-t"><b>${escapeHtml(ITEMS[k].n)}</b><small>${escapeHtml(ITEMS[k].d)}</small></span><span class="pr-n tnum">×${saveData.items[k]}</span></button>`).join('')}</div>`,
    btns: [
      {
        l: 'Cancel',
        c: 'quiet',
        f: () => {
          uiState.modal = null;
          billySheet(m);
        },
      },
    ],
  });
}
/* the team is full: pick who goes to storage so another can join */
function swapPick(m) {
  modal({
    title: `Swap in ${escapeHtml(billyName(m))}`,
    html: `<p class="note">Your team is full. Pick who rests in storage instead.</p><div class="list">${saveData.team.map((o, i) => `<button class="pickrow" data-a="mswap" data-u="${m.uid}" data-o="${o.uid}">${rigCanvasHTML(o.sp, 40, { build: o.build, coat: o.coat, graft: graftOf(o) })}<span class="pr-t"><b>${escapeHtml(billyName(o))}</b><small>Lv ${o.lvl}${i === 0 ? ', your lead' : ''}${o.uid === saveData.buddy ? ', buddy' : ''}</small></span></button>`).join('')}</div>`,
    btns: [{ l: 'Cancel', c: 'quiet', f: closeModal }],
  });
}
function addPick() {
  const free = saveData.box.slice().sort((a, b) => b.lvl - a.lvl);
  modal({
    title: 'Add to your team',
    html: `<div class="list">${
      free
        .map(
          m =>
            `<button class="pickrow" data-a="tmaddon" data-u="${m.uid}">${rigCanvasHTML(m.sp, 40, { build: m.build, coat: m.coat, graft: graftOf(m) })}<span class="pr-t"><b>${escapeHtml(billyName(m))}</b><small>Lv ${m.lvl}, ${billyTypes(
              m
            )
              .map(t => (t === 'None' ? 'Normal' : t))
              .join(' and ')}</small></span></button>`
        )
        .join('') || '<p>Storage is empty.</p>'
    }</div>`,
    btns: [{ l: 'Cancel', c: 'quiet', f: closeModal }],
  });
}
/* the sheet's buttons (UI-5: the cases of ui.js's click switch, as they were) */
export function billieSheetAction(a, d) {
  switch (a) {
    case 'mon': {
      const m = findBilly(d.u);
      if (m) billySheet(m);
      break;
    }
    case 'mact': {
      const b = uiState.modal && uiState.modal.acts && uiState.modal.acts[+d.i];
      if (b && !b.dis) b.f();
      break;
    }
    case 'mnick':
      if (uiState.modal && uiState.modal.nick) uiState.modal.nick.f();
      break;
    case 'mlead': {
      const m = findBilly(d.u);
      if (m && saveData.team.includes(m) && m.hp > 0) {
        saveData.team.splice(saveData.team.indexOf(m), 1);
        saveData.team.unshift(m);
        save();
        render();
        toast(`${billyName(m)} leads the team now.`);
      }
      break;
    }
    case 'mbuddy': {
      const m = findBilly(d.u);
      if (m) {
        saveData.buddy = m.uid;
        save();
        render();
        toast(`${billyName(m)} is your buddy now.`);
      }
      break;
    }
    case 'mheal': {
      const m = findBilly(d.u);
      if (m) healPick(m, false);
      break;
    }
    case 'mhealuse': {
      const m = findBilly(d.u);
      if (m && applyItem(d.it, d.u, false)) {
        uiState.modal = null;
        render();
        if (d.b) billySheet(m);
        else nextModal();
      }
      break;
    }
    case 'mheldgive': {
      const m = findBilly(d.u);
      if (m && heldGive(saveData, m, d.it, ITEMS)) {
        save();
        uiState.modal = null;
        render();
        billySheet(m);
        toast(`${billyName(m)} is holding the ${ITEMS[d.it].n}.`);
      }
      break;
    }
    case 'mteam': {
      const m = findBilly(d.u);
      if (!m || saveData.team.includes(m)) break;
      if (saveData.team.length < teamSize()) {
        toTeam(m);
        save();
        render();
        toast(`${billyName(m)} joined your team.`);
      } else swapPick(m);
      break;
    }
    case 'tmadd':
      addPick();
      break;
    case 'tmaddon': {
      const m = findBilly(d.u);
      if (m && !saveData.team.includes(m) && saveData.team.length < teamSize()) {
        toTeam(m);
        save();
        closeModal();
        render();
        toast(`${billyName(m)} joined your team.`);
      }
      break;
    }
    case 'mswap': {
      const m = findBilly(d.u),
        o = findBilly(d.o);
      if (!m || !o || !saveData.team.includes(o) || saveData.team.includes(m)) break;
      const i = saveData.team.indexOf(o);
      toBox(o);
      saveData.box.splice(saveData.box.indexOf(m), 1);
      saveData.team.splice(i, 0, m);
      m.boxedAt = null;
      save();
      closeModal();
      render();
      toast(`${billyName(m)} swapped in for ${billyName(o)}.`);
      break;
    }
  }
}
