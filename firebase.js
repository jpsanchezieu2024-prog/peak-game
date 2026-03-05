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
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT_ID.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId:             "YOUR_APP_ID"
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

  // Basic rate-limit: check if this exact name+score exists from last 60s
  const oneMinuteAgo = new Date(Date.now() - 60_000);
  const existing = await db.collection(SCORES_COLLECTION)
    .where('name',  '==', name)
    .where('score', '==', score)
    .where('timestamp', '>', oneMinuteAgo)
    .limit(1)
    .get();

  if (!existing.empty) {
    throw new Error('Duplicate submission — please wait a moment.');
  }

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
    // Get scores around mine
    const above = await db.collection(SCORES_COLLECTION)
      .orderBy('score', 'asc')
      .where('score', '>=', myScore)
      .limit(radius)
      .get();

    const below = await db.collection(SCORES_COLLECTION)
      .orderBy('score', 'desc')
      .where('score', '<', myScore)
      .limit(radius)
      .get();

    const aboveEntries = above.docs.map(d => ({ name: d.data().name, score: d.data().score }));
    const belowEntries = below.docs.map(d => ({ name: d.data().name, score: d.data().score }));

    // Combine and sort
    const all = [...belowEntries, ...aboveEntries].sort((a, b) => b.score - a.score);

    // Get global rank for context
    const rankSnap = await db.collection(SCORES_COLLECTION)
      .where('score', '>', myScore)
      .get();
    const myRankOffset = rankSnap.size + 1;

    // Build output with ranks
    const result = [];
    // Find closest to myScore
    let closestDist = Infinity;
    let closestIdx  = -1;
    all.forEach((e, i) => {
      const dist = Math.abs(e.score - myScore);
      if (dist < closestDist) { closestDist = dist; closestIdx = i; }
    });

    all.slice(0, 5).forEach((e, i) => {
      result.push({
        rank:   myRankOffset - 2 + i,  // approximate rank
        name:   e.name,
        score:  e.score,
        isYou:  i === closestIdx && closestDist < 10,
      });
    });

    // Insert "you" entry if not already there
    const youEntry = { rank: myRankOffset, name: 'YOU', score: myScore, isYou: true };
    const hasYou = result.some(r => r.isYou);
    if (!hasYou) result.splice(Math.min(2, result.length), 0, youEntry);

    return result.slice(0, 5);
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
