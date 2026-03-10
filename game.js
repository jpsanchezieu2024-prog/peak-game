/* ═══════════════════════════════════════════════════════
   PEAK: Rise to the Top — game.js
   Pure Canvas 2D Game Engine (no external dependencies)
   ═══════════════════════════════════════════════════════ */

(() => {
  'use strict';

  const CANVAS_W = 480;
  const CANVAS_H = 600;
  const GRAVITY  = 1.6;
  const JUMP_VEL = -35;
  const MOVE_SPD = window.matchMedia('(pointer: coarse)').matches ? 14 : 17.5;
  const PLAT_H   = 12;
  const PLAYER_W = 70;
  const PLAYER_H = 90;

  const PT_STATIC  = 0;
  const PT_MOVING  = 1;
  const PT_CRUMBLE = 2;
  
  

  const C = {
    bg:              '#f5efe6',
    bgStar:          'rgba(91,26,26,0.18)',
    playerBody:      '#5b1a1a',
    playerGlow:      'rgba(91,26,26,0.45)',
    playerShade:     '#3a0f0f',
    platStatic:      '#4a9eff',
    platMove:        '#a855f7',
    platCrumble:     '#FF5C00',
    platCrumbleWarn: 'rgba(0,0,0,0.05)',
    shadow:          'rgba(0,0,0,0.35)',
    particle:        '#ffd166',
    groundGlow:      'rgba(91,26,26,0.12)',
  };

  const IS_MOBILE = window.matchMedia('(pointer: coarse)').matches;

  const BANDS_DESKTOP = [
    { threshold: 0,   gap: [100, 140], moving: 0.0,  crumble: 0.05, platW: [100, 150] },
    { threshold: 300, gap: [115, 155], moving: 0.15, crumble: 0.12, platW: [90,  135] },
    { threshold: 600, gap: [130, 175], moving: 0.25, crumble: 0.18, platW: [80,  120] },
    { threshold: 800, gap: [145, 190], moving: 0.35, crumble: 0.22, platW: [70,  110] },
  ];

  const BANDS_MOBILE = [
    { threshold: 0,   gap: [130, 180], moving: 0.0,  crumble: 0.04, platW: [70, 100] },
    { threshold: 300, gap: [155, 205], moving: 0.12, crumble: 0.10, platW: [60,  90] },
    { threshold: 600, gap: [175, 225], moving: 0.20, crumble: 0.15, platW: [55,  80] },
    { threshold: 800, gap: [195, 245], moving: 0.30, crumble: 0.20, platW: [50,  70] },
  ];

  const BANDS = IS_MOBILE ? BANDS_MOBILE : BANDS_DESKTOP;

  // ── CHARACTER SYSTEM ──────────────────────────────────
const CHARACTERS = [
    { id: 1, name: 'Peaky', file: 'char1.png', unlock: 0    },
    { id: 2, name: 'Juan Pablo', file: 'char2.png', unlock: 0  },
    { id: 3, name: 'Khadija', file: 'char3.png', unlock: 0  },
    { id: 4, name: 'Shaun', file: 'char4.png', unlock: 0  },
    { id: 5, name: 'Barnabas', file: 'char5.png', unlock: 0  },
    { id: 6, name: 'Alfredo', file: 'char6.png', unlock: 0 },
    { id: 7, name: 'Stela', file: 'char7.png', unlock: 0 },
    { id: 8, name: 'Sienna', file: 'char8.png', unlock: 0 },
    { id: 9, name: 'Sasha', file: 'char9.png', unlock: 0 },
    { id: 10, name: 'IE Tower', file: 'char10.png', unlock: 0    },
    { id: 11, name: 'Segovia Campus', file: 'char11.png', unlock: 0    }
  ];

  let selectedCharId = parseInt(localStorage.getItem('peak_char') || '1');
  localStorage.removeItem('peak_unlocked');
  let unlockedChars  = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

  const charImages = {};
  CHARACTERS.forEach(c => {
    const img = new Image();
    img.src   = c.file;
    charImages[c.id] = img;
  });

  function getSelectedImage() {
    return charImages[selectedCharId] || charImages[1];
  }

  function checkUnlocks(currentBest) {
    let newUnlock = false;
    CHARACTERS.forEach(c => {
      if (currentBest >= c.unlock && !unlockedChars.includes(c.id)) {
        unlockedChars.push(c.id);
        newUnlock = c;
      }
    });
    if (newUnlock) {
      localStorage.setItem('peak_unlocked', JSON.stringify(unlockedChars));
      showMilestoneFlash('UNLOCKED: ' + newUnlock.name + '!');
    }
  }

  // ── POWERUP SYSTEM ────────────────────────────────────
  const PU_TOGETHER = 'together';
  const PU_LISTEN   = 'listen';
  const PU_LAST     = 'last';

  let powerups          = [];
  let activePowerup     = null;
  let powerupTimer      = 0;
  let scoreMultiplier   = 1;
  let bonusScore        = 0;
  let highestYAtBonus   = 0;
  let shieldActive      = false;
  let lastPowerupSpawnY = 0;

  const POWERUP_DEFS = {
    [PU_TOGETHER]: { label: 'BUILT TOGETHER', color: '#00c896', duration: 5000 },
    [PU_LISTEN]:   { label: 'BUILT TO LISTEN', color: '#ffc800', duration: 8000 },
    [PU_LAST]:     { label: 'BUILT TO LAST',   color: '#b464ff', duration: 0    },
  };

  function spawnPowerup(belowY) {
    const types = [PU_TOGETHER, PU_LISTEN, PU_LAST];
    const type  = types[Math.floor(Math.random() * types.length)];
    const lw    = canvas._lw || CANVAS_W;
    powerups.push({
      x: randomBetween(40, lw - 40),
      y: belowY - randomBetween(200, 350),
      type, size: 18, pulse: 0,
    });
  }

  function activatePowerup(type) {
    const def   = POWERUP_DEFS[type];
    activePowerup = type;
    if (type === PU_LISTEN) {
      scoreMultiplier  = 2;
      powerupTimer     = def.duration;
      highestYAtBonus  = highestY;
      bonusScore       = 0;
    } else if (type === PU_TOGETHER) {
      powerupTimer = def.duration;
    } else if (type === PU_LAST) {
      shieldActive = true;
      powerupTimer = 0;
    }
    showPowerupHUD(type);
    playMilestone();
    showMilestoneFlash(def.label);
  }

  function showPowerupHUD(type) {
    document.querySelectorAll('.powerup-indicator').forEach(e => e.remove());
    if (!type) return;
    const def = POWERUP_DEFS[type];
    const hud = document.createElement('div');
    hud.className   = 'powerup-indicator powerup-' + type;
    hud.id          = 'active-powerup-hud';
    hud.textContent = def.label + (def.duration > 0 ? ' \u25CF' : ' SHIELD');
    let wrap = document.getElementById('powerup-hud-wrap');
    if (!wrap) {
      wrap           = document.createElement('div');
      wrap.id        = 'powerup-hud-wrap';
      wrap.className = 'powerup-hud';
      document.getElementById('game-screen').appendChild(wrap);
    }
    wrap.innerHTML = '';
    wrap.appendChild(hud);
  }

  function clearPowerup() {
    activePowerup   = null;
    scoreMultiplier = 1;
    shieldActive    = false;
    powerupTimer    = 0;
    highestYAtBonus = 0;
    showPowerupHUD(null);
  }

  function showMilestoneFlash(text) {
    const el       = document.createElement('div');
    el.className   = 'milestone-flash';
    el.textContent = text;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1200);
  }

  // ── SOUND ENGINE ──────────────────────────────────────
  let audioCtx = null;

  function getAudioCtx() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  function playBounce(platType) {
    try {
      const ctx  = getAudioCtx();
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      if (platType === PT_STATIC) {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(520, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(320, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.15);
      } else if (platType === PT_MOVING) {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(680, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(420, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.12);
      } else if (platType === PT_CRUMBLE) {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(280, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.18);
        gain.gain.setValueAtTime(0.22, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.2);
        const osc2 = ctx.createOscillator(); const gain2 = ctx.createGain();
        osc2.connect(gain2); gain2.connect(ctx.destination);
        osc2.type = 'sawtooth';
        osc2.frequency.setValueAtTime(160, ctx.currentTime + 0.05);
        osc2.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.25);
        gain2.gain.setValueAtTime(0.1, ctx.currentTime + 0.05);
        gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        osc2.start(ctx.currentTime + 0.05); osc2.stop(ctx.currentTime + 0.25);
      }
    } catch(e) {}
  }

  function playGameOver() {
    try {
      const ctx = getAudioCtx();
      [440, 330, 220].forEach((freq, i) => {
        const osc = ctx.createOscillator(); const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'sine';
        const t  = ctx.currentTime + i * 0.18;
        osc.frequency.setValueAtTime(freq, t);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.7, t + 0.25);
        gain.gain.setValueAtTime(0.15, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        osc.start(t); osc.stop(t + 0.3);
      });
    } catch(e) {}
  }

  function playMilestone() {
    try {
      const ctx = getAudioCtx();
      [440, 554, 660, 880].forEach((freq, i) => {
        const osc = ctx.createOscillator(); const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'sine';
        const t  = ctx.currentTime + i * 0.1;
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.12, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        osc.start(t); osc.stop(t + 0.2);
      });
    } catch(e) {}
  }

  // ── BACKGROUND COLOR ──────────────────────────────────
  function lerpColor(r1,g1,b1,r2,g2,b2,t) {
    t = Math.max(0, Math.min(1, t));
    return 'rgb(' + Math.round(r1+(r2-r1)*t) + ',' + Math.round(g1+(g2-g1)*t) + ',' + Math.round(b1+(b2-b1)*t) + ')';
  }

  function getBackgroundColor(sc) {
const stages = [
      [0,    245,239,230],
      [1500,  220,210,195],
      [3500, 190,175,165],
      [7500, 160,140,130],
      [12500, 130,100, 90],
    ];
    for (let i = 0; i < stages.length - 1; i++) {
      const [s1,r1,g1,b1] = stages[i];
      const [s2,r2,g2,b2] = stages[i+1];
      if (sc >= s1 && sc < s2) return lerpColor(r1,g1,b1,r2,g2,b2,(sc-s1)/(s2-s1));
    }
    const last = stages[stages.length-1];
    return 'rgb(' + last[1] + ',' + last[2] + ',' + last[3] + ')';
  }

  // ── STATE ─────────────────────────────────────────────
  let canvas, ctx;
  let running   = false;
  let score     = 0;
  let bestScore = parseInt(localStorage.getItem('peak_best') || '0');
  let cameraY   = 0;
  let highestY  = 0;
  let frameId;
  let lastTime  = 0;
  let particles = [];
  let stars     = [];

  const player = { x:0, y:0, vx:0, vy:0, onGround:false, trail:[] };
  let platforms = [];
  const keys    = { left:false, right:false };
  let touchLeft = false, touchRight = false;

  // ── CHARACTER SELECT UI ───────────────────────────────
  function buildCharSelectScreen() {
    const grid = document.getElementById('char-grid');
    grid.innerHTML = '';
    CHARACTERS.forEach(c => {
      const isUnlocked = unlockedChars.includes(c.id);
      const isSelected = selectedCharId === c.id;
      const card       = document.createElement('div');
      card.className   = 'char-card' + (isUnlocked ? '' : ' char-locked') + (isSelected ? ' char-selected' : '');
      const imgEl      = charImages[c.id];
      const imgLoaded  = imgEl.complete && imgEl.naturalWidth > 0;
      card.innerHTML   =
        (!isUnlocked ? '<span class="char-lock-icon">🔒</span>' : '') +
        (imgLoaded
          ? '<img src="' + c.file + '" class="char-card-img" alt="' + c.name + '" />'
          : '<div class="char-card-placeholder">👤</div>') +
        '<span class="char-card-label">' + c.name + '</span>' +
        (!isUnlocked ? '<span class="char-card-unlock">' + c.unlock + '+ pts</span>' : '');
      if (isUnlocked) {
        card.addEventListener('click', () => {
          selectedCharId = c.id;
          localStorage.setItem('peak_char', c.id);
          document.getElementById('charselect-name').textContent   = c.name;
          document.getElementById('charselect-status').textContent = 'Selected \u2713';
          document.getElementById('charselect-preview').src        = c.file;
          buildCharSelectScreen();
        });
      }
      grid.appendChild(card);
    });
    const sel = CHARACTERS.find(c => c.id === selectedCharId);
    if (sel) {
      document.getElementById('charselect-name').textContent   = sel.name;
      document.getElementById('charselect-status').textContent = 'Selected \u2713';
      document.getElementById('charselect-preview').src        = sel.file;
    }
  }

  // ── INIT ──────────────────────────────────────────────
  function init() {
    canvas = document.getElementById('game-canvas');
    ctx    = canvas.getContext('2d');
    resizeCanvas();
    
    // Load Montserrat for share card
    const montserrat = new FontFace('Montserrat', 'url(https://fonts.gstatic.com/s/montserrat/v26/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCtr6Hw5aXo.woff2)');
    montserrat.load().then(f => document.fonts.add(f)).catch(() => {});
    
    window.addEventListener('resize', resizeCanvas);

    window.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft'  || e.key === 'a' || e.key === 'A') keys.left  = true;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = true;
    });
    window.addEventListener('keyup', e => {
      if (e.key === 'ArrowLeft'  || e.key === 'a' || e.key === 'A') keys.left  = false;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = false;
    });

    const tl = document.getElementById('touch-left');
    const tr = document.getElementById('touch-right');
    function bindTouch(el, setFn) {
      el.addEventListener('touchstart',  e => { e.preventDefault(); setFn(true);  el.classList.add('pressed');    }, { passive:false });
      el.addEventListener('touchend',    e => { e.preventDefault(); setFn(false); el.classList.remove('pressed'); }, { passive:false });
      el.addEventListener('touchcancel', e => { e.preventDefault(); setFn(false); el.classList.remove('pressed'); }, { passive:false });
    }
    bindTouch(tl, v => { touchLeft  = v; });
    bindTouch(tr, v => { touchRight = v; });

    document.getElementById('start-btn').addEventListener('click', startGame);
    document.getElementById('play-again-btn').addEventListener('click', startGame);
    document.getElementById('char-select-open-btn').addEventListener('click', () => {
      buildCharSelectScreen(); showScreen('charselect-screen');
    });
    document.getElementById('charselect-back-btn').addEventListener('click', () => showScreen('start-screen'));
    document.getElementById('charselect-confirm-btn').addEventListener('click', () => showScreen('start-screen'));
    document.getElementById('go-char-btn').addEventListener('click', () => {
      buildCharSelectScreen(); showScreen('charselect-screen');
      document.getElementById('charselect-back-btn').onclick = () => showScreen('gameover-screen');
    });

    document.getElementById('copy-btn').addEventListener('click', copyShareText);
    document.getElementById('submit-score-btn').addEventListener('click', handleScoreSubmit);
    document.getElementById('refresh-lb-btn').addEventListener('click', () => loadLeaderboard());

    generateStars(120);
    loadLeaderboard();
    document.getElementById('hud-best').textContent = bestScore;
  }

  function resizeCanvas() {
    const container = document.getElementById('game-screen');
    const dpr = window.devicePixelRatio || 1;
    const cw  = container.clientWidth  || window.innerWidth;
    const ch  = container.clientHeight || window.innerHeight;
    canvas.width        = cw * dpr;
    canvas.height       = ch * dpr;
    canvas.style.width  = cw + 'px';
    canvas.style.height = ch + 'px';
    ctx.scale(dpr, dpr);
    canvas._lw = cw;
    canvas._lh = ch;
  }

  // ── STARS ─────────────────────────────────────────────
  function generateStars(n) {
    stars = [];
    for (let i = 0; i < n; i++) {
      stars.push({ x: Math.random()*CANVAS_W, y: Math.random()*4000, size: Math.random()*1.5+0.5, alpha: Math.random()*0.4+0.2 });
    }
  }

  // ── GAME START ────────────────────────────────────────
  function startGame() {
    showScreen('game-screen');
    resizeCanvas();
    score=0; cameraY=0; highestY=0; particles=[]; powerups=[]; lastPowerupSpawnY=0; running=true; bonusScore=0; highestYAtBonus=0;
    clearPowerup();
    const lw = canvas._lw||CANVAS_W; const lh = canvas._lh||CANVAS_H;
    player.x=lw/2-PLAYER_W/2; player.y=lh-250; player.vx=0; player.vy=0; player.onGround=false; player.trail=[];
    platforms = [];
    generateInitialPlatforms();
    document.getElementById('hud-score').textContent = '0';
    document.getElementById('hud-best').textContent  = bestScore;
    if (frameId) cancelAnimationFrame(frameId);
    lastTime = performance.now();
    frameId  = requestAnimationFrame(gameLoop);
  }

  // ── PLATFORM GENERATION ───────────────────────────────
  function getDifficulty(sc) {
    let band = BANDS[0];
    for (const b of BANDS) { if (sc >= b.threshold) band = b; }
    return band;
  }

  function randomBetween(a, b) { return a + Math.random()*(b-a); }

  function generateInitialPlatforms() {
    const lw = canvas._lw||CANVAS_W; const lh = canvas._lh||CANVAS_H;
    platforms.push({ x:lw/2-90, y:lh-120, w:180, h:PLAT_H, type:PT_STATIC, crumbling:false, crumbleTimer:0, alpha:1, dx:0, minX:0, maxX:0, speed:0 });
    let lastY = lh - 120;
    while (lastY > -2000) lastY = addPlatform(lastY, 0);
  }

  function addPlatform(belowY, sc) {
    const lw   = canvas._lw||CANVAS_W;
    const diff = getDifficulty(sc);
    const gap  = randomBetween(diff.gap[0], diff.gap[1]);
    const newY = belowY - gap;
    const w    = randomBetween(diff.platW[0], diff.platW[1]);
    const x    = randomBetween(16, lw-w-16);
    const roll = Math.random();
    let type = PT_STATIC;
    if      (roll < diff.crumble)               type = PT_CRUMBLE;
    else if (roll < diff.crumble+diff.moving)   type = PT_MOVING;
    const plat = { x, y:newY, w, h:PLAT_H, type, crumbling:false, crumbleTimer:0, alpha:1, dx:0, minX:0, maxX:0, speed:0 };
    if (type === PT_MOVING) {
      const range = randomBetween(60,140);
      plat.minX  = Math.max(8, x-range/2);
      plat.maxX  = Math.min(lw-w-8, x+range/2);
      plat.speed = randomBetween(1.2,2.5) * (Math.random()<0.5?1:-1);
    }
    platforms.push(plat);
    return newY;
  }

  function ensurePlatformsAbove() {
    let topY = 99999;
    for (const p of platforms) topY = Math.min(topY, p.y);
    const targetTop = cameraY - 600;
    while (topY > targetTop) topY = addPlatform(topY, score);
    const cullY = cameraY + (canvas._lh||CANVAS_H) + 400;
    platforms   = platforms.filter(p => p.y < cullY);
  }

  // ── PARTICLES ─────────────────────────────────────────
  function spawnLandParticles(px, py) {
    for (let i=0;i<8;i++) particles.push({ x:px+PLAYER_W/2, y:py+PLAYER_H, vx:(Math.random()-0.5)*4, vy:-Math.random()*3-0.5, life:1, decay:Math.random()*0.05+0.04, size:Math.random()*4+2, color:C.particle });
  }
  function spawnCrumbleParticles(px, py, pw) {
    for (let i=0;i<14;i++) particles.push({ x:px+Math.random()*pw, y:py, vx:(Math.random()-0.5)*5, vy:-Math.random()*2+1, life:1, decay:Math.random()*0.04+0.03, size:Math.random()*5+3, color:C.platCrumble });
  }

  // ── UPDATE ────────────────────────────────────────────
  function update(dt) {
    if (!running) return;
    const lw  = canvas._lw||CANVAS_W;
    const lh  = canvas._lh||CANVAS_H;
    const dtN = dt / 16.667;

    const movingLeft  = keys.left  || touchLeft;
    const movingRight = keys.right || touchRight;
    if (movingLeft)       player.vx = -MOVE_SPD;
    else if (movingRight) player.vx =  MOVE_SPD;
    else                  player.vx *= 0.75;

    player.vy += GRAVITY * dtN;
    player.x  += player.vx * dtN;
    player.y  += player.vy * dtN;

    if (player.x + PLAYER_W < 0) player.x = lw;
    if (player.x > lw)           player.x = -PLAYER_W;

    player.trail.unshift({ x:player.x, y:player.y, alpha:0.5 });
    if (player.trail.length > 6) player.trail.pop();

    player.onGround = false;
    if (player.vy >= 0) {
      for (const p of platforms) {
        if (p.alpha <= 0 || p.w === 0) continue;
        const screenY = p.y - cameraY;
        if (screenY < -80 || screenY > lh+80) continue;
        const prevBottom = (player.y+PLAYER_H) - player.vy*dtN;
        const currBottom = player.y+PLAYER_H;
        if (player.x+PLAYER_W-4 > p.x && player.x+4 < p.x+p.w && prevBottom <= p.y+2 && currBottom >= p.y) {
          player.y = p.y - PLAYER_H;
          player.vy = JUMP_VEL;
          player.onGround = true;
          spawnLandParticles(player.x, player.y);
          playBounce(p.type);
          if (p.type === PT_CRUMBLE && !p.crumbling) { p.crumbling=true; p.crumbleTimer=0; spawnCrumbleParticles(p.x,p.y,p.w); }
          break;
        }
      }
    }

    const worldY = player.y + cameraY;
    if (worldY < highestY || highestY === 0) highestY = worldY;

    const initialBaseline = (canvas._lh||CANVAS_H) - 120;
    const rise            = initialBaseline - highestY;
    const baseScore       = Math.max(0, Math.floor(rise / 3));

    if (activePowerup === PU_LISTEN) {
      // Track extra points earned only during the buff
      const riseduringBuff = highestYAtBonus - highestY;
      bonusScore = Math.max(0, Math.floor(riseduringBuff / 3));
    }

    score = baseScore + bonusScore;

    if (activePowerup && powerupTimer > 0) {
      powerupTimer -= dt;
      if (powerupTimer <= 0) clearPowerup();
    }

    for (let i=powerups.length-1; i>=0; i--) {
      const pu   = powerups[i];
      const puSY = pu.y - cameraY;
      if (puSY > lh+60) { powerups.splice(i,1); continue; }
      const px   = player.x+PLAYER_W/2;
      const py   = player.y+PLAYER_H/2;
      const dist = Math.hypot(px-pu.x, py-pu.y);
      if (dist < pu.size+16) { activatePowerup(pu.type); powerups.splice(i,1); }
      else pu.pulse += 0.05;
    }

    if (lastPowerupSpawnY === 0) lastPowerupSpawnY = cameraY;
    if (lastPowerupSpawnY - cameraY > 800) {
      if (Math.random() < 0.6) spawnPowerup(cameraY);
      lastPowerupSpawnY = cameraY;
    }

    if (activePowerup === PU_TOGETHER) {
      for (const p of platforms) {
        const sY = p.y - cameraY;
        if (sY > 0 && sY < lh && p.w < (canvas._lw||CANVAS_W)*0.4) p.w = Math.min(p.w+0.3,(canvas._lw||CANVAS_W)*0.4);
      }
    }

    const targetCameraY = player.y - lh*0.38;
    if (targetCameraY < cameraY) cameraY += (targetCameraY-cameraY)*0.12*dtN;

    document.getElementById('hud-score').textContent = score;
    if (score > bestScore) { bestScore=score; document.getElementById('hud-best').textContent=bestScore; }

    for (const p of platforms) {
      if (p.type===PT_MOVING) { p.x+=p.speed*dtN; if (p.x<=p.minX||p.x>=p.maxX) p.speed*=-1; }
      if (p.crumbling) { p.crumbleTimer+=dt; p.alpha=Math.max(0,1-p.crumbleTimer/350); if (p.alpha<=0) p.w=0; }
    }

    for (const pt of particles) { pt.x+=pt.vx*dtN; pt.y+=pt.vy*dtN; pt.vy+=0.15*dtN; pt.life-=pt.decay*dtN; }
    particles = particles.filter(pt=>pt.life>0);

    ensurePlatformsAbove();

    if (player.y - cameraY > lh+60) {
      if (shieldActive) {
        shieldActive=false; activePowerup=null;
        player.vy=JUMP_VEL*1.5; player.y=cameraY+lh-100;
        showPowerupHUD(null); showMilestoneFlash('SHIELD SAVED YOU!');
      } else { gameOver(); }
    }
  }

  // ── RENDER ────────────────────────────────────────────
