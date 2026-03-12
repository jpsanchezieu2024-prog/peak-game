/* ═══════════════════════════════════════════════════════
   PEAK: Rise to the Top — firebase.js
   Firebase Firestore Integration
   ═══════════════════════════════════════════════════════ */

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
let db            = null;
let firebaseReady = false;

try {
  firebase.initializeApp(firebaseConfig);
  db            = firebase.firestore();
  firebaseReady = true;
  console.log('[PEAK] Firebase connected.');
} catch (err) {
  console.warn('[PEAK] Firebase init failed — leaderboard disabled.', err.message);
}

const SCORES_COLLECTION = 'scores';
const MAX_SCORE         = 99999;

// ──────────────────────────────────────────────────────
//  LEADERBOARD CACHE
// ──────────────────────────────────────────────────────
let _lbCache     = null;
let _lbCacheTime = 0;
const LB_TTL     = 60000; // 60 seconds

// ──────────────────────────────────────────────────────
//  SUBMIT SCORE
// ──────────────────────────────────────────────────────
async function submitScore(name, score) {
  if (!firebaseReady) throw new Error('Firebase not available');
  if (typeof score !== 'number' || !Number.isFinite(score)) throw new Error('Bad score type');
  if (score < 0 || score > MAX_SCORE) throw new Error('Score out of range');
  score = Math.floor(score);
  if (typeof name !== 'string' || name.length < 1 || name.length > 20) throw new Error('Bad name');

  await db.collection(SCORES_COLLECTION).add({
    name:      name,
    score:     score,
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
  });

  // Bust cache so leaderboard refreshes after submit
  _lbCache     = null;
  _lbCacheTime = 0;
}

// ──────────────────────────────────────────────────────
//  GET TOP SCORES  (cached)
// ──────────────────────────────────────────────────────
async function getTopScores(limit = 25, force = false) {
  if (!firebaseReady) return getMockScores();

  const now = Date.now();
  if (!force && _lbCache && (now - _lbCacheTime) < LB_TTL) {
    return _lbCache.slice(0, limit);
  }

  try {
    const snap = await db.collection(SCORES_COLLECTION)
      .orderBy('score', 'desc')
      .limit(limit)
      .get();

    const results = snap.docs.map(doc => ({
      id:        doc.id,
      name:      doc.data().name  || 'Anonymous',
      score:     doc.data().score || 0,
      timestamp: doc.data().timestamp,
    }));

    _lbCache     = results;
    _lbCacheTime = now;
    return results;
  } catch (err) {
    console.error('[PEAK] getTopScores error:', err);
    return _lbCache || getMockScores();
  }
}

// ──────────────────────────────────────────────────────
//  GET NEARBY SCORES  (max 2 queries)
// ──────────────────────────────────────────────────────
async function getNearbyScores(myScore) {
  if (!firebaseReady) return [];

  try {
    // Query 1: fetch top 10
    const topSnap = await db.collection(SCORES_COLLECTION)
      .orderBy('score', 'desc')
      .limit(10)
      .get();

    const entries = topSnap.docs.map((d, i) => ({
      rank:  i + 1,
      name:  d.data().name,
      score: d.data().score,
      isYou: false,
    }));

    const lowestTopScore = entries.length > 0 ? entries[entries.length - 1].score : 0;

    // If player is within top 10 range, no second query needed
    if (myScore >= lowestTopScore || entries.length < 10) {
      const youRank   = entries.filter(e => e.score > myScore).length + 1;
      const youEntry  = { rank: youRank, name: 'YOU', score: myScore, isYou: true };
      const result    = [...entries];
      result.splice(youRank - 1, 0, youEntry);
      result.forEach((e, i) => e.rank = i + 1);
      return result.slice(0, 6);
    }

    // Query 2: count scores above player to get their rank
    const aboveSnap = await db.collection(SCORES_COLLECTION)
      .where('score', '>', myScore)
      .get();

    const myRank   = aboveSnap.size + 1;
    const youEntry = { rank: myRank, name: 'YOU', score: myScore, isYou: true };

    // Find the nearest entry above from what we already fetched
    const aboveEntries = aboveSnap.docs
      .map(d => ({ name: d.data().name, score: d.data().score }))
      .sort((a, b) => a.score - b.score); // ascending = closest above is first

    const nearestAbove = aboveEntries.length > 0 ? {
      rank:  myRank - 1,
      name:  aboveEntries[0].name,
      score: aboveEntries[0].score,
      isYou: false,
    } : null;

    const result = [...entries.slice(0, 2)];
    if (nearestAbove) result.push(nearestAbove);
    result.push(youEntry);
    result.forEach((e, i) => e.rank = i + 1);
    return result;

  } catch (err) {
    console.error('[PEAK] getNearbyScores error:', err);
    return [];
  }
}

// ──────────────────────────────────────────────────────
//  MOCK SCORES
// ──────────────────────────────────────────────────────
function getMockScores() {
  return [
    { id: '1',  name: 'Alex P.',   score: 1842, timestamp: null },
    { id: '2',  name: 'Jordan K.', score: 1650, timestamp: null },
    { id: '3',  name: 'Sam W.',    score: 1421, timestamp: null },
    { id: '4',  name: 'Taylor M.', score: 1309, timestamp: null },
    { id: '5',  name: 'Riley C.',  score: 1204, timestamp: null },
    { id: '6',  name: 'Morgan B.', score: 1077, timestamp: null },
    { id: '7',  name: 'Drew H.',   score:  993, timestamp: null },
    { id: '8',  name: 'Casey R.',  score:  881, timestamp: null },
    { id: '9',  name: 'Quinn S.',  score:  742, timestamp: null },
    { id: '10', name: 'Avery L.', score:  618, timestamp: null },
  ];
}
