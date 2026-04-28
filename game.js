/* ============================================
   GAME ENGINE - Core game loop & logic
   Player 1: Human, Player 2: CPU
   ============================================ */

class Game {
    constructor(canvas, config = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.config = config;

        // Game dimensions
        this.width = 1024;
        this.height = 600;
        this.canvas.width = this.width;
        this.canvas.height = this.height;

        // Stage
        this.groundY = config.startY || (this.height - 60);
        this.stageImage = new Image();
        this.stageImage.src = 'assets/images/stage_bg.png';
        this.projectileImage = new Image();
        this.projectileImage.src = 'assets/images/projectile.png';

        // Handle player selection via URL parameters (?p1=X and ?p2=X)
        const urlParams = new URLSearchParams(window.location.search);
        const p1Choice = urlParams.get('p1') || '1';
        const p2Choice = urlParams.get('p2') || 'fighter';

        const getFighterSprites = (prefixNum) => {
            const prefix = `${prefixNum}_a`;
            return {
                idle: `assets/images/${prefix}.png`,
                walk: `assets/images/${prefix}_walking.png`,
                jump: `assets/images/${prefix}_jump.png`,
                crouch: `assets/images/${prefix}_crouch.png`,
                punch: `assets/images/${prefix}_punch.png`,
                kick: `assets/images/${prefix}_kick.png`,
                magic: `assets/images/${prefix}_magic.png`,
                defense: `assets/images/${prefix}_defense.png`,
                victory: `assets/images/${prefix}_victory.png`,
                death: `assets/images/${prefix}_death.png`,
                hit: `assets/images/${prefix}_ouch.png`,
                projectile: `assets/images/${prefixNum}_projectile.png`,
                run1: `assets/images/${prefix}_run_1.png`,
                run2: `assets/images/${prefix}_run_2.png`
            };
        };

        const p1Sprites = getFighterSprites(p1Choice);
        const p2Sprites = getFighterSprites(p2Choice);

        this.p1 = new Fighter(1, 150, true, p1Sprites, config);
        this.p2 = new Fighter(2, this.width - 250, false, p2Sprites, config);
        this.p1.groundY = this.groundY;
        this.p2.groundY = this.groundY;
        this.p1.opponent = this.p2;
        this.p2.opponent = this.p1;

        // CPU AI for Player 2
        this.cpu = new CPUController('normal', {
            speed: config.cpuSpeed || 1.0,
            attack: config.cpuAttack || 1.0
        });

        // Game state
        this.state = 'idle';
        this.round = 1;
        this.maxRounds = 3;
        this.winsNeeded = 2;
        this.timer = 99;
        this.timerInterval = null;
        this.introTimer = 0;
        this.introPhase = 0;

        // Input
        this.keys = {};
        this.setupInput();
        this.setupTouchControls();

        // Particles
        this.particles = [];

        // Frame timing
        this.lastTime = 0;
        this.accumulator = 0;
        this.fixedDT = 1000 / 60;
        this.running = false;

        // Callbacks
        this.onHealthUpdate = null;
        this.onSpecialUpdate = null;
        this.onTimerUpdate = null;
        this.onOverlay = null;
        this.onHideOverlay = null;
        this.onCombo = null;
        this.onHit = null;
        this.onBlock = null;
        this.onShake = null;
        this.onRoundWin = null;
        this.onMatchEnd = null;
    }

    setupInput() {
        this.lastRightTap = 0;
        window.addEventListener('keydown', (e) => {
            if (this.state !== 'fighting') return;

            // Evita que segurar a tecla dispare a corrida (ignore repetição do SO)
            if (e.code === 'ArrowRight' && !e.repeat) {
                const now = Date.now();
                if (now - this.lastRightTap < 300) {
                    this.p1.run();
                }
                this.lastRightTap = now;
            }

            this.keys[e.code] = true;
            e.preventDefault();
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
            e.preventDefault();

            // P1 block release
            if (e.code === 'KeyH') this.p1.stopBlocking();

            // P1 stop moving
            if (['ArrowLeft', 'ArrowRight'].includes(e.code)) {
                if (!this.keys['ArrowLeft'] && !this.keys['ArrowRight']) {
                    this.p1.stopMoving();
                }
            }

            // P1 release crouch
            if (e.code === 'ArrowDown') {
                if (this.p1.state === STATES.CROUCH) {
                    this.p1.stopMoving();
                }
            }
        });
    }

