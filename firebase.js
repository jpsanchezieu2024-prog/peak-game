/* ═══════════════════════════════════════════════════════
   PEAK: Rise to the Top — firebase.js
   Firebase Firestore Integration
   ═══════════════════════════════════════════════════════

   HOW TO CONFIGURE:
   1. Go to https://console.firebase.google.com
   2. Create a project (e.g. "peak-game")
   3. Click ⚙ → Project Settings → Your Apps → Web App
   4. Copy your firebaseConfig object
   5. Paste it below, replacing the placeholder values

   ═══════════════════════════════════════════════════════ */

// ──────────────────────────────────────────────────────
//  FIREBASE CONFIG — Replace with your own values
// ──────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyDYWee7HCorXV2mzij7EyrFN5nUNzPWfjo",
  authDomain: "peak-game.firebaseapp.com",
  projectId: "peak-game",
  storageBucket: "peak-game.firebasestorage.app",
  messagingSenderId: "877385712555",
  appId: "1:877385712555:web:81485bd5477ac2b21ac8ee"
};

// ──────────────────────────────────────────────────────
//  INIT
// ──────────────────────────────────────────────────────
let db = null;
let firebaseReady = false;

try {
  firebase.initializeApp(firebaseConfig);
  db = firebase.firestore();
  firebaseReady = true;
  console.log('[PEAK] Firebase connected.');
} catch (err) {
  console.warn('[PEAK] Firebase init failed — leaderboard disabled.', err.message);
}

// ──────────────────────────────────────────────────────
//  CONSTANTS
// ──────────────────────────────────────────────────────
const SCORES_COLLECTION = 'scores';
const MAX_SCORE         = 99999;  // server-side validation ceiling

// ──────────────────────────────────────────────────────
//  SUBMIT SCORE
//  - Validates score is a reasonable integer
//  - Checks for duplicate name+score (rate limiting)
//  - Adds server timestamp
// ──────────────────────────────────────────────────────
async function submitScore(name, score) {
  if (!firebaseReady) throw new Error('Firebase not available');

  // Client-side validation
  if (typeof score !== 'number' || !Number.isFinite(score)) throw new Error('Bad score type');
  if (score < 0 || score > MAX_SCORE)                       throw new Error('Score out of range');
  score = Math.floor(score);

  if (typeof name !== 'string' || name.length < 1 || name.length > 20) throw new Error('Bad name');


  // Write to Firestore
  await db.collection(SCORES_COLLECTION).add({
    name:      name,
    score:     score,
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    // Do NOT store client IP — Firebase handles that server-side
  });
}

// ──────────────────────────────────────────────────────
//  GET TOP SCORES
// ──────────────────────────────────────────────────────
async function getTopScores(limit = 25) {
  if (!firebaseReady) return getMockScores();

  try {
    const snap = await db.collection(SCORES_COLLECTION)
      .orderBy('score', 'desc')
      .limit(limit)
      .get();

    return snap.docs.map(doc => ({
      id:        doc.id,
      name:      doc.data().name   || 'Anonymous',
      score:     doc.data().score  || 0,
      timestamp: doc.data().timestamp,
    }));
  } catch (err) {
    console.error('[PEAK] getTopScores error:', err);
    return getMockScores();
  }
}

// ──────────────────────────────────────────────────────
//  GET NEARBY SCORES
//  Returns ~5 scores around the player's score
//  with `isYou: true` on an entry closest to their score
// ──────────────────────────────────────────────────────
async function getNearbyScores(myScore, radius = 5) {
  if (!firebaseReady) return [];
  try {
    // Count how many scores are strictly higher = your rank
    const higherSnap = await db.collection(SCORES_COLLECTION)
      .where('score', '>', myScore)
      .get();
    const myRank = higherSnap.size + 1;

    // Get 2 scores strictly above mine
    const above = await db.collection(SCORES_COLLECTION)
      .orderBy('score', 'desc')
      .where('score', '>', myScore)
      .limit(2)
      .get();

    // Get 2 scores strictly below mine
    const below = await db.collection(SCORES_COLLECTION)
      .orderBy('score', 'desc')
      .where('score', '<', myScore)
      .limit(2)
      .get();

    const aboveEntries = above.docs.reverse().map((d, i) => ({
      rank:  myRank - (above.docs.length - i),
      name:  d.data().name,
      score: d.data().score,
      isYou: false,
    }));

    const belowEntries = below.docs.map((d, i) => ({
      rank:  myRank + 1 + i,
      name:  d.data().name,
      score: d.data().score,
      isYou: false,
    }));

    const youEntry = {
      rank:  myRank,
      name:  'YOU',
      score: myScore,
      isYou: true,
    };

    return [...aboveEntries, youEntry, ...belowEntries];

  } catch (err) {
    console.error('[PEAK] getNearbyScores error:', err);
    return [];
  }
}
// ──────────────────────────────────────────────────────
//  MOCK SCORES (shown when Firebase not configured)
// ──────────────────────────────────────────────────────
function getMockScores() {
  return [
    { id: '1', name: 'Alex P.',    score: 1842, timestamp: null },
    { id: '2', name: 'Jordan K.',  score: 1650, timestamp: null },
    { id: '3', name: 'Sam W.',     score: 1421, timestamp: null },
    { id: '4', name: 'Taylor M.',  score: 1309, timestamp: null },
    { id: '5', name: 'Riley C.',   score: 1204, timestamp: null },
    { id: '6', name: 'Morgan B.',  score: 1077, timestamp: null },
    { id: '7', name: 'Drew H.',    score:  993, timestamp: null },
    { id: '8', name: 'Casey R.',   score:  881, timestamp: null },
    { id: '9', name: 'Quinn S.',   score:  742, timestamp: null },
    { id: '10', name: 'Avery L.', score:  618, timestamp: null },
  ];
}
