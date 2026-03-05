/* ═══════════════════════════════════════════════════════
   PEAK: Rise to the Top — game.js
   Pure Canvas 2D Game Engine (no external dependencies)
   ═══════════════════════════════════════════════════════ */

(() => {
  'use strict';

  // ──────────────────────────────────────────────────────
  //  CONSTANTS
  // ──────────────────────────────────────────────────────
  const CANVAS_W = 480;
  const CANVAS_H = 600;
  const GRAVITY   = 1.5;
  const JUMP_VEL  = -30;
  const MOVE_SPD  = 15;
  const PLAT_H    = 12;
  const PLAYER_W  = 70;
  const PLAYER_H  = 90;

  // Platform type IDs
  const PT_STATIC   = 0;
  const PT_MOVING   = 1;
  const PT_CRUMBLE  = 2;

  // Colors
const C = {
  bg:          '#f5efe6',
  bgStar:      'rgba(91,26,26,0.18)',

  playerBody:  '#5b1a1a',
  playerGlow:  'rgba(91,26,26,0.45)',
  playerShade: '#3a0f0f',

  platStatic:  '#ff5a5f',
  platMove:    '#8b5cf6',
  platCrumble: '#f59e0b',
  platCrumbleWarn: '#ff2d55',

  shadow:      'rgba(0,0,0,0.35)',
  particle:    '#ffd166',
  groundGlow:  'rgba(91,26,26,0.12)',
};

  // Difficulty bands
const BANDS = [
    { threshold: 0,   gap: [120, 170], moving: 0.0, crumble: 0.05, platW: [80, 120] },
    { threshold: 300, gap: [140, 190], moving: 0.15, crumble: 0.12, platW: [70, 110]  },
    { threshold: 600, gap: [160, 215], moving: 0.25, crumble: 0.18, platW: [60, 100]  },
    { threshold: 800, gap: [175, 230], moving: 0.35, crumble: 0.22, platW: [55, 90]  },
  ];

  // ──────────────────────────────────────────────────────
  //  STATE
  // ──────────────────────────────────────────────────────
  let canvas, ctx;
  let running = false;
  let score = 0;
  let bestScore = parseInt(localStorage.getItem('peak_best') || '0');
  let cameraY = 0;        // world Y of top of screen
  let highestY = 0;       // track highest player position
  let frameId;
  let lastTime = 0;
  
  const playerImg = new Image();
  playerImg.src = 'character.png';
  let particles = [];
  let stars = [];

  // Player state
  const player = {
    x: 0, y: 0,
    vx: 0, vy: 0,
    onGround: false,
    trail: [],
  };

  // Platforms array
  let platforms = [];

  // Input state
  const keys = { left: false, right: false };

  // Touch state
  let touchLeft = false, touchRight = false;

  // ──────────────────────────────────────────────────────
  //  INIT
  // ──────────────────────────────────────────────────────
  function init() {
    canvas = document.getElementById('game-canvas');
    ctx    = canvas.getContext('2d');

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Keyboard
    window.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft'  || e.key === 'a' || e.key === 'A') keys.left  = true;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = true;
    });
    window.addEventListener('keyup', e => {
      if (e.key === 'ArrowLeft'  || e.key === 'a' || e.key === 'A') keys.left  = false;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = false;
    });

    // Touch controls
    const tl = document.getElementById('touch-left');
    const tr = document.getElementById('touch-right');

    function bindTouch(el, setFn) {
      el.addEventListener('touchstart', e => { e.preventDefault(); setFn(true);  el.classList.add('pressed');    }, { passive: false });
      el.addEventListener('touchend',   e => { e.preventDefault(); setFn(false); el.classList.remove('pressed'); }, { passive: false });
      el.addEventListener('touchcancel',e => { e.preventDefault(); setFn(false); el.classList.remove('pressed'); }, { passive: false });
    }

    bindTouch(tl, v => { touchLeft  = v; });
    bindTouch(tr, v => { touchRight = v; });

    // Buttons
    document.getElementById('start-btn').addEventListener('click', startGame);
    document.getElementById('play-again-btn').addEventListener('click', startGame);
    document.getElementById('go-leaderboard-btn').addEventListener('click', () => {
      document.getElementById('leaderboard-section').scrollIntoView({ behavior: 'smooth' });
    });
    document.getElementById('copy-btn').addEventListener('click', copyShareText);
    document.getElementById('submit-score-btn').addEventListener('click', handleScoreSubmit);
    document.getElementById('refresh-lb-btn').addEventListener('click', () => loadLeaderboard());

    // Generate background stars
    generateStars(120);

    // Initial leaderboard load
    loadLeaderboard();

    // Update best display
    document.getElementById('hud-best').textContent = bestScore;
  }

  function resizeCanvas() {
    const container = document.getElementById('game-screen');
    const dpr = window.devicePixelRatio || 1;
    const cw  = container.clientWidth  || window.innerWidth;
    const ch  = container.clientHeight || window.innerHeight;

    canvas.width  = cw * dpr;
    canvas.height = ch * dpr;
    canvas.style.width  = cw + 'px';
    canvas.style.height = ch + 'px';
    ctx.scale(dpr, dpr);

    // Store logical size
    canvas._lw = cw;
    canvas._lh = ch;
  }

  // ──────────────────────────────────────────────────────
  //  STARS (decorative)
  // ──────────────────────────────────────────────────────
  function generateStars(n) {
    stars = [];
    for (let i = 0; i < n; i++) {
      stars.push({
        x:    Math.random() * CANVAS_W,
        y:    Math.random() * 4000,   // spread over large world area
        size: Math.random() * 1.5 + 0.5,
        alpha: Math.random() * 0.4 + 0.2,
      });
    }
  }

  // ──────────────────────────────────────────────────────
  //  GAME START
  // ──────────────────────────────────────────────────────
  function startGame() {
    showScreen('game-screen');
    resizeCanvas();

    score    = 0;
    cameraY  = 0;
    highestY = 0;
    particles = [];
    running  = true;

    // Reset player
    const lw = canvas._lw || CANVAS_W;
    const lh = canvas._lh || CANVAS_H;
    player.x  = lw / 2 - PLAYER_W / 2;
    player.y  = lh - 250;
    player.vx = 0;
    player.vy = 0;
    player.onGround = false;
    player.trail = [];

    // Generate initial platforms
    platforms = [];
    generateInitialPlatforms();

    // Update HUD
    document.getElementById('hud-score').textContent = '0';
    document.getElementById('hud-best').textContent  = bestScore;

    if (frameId) cancelAnimationFrame(frameId);
    lastTime = performance.now();
    frameId  = requestAnimationFrame(gameLoop);
  }

  // ──────────────────────────────────────────────────────
  //  PLATFORM GENERATION
  // ──────────────────────────────────────────────────────
  function getDifficulty(sc) {
    let band = BANDS[0];
    for (const b of BANDS) {
      if (sc >= b.threshold) band = b;
    }
    return band;
  }

  function randomBetween(a, b) {
    return a + Math.random() * (b - a);
  }

  function generateInitialPlatforms() {
    const lw = canvas._lw || CANVAS_W;
    const lh = canvas._lh || CANVAS_H;

    // Starting platform — directly under player, wide, static
    platforms.push({
      x:       lw / 2 - 90,
      y:       lh - 120,
      w:       180,
      h:       PLAT_H,
      type:    PT_STATIC,
      crumbling: false,
      crumbleTimer: 0,
      alpha:   1,
      dx:      0,
      // moving platform range
      minX: 0, maxX: 0, speed: 0,
    });

    // Build upward
    let lastY = lh - 120;
    while (lastY > -2000) {
      lastY = addPlatform(lastY, 0);
    }
  }

  function addPlatform(belowY, sc) {
    const lw    = canvas._lw || CANVAS_W;
    const diff  = getDifficulty(sc);
    const gap   = randomBetween(diff.gap[0], diff.gap[1]);
    const newY  = belowY - gap;
    const w     = randomBetween(diff.platW[0], diff.platW[1]);
    const x     = randomBetween(16, lw - w - 16);
    const roll  = Math.random();

    let type = PT_STATIC;
    if      (roll < diff.crumble)                  type = PT_CRUMBLE;
    else if (roll < diff.crumble + diff.moving)    type = PT_MOVING;

    const plat = {
      x, y: newY, w, h: PLAT_H,
      type, crumbling: false, crumbleTimer: 0, alpha: 1,
      dx: 0, minX: 0, maxX: 0, speed: 0,
    };

    if (type === PT_MOVING) {
      const range = randomBetween(60, 140);
      plat.minX  = Math.max(8, x - range / 2);
      plat.maxX  = Math.min(lw - w - 8, x + range / 2);
      plat.speed = randomBetween(1.2, 2.5) * (Math.random() < 0.5 ? 1 : -1);
    }

    platforms.push(plat);
    return newY;
  }

  function ensurePlatformsAbove() {
    // Find topmost platform
    let topY   = 99999;
    for (const p of platforms) topY = Math.min(topY, p.y);

    const targetTop = cameraY - 600;
    while (topY > targetTop) {
      topY = addPlatform(topY, score);
    }

    // Remove platforms far below camera (performance)
    const cullY = cameraY + (canvas._lh || CANVAS_H) + 400;
    platforms = platforms.filter(p => p.y < cullY);
  }

  // ──────────────────────────────────────────────────────
  //  PARTICLES
  // ──────────────────────────────────────────────────────
  function spawnLandParticles(px, py) {
    for (let i = 0; i < 8; i++) {
      particles.push({
        x:    px + PLAYER_W / 2,
        y:    py + PLAYER_H,
        vx:   (Math.random() - 0.5) * 4,
        vy:   -Math.random() * 3 - 0.5,
        life: 1,
        decay: Math.random() * 0.05 + 0.04,
        size: Math.random() * 4 + 2,
        color: C.particle,
      });
    }
  }

  function spawnCrumbleParticles(px, py, pw) {
    for (let i = 0; i < 14; i++) {
      particles.push({
        x:    px + Math.random() * pw,
        y:    py,
        vx:   (Math.random() - 0.5) * 5,
        vy:   -Math.random() * 2 + 1,
        life: 1,
        decay: Math.random() * 0.04 + 0.03,
        size: Math.random() * 5 + 3,
        color: C.platCrumble,
      });
    }
  }

  // ──────────────────────────────────────────────────────
  //  PHYSICS & UPDATE
  // ──────────────────────────────────────────────────────
  function update(dt) {
    if (!running) return;

    const lw = canvas._lw || CANVAS_W;
    const lh = canvas._lh || CANVAS_H;
    const dtN = dt / 16.667; // normalize to 60fps

    // Input
    const movingLeft  = keys.left  || touchLeft;
    const movingRight = keys.right || touchRight;

    if (movingLeft)  player.vx = -MOVE_SPD;
    else if (movingRight) player.vx = MOVE_SPD;
    else player.vx *= 0.75;

    // Gravity
    player.vy += GRAVITY * dtN;

    // Move
    player.x += player.vx * dtN;
    player.y += player.vy * dtN;

    // Wrap horizontal
    if (player.x + PLAYER_W < 0)  player.x = lw;
    if (player.x > lw)             player.x = -PLAYER_W;

    // Update trail
    player.trail.unshift({ x: player.x, y: player.y, alpha: 0.5 });
    if (player.trail.length > 6) player.trail.pop();

    // Platform collision (only falling downward)
    player.onGround = false;
    if (player.vy >= 0) {
      for (const p of platforms) {
        if (p.alpha <= 0) continue; // fully crumbled

        const screenY = p.y - cameraY;
        // Skip platforms far off screen for performance
        if (screenY < -80 || screenY > lh + 80) continue;

        const prevBottom = (player.y + PLAYER_H) - player.vy * dtN;
        const currBottom = player.y + PLAYER_H;

        if (
          player.x + PLAYER_W - 4 > p.x &&
          player.x + 4 < p.x + p.w &&
          prevBottom <= p.y + 2 &&
          currBottom >= p.y
        ) {
          player.y        = p.y - PLAYER_H;
          player.vy       = JUMP_VEL;
          player.onGround = true;

          spawnLandParticles(player.x, player.y);

          // Crumbling logic
          if (p.type === PT_CRUMBLE && !p.crumbling) {
            p.crumbling     = true;
            p.crumbleTimer  = 0;
            spawnCrumbleParticles(p.x, p.y, p.w);
          }
          break;
        }
      }
    }

    // Score = vertical height
    const worldY = player.y + cameraY;
    if (worldY < highestY || highestY === 0) {
      highestY = worldY;
    }

    // Score based on how high above start (initial lh-120 baseline)
    const initialBaseline = (canvas._lh || CANVAS_H) - 120;
    const rise = initialBaseline - (highestY - 0);
    score = Math.max(0, Math.floor(rise / 3));

    // Smooth camera: keep player in upper 40% of screen
    const targetCameraY = player.y - lh * 0.38;
    if (targetCameraY < cameraY) {
      cameraY += (targetCameraY - cameraY) * 0.12 * dtN;
    }

    // Update HUD
    document.getElementById('hud-score').textContent = score;
    if (score > bestScore) {
      bestScore = score;
      document.getElementById('hud-best').textContent = bestScore;
    }

    // Update platforms
    for (const p of platforms) {
      if (p.type === PT_MOVING) {
        p.x += p.speed * dtN;
        if (p.x <= p.minX || p.x >= p.maxX) p.speed *= -1;
      }

      if (p.crumbling) {
        p.crumbleTimer += dt;
        p.alpha = Math.max(0, 1 - p.crumbleTimer / 350);
      }
    }

    // Update particles
    for (const pt of particles) {
      pt.x   += pt.vx * dtN;
      pt.y   += pt.vy * dtN;
      pt.vy  += 0.15 * dtN;
      pt.life -= pt.decay * dtN;
    }
    particles = particles.filter(pt => pt.life > 0);

    // Ensure platforms above
    ensurePlatformsAbove();

    // Game over: player falls below camera bottom
    if (player.y - cameraY > lh + 60) {
      gameOver();
    }
  }

  // ──────────────────────────────────────────────────────
  //  RENDER
  // ──────────────────────────────────────────────────────
  function render() {
    const lw = canvas._lw || CANVAS_W;
    const lh = canvas._lh || CANVAS_H;

    ctx.clearRect(0, 0, lw, lh);

    // Background
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, lw, lh);

    // Stars
    for (const s of stars) {
      const sy = s.y - cameraY;
      if (sy < -5 || sy > lh + 5) continue;
      ctx.globalAlpha = s.alpha;
      ctx.fillStyle   = C.bgStar;
      ctx.beginPath();
      ctx.arc(s.x, sy, s.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Subtle vertical gradient overlay
    const grad = ctx.createLinearGradient(0, 0, 0, lh);
    grad.addColorStop(0, 'rgba(0,229,255,0.04)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, lw, lh);

    // Platforms
    for (const p of platforms) {
      const screenY = p.y - cameraY;
      if (screenY < -PLAT_H - 10 || screenY > lh + 20) continue;

      ctx.save();
      ctx.globalAlpha = p.alpha;

      // Shadow
      ctx.fillStyle = C.shadow;
      ctx.beginPath();
      ctx.roundRect(p.x + 3, screenY + 4, p.w, PLAT_H, 6);
      ctx.fill();

      // Platform body
      let color;
      if (p.type === PT_STATIC)  color = C.platStatic;
      if (p.type === PT_MOVING)  color = C.platMove;
      if (p.type === PT_CRUMBLE) {
        color = p.crumbling ? C.platCrumbleWarn : C.platCrumble;
      }

      // Glow
      ctx.shadowBlur  = 12;
      ctx.shadowColor = color;
      ctx.fillStyle   = color;
      ctx.beginPath();
      ctx.roundRect(p.x, screenY, p.w, PLAT_H, 6);
      ctx.fill();

      // Top highlight
      ctx.shadowBlur = 0;
      const hlGrad = ctx.createLinearGradient(p.x, screenY, p.x, screenY + PLAT_H);
      hlGrad.addColorStop(0, 'rgba(255,255,255,0.25)');
      hlGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = hlGrad;
      ctx.beginPath();
      ctx.roundRect(p.x, screenY, p.w, PLAT_H, 6);
      ctx.fill();

      // Moving platform indicator arrows
      if (p.type === PT_MOVING) {
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = '9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('◀ ▶', p.x + p.w / 2, screenY + 9);
      }

      // Crumble cracks
      if (p.type === PT_CRUMBLE && p.crumbling) {
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth   = 1;
        ctx.beginPath();
        ctx.moveTo(p.x + p.w * 0.3, screenY);
        ctx.lineTo(p.x + p.w * 0.3 + 8, screenY + PLAT_H);
        ctx.moveTo(p.x + p.w * 0.65, screenY);
        ctx.lineTo(p.x + p.w * 0.65 - 6, screenY + PLAT_H);
        ctx.stroke();
      }

      ctx.restore();
    }

    // Particles
    for (const pt of particles) {
      const ptY = pt.y - cameraY;
      ctx.globalAlpha = pt.life * 0.8;
      ctx.fillStyle   = pt.color;
      ctx.shadowBlur  = 8;
      ctx.shadowColor = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, ptY, pt.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;

   // Player trail
    for (let i = 0; i < player.trail.length; i++) {
      const t   = player.trail[i];
      const tY  = t.y - cameraY;
      const alp = (t.alpha * (1 - i / player.trail.length)) * 0.3;
      ctx.globalAlpha = alp;
      ctx.drawImage(playerImg, t.x, tY, PLAYER_W, PLAYER_H);
    }
    ctx.globalAlpha = 1;

    // Player
    const pScreenY = player.y - cameraY;

    // Glow beneath player
    ctx.shadowBlur  = 20;
    ctx.shadowColor = C.playerGlow;
    ctx.fillStyle   = C.playerGlow;
    ctx.beginPath();
    ctx.ellipse(player.x + PLAYER_W / 2, pScreenY + PLAYER_H + 2, 22, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Draw character image
    ctx.drawImage(playerImg, player.x, pScreenY, PLAYER_W, PLAYER_H);
  }

  // ──────────────────────────────────────────────────────
  //  GAME LOOP
  // ──────────────────────────────────────────────────────
  function gameLoop(ts) {
    if (!running) return;
    const dt = Math.min(ts - lastTime, 50); // cap at 50ms
    lastTime = ts;

    update(dt);
    render();

    frameId = requestAnimationFrame(gameLoop);
  }

  // ──────────────────────────────────────────────────────
  //  GAME OVER
  // ──────────────────────────────────────────────────────
function gameOver() {
    running = false;
    cancelAnimationFrame(frameId);

    // Save best
    if (score > bestScore) {
      bestScore = score;
      localStorage.setItem('peak_best', bestScore);
    }

    // Populate game over screen
    document.getElementById('go-score').textContent = score;

    const isNewBest = (score >= bestScore && score > 0);
    const badge = document.getElementById('go-rank-badge');
    if (isNewBest) badge.classList.remove('hidden');
    else           badge.classList.add('hidden');

    // Share text
    const shareMsg = `🔥 I reached ${score} Momentum in PEAK: Rise to the Top. Can you beat me?`;
    document.getElementById('share-text').textContent = shareMsg;

    // Reset submit form
    document.getElementById('submit-status').textContent = '';
    document.getElementById('submit-score-btn').textContent = 'SUBMIT SCORE';
    document.getElementById('submit-score-btn').disabled    = false;
    document.getElementById('submit-score-btn').style.display = '';
    document.getElementById('nickname-input').style.display  = '';
    document.querySelector('.form-label').style.display      = '';
    document.getElementById('nickname-form').classList.remove('hidden');
    document.getElementById('nearby-players').classList.add('hidden');

    showScreen('gameover-screen');
    loadNearbyPlayers(score);
  }

  // ──────────────────────────────────────────────────────
  //  SHARE
  // ──────────────────────────────────────────────────────
function copyShareText() {
    const displayMsg = `🔥 I reached ${score} Momentum in PEAK: Rise to the Top. Can you beat me?`;
    const copyMsg    = `${displayMsg} https://peak-game-rho.vercel.app/`;
    const btn = document.getElementById('copy-btn');

    if (navigator.clipboard) {
      navigator.clipboard.writeText(copyMsg).then(() => {
        btn.classList.add('copy-feedback');
        btn.textContent = '✓ Copied!';
        setTimeout(() => {
          btn.classList.remove('copy-feedback');
          btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> Copy & Share`;
        }, 2000);
      });
    } else {
      const el = document.createElement('textarea');
      el.value = copyMsg;
      el.style.position = 'fixed';
      el.style.opacity  = '0';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      btn.textContent = '✓ Copied!';
      setTimeout(() => { btn.textContent = 'Copy & Share'; }, 2000);
    }
  }

  // ──────────────────────────────────────────────────────
  //  SCORE SUBMISSION
  // ──────────────────────────────────────────────────────
  async function handleScoreSubmit() {
    const input  = document.getElementById('nickname-input');
    const status = document.getElementById('submit-status');
    const btn    = document.getElementById('submit-score-btn');

    let name = input.value.trim();
    if (!name) {
      status.textContent = 'Please enter a name.';
      status.className   = 'submit-status error';
      return;
    }

    // Sanitize
    name = name.replace(/[^a-zA-Z0-9 _\-]/g, '').substring(0, 20).trim();
    if (!name) {
      status.textContent = 'Invalid name. Use letters, numbers, spaces.';
      status.className   = 'submit-status error';
      return;
    }

    // Basic anti-tamper: score must be a sane number
    if (typeof score !== 'number' || score < 0 || score > 99999 || !Number.isInteger(score)) {
      status.textContent = 'Invalid score.';
      status.className   = 'submit-status error';
      return;
    }

    btn.disabled   = true;
    btn.textContent = 'Submitting...';
    status.textContent = '';
    status.className   = 'submit-status';

    try {
      await submitScore(name, score);

      status.textContent = '✓ Score submitted!';
      status.className   = 'submit-status';
      btn.textContent    = 'Submitted ✓';
      btn.disabled       = true;

      // Hide only the form inputs, not the whole container
      document.getElementById('nickname-input').style.display  = 'none';
      document.getElementById('submit-score-btn').style.display = 'none';
      document.querySelector('.form-label').style.display       = 'none';

      // Reload leaderboard
      await loadLeaderboard();
      await loadNearbyPlayers(score);
    } catch (err) {
      console.error('Score submit error:', err);
      status.textContent = 'Could not submit. Check your connection.';
      status.className   = 'submit-status error';
      btn.disabled   = false;
      btn.textContent = 'SUBMIT SCORE';
    }
  }

  async function loadNearbyPlayers(myScore) {
    try {
      const nearby = await getNearbyScores(myScore, 5);
      if (!nearby || nearby.length === 0) return;

      const container = document.getElementById('nearby-players');
      const list      = document.getElementById('nearby-list');
      list.innerHTML  = '';

      nearby.forEach(entry => {
        const row = document.createElement('div');
        row.className = 'nearby-row' + (entry.isYou ? ' highlight' : '');
        row.innerHTML = `
          <span class="nr-rank">#${entry.rank}</span>
          <span class="nr-name">${escapeHtml(entry.name)}${entry.isYou ? ' (you)' : ''}</span>
          <span class="nr-score">${entry.score}</span>
        `;
        list.appendChild(row);
      });

      container.classList.remove('hidden');
    } catch (e) {
      // Silently fail — leaderboard not required for game to work
    }
  }

  // ──────────────────────────────────────────────────────
  //  LEADERBOARD DISPLAY
  // ──────────────────────────────────────────────────────
  async function loadLeaderboard() {
    const loading = document.getElementById('lb-loading');
    const table   = document.getElementById('lb-table');
    const empty   = document.getElementById('lb-empty');
    const tbody   = document.getElementById('lb-body');

    loading.classList.remove('hidden');
    table.classList.add('hidden');
    empty.classList.add('hidden');

    try {
      const scores = await getTopScores(25);

      loading.classList.add('hidden');

      if (!scores || scores.length === 0) {
        empty.classList.remove('hidden');
        return;
      }

      tbody.innerHTML = '';
      const medals = ['🥇', '🥈', '🥉'];

scores.forEach((entry, i) => {
        const rank = i + 1;
        const tr   = document.createElement('tr');
        if (i >= 5) tr.classList.add('lb-hidden-row');
        tr.innerHTML = `
          <td><span class="rank-num">${rank <= 3 ? `<span class="rank-medal">${medals[i]}</span>` : rank}</span></td>
          <td>${escapeHtml(entry.name)}</td>
          <td><span class="score-val">${entry.score.toLocaleString()}</span></td>
          <td><span class="date-val">${formatDate(entry.timestamp)}</span></td>
        `;
        tbody.appendChild(tr);
      });

      table.classList.remove('hidden');

      const expandBtn = document.getElementById('lb-expand-btn');
      if (scores.length > 5) {
        expandBtn.classList.remove('hidden');
        expandBtn.textContent = `SHOW ALL ${scores.length} ↓`;
        expandBtn.onclick = () => {
          document.querySelectorAll('.lb-hidden-row').forEach(r => r.style.display = '');
          expandBtn.classList.add('hidden');
        };
      }

      table.classList.remove('hidden');
    } catch (err) {
      loading.textContent = 'Could not load leaderboard.';
      console.error('LB load error:', err);
    }
  }

  // ──────────────────────────────────────────────────────
  //  HELPERS
  // ──────────────────────────────────────────────────────
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => {
      s.classList.remove('active');
      s.style.display = '';
    });
    const el = document.getElementById(id);
    el.style.display = 'flex';
    el.classList.add('active');
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g,  '&amp;')
      .replace(/</g,  '&lt;')
      .replace(/>/g,  '&gt;')
      .replace(/"/g,  '&quot;')
      .replace(/'/g,  '&#039;');
  }

  function formatDate(ts) {
    if (!ts) return '—';
    try {
      const d = ts.toDate ? ts.toDate() : new Date(ts);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
    } catch (e) {
      return '—';
    }
  }

  // ──────────────────────────────────────────────────────
  //  ROUNDRECT POLYFILL
  // ──────────────────────────────────────────────────────
  if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
      r = Math.min(r, w / 2, h / 2);
      this.beginPath();
      this.moveTo(x + r, y);
      this.lineTo(x + w - r, y);
      this.arcTo(x + w, y, x + w, y + r, r);
      this.lineTo(x + w, y + h - r);
      this.arcTo(x + w, y + h, x + w - r, y + h, r);
      this.lineTo(x + r, y + h);
      this.arcTo(x, y + h, x, y + h - r, r);
      this.lineTo(x, y + r);
      this.arcTo(x, y, x + r, y, r);
      this.closePath();
      return this;
    };
  }

  // ──────────────────────────────────────────────────────
  //  BOOT
  // ──────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', init);

  // Expose for index.html button onclick fallback
  window.__PEAK = { startGame, loadLeaderboard };

})();
