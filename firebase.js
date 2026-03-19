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
const MAX_SCORE = 150167;

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
    // Count scores strictly above player to get their rank
    const aboveSnap = await db.collection(SCORES_COLLECTION)
      .where('score', '>', myScore)
      .get();

    const myRank = aboveSnap.size + 1;

    // Get top 2
    const top2Snap = await db.collection(SCORES_COLLECTION)
      .orderBy('score', 'desc')
      .limit(2)
      .get();

    const top2 = top2Snap.docs.map((d, i) => ({
      rank:  i + 1,
      name:  d.data().name,
      score: d.data().score,
      isYou: false,
    }));

    // If player is in top 2, just show top 5
    if (myRank <= 2) {
      const top5Snap = await db.collection(SCORES_COLLECTION)
        .orderBy('score', 'desc')
        .limit(5)
        .get();
      return top5Snap.docs.map((d, i) => ({
        rank:  i + 1,
        name:  d.data().name,
        score: d.data().score,
        isYou: i + 1 === myRank,
      }));
    }

    // Nearest score above player
    const nearestAbove = aboveSnap.docs
      .map(d => ({ name: d.data().name, score: d.data().score }))
      .sort((a, b) => a.score - b.score)[0]; // lowest of those above = closest

    const aboveEntry = nearestAbove ? {
      rank:  myRank - 1,
      name:  nearestAbove.name,
      score: nearestAbove.score,
      isYou: false,
    } : null;

    // Nearest score below player
    const belowSnap = await db.collection(SCORES_COLLECTION)
      .orderBy('score', 'desc')
      .where('score', '<', myScore)
      .limit(1)
      .get();

    const belowEntry = belowSnap.docs.length > 0 ? {
      rank:  myRank + 1,
      name:  belowSnap.docs[0].data().name,
      score: belowSnap.docs[0].data().score,
      isYou: false,
    } : null;

    const youEntry = { rank: myRank, name: 'YOU', score: myScore, isYou: true };

    // Build: #1, #2, [separator if gap], above, YOU, below
    const result = [...top2];

    if (aboveEntry && aboveEntry.rank > 3) {
      result.push({ rank: '…', name: '', score: '', isSeparator: true });
    }
    if (aboveEntry) result.push(aboveEntry);
    result.push(youEntry);
    if (belowEntry) result.push(belowEntry);

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