function render() {
    const lw = canvas._lw||CANVAS_W;
    const lh = canvas._lh||CANVAS_H;

    ctx.clearRect(0,0,lw,lh);
    ctx.fillStyle = getBackgroundColor(score);
    ctx.fillRect(0,0,lw,lh);

    for (const s of stars) {
      const sy = s.y - cameraY;
      if (sy<-5||sy>lh+5) continue;
      ctx.globalAlpha = s.alpha;
      ctx.fillStyle   = C.bgStar;
      ctx.beginPath(); ctx.arc(s.x,sy,s.size,0,Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    const grad = ctx.createLinearGradient(0,0,0,lh);
    grad.addColorStop(0,'rgba(0,229,255,0.04)'); grad.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=grad; ctx.fillRect(0,0,lw,lh);

    for (const p of platforms) {
      const screenY = p.y - cameraY;
      if (screenY<-PLAT_H-10||screenY>lh+20||p.w===0) continue;
      ctx.save(); ctx.globalAlpha=p.alpha;
      ctx.fillStyle=C.shadow; ctx.beginPath(); ctx.roundRect(p.x+3,screenY+4,p.w,PLAT_H,6); ctx.fill();
      let color = C.platStatic;
      if (p.type===PT_MOVING)  color = C.platMove;
      if (p.type===PT_CRUMBLE) color = p.crumbling ? C.platCrumbleWarn : C.platCrumble;
      ctx.shadowBlur=12; ctx.shadowColor=color; ctx.fillStyle=color;
      ctx.beginPath(); ctx.roundRect(p.x,screenY,p.w,PLAT_H,6); ctx.fill();
      ctx.shadowBlur=0;
      const hlGrad=ctx.createLinearGradient(p.x,screenY,p.x,screenY+PLAT_H);
      hlGrad.addColorStop(0,'rgba(255,255,255,0.25)'); hlGrad.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=hlGrad; ctx.beginPath(); ctx.roundRect(p.x,screenY,p.w,PLAT_H,6); ctx.fill();
      if (p.type===PT_MOVING) { ctx.fillStyle='rgba(255,255,255,0.5)'; ctx.font='9px sans-serif'; ctx.textAlign='center'; ctx.fillText('\u25C4 \u25BA',p.x+p.w/2,screenY+9); }
      if (p.type===PT_CRUMBLE&&p.crumbling) {
        ctx.strokeStyle='rgba(255,255,255,0.3)'; ctx.lineWidth=1; ctx.beginPath();
        ctx.moveTo(p.x+p.w*0.3,screenY); ctx.lineTo(p.x+p.w*0.3+8,screenY+PLAT_H);
        ctx.moveTo(p.x+p.w*0.65,screenY); ctx.lineTo(p.x+p.w*0.65-6,screenY+PLAT_H); ctx.stroke();
      }
      ctx.restore();
    }

    for (const pt of particles) {
      const ptY=pt.y-cameraY;
      ctx.globalAlpha=pt.life*0.8; ctx.fillStyle=pt.color; ctx.shadowBlur=8; ctx.shadowColor=pt.color;
      ctx.beginPath(); ctx.arc(pt.x,ptY,pt.size,0,Math.PI*2); ctx.fill(); ctx.shadowBlur=0;
    }
    ctx.globalAlpha=1;

    for (const pu of powerups) {
      const puY=pu.y-cameraY;
      if (puY<-40||puY>lh+40) continue;
      const def=POWERUP_DEFS[pu.type]; const pulse=Math.sin(pu.pulse)*4;
      ctx.save();
      ctx.globalAlpha=0.3+Math.sin(pu.pulse)*0.1; ctx.fillStyle=def.color; ctx.shadowBlur=24; ctx.shadowColor=def.color;
      ctx.beginPath(); ctx.arc(pu.x,puY,pu.size+pulse+6,0,Math.PI*2); ctx.fill();
      ctx.globalAlpha=1; ctx.shadowBlur=16; ctx.fillStyle=def.color;
      ctx.beginPath(); ctx.arc(pu.x,puY,pu.size+pulse*0.3,0,Math.PI*2); ctx.fill();
      ctx.shadowBlur=0; ctx.globalAlpha=1;
      ctx.font=pu.size+'px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(pu.type===PU_TOGETHER?'\uD83D\uDD17':pu.type===PU_LISTEN?'\uD83D\uDCE2':'\u26A1',pu.x,puY);
      ctx.restore();
    }

    for (let i=0;i<player.trail.length;i++) {
      const t=player.trail[i]; const tY=t.y-cameraY;
      const alp=(t.alpha*(1-i/player.trail.length))*0.3;
      ctx.globalAlpha=alp;
      ctx.save();
      if (player.vx > 0) {
        ctx.scale(-1, 1);
        ctx.drawImage(getSelectedImage(), -(t.x + PLAYER_W), tY, PLAYER_W, PLAYER_H);
      } else {
        ctx.drawImage(getSelectedImage(), t.x, tY, PLAYER_W, PLAYER_H);
      }
      ctx.restore();
    }
    ctx.globalAlpha=1;

    const pScreenY=player.y-cameraY;
    ctx.shadowBlur=20; ctx.shadowColor=C.playerGlow; ctx.fillStyle=C.playerGlow;
    ctx.beginPath(); ctx.ellipse(player.x+PLAYER_W/2,pScreenY+PLAYER_H+2,22,8,0,0,Math.PI*2); ctx.fill();
    ctx.shadowBlur=0;

    ctx.save();
    if (player.vx > 0) {
      ctx.scale(-1, 1);
      ctx.drawImage(getSelectedImage(), -(player.x + PLAYER_W), pScreenY, PLAYER_W, PLAYER_H);
    } else {
      ctx.drawImage(getSelectedImage(), player.x, pScreenY, PLAYER_W, PLAYER_H);
    }
    ctx.restore();
  }
  // ── GAME LOOP ─────────────────────────────────────────
  function gameLoop(ts) {
    if (!running) return;
    const dt = Math.min(ts-lastTime, 50);
    lastTime = ts;
    update(dt);
    render();
    frameId = requestAnimationFrame(gameLoop);
  }

  // ── SCORE ANIMATION ───────────────────────────────────
  function animateScore(finalScore) {
    const el       = document.getElementById('go-score');
    const duration = Math.min(1200, 600+finalScore*0.3);
    const start    = performance.now();
    function tick(now) {
      const elapsed  = now - start;
      const progress = Math.min(elapsed/duration, 1);
      const eased    = 1 - Math.pow(1-progress, 3);
      el.textContent = Math.floor(eased*finalScore);
      if (progress < 1) requestAnimationFrame(tick);
      else              el.textContent = finalScore;
    }
    requestAnimationFrame(tick);
  }

  // ── GAME OVER ─────────────────────────────────────────
  function gameOver() {
    running = false;
    cancelAnimationFrame(frameId);
    playGameOver();

    if (score > bestScore) {
      bestScore = score;
      localStorage.setItem('peak_best', bestScore);
      checkUnlocks(bestScore);
    }

    animateScore(score);

    const isNewBest = (score >= bestScore && score > 0);
    const badge     = document.getElementById('go-rank-badge');
    if (isNewBest) badge.classList.remove('hidden');
    else           badge.classList.add('hidden');

    const shareMsg = 'I reached ' + score + '🔥 Momentum in PEAK: Rise to the Top. Can you beat me?';
    document.getElementById('share-text').textContent = shareMsg;

    document.getElementById('submit-status').textContent         = '';
    document.getElementById('submit-score-btn').textContent      = 'SUBMIT SCORE';
    document.getElementById('submit-score-btn').disabled         = false;
    document.getElementById('submit-score-btn').style.display    = '';
    document.getElementById('nickname-input').style.display      = '';
    document.querySelector('.form-label').style.display          = '';
    document.getElementById('nickname-form').classList.remove('hidden');
    document.getElementById('nearby-players').classList.add('hidden');

    showScreen('gameover-screen');
    loadNearbyPlayers(score);
  }


// ── SHARE ─────────────────────────────────────────────
  function copyShareText() {
    const btn     = document.getElementById('copy-btn');
    const textMsg = '🔥 I reached ' + score + ' Momentum in PEAK: Rise to the Top. Can you beat me? https://peak-game-rho.vercel.app/';
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    if (!isMobile) {
      // Desktop: just copy text
      if (navigator.clipboard) {
        navigator.clipboard.writeText(textMsg).then(() => {
          btn.textContent = 'Copied! ✓';
          setTimeout(() => { btn.textContent = 'Share Your Score 🔥'; }, 2000);
        }).catch(() => forceCopy());
      } else {
        forceCopy();
      }
      function forceCopy() {
        const el = document.createElement('textarea');
        el.value = textMsg; el.style.position = 'fixed'; el.style.opacity = '0';
        document.body.appendChild(el); el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        btn.textContent = 'Copied! ✓';
        setTimeout(() => { btn.textContent = 'Share Your Score 🔥'; }, 2000);
      }
      return;
    }

    // Mobile: generate image + share
    btn.textContent = 'Generating...';
    btn.disabled    = true;

    function drawCard(logoImg) {
      const sc  = document.createElement('canvas');
      sc.width  = 1080;
      sc.height = 1080;
      const s   = sc.getContext('2d');
      const hasLogo = !!logoImg;
      const midY    = hasLogo ? 60 : 0;

      s.fillStyle = '#f5efe6';
      s.fillRect(0, 0, 1080, 1080);
      s.fillStyle = '#97252C';
      s.fillRect(0, 0, 1080, 14);

      if (hasLogo) s.drawImage(logoImg, 440, 50, 200, 200);

      s.fillStyle = '#97252C'; s.font = 'bold 128px Montserrat, Georgia, serif';
      s.textAlign = 'center'; s.textBaseline = 'middle';
      s.fillText('PEAK', 540, 320 + midY);

      s.fillStyle = '#888'; s.font = '36px monospace';
      s.fillText('Rise to the Top', 540, 400 + midY);

      s.strokeStyle = '#97252C'; s.lineWidth = 3;
      s.beginPath(); s.moveTo(300, 455 + midY); s.lineTo(780, 455 + midY); s.stroke();

      s.fillStyle = '#888'; s.font = '38px monospace';
      s.fillText('MOMENTUM REACHED', 540, 530 + midY);

      s.fillStyle = '#97252C';
      s.font      = 'bold 200px Montserrat, Georgia, serif';
      s.fillText(score, 540, 700 + midY);

      s.fillStyle = '#aaa'; s.font = '28px monospace';
      s.fillText('Vote PEAK for SG', 540, 980);

      s.fillStyle = '#97252C';
      s.fillRect(0, 1066, 1080, 14);

      return sc;
    }

    function doShare(sc) {
      try {
        sc.toBlob(blob => {
          if (!blob) { fallback(); return; }
          btn.disabled = false; btn.textContent = 'Share Your Score 🔥';
          const file = new File([blob], 'peak-score.png', { type: 'image/png' });
          if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            navigator.share({ title: 'PEAK', text: textMsg, files: [file] }).catch(() => fallback());
          } else if (navigator.share) {
            navigator.share({ title: 'PEAK', text: textMsg }).catch(() => {});
          } else {
            fallback();
          }
        }, 'image/png');
      } catch(e) { fallback(); }
    }

    function fallback() {
      btn.disabled = false; btn.textContent = 'Share Your Score 🔥';
      if (navigator.clipboard) navigator.clipboard.writeText(textMsg).catch(() => {});
    }

    let handled = false;
    function handle(img) {
      if (handled) return; handled = true;
      doShare(drawCard(img));
    }

    const logo = new Image();
    logo.crossOrigin = 'anonymous';
    logo.onload  = () => handle(logo);
    logo.onerror = () => handle(null);
    setTimeout(() => handle(null), 3000);
    logo.src = 'logo.png?' + Date.now();
  }

  // ── SCORE SUBMISSION ──────────────────────────────────
  async function handleScoreSubmit() {
    const input  = document.getElementById('nickname-input');
    const status = document.getElementById('submit-status');
    const btn    = document.getElementById('submit-score-btn');
    let name = input.value.trim();
    if (!name) { status.textContent='Please enter a name.'; status.className='submit-status error'; return; }
    name = name.replace(/[^a-zA-Z0-9 _\-]/g,'').substring(0,20).trim();
    if (!name) { status.textContent='Invalid name. Use letters, numbers, spaces.'; status.className='submit-status error'; return; }
    if (typeof score!=='number'||score<0||score>99999||!Number.isInteger(score)) { status.textContent='Invalid score.'; status.className='submit-status error'; return; }
    btn.disabled=true; btn.textContent='Submitting...'; status.textContent=''; status.className='submit-status';
    try {
      await submitScore(name, score);
      status.textContent='Score submitted!'; status.className='submit-status';
      btn.textContent='Submitted'; btn.disabled=true;
      document.getElementById('nickname-input').style.display  ='none';
      document.getElementById('submit-score-btn').style.display='none';
      document.querySelector('.form-label').style.display      ='none';
      await loadLeaderboard();
      await loadNearbyPlayers(score);
    } catch(err) {
      console.error('Score submit error:',err);
      status.textContent='Could not submit. Check your connection.'; status.className='submit-status error';
      btn.disabled=false; btn.textContent='SUBMIT SCORE';
    }
  }

  async function loadNearbyPlayers(myScore) {
    try {
      const nearby = await getNearbyScores(myScore, 5);
      if (!nearby||nearby.length===0) return;
      const container = document.getElementById('nearby-players');
      const list      = document.getElementById('nearby-list');
      list.innerHTML  = '';
      nearby.forEach(entry => {
        const row=document.createElement('div');
        row.className='nearby-row'+(entry.isYou?' highlight':'');
        row.innerHTML='<span class="nr-rank">#'+entry.rank+'</span><span class="nr-name">'+escapeHtml(entry.name)+(entry.isYou?' (you)':'')+'</span><span class="nr-score">'+entry.score+'</span>';
        list.appendChild(row);
      });
      container.classList.remove('hidden');
    } catch(e) {}
  }

  // ── LEADERBOARD ───────────────────────────────────────
  async function loadLeaderboard() {
    const loading=document.getElementById('lb-loading'); const table=document.getElementById('lb-table');
    const empty=document.getElementById('lb-empty'); const tbody=document.getElementById('lb-body');
    const expandBtn=document.getElementById('lb-expand-btn');
    loading.classList.remove('hidden'); table.classList.add('hidden'); empty.classList.add('hidden'); expandBtn.classList.add('hidden');
    try {
      const scores = await getTopScores(25);
      loading.classList.add('hidden');
      if (!scores||scores.length===0) { empty.classList.remove('hidden'); return; }
      tbody.innerHTML='';
      const medals=['🥇','🥈','🥉'];
      scores.forEach((entry,i) => {
        const rank=i+1; const tr=document.createElement('tr');
        if (i>=5) tr.classList.add('lb-hidden-row');
        tr.innerHTML='<td><span class="rank-num">'+(rank<=3?'<span class="rank-medal">'+medals[i]+'</span>':rank)+'</span></td><td>'+escapeHtml(entry.name)+'</td><td><span class="score-val">'+entry.score.toLocaleString()+'</span></td><td><span class="date-val">'+formatDate(entry.timestamp)+'</span></td>';
        tbody.appendChild(tr);
      });
      table.classList.remove('hidden');
      if (scores.length>5) {
        expandBtn.classList.remove('hidden');
        expandBtn.textContent='SHOW ALL '+scores.length+' \u2193';
        expandBtn.onclick=()=>{ document.querySelectorAll('.lb-hidden-row').forEach(r=>r.style.display=''); expandBtn.classList.add('hidden'); };
      }
    } catch(err) { loading.textContent='Could not load leaderboard.'; console.error('LB load error:',err); }
  }

  // ── HELPERS ───────────────────────────────────────────
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => { s.classList.remove('active'); s.style.display=''; });
    const el=document.getElementById(id); el.style.display='flex'; el.classList.add('active');
  }

  function escapeHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  }

  function formatDate(ts) {
    if (!ts) return '\u2014';
    try { const d=ts.toDate?ts.toDate():new Date(ts); return d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'2-digit'}); }
    catch(e) { return '\u2014'; }
  }

  // ── ROUNDRECT POLYFILL ────────────────────────────────
  if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(x,y,w,h,r) {
      r=Math.min(r,w/2,h/2);
      this.beginPath();
      this.moveTo(x+r,y); this.lineTo(x+w-r,y); this.arcTo(x+w,y,x+w,y+r,r);
      this.lineTo(x+w,y+h-r); this.arcTo(x+w,y+h,x+w-r,y+h,r);
      this.lineTo(x+r,y+h); this.arcTo(x,y+h,x,y+h-r,r);
      this.lineTo(x,y+r); this.arcTo(x,y,x+r,y,r);
      this.closePath(); return this;
    };
  }

  // ── BOOT ──────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', init);
  window.__PEAK = { startGame, loadLeaderboard };

})();
