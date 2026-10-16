'use strict';
/* ================= DEBUG MENU =================
   Open it from Settings, with Ctrl+Shift+D, or by adding ?debug to the address.
   Everything here edits the current save directly; use Export first if you want a way back. */
const DBG={fps:false,on:/[?&]debug\b/.test(location.search)};
const dbgSel=(id,opts,val)=>`<select id="${id}">${opts.map(([v,n])=>`<option value="${esc(v)}" ${String(v)===String(val)?'selected':''}>${esc(n)}</option>`).join('')}</select>`;
const dbgBtn=(x,l,c='')=>`<button class="pb small ${c}" data-a="dbg" data-x="${x}">${l}</button>`;
function dbgSpecies(){return DEX.map(id=>[id,`${String(SP[id].no).padStart(3,'0')} ${SP[id].name}`])}
function debugHTML(){const inB=!!B,node=S.route.node;
 return `<div class="dbg">
 <p class="note">Changes apply to this save right away. Export a backup first if you might want to undo.</p>
 <details open><summary>Performance</summary><div class="dbg-row">${dbgBtn('fps',DBG.fps?'Hide FPS meter':'Show FPS meter')}<span class="note">Screen ≈ ${FRAME.hz} Hz · cap ${userFps()} FPS · battle quality level ${SC.q.lvl} (0 is best)</span><button class="pb small" data-a="quicktest">Full test</button><button class="pb small" data-a="dbglog">Export debug log</button></div>
  <div class="dbg-row">${dbgBtn('q0','Force best quality')}${dbgBtn('qauto','Automatic quality')}</div>
  ${DATA_WARN.length?`<p class="note">Game data warnings (${DATA_WARN.length}):</p><ul class="dbg-warn">${DATA_WARN.slice(0,30).map(w=>`<li>${esc(w)}</li>`).join('')}</ul>`:'<p class="note">Game data loaded with no warnings.</p>'}</details>
 <details><summary>Wallet and steps</summary><div class="dbg-row">${dbgBtn('se1','+$1,000')}${dbgBtn('se10','+$10,000')}${dbgBtn('st1','+1,000 steps')}${dbgBtn('st10','+10,000 steps')}</div>
  <div class="dbg-row">${dbgBtn('coins','+10 of every coin')}${dbgBtn('items','+5 of every item')}${dbgBtn('newday','Start a new day')}</div></details>
 <details><summary>Billies</summary><div class="dbg-row">${dbgSel('dbgSp',dbgSpecies(),U.dbgSp||DEX[0])}<input id="dbgLv" type="number" min="1" max="${MAXLV()}" value="${U.dbgLv||10}" aria-label="Level"><label class="dbg-ck"><input id="dbgGold" type="checkbox"> Golden</label></div>
  <div class="dbg-row">${dbgBtn('give','Give it to me','gold')}${dbgBtn('enc','Add as encounter')}${dbgBtn('wild','Battle it now','red')}${dbgBtn('alpha','As an Alpha','red')}</div>
  <div class="dbg-row">${dbgBtn('heal','Heal everyone')}${dbgBtn('lv5','Team +5 levels')}${dbgBtn('evo','Lead evolves now')}${dbgBtn('dex','Fill the Field Guide')}</div></details>
 <details><summary>Trainers and world</summary><div class="dbg-row">${dbgSel('dbgTr',Object.values(TRAINERS).map(T=>[T.id,T.name]),'')}${dbgBtn('trainer','Battle trainer','red')}${dbgBtn('trainer2','As a double battle','red')}</div>
  <div class="dbg-row">${dbgSel('dbgNode',ROUTE.map((r,i)=>[i,`${i}. ${r.name}`]),node)}${dbgBtn('jump','Go there')}</div>
  <div class="dbg-row">${dbgBtn('seats','Earn every badge')}${dbgBtn('flags','Reset trainer wins')}${dbgBtn('fillq','Fill encounter queue')}${dbgBtn('clearq','Clear queue')}</div></details>
 <details ${U.bench&&U.bench.test?'open':''}><summary>Test scenes</summary><p class="note">Small places that each show one tricky situation: stairs, ledges at the limits, bridges, water, shadows, every prop, slopes, the camera in tight spots, night lights, a dense forest, tiny and huge maps, traffic, and the light lab (v44: light on the land, in a room, on props, in the air — the places the quick check measures the lighting in). Checks test the walking rules there (what should and shouldn't be reachable).</p>
  <div class="dbg-row">${dbgSel('dbgTest',testScenes().map(k=>[k,(dioScene(k).name||k).replace(/^Test: /,'')]),U.dbgTest||testScenes()[0]||'')}${dbgBtn('test','Go there')}${dbgBtn('testchk','Run its checks')}${U.bench&&U.bench.test?dbgBtn('untest','Back to the game','gold'):''}</div>
  ${U.testRes?`<ul class="dbg-warn">${U.testRes.map(r=>`<li>${r.ok?'✓':'✗'} ${esc(r.what)}${r.ok?'':` (expected ${r.reach?'reachable':'not reachable'})`}</li>`).join('')}</ul>`:''}</details>
 <details><summary>Eggs and jobs</summary><div class="dbg-row">${dbgSel('dbgEgg',EGG_TIERS.map(t=>[t,t+' km']),EGG_TIERS[0])}${dbgBtn('egg','Add egg')}${dbgBtn('hatch','Finish all incubators')}${dbgBtn('pay','Pay all jobs')}</div>
  <div class="dbg-row">${dbgBtn('idle','Age storage by a day')}${dbgBtn('streak','Lead +3 win streak')}</div></details>
 <details ${inB?'open':''}><summary>Battle${inB?'':' (start one first)'}</summary><div class="dbg-row">${dbgBtn('win','Win now','gold')}${dbgBtn('lose','Lose now')}${dbgBtn('foe1','Foe to 1 HP')}${dbgBtn('catch',U.dbgCatch?'Taxing works as normal':'Every throw taxes')}</div>
  <div class="dbg-row">${[1,2,4].map(x=>dbgBtn('speed'+x,`${x}× speed`,SC.speed===x?'dark':'')).join('')}</div></details>
 <details><summary>Save</summary><div class="dbg-row">${dbgBtn('copy','Copy save as text')}${dbgBtn('export','Download backup')}${dbgBtn('wipe','Erase save','red')}</div></details>
 </div>`}
