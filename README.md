# PEAK: Rise to the Top
**A vertical endless platformer for the PEAK Student Government Campaign**

PLAY HERE: https://peak-game-rho.vercel.app/

Left Right, rise to the top

Choose your character

Share your score







---

## 📁 Folder Structure

```
peak-game/
├── index.html          ← Main HTML shell (screens, layout)
├── style.css           ← Full UI stylesheet
├── game.js             ← Game engine (canvas, physics, rendering)
├── firebase.js         ← Firebase Firestore integration
├── firestore.rules     ← Firestore security rules
└── README.md           ← This file
```

---

## STEP 1: Firebase Setup

### A. Create a Firebase Project

1. Go to [https://console.firebase.google.com](https://console.firebase.google.com)
2. Click **"Add project"**
3. Name it (e.g. `peak-game`) → Continue
4. Disable Google Analytics (not needed) → **Create project**

### B. Create a Firestore Database

1. In the left sidebar → **Firestore Database** → **Create database**
2. Choose **"Start in production mode"** → Next
3. Pick the location closest to you (e.g. `us-east1`) → **Enable**

### C. Get Your Firebase Config

1. In the left sidebar → ⚙ (gear icon) → **Project settings**
2. Scroll down to **"Your apps"**
3. Click **"</>"** (Web app icon)
4. Give it a nickname (e.g. `peak-web`) → **Register app**
5. Copy the `firebaseConfig` object — it looks like:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "peak-game-xxxxx.firebaseapp.com",
  projectId: "peak-game-xxxxx",
  storageBucket: "peak-game-xxxxx.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456"
};
```

### D. Paste Config into firebase.js

Open `firebase.js` and replace the placeholder values:

```javascript
const firebaseConfig = {
  apiKey:            "AIzaSy...",        // ← your real values here
  authDomain:        "peak-game-xxxxx.firebaseapp.com",
  projectId:         "peak-game-xxxxx",
  storageBucket:     "peak-game-xxxxx.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123456789:web:abcdef123456"
};
```

### E. Deploy Firestore Security Rules

**Option 1 — Firebase Console (easiest):**
1. Go to **Firestore Database** → **Rules** tab
2. Delete all existing content
3. Paste the entire contents of `firestore.rules`
4. Click **Publish**

**Option 2 — Firebase CLI:**
```bash
npm install -g firebase-tools
firebase login
firebase init firestore   # select your project
firebase deploy --only firestore:rules
```

### F. Firestore Index (Optional but Recommended)

For the nearby-players feature, create a composite index:

1. **Firestore** → **Indexes** → **Composite** → **Create index**
2. Collection: `scores`
3. Fields: `name` (Ascending), `score` (Ascending), `timestamp` (Descending)
4. **Save**

---

## STEP 2: Test Locally

Because the game uses Firebase (a remote service), you need a local web server — you can't just open `index.html` directly in a browser.

### Option A — Python (zero install)
```bash
cd peak-game
python3 -m http.server 8080
# Open: http://localhost:8080
```

### Option B — Node.js (npx)
```bash
cd peak-game
npx serve .
# Open the URL shown in terminal
```

### Option C — VS Code Live Server extension
1. Install the "Live Server" extension in VS Code
2. Right-click `index.html` → **"Open with Live Server"**

---

## STEP 3: Deploy (Pick One)

---

### Option A — GitHub Pages (Free, Recommended)

**Prerequisites:** A GitHub account

1. **Create a new repository** at [https://github.com/new](https://github.com/new)
   - Name: `peak-game` (or anything)
   - Visibility: Public
   - Click **Create repository**

2. **Push your files:**
```bash
cd peak-game
git init
git add .
git commit -m "Initial commit — PEAK game"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/peak-game.git
git push -u origin main
```

3. **Enable GitHub Pages:**
   - Go to your repo on GitHub
   - **Settings** → **Pages** (left sidebar)
   - Source: **Deploy from a branch**
   - Branch: `main`, folder: `/ (root)`
   - Click **Save**

4. **Your site is live at:**
   `https://YOUR_USERNAME.github.io/peak-game/`

   (Takes ~1–2 minutes to go live after first deploy)

5. **Update later:**
```bash
git add .
git commit -m "Update game"
git push
```

---

### Option B — Vercel (Free, Fastest CDN)

**Prerequisites:** A GitHub account

1. **Push to GitHub first** (follow steps 1–2 from Option A above)

2. **Go to [https://vercel.com](https://vercel.com)** and sign in with GitHub

3. Click **"New Project"** → Import your `peak-game` repo

4. Leave all settings as default (no framework needed)

5. Click **Deploy**

6. **Your site is live at:**
   `https://peak-game.vercel.app` (or a custom URL Vercel assigns)

7. **Auto-deploys:** Every `git push` to `main` automatically redeploys!

---

### Option C — Netlify (Also Free)

1. Go to [https://netlify.com](https://netlify.com) → Sign up
2. Click **"Add new site"** → **"Deploy manually"**
3. Drag and drop your entire `peak-game/` folder onto the deploy area
4. Done — instant live URL!

---

## Firebase Security Notes

The security rules in `firestore.rules` enforce:

| Rule | Details |
|------|---------|
| **Read** | Anyone can read (public leaderboard) |
| **Create** | Validated: name (1–20 chars), score (0–99,999 int), timestamp (server-enforced) |
| **Update** | ❌ Blocked — scores are immutable |
| **Delete** | ❌ Blocked — no score deletion from client |
| **Extra fields** | ❌ Blocked — exactly 3 fields required |
| **Backdated scores** | ❌ Blocked — timestamp must equal `request.time` |

Additional protection in `firebase.js`:
- 60-second duplicate check (same name + same score)
- Client-side score validation before submission

---

## 🎮 Game Controls

| Input | Desktop | Mobile |
|-------|---------|--------|
| Move Left  | ← Arrow or A | Tap left side |
| Move Right | → Arrow or D | Tap right side |
| Jump | Automatic on landing | Automatic |

---

## 🗄️ Firestore Data Structure

```
scores/
  {auto-id}/
    name:      "Alex P."       // string, 1–20 chars
    score:     1842            // integer, 0–99999
    timestamp: <ServerTimestamp>
```

---

## Troubleshooting

**Leaderboard shows mock data:**
→ Your Firebase config isn't filled in yet. Open `firebase.js` and paste your real config.

**"Firebase not available" error:**
→ Check browser console for the actual error. Common causes:
- Wrong `projectId`
- Firestore not created yet
- Missing security rules

**Score submit fails:**
→ Check that Firestore rules are deployed. In the Firebase console, verify the `scores` collection has rules that allow `create`.

**CORS error locally:**
→ Don't open `index.html` directly — use a local server (`python3 -m http.server 8080`)

**Game is blurry on retina/HiDPI:**
→ Already handled — the canvas uses `devicePixelRatio` scaling automatically.

---

## Optional Improvements

- **Custom domain:** Point your domain to GitHub Pages or Vercel (both support custom domains for free)
- **Rate limiting:** Add Firebase App Check to prevent bot submissions
- **Analytics:** Add Firebase Analytics to track game sessions
- **Leaderboard pagination:** Load more scores beyond top 25
- **Social sharing:** Add Web Share API for native mobile share sheets
- **Sound effects:** Add jump/land sounds with the Web Audio API

---

## License

Built for the PEAK Student Government Campaign.
Internal/campaign use only.
