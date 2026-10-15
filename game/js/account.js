'use strict';
/* ================= ACCOUNTS (alpha 0.4.1) =================
   "Sign in with Google": each player gets their own save, kept online (Firebase Firestore, saves/<their id>) and
   copied in this browser, so it follows them to any device. Without an account the game keeps one save in this browser.
   Signing in or out switches whose save is loaded (the page reloads once; js/core.js picks the save by account).
   The first time someone signs in on a browser that already has a game, they are asked whether to bring it along.
   The Firebase project is set in js/account-config.js; without it there is no sign-in button. */
const ACC={cfg:window.PB_FIREBASE||null,ready:false,user:null,auth:null,db:null,t:null,busy:false,err:''};
const ACC_SDK='https://cdn.jsdelivr.net/npm/firebase@10.12.5/';
function accOn(){return !window.PB_PROTOTYPE&&!!(ACC.cfg&&ACC.cfg.apiKey&&ACC.cfg.projectId)&&!window.NW_ARTIFACT&&!(typeof NW_TEST!=='undefined'&&NW_TEST)&&location.protocol!=='file:'}
function accScript(src){return new Promise((res,rej)=>{const s=document.createElement('script');s.src=src;s.onload=res;s.onerror=()=>rej(new Error('could not load '+src));document.head.appendChild(s)})}
async function accInit(){if(!accOn())return;
 try{for(const f of ['firebase-app-compat.js','firebase-auth-compat.js','firebase-firestore-compat.js'])await accScript(ACC_SDK+f);
  firebase.initializeApp(ACC.cfg);ACC.auth=firebase.auth();ACC.db=firebase.firestore();
  try{await ACC.auth.getRedirectResult()}catch(e){accErr(e)}
  ACC.auth.onAuthStateChanged(u=>accState(u))}
 catch(e){console.warn(e);ACC.err='Sign-in isn’t reachable right now.';ACC.ready=true;accRefresh()}}
function accState(u){ACC.ready=true;ACC.user=u?{uid:u.uid,name:u.displayName||u.email||'Player',email:u.email||'',photo:u.photoURL||''}:null;
 const want=u?u.uid:'';
 if(want!==ACC_ID){/* a different player: keep what's here, then load theirs */
  try{lsSet(S)}catch(e){}try{if(want){localStorage.setItem(LS_ACC,want);if(!ACC_ID&&S.started)localStorage.setItem('pb-offer-guest','1')}else localStorage.removeItem(LS_ACC)}catch(e){}
  location.reload();return}
 if(u){accPull();if(typeof frInit==='function')frInit()}accRefresh()}
/* the save online against the one here: the newer one wins */
async function accPull(){if(!ACC.user||!ACC.db)return;let snap=null;try{snap=await ACC.db.collection('saves').doc(ACC.user.uid).get()}catch(e){accErr(e);return}
 const offer=(()=>{try{const v=localStorage.getItem('pb-offer-guest');localStorage.removeItem('pb-offer-guest');return v==='1'}catch(e){return false}})();
 if(snap&&snap.exists){let remote=null;try{remote=migrate(JSON.parse(snap.data().json))}catch(e){}
  if(remote&&remote.started&&(!S.started||(remote.savedAt||0)>(S.savedAt||0))&&!B){S=remote;S.avatar=cleanTrainer(S.avatar,S.gender);applyPreferences();lsSet(S);render();toast('Your game is loaded from your account.');return}
  if(S.started)accFlush(true);return}
 /* nothing online yet: a game from this browser can come along */
 let guest=null;try{guest=migrate(JSON.parse(localStorage.getItem(LS_BASE)||'null'))}catch(e){}
 if(offer&&guest&&guest.started&&!S.started){modal({title:'Bring your game along?',html:`<p>This browser has a game with ${esc((guest.avatar&&guest.avatar.name)||'your trainer')} (${fmt(guest.totalSteps||0)} steps). Use it as the game on your account, ${esc(ACC.user.name)}?</p>`,btns:[
   {l:'Yes, use it',c:'gold',f:()=>{S=guest;S.savedAt=Date.now();lsSet(S);closeModal();accFlush(true);if(typeof TITLE!=='undefined'&&TITLE.on){TITLE.on=false;titleStart()}render();toast('Your game is on your account now.')}},
   {l:'No, start fresh',c:'quiet',f:closeModal}]})}
 else if(S.started)accFlush(true)}
/* called by save()'s flush: writes to the account (a moment later, so a burst of saves is one write) */
function accFlush(now){if(!ACC.user||!ACC.db)return false;clearTimeout(ACC.t);const go=()=>{if(!ACC.user)return;ACC.db.collection('saves').doc(ACC.user.uid).set({json:JSON.stringify(S),savedAt:S.savedAt||Date.now(),name:(S.avatar&&S.avatar.name)||'',game:'Pocket Billies'}).catch(accErr)};if(now)go();else ACC.t=setTimeout(go,1500);return true}
async function accSignIn(){if(!ACC.auth){toast(accOn()?'Sign-in is still starting. Try again in a moment.':'Accounts aren’t set up in this copy of the game.');return}if(ACC.busy)return;ACC.busy=true;
 const p=new firebase.auth.GoogleAuthProvider();p.setCustomParameters({prompt:'select_account'});
 try{await ACC.auth.signInWithPopup(p)}catch(e){if(e&&/popup-blocked|operation-not-supported|popup-closed-by-browser/.test(e.code||''))try{await ACC.auth.signInWithRedirect(p)}catch(e2){accErr(e2)}else if(!(e&&/popup-closed-by-user|cancelled-popup/.test(e.code||'')))accErr(e)}finally{ACC.busy=false}}
