'use strict';
/* ================= POCKET BILLIES STUDIO · layout (studio track ST-1) =================
   Each pane carries its width class (data-w: narrow, wide or ultra; game/js/logic/studio-layout.js) so the CSS lays a
   section out for the room it has, in a split as in a small window. A CSS container query on the pane would make the
   pane the box that fixed children (the big 3D view, the story reference) are placed in, so a ResizeObserver sets it. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/test-globals.js';
import { $$ } from '../../game/js/util.js';
import { paneWidthClass } from '../../game/js/logic/studio-layout.js';
/* eslint-disable no-func-assign */
expose({ markPaneWidth: [() => markPaneWidth, v => (markPaneWidth = v)], paneSizes: [() => paneSizes] });
/* eslint-enable no-func-assign */
/* to-module: end */
function markPaneWidth(p) {
  const c = paneWidthClass(p.clientWidth);
  if ((p.dataset.w || '') === c) return;
  if (c) p.dataset.w = c;
  else delete p.dataset.w;
}
const paneSizes = new ResizeObserver(es => es.forEach(e => markPaneWidth(e.target)));
addEventListener('load', () =>
  $$('.pane').forEach(p => {
    markPaneWidth(p);
    paneSizes.observe(p);
  })
);