    setupTouchControls() {
        const touchContainer = document.getElementById('touch-controls');
        if (!touchContainer) return;

        // Detect touch support
        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        if (isTouchDevice) {
            touchContainer.classList.remove('hidden');
        }

        // Action Buttons
        const buttons = {
            'btn-touch-punch': 'KeyF',
            'btn-touch-kick': 'KeyG',
            'btn-touch-block': 'KeyH',
            'btn-touch-magic': 'KeyR'
        };

        Object.entries(buttons).forEach(([id, code]) => {
            const btn = document.getElementById(id);
            if (!btn) return;

            btn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                if (this.state !== 'fighting') return;

                if (code === 'KeyF') {
                    this.p1.punch();
                } else if (code === 'KeyG') {
                    this.p1.kick();
                } else if (code === 'KeyR') {
                    this.p1.magic();
                } else if (code === 'KeyH') {
                    this.p1.block();
                    this.keys['KeyH'] = true;
                }
            });

            btn.addEventListener('touchend', (e) => {
                e.preventDefault();
                if (code === 'KeyH') {
                    this.p1.stopBlocking();
                    this.keys['KeyH'] = false;
                }
            });
        });

        // Joystick (Full 360 Logic)
        const stick = document.getElementById('joystick-stick');
        const base = document.getElementById('joystick-base');
        if (!stick || !base) return;

        let activeTouchId = null;

        const handleJoystick = (touch) => {
            if (this.state !== 'fighting') return;

            const rect = base.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const maxDist = rect.width / 2;

            let dx = touch.clientX - centerX;
            let dy = touch.clientY - centerY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > maxDist) {
                dx *= maxDist / dist;
                dy *= maxDist / dist;
            }

            // Un-scale dx and dy for local CSS transform
            const scale = rect.width / base.offsetWidth;
            const localDx = dx / scale;
            const localDy = dy / scale;

            stick.style.transform = `translate(${localDx}px, ${localDy}px)`;

            // Horizontal (Move & Run)
            if (Math.abs(localDx) > 15) {
                if (localDx > 0) {
                    this.keys['ArrowRight'] = true;
                    this.keys['ArrowLeft'] = false;

                    // Run if pushed to the extreme (85% of max radius = ~51px)
                    if (localDx > 51) {
                        this.p1.run();
                    } else {
                        this.p1.moveForward();
                    }
                } else {
                    this.keys['ArrowLeft'] = true;
                    this.keys['ArrowRight'] = false;
                    this.p1.moveBackward();
                }
            } else {
                this.keys['ArrowLeft'] = false;
                this.keys['ArrowRight'] = false;
                if (this.p1.state !== STATES.CROUCH) {
                    this.p1.stopMoving();
                }
            }

            // Vertical (Jump & Crouch)
            if (localDy < -35) { // Jump (Up)
                this.p1.jump();
            } else if (localDy > 35) { // Crouch (Down)
                this.p1.crouch();
                this.keys['ArrowDown'] = true;
            } else {
                if (this.keys['ArrowDown']) {
                    this.keys['ArrowDown'] = false;
                    this.p1.stopMoving();
                }
            }
        };

        base.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (activeTouchId === null) {
                const touch = e.changedTouches[0];
                activeTouchId = touch.identifier;
                handleJoystick(touch);
            }
        });

        window.addEventListener('touchmove', (e) => {
            if (this.state === 'fighting') {
                e.preventDefault(); // Prevent scrolling entirely while fighting
            }
            if (activeTouchId !== null) {
                for (let i = 0; i < e.changedTouches.length; i++) {
                    if (e.changedTouches[i].identifier === activeTouchId) {
                        handleJoystick(e.changedTouches[i]);
                        break;
                    }
                }
            }
        }, { passive: false });

        window.addEventListener('touchend', (e) => {
            if (activeTouchId !== null) {
                for (let i = 0; i < e.changedTouches.length; i++) {
                    if (e.changedTouches[i].identifier === activeTouchId) {
                        activeTouchId = null;
                        stick.style.transform = 'translate(0, 0)';
                        this.keys['ArrowLeft'] = false;
                        this.keys['ArrowRight'] = false;
                        this.keys['ArrowDown'] = false;
                        this.p1.stopMoving();
                        break;
                    }
                }
            }
        });
    }


    start() {
        this.running = true;
        this.lastTime = performance.now();
        this.startRound();
        this.gameLoop(this.lastTime);
    }

    stop() {
        this.running = false;
        this.stopTimer();
    }

    startRound() {
        this.p1.reset(150);
        this.p2.reset(this.width - 250);
        this.p1.groundY = this.groundY;
        this.p2.groundY = this.groundY;

        this.state = 'intro';
        this.introTimer = 0;
        this.introPhase = 0;
        this.timer = 99;
        this.particles = [];

        if (this.onHealthUpdate) {
            this.onHealthUpdate(1, 100);
            this.onHealthUpdate(2, 100);
        }
        if (this.onSpecialUpdate) {
            this.onSpecialUpdate(1, 0);
            this.onSpecialUpdate(2, 0);
        }
        if (this.onTimerUpdate) this.onTimerUpdate(99);

        const roundText = this.round >= this.maxRounds ? 'FINAL ROUND' : `ROUND ${this.round}`;
        if (this.onOverlay) this.onOverlay(roundText, 'round');
        audio.playRound();
    }

    startTimer() {
        this.stopTimer();
        this.timerInterval = setInterval(() => {
            if (this.state !== 'fighting') return;
            this.timer--;
            if (this.onTimerUpdate) this.onTimerUpdate(this.timer);
            if (this.timer <= 0) { this.timer = 0; this.timeUp(); }
        }, 1000);
    }

    stopTimer() {
        if (this.timerInterval) { clearInterval(this.timerInterval); this.timerInterval = null; }
    }

    timeUp() {
        this.stopTimer();
        this.state = 'roundOver';
        if (this.p1.health > this.p2.health) this.roundWin(1);
        else if (this.p2.health > this.p1.health) this.roundWin(2);
        else {
            if (this.onOverlay) this.onOverlay("TIME UP", 'time-up');
            setTimeout(() => this.nextRound(), 2500);
        }
    }

    roundWin(playerNum) {
        this.stopTimer();
        this.state = 'roundOver';

        const winner = playerNum === 1 ? this.p1 : this.p2;
        const loser = playerNum === 1 ? this.p2 : this.p1;

        loser.state = STATES.DEFEATED;
        loser.canAct = false;
        winner.state = STATES.VICTORY;
        winner.wins++;

        if (this.onRoundWin) this.onRoundWin(playerNum);
        if (this.onOverlay) this.onOverlay('K.O.', 'ko');
        audio.playKO();
        if (this.onShake) this.onShake('heavy');
        this._spawnKOParticles(loser);

        setTimeout(() => {
            if (winner.wins >= this.winsNeeded) this.matchEnd(playerNum);
            else this.nextRound();
        }, 3000);
    }

    nextRound() {
        this.round++;
        if (this.onHideOverlay) this.onHideOverlay();
        setTimeout(() => this.startRound(), 500);
    }

    matchEnd(playerNum) {
        this.state = 'matchOver';
        audio.playVictory();
        audio.stopMusic();
        if (this.onMatchEnd) this.onMatchEnd(playerNum);
    }

    restartMatch() {
        this.round = 1;
        this.p1.wins = 0;
        this.p2.wins = 0;
        this.p1.reset(150);
        this.p2.reset(this.width - 250);
        this.state = 'idle';
        this.particles = [];
        if (this.onHideOverlay) this.onHideOverlay();
    }

    gameLoop(timestamp) {
        if (!this.running) return;
        const delta = timestamp - this.lastTime;
        this.lastTime = timestamp;
        this.accumulator += delta;

        while (this.accumulator >= this.fixedDT) {
            this.update();
            this.accumulator -= this.fixedDT;
        }
        this.render();
        requestAnimationFrame((ts) => this.gameLoop(ts));
    }

    update() {
        if (this.state === 'intro') { this.updateIntro(); return; }

        if (this.state !== 'fighting') {
            this.p1.update(this.width);
            this.p2.update(this.width);
            this._updateParticles();
            return;
        }

        // Process P1 input
        this.handleInput();

        // CPU AI for P2
        this.cpu.update(this.p2, this.p1, this.width);

        // Face each other
        this.p1.facingRight = this.p1.centerX < this.p2.centerX;
        this.p2.facingRight = this.p2.centerX < this.p1.centerX;

        // Update fighters
        this.p1.update(this.width);
        this.p2.update(this.width);

        // Collisions
        this.checkCollisions();
        this.pushApart();

        // Update HUD
        if (this.onHealthUpdate) {
            this.onHealthUpdate(1, this.p1.health);
            this.onHealthUpdate(2, this.p2.health);
        }
        if (this.onSpecialUpdate) {
            this.onSpecialUpdate(1, this.p1.specialMeter);
            this.onSpecialUpdate(2, this.p2.specialMeter);
        }

        // Check KO
        if (this.p1.health <= 0) this.roundWin(2);
        else if (this.p2.health <= 0) this.roundWin(1);

        this._updateParticles();
    }

    updateIntro() {
        this.introTimer++;
        if (this.introPhase === 0 && this.introTimer >= 90) {
            this.introPhase = 1;
            this.introTimer = 0;
            if (this.onOverlay) this.onOverlay('FIGHT!', 'fight');
            audio.playFight();
        } else if (this.introPhase === 1 && this.introTimer >= 60) {
            this.introPhase = 2;
            this.state = 'fighting';
            if (this.onHideOverlay) this.onHideOverlay();
            this.startTimer();
            audio.startMusic();
        }
        this.p1.update(this.width);
        this.p2.update(this.width);
    }

    handleInput() {
        // P1: WASD + F(punch) G(kick) H(block) R(magic/special)
        if (this.keys['ArrowLeft']) this.p1.moveBackward();
        if (this.keys['ArrowRight']) this.p1.moveForward();
        if (this.keys['ArrowUp']) { this.p1.jump(); this.keys['ArrowUp'] = false; }
        if (this.keys['ArrowDown']) this.p1.crouch();
        if (this.keys['KeyF']) { this.p1.punch(); this.keys['KeyF'] = false; }
        if (this.keys['KeyG']) { this.p1.kick(); this.keys['KeyG'] = false; }
        if (this.keys['KeyH']) this.p1.block();
        if (this.keys['KeyR']) { this.p1.magic(); this.keys['KeyR'] = false; }

        // Release crouch
        if (!this.keys['ArrowDown'] && this.p1.state === STATES.CROUCH) this.p1.stopMoving();
    }

    checkCollisions() {
        // P1 attack -> P2
        if (this.p1.attackHitbox && !this.p1.hasHitThisAttack) {
            if (this._rectsOverlap(this.p1.attackHitbox, this.p2.hitbox)) {
                this.p1.hasHitThisAttack = true;
                const result = this.p2.takeDamage(
                    this.p1.attackHitbox.damage, this.p1.attackHitbox.knockback, this.p1.attackHitbox.type
                );
                this._onHitEffect(this.p2, result, this.p1.attackHitbox);
                this.p1.specialMeter = Math.min(this.p1.maxSpecial, this.p1.specialMeter + 10);
            }
        }

        // P2 attack -> P1
        if (this.p2.attackHitbox && !this.p2.hasHitThisAttack) {
            if (this._rectsOverlap(this.p2.attackHitbox, this.p1.hitbox)) {
                this.p2.hasHitThisAttack = true;
                const result = this.p1.takeDamage(
                    this.p2.attackHitbox.damage, this.p2.attackHitbox.knockback, this.p2.attackHitbox.type
                );
                this._onHitEffect(this.p1, result, this.p2.attackHitbox);
                this.p2.specialMeter = Math.min(this.p2.maxSpecial, this.p2.specialMeter + 10);
            }
        }

        // P1 projectiles -> P2
        this.p1.projectiles.forEach((pr, index) => {
            if (pr.active) {
                if (this._rectsOverlap(pr, this.p2.hitbox)) {
                    const result = this.p2.takeDamage(pr.damage, 7, 'special');
                    this._onHitEffect(this.p2, result, { ...pr, type: 'special' });
                    pr.active = false;
                    this.p1.specialMeter = Math.min(this.p1.maxSpecial, this.p1.specialMeter + 6);
                    audio.playProjectileHit();
                }
            }
        });

        // P2 projectiles -> P1
        this.p2.projectiles.forEach((pr, index) => {
            if (pr.active) {
                if (this._rectsOverlap(pr, this.p1.hitbox)) {
                    const result = this.p1.takeDamage(pr.damage, 7, 'special');
                    this._onHitEffect(this.p1, result, { ...pr, type: 'special' });
                    pr.active = false;
                    this.p2.specialMeter = Math.min(this.p2.maxSpecial, this.p2.specialMeter + 6);
                    audio.playProjectileHit();
                }
            }
        });

        // Projectile vs projectile
        this.p1.projectiles.forEach(pr1 => {
            if (!pr1.active) return;
            this.p2.projectiles.forEach(pr2 => {
                if (!pr2.active) return;
                if (this._rectsOverlap(pr1, pr2)) {
                    const mx = (pr1.x + pr2.x) / 2;
                    const my = (pr1.y + pr2.y) / 2;
                    this._spawnParticles(mx, my, 15, '#ffffff');
                    pr1.active = false;
                    pr2.active = false;
                    audio.playProjectileHit();
                }
            });
        });
    }

    pushApart() {
        const h1 = this.p1.hitbox, h2 = this.p2.hitbox;
        if (this._rectsOverlap(h1, h2)) {
            const overlap = Math.min(h1.x + h1.width, h2.x + h2.width) - Math.max(h1.x, h2.x);
            const push = overlap / 2 + 1;
            if (this.p1.centerX < this.p2.centerX) { this.p1.x -= push; this.p2.x += push; }
            else { this.p1.x += push; this.p2.x -= push; }
        }
    }

    _onHitEffect(target, result, attackHitbox) {
        const hx = attackHitbox.x + attackHitbox.width / 2;
        const hy = attackHitbox.y + attackHitbox.height / 2;

        if (result.blocked) {
            if (this.onBlock) this.onBlock(hx, hy);
            this._spawnParticles(hx, hy, 5, '#00ccff');
        } else {
            if (this.onHit) this.onHit(hx, hy, result.damage);
            if (this.onShake) this.onShake(result.damage >= 12 ? 'heavy' : 'light');
            this._spawnParticles(hx, hy, 8 + result.damage, '#ffaa00');

            const attacker = target === this.p1 ? this.p2 : this.p1;
            attacker.comboCount++;
            attacker.comboTimer = 60;
            if (attacker.comboCount >= 2 && this.onCombo) {
                this.onCombo(attacker.playerNum, attacker.comboCount);
            }
        }
    }

    _spawnParticles(x, y, count, color) {
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x, y,
                vx: (Math.random() - 0.5) * 8,
                vy: (Math.random() - 0.5) * 8 - 2,
                life: 20 + Math.random() * 15,
                maxLife: 35,
                size: 2 + Math.random() * 4,
                color
            });
        }
    }

    _spawnKOParticles(loser) {
        const cx = loser.centerX, cy = loser.feetY - loser.height / 2;
        for (let i = 0; i < 40; i++) {
            this.particles.push({
                x: cx, y: cy,
                vx: (Math.random() - 0.5) * 15,
                vy: (Math.random() - 1) * 12,
                life: 40 + Math.random() * 30,
                maxLife: 70,
                size: 3 + Math.random() * 6,
                color: ['#ff4444', '#ffcc00', '#ff8800', '#ffffff'][Math.floor(Math.random() * 4)]
            });
        }
    }

    _updateParticles() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.3;
            p.vx *= 0.97;
            p.life--;
            if (p.life <= 0) this.particles.splice(i, 1);
        }
    }

    _rectsOverlap(a, b) {
        return a.x < b.x + b.width && a.x + a.width > b.x &&
            a.y < b.y + b.height && a.y + a.height > b.y;
    }

    // ---- RENDERING ----
    render() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.width, this.height);
        this._drawStage(ctx);

        const fighters = this.p1.centerX < this.p2.centerX ? [this.p1, this.p2] : [this.p2, this.p1];
        fighters[0].draw(ctx, this.projectileImage);
        fighters[1].draw(ctx, this.projectileImage);

        this._drawParticles(ctx);

        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.fillRect(0, this.groundY, this.width, 2);
    }

    _drawStage(ctx) {
        // Background is now handled by CSS (#game-bg) to support animated GIFs
        // We only clear the canvas and optionally draw effects here
    } 

    _drawParticles(ctx) {
        for (const p of this.particles) {
            const alpha = p.life / p.maxLife;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }
} 