function openDebug(){U.modal=null;U.mq=U.mq.filter(m=>!m.dbg);modal({title:'Debug menu',dbg:1,cls:'dbg-sheet',html:debugHTML(),btns:[{l:'Close',c:'quiet',f:closeModal}]})}
function dbgRefresh(msg){if(msg)toast(msg);if(!B)render();const M=U.modal;if(M&&M.dbg){const open=$$('.dbg details').map(d=>d.open);M.html=debugHTML();renderOv();$$('.dbg details').forEach((d,i)=>{if(open[i]!=null)d.open=open[i]})}}
function debugFps(){if(!DBG.fps)return;let el=$('#fpsMeter');if(!el){el=document.createElement('div');el.id='fpsMeter';document.body.appendChild(el)}const m=FRAME.meter;el.textContent=`${m.fps} fps · ${m.workAvg.toFixed(1)} ms${typeof EGL!=='undefined'&&EGL.gpuMs?' · GPU '+EGL.gpuMs.toFixed(1)+' ms':''} · Q${SC.q.lvl} · ${FRAME.hz} Hz`}
function dbgAct(x){const v=id=>{const e=$('#'+id);return e?e.value:null},sp=v('dbgSp'),lv=clamp(+v('dbgLv')||10,1,MAXLV());if(sp){U.dbgSp=sp;U.dbgLv=lv}
 switch(x){
  case 'fps':DBG.fps=!DBG.fps;if(!DBG.fps){const e=$('#fpsMeter');if(e)e.remove()}else{if(!SC.on&&!MAP.on)frameTask('meter',()=>frameCount(0));debugFps()}return dbgRefresh();
  case 'q0':SC.lockQ=true;SC.q.lvl=0;if(B)scResize();return dbgRefresh('Battle quality locked to best.');
  case 'qauto':SC.lockQ=false;return dbgRefresh('Battle quality adapts to frame time again.');
  case 'se1':S.se+=1000;break;case 'se10':S.se+=10000;break;
  case 'st1':addSteps(1000,true);return dbgRefresh();case 'st10':addSteps(10000,true);return dbgRefresh();
  case 'coins':Object.keys(COINS).forEach(k=>S.coins[k]=(S.coins[k]||0)+10);break;
  case 'items':Object.keys(ITEMS).forEach(k=>S.items[k]=(S.items[k]||0)+5);break;
  case 'newday':S.day={date:today(),steps:0};break;
  case 'give':{const m=makeMon(sp,lv,{gold:$('#dbgGold').checked});const w=addMon(m);save();return dbgRefresh(`${SP[sp].name} joined your ${w==='team'?'team':'storage'}.`)}
  case 'enc':{S.queue.push({id:uid(),sp,lvl:lv,gold:$('#dbgGold').checked,no:++S.serial});break}
  case 'alpha':{if(B)return toast('Finish the current battle first.');const q={id:uid(),sp,lvl:lv,gold:$('#dbgGold').checked,no:++S.serial,alpha:true};S.queue.push(q);closeModal();startWild(q);return}
  case 'wild':{if(B)return toast('Finish the current battle first.');const q={id:uid(),sp,lvl:lv,gold:$('#dbgGold').checked,no:++S.serial};S.queue.push(q);closeModal();startWild(q);return}
  case 'heal':healAll();break;
  case 'lv5':S.team.forEach(m=>{const t=Math.min(MAXLV(),m.lvl+5);gainXp(m,xpFor(t)-m.xp,()=>{})});break;
  case 'evo':{const m=S.team[0];if(!m||!SP[m.sp].next)return toast('Your lead doesn’t evolve.');closeModal();evoRun(m,'Debug menu. Nobody saw anything.');return}
  case 'dex':DEX.forEach(id=>{S.seen[id]=1;S.caught[id]=1});break;
  case 'trainer2':{const id=v('dbgTr');if(B)return toast('Finish the current battle first.');closeModal();startTrainer(id,{double:true});return}
  case 'trainer':{const id=v('dbgTr');if(B)return toast('Finish the current battle first.');closeModal();startTrainer(id);return}
  case 'test':{const id=v('dbgTest');if(!id||!dioScene(id))break;U.dbgTest=id;U.testRes=null;U.bench={id,test:1};U.tab='walk';closeModal();render();toast((dioScene(id).name||id)+'. Open the debug menu to leave.');return}
  case 'untest':{U.bench=null;U.testRes=null;closeModal();render();return}
  case 'testchk':{const id=v('dbgTest')||U.dbgTest;U.dbgTest=id;U.testRes=stSceneChecks(id);break}
  case 'jump':{const n=clamp(+v('dbgNode'),0,ROUTE.length-1);S.route={node:n,prog:0,plan:[],hold:false};S.visited[n]=1;S.mapSeen=null;break}
  case 'seats':Object.values(TRAINERS).forEach(T=>{if(T.seat&&!S.seats.includes(T.seat.id))S.seats.push(T.seat.id);S.flags[T.id]=1});break;
  case 'flags':S.flags={};S.seats=[];break;
  case 'fillq':while(S.queue.length<RULES.steps.maxEncounters)spawn();break;
  case 'clearq':S.queue=[];break;
  case 'egg':addEgg(+v('dbgEgg'));break;
  case 'hatch':S.eggs.forEach(e=>{if(e.slot!=null)e.prog=EGGS[e.tier].need});break;
  case 'pay':S.jobs.forEach(j=>{if(j.uid)j.pend=Math.max(j.pend,3)});break;
  case 'idle':S.box.forEach(m=>{if(m.boxedAt)m.boxedAt-=864e5});break;
  case 'streak':if(S.team[0])S.team[0].streak=(S.team[0].streak||0)+3;break;
  case 'win':if(!B||B.phase==='playing'||B.over)return toast('Wait for your turn in a battle.');closeModal();B.events=[];for(let g=0;g<12&&!B.over;g++){A(1).hp=0;checkFaints()}play();return;
  case 'lose':if(!B||B.phase==='playing'||B.over)return toast('Wait for your turn in a battle.');closeModal();B.events=[];S.team.forEach(m=>m.hp=0);say('Your team fainted. (Debug.)');B.over='lose';play();return;
  case 'foe1':if(!B)return;A(1).hp=1;paintBoxes(snapAll(),B.market);break;
  case 'catch':U.dbgCatch=!U.dbgCatch;return dbgRefresh(U.dbgCatch?'Every throw taxes until you turn it off.':'Taxing is back to normal.');
  case 'speed1':case 'speed2':case 'speed4':SC.speed=+x.slice(5);U.dbgSpeed=SC.speed!==1;return dbgRefresh(`Battle speed ${SC.speed}×.`);
  case 'copy':navigator.clipboard&&navigator.clipboard.writeText(JSON.stringify(S)).then(()=>toast('Save copied.'),()=>toast('The browser blocked the clipboard.'));return;
  case 'export':exportSave();return;
  case 'wipe':U.modal=null;settingsReset();return;
 }save();dbgRefresh('Done.')}
function settingsReset(){modal({title:'Start over?',html:'<p>This erases your team, Field Guide and money.</p>',btns:[{l:'Erase and start over',c:'red',f:()=>{if(B){stopTimers();B=null;scStop()}S=freshKeep();S.savedAt=Date.now();lsSet(S);flush();U.intro=0;U.pg=null;U.avatarDraft=null;U.trainerDraft=null;U.tab='walk';applyPreferences();closeModal();render()}},{l:'Keep my progress',c:'quiet',f:closeModal}]})}
document.addEventListener('click',ev=>{const el=ev.target.closest('[data-a]');if(!el)return;if(el.dataset.a==='dbg')dbgAct(el.dataset.x);else if(el.dataset.a==='debug')openDebug()});
document.addEventListener('keydown',ev=>{if(ev.ctrlKey&&ev.shiftKey&&(ev.key==='D'||ev.key==='d')){ev.preventDefault();if(U.modal&&U.modal.dbg)closeModal();else openDebug()}});
if(DBG.on)addEventListener('load',()=>{const b=document.createElement('button');b.className='dbg-fab';b.dataset.a='debug';b.setAttribute('aria-label','Debug menu');b.innerHTML=uiIco('bug',20);document.body.appendChild(b)});