async function accSignOut(){if(!ACC.auth)return;try{save();await new Promise(r=>{ACC.db.collection('saves').doc(ACC.user.uid).set({json:JSON.stringify(S),savedAt:S.savedAt||Date.now(),name:(S.avatar&&S.avatar.name)||'',game:'Pocket Billies'}).then(r,r)});await ACC.auth.signOut()}catch(e){accErr(e)}}
function accErr(e){console.error(e);const c=(e&&e.code)||'';ACC.err=c==='auth/unauthorized-domain'?'This web address isn’t allowed to sign in yet (Firebase → Authentication → Settings → Authorized domains).':c==='permission-denied'?'Your save couldn’t be stored (the database rules don’t allow it).':/network/.test(c)?'No connection: your game is kept in this browser and goes online later.':'Sign-in didn’t work: '+(e&&e.message||c);toast(ACC.err);accRefresh()}
/* ---------- what shows ---------- */
const accFace=u=>u.photo?`<img class="acc-ph" src="${esc(u.photo)}" alt="" referrerpolicy="no-referrer">`:`<span class="acc-ph acc-ini">${esc((u.name||'?')[0].toUpperCase())}</span>`;
const accG='<svg class="acc-g" viewBox="0 0 18 18" aria-hidden="true"><path fill="#4285F4" d="M17.6 9.2c0-.6-.1-1.2-.2-1.7H9v3.3h4.8a4.1 4.1 0 0 1-1.8 2.7v2.2h2.9c1.7-1.6 2.7-3.9 2.7-6.5z"/><path fill="#34A853" d="M9 18c2.4 0 4.5-.8 5.9-2.2l-2.9-2.2c-.8.5-1.8.9-3 .9-2.3 0-4.3-1.6-5-3.7H1v2.3A9 9 0 0 0 9 18z"/><path fill="#FBBC05" d="M4 10.8a5.4 5.4 0 0 1 0-3.5V5H1a9 9 0 0 0 0 8.1l3-2.3z"/><path fill="#EA4335" d="M9 3.6c1.3 0 2.5.5 3.4 1.3l2.6-2.6A9 9 0 0 0 1 5l3 2.3c.7-2.1 2.7-3.7 5-3.7z"/></svg>';
/* the corner of the title: who's playing, or a sign-in button */
function accChipHTML(){if(!accOn())return '';if(!ACC.ready)return '<span class="acc-chip quiet">Signing in…</span>';
 if(ACC.user)return `<button class="acc-chip" data-a="acc-menu" title="Signed in as ${esc(ACC.user.email||ACC.user.name)}">${accFace(ACC.user)}<span>${esc(ACC.user.name.split(' ')[0])}</span></button>`;
 return `<button class="acc-chip google" data-a="acc-in">${accG}<span>Sign in with Google</span></button>`}
/* Settings → Save */
function accSettingsHTML(){if(!accOn())return `<div class="acc-box"><b>Your account</b><p class="note">Accounts aren’t set up in this copy of the game, so your game is kept in this browser.</p></div>`;
 if(ACC.user)return `<div class="acc-box">${accFace(ACC.user)}<div class="acc-t"><b>${esc(ACC.user.name)}</b><span class="note">${esc(ACC.user.email)} · your game is saved to this account</span></div><button class="pb small quiet" data-a="acc-out">Sign out</button></div>${ACC.err?`<p class="note warn">${esc(ACC.err)}</p>`:''}`;
 return `<div class="acc-box"><div class="acc-t"><b>Play on your own save</b><span class="note">Sign in with Google and your game is kept online, so you can carry on from any device. Everyone who signs in gets their own save.</span></div><button class="pb small acc-gbtn" data-a="acc-in">${accG} Sign in with Google</button></div>${ACC.err?`<p class="note warn">${esc(ACC.err)}</p>`:''}`}
function accRefresh(){const c=document.querySelector('.ttl-acc');if(c)c.innerHTML=accChipHTML();if(typeof settingsRefresh==='function')settingsRefresh()}
document.addEventListener('click',ev=>{const el=ev.target.closest&&ev.target.closest('[data-a="acc-in"],[data-a="acc-out"],[data-a="acc-menu"]');if(!el)return;ev.stopPropagation();ev.preventDefault();const a=el.dataset.a;
 if(a==='acc-in')accSignIn();else if(a==='acc-out')accSignOut();
 else modal({title:ACC.user?ACC.user.name:'Account',html:`<p>${esc(ACC.user?ACC.user.email:'')}</p><p class="note">Your game is saved to this account. Signing out loads this browser’s own game instead; sign in again any time to carry on.</p>`,btns:[{l:'Sign out',c:'quiet',f:()=>{closeModal();accSignOut()}},{l:'Keep playing',c:'gold',f:closeModal}]})},true);
