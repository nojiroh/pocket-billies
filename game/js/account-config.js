/* Pocket Billies: the Firebase project behind "Sign in with Google" (js/account.js).
   Paste the firebaseConfig from Firebase → Project settings → Your apps → Web here. These values are public by design
   (every Firebase website carries them); the database rules decide who may read and write which save.
   Left as null, the game has no accounts: one save in this browser, as before. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './bridge.js';
/* to-module: end */
window.PB_FIREBASE = {
  apiKey: 'AIzaSyAWb8Z6hZWj5dBzcK3lcBnN2JoZNijzgLw',
  authDomain: 'pocket-billies-121c0.firebaseapp.com',
  projectId: 'pocket-billies-121c0',
  storageBucket: 'pocket-billies-121c0.firebasestorage.app',
  messagingSenderId: '584909397467',
  appId: '1:584909397467:web:706a2107ddbc6d095f5bfe',
};
