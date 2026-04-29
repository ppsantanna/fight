/* ============================================
   FIGHTER CLASS - Character logic & rendering
   With per-state sprite images and chroma key
   ============================================ */

const STATES = {
    IDLE: 'idle',
    WALK_FORWARD: 'walkForward',
    WALK_BACKWARD: 'walkBackward',
    JUMP: 'jump',
    CROUCH: 'crouch',
    PUNCH: 'punch',
    KICK: 'kick',
    SPECIAL: 'special',
    BLOCK: 'block',
    HIT: 'hit',
    DEFEATED: 'defeated',
    VICTORY: 'victory',
    RUN: 'run'
};

/* ---- Helper: load an image and remove magenta background ---- */
function loadSpriteImage(src, callback) {
    const img = new Image();
    img.onload = () => {
        // Retornando a imagem diretamente para garantir rapidez e compatibilidade
        callback(img);
    };
    img.onerror = (err) => {
        console.error("Erro ao carregar sprite:", src, err);
        callback(null);
    };
    img.src = src;
}

class Fighter {
    constructor(playerNum, x, facingRight, spriteConfig, config = {}) {
        this.playerNum = playerNum;
        this.x = x;
        this.y = 0;
        this.facingRight = facingRight;
        this.config = config;
        this.usedTractorMatch = false; // "essa ação só possa ser executada uma vez por luta"

        // Dimensions scaled by config
        const scale = config.fighterScale || 1.0;
        this.width = 100 * scale;
        this.height = 180 * scale;
        this.groundY = 0;

        // Physics
        this.vx = 0;
        this.vy = 0;
        this.speed = 4.5;
        this.jumpForce = 15;
        this.gravity = 0.65;
        this.isGrounded = true;

        // State
        this.state = STATES.IDLE;
        this.stateTimer = 0;
        this.animFrame = 0;
        this.animTimer = 0;

        // Combat
        this.health = 100;
        this.maxHealth = 100;
        this.specialMeter = 0;
        this.maxSpecial = 100;
        this.damage = {
            punch: 6,
            kick: 9,
            special: 16,
            projectile: 14
        };
        this.attackHitbox = null;
        this.hasHitThisAttack = false;
        this.isBlocking = false;
        this.blockStun = 0;
        this.hitStun = 0;
        this.comboCount = 0;
        this.comboTimer = 0;
        this.canAct = true;

        // Projectiles - now an array to allow multiple on screen
        this.projectiles = [];

        // Input buffer for combos
        this.inputBuffer = [];
        this.inputBufferTimeout = 600;

        // Sprites - per-state canvases
        this.sprites = {};
        this.spritesLoaded = false;
        this._loadSprites(spriteConfig);

        // Visual effects
        this.flashTimer = 0;
        this.shakeX = 0;
        this.shakeY = 0;
        this.alpha = 1;
        this.drawOffsetX = 0;
        this.drawOffsetY = 0;
        this.drawScaleX = 1;
        this.drawScaleY = 1;
        this.drawRotation = 0;

        // Round stats
        this.wins = 0;
    }

    _loadSprites(config) {
        if (!config) return;
        const states = ['idle', 'walk', 'jump', 'crouch', 'punch', 'kick', 'magic', 'defense', 'victory', 'death', 'hit', 'projectile', 'run1', 'run2'];
        let loaded = 0;
        const total = states.filter(s => config[s]).length;
        if (total === 0) return;

        states.forEach(state => {
            if (config[state]) {
                loadSpriteImage(config[state], (canvas) => {
                    if (canvas) this.sprites[state] = canvas;
                    loaded++;
                    if (loaded >= total) this.spritesLoaded = true;
                });
            }
        });
    }

    reset(x) {
        this.x = x;
        this.y = 0;
        this.vx = 0;
        this.vy = 0;
        this.health = this.maxHealth;
        this.specialMeter = 0;
        this.state = STATES.IDLE;
        this.stateTimer = 0;
        this.isGrounded = true;
        this.attackHitbox = null;
        this.hasHitThisAttack = false;
        this.isBlocking = false;
        this.blockStun = 0;
        this.hitStun = 0;
        this.comboCount = 0;
        this.comboTimer = 0;
        this.canAct = true;
        this.projectiles = [];
        this.inputBuffer = [];
        this.flashTimer = 0;
        this.alpha = 1;
    }

    get feetY() { return this.groundY - this.y; }
    get centerX() { return this.x + this.width / 2; }
    get hitbox() {
        const scale = this.config.fighterScale || 1.0;
        const insetX = 15 * scale;
        const insetY = 10 * scale;

        let currentHeight = this.height;
        if (this.state === STATES.CROUCH) {
            currentHeight = this.height * 0.5; // Reduced to 50% for better clearance
        }

        return {
            x: this.x + insetX,
            y: this.feetY - currentHeight + insetY,
            width: this.width - insetX * 2,
            height: currentHeight - insetY
        };
    }

    // ---- Input ----
    addInput(action) {
        const now = Date.now();
        this.inputBuffer.push({ action, time: now });
        this.inputBuffer = this.inputBuffer.filter(i => now - i.time < this.inputBufferTimeout);
    }

    checkCombo() {
        if (this.inputBuffer.length < 3) return null;
        const recent = this.inputBuffer.slice(-5).map(i => i.action);
        const str = recent.join(',');
        if (str.includes('down,forward,punch') || str.includes('forward,down,punch')) {
            this.inputBuffer = [];
            return 'fireball';
        }
        if (str.includes('down,down,kick') || str.includes('forward,forward,kick')) {
            this.inputBuffer = [];
            return 'dragon_kick';
        }
        if (str.includes('forward,forward,punch')) {
            this.inputBuffer = [];
            return 'dash_punch';
        }
        if (str.includes('down,forward,magic') || str.includes('forward,down,magic')) {
            this.inputBuffer = [];
            return 'tractor';
        }
        return null;
    }

    // ---- Actions ----
    moveForward() {
        if (!this.canAct || this.hitStun > 0) return;
        if ([STATES.PUNCH, STATES.KICK, STATES.SPECIAL, STATES.RUN].includes(this.state)) return;
        this.addInput('forward');
        this.vx = this.facingRight ? this.speed : -this.speed;
        if (this.isGrounded && this.state !== STATES.JUMP) this.state = STATES.WALK_FORWARD;
    }

    moveBackward() {
        if (!this.canAct || this.hitStun > 0) return;
        if ([STATES.PUNCH, STATES.KICK, STATES.SPECIAL, STATES.RUN].includes(this.state)) return;
        this.addInput('backward');
        this.vx = this.facingRight ? -this.speed : this.speed;
        if (this.isGrounded && this.state !== STATES.JUMP) this.state = STATES.WALK_BACKWARD;
    }

    jump() {
        if (!this.canAct || !this.isGrounded || this.hitStun > 0) return;
        if ([STATES.PUNCH, STATES.KICK, STATES.SPECIAL].includes(this.state)) return;
        this.vy = this.jumpForce;
        this.isGrounded = false;
        this.state = STATES.JUMP;
    }

    crouch() {
        if (!this.canAct || !this.isGrounded || this.hitStun > 0) return;
        if ([STATES.PUNCH, STATES.KICK, STATES.SPECIAL, STATES.RUN].includes(this.state)) return;
        this.addInput('down');
        this.state = STATES.CROUCH;
        this.vx = 0;
    }

    punch() {
        if (!this.canAct || this.hitStun > 0) return;
        if ([STATES.PUNCH, STATES.KICK, STATES.SPECIAL].includes(this.state)) return;
        this.addInput('punch');
        const combo = this.checkCombo();
        if (combo === 'fireball' && this.specialMeter >= 25) { this.doFireball(); return; }
        if (combo === 'dash_punch' && this.specialMeter >= 20) { this.doDashPunch(); return; }

        this.state = STATES.PUNCH;
        this.stateTimer = 18;
        this.hasHitThisAttack = false;
        this.vx = 0;
        const reach = 60;
        this.attackHitbox = {
            x: this.facingRight ? this.x + this.width - 10 : this.x + 10 - reach,
            y: this.feetY - this.height + 35,
            width: reach, height: 45,
            damage: this.damage.punch, type: 'punch', knockback: 4
        };
    }

    kick() {
        if (!this.canAct || this.hitStun > 0) return;
        if ([STATES.PUNCH, STATES.KICK, STATES.SPECIAL].includes(this.state)) return;
        this.addInput('kick');
        const combo = this.checkCombo();
        if (combo === 'dragon_kick' && this.specialMeter >= 25) { this.doDragonKick(); return; }

        this.state = STATES.KICK;
        this.stateTimer = 22;
        this.hasHitThisAttack = false;
        this.vx = 0;
        const reach = 70;
        this.attackHitbox = {
            x: this.facingRight ? this.x + this.width - 10 : this.x + 10 - reach,
            y: this.feetY - this.height + 55,
            width: reach, height: 55,
            damage: this.damage.kick, type: 'kick', knockback: 6
        };
    }

    magic() {
        // Direct magic command - easier than combo
        if (!this.canAct || this.hitStun > 0) return;
        if ([STATES.PUNCH, STATES.KICK, STATES.SPECIAL, STATES.RUN].includes(this.state)) return;

        this.addInput('magic');
        const combo = this.checkCombo();
        if (combo === 'tractor') { this.doTractor(); return; }

        // Cost removed to make it always accessible as requested
        this.doFireball();
    }

    run() {
        if (!this.canAct || this.hitStun > 0 || !this.isGrounded) return;
        if ([STATES.PUNCH, STATES.KICK, STATES.SPECIAL, STATES.DEFEATED, STATES.VICTORY].includes(this.state)) return;
        this.state = STATES.RUN;
        this.vx = this.facingRight ? this.speed * 2.2 : -this.speed * 2.2;
        this.animTimer = 0;
        this.animFrame = 0;
    }

    block() {
        if (!this.canAct || this.hitStun > 0 || !this.isGrounded) return;
        if ([STATES.PUNCH, STATES.KICK, STATES.SPECIAL].includes(this.state)) return;
        this.state = STATES.BLOCK;
        this.isBlocking = true;
        this.vx = 0;
    }

    stopBlocking() {
        if (this.state === STATES.BLOCK) { this.isBlocking = false; this.state = STATES.IDLE; }
    }

    doFireball() {
        // No cost for projectiles
        this.state = STATES.SPECIAL;
        this.stateTimer = 30;
        this.vx = 0;

        // Spawn the projectile after a short startup
        setTimeout(() => {
            // Even if hit, the magic is "released" now
            const mScale = this.config.magicScale || 1.0;
            const proj = {
                x: this.facingRight ? this.x + this.width : this.x - 60 * mScale,
                y: this.feetY - this.height * 0.95, // Further raised to visibly clear the opponent's head when crouching
                width: 70 * mScale, height: 50 * mScale,
                vx: this.facingRight ? 12 : -12, // Increased speed
                damage: this.damage.projectile,
                active: true, animFrame: 0,
                playerNum: this.playerNum
            };
            this.projectiles.push(proj);

            if (this.playerNum === 1) {
                audio.playExternalSFX('magic');
            } else {
                audio.playSpecial();
            }
        }, 200);
    }

    doTractor() {
        if (this.usedTractorMatch) return;
        this.usedTractorMatch = true;

        this.state = STATES.SPECIAL;
        this.stateTimer = 50;
        this.hasHitThisAttack = false;
        this.vx = 0;
        this.vy = 0;

        const prefix = this.config.playerPrefix || '1';
        const gameScreen = document.getElementById('game-screen');
        const gameCanvas = document.getElementById('game-canvas');
        if (!gameScreen || !gameCanvas) return;

        const img = document.createElement('img');
        img.src = `assets/images/${prefix}_a_trator.gif`;
        img.className = 'tractor-effect';
        img.style.position = 'absolute';
        img.style.zIndex = '3'; // To guarantee layer above background
        img.style.pointerEvents = 'none';

        const isRight = this.facingRight;
        if (isRight) {
            img.style.transform = 'scaleX(-1)';
        }

        // Insert behind canvas
        gameScreen.insertBefore(img, gameCanvas);

        const mScale = this.config.fighterScale || 1.0;
        const rect = gameCanvas.getBoundingClientRect();
        const scaleX = rect.width / gameCanvas.width;
        const scaleY = rect.height / gameCanvas.height;

        const tractor = {
            element: img,
            isRight: isRight,
            x: isRight ? -400 : 1024 + 100,
            y: this.groundY - 180 * mScale,
            width: 300 * mScale,
            height: 180 * mScale,
            vx: isRight ? 18 : -18,
            damage: 100,
            active: true,
            isTractor: true
        };

        this.projectiles.push(tractor);
        audio.playSpecial();
    }

    doDragonKick() {
        this.specialMeter -= 25;
        this.state = STATES.SPECIAL;
        this.stateTimer = 30;
        this.hasHitThisAttack = false;
        this.vy = -12;
        this.vx = this.facingRight ? 8 : -8;
        this.isGrounded = false;
        const reach = 75;
        this.attackHitbox = {
            x: this.facingRight ? this.x + this.width - 10 : this.x + 10 - reach,
            y: this.feetY - this.height + 20, width: reach, height: 65,
            damage: this.damage.special, type: 'special', knockback: 9
        };
        audio.playSpecial();
    }

    doDashPunch() {
        this.specialMeter -= 20;
        this.state = STATES.SPECIAL;
        this.stateTimer = 22;
        this.hasHitThisAttack = false;
        this.vx = this.facingRight ? 12 : -12;
        const reach = 85;
        this.attackHitbox = {
            x: this.facingRight ? this.x + this.width - 10 : this.x + 10 - reach,
            y: this.feetY - this.height + 30, width: reach, height: 55,
            damage: this.damage.special, type: 'special', knockback: 11
        };
        audio.playSpecial();
    }

    stopMoving() {
        if ([STATES.WALK_FORWARD, STATES.WALK_BACKWARD, STATES.CROUCH].includes(this.state)) {
            this.state = STATES.IDLE;
            this.vx = 0;
        }
    }

    takeDamage(amount, knockback, type) {
        if (this.state === STATES.DEFEATED) return { blocked: false, damage: 0 };
        if (this.isBlocking) {
            const reduced = Math.floor(amount * 0.15);
            this.health = Math.max(0, this.health - reduced);
            this.blockStun = 10;
            this.vx = this.facingRight ? -3 : 3;
            audio.playBlock();
            return { blocked: true, damage: reduced };
        }
        this.health = Math.max(0, this.health - amount);
        this.hitStun = 18;
        this.state = STATES.HIT;
        this.stateTimer = 18;
        this.canAct = false;
        this.flashTimer = 10;
        this.vx = this.facingRight ? -knockback : knockback;
        if (!this.isGrounded) this.vy = -4;

        if (type === 'punch') audio.playPunch();
        else if (type === 'kick') audio.playKick();
        else audio.playProjectileHit();

        if (this.health <= 0) { this.state = STATES.DEFEATED; this.canAct = false; }
        return { blocked: false, damage: amount };
    }

    // ---- Update ----
    update(stageWidth) {
        // Timers
        if (this.stateTimer > 0) {
            this.stateTimer--;
            if (this.stateTimer === 0) {
                if ([STATES.PUNCH, STATES.KICK, STATES.SPECIAL].includes(this.state)) {
                    this.state = STATES.IDLE;
                    this.attackHitbox = null;
                }
                if (this.state === STATES.HIT) { this.state = STATES.IDLE; this.canAct = true; }
            }
        }
        if (this.hitStun > 0) { this.hitStun--; if (this.hitStun === 0) this.canAct = true; }
        if (this.blockStun > 0) this.blockStun--;
        if (this.flashTimer > 0) this.flashTimer--;
        if (this.comboTimer > 0) { this.comboTimer--; if (this.comboTimer === 0) this.comboCount = 0; }

        // Run logic - check distance to opponent
        if (this.state === STATES.RUN && this.opponent) {
            const dist = Math.abs(this.centerX - this.opponent.centerX);
            const h1 = this.hitbox;
            const h2 = this.opponent.hitbox;
            const overlapping = (h1.x < h2.x + h2.width && h1.x + h1.width > h2.x &&
                h1.y < h2.y + h2.height && h1.y + h1.height > h2.y);

            if (dist < 110 || overlapping) {
                this.state = STATES.IDLE;
                this.vx = 0;
                this.animTimer = 0;
            } else {
                // Keep moving towards opponent
                this.vx = this.centerX < this.opponent.centerX ? this.speed * 2.2 : -this.speed * 2.2;
            }
        }

        // Friction
        if (this.state === STATES.IDLE || this.state === STATES.HIT) {
            this.vx *= 0.8;
            if (Math.abs(this.vx) < 0.3) this.vx = 0;
        }

        // Gravity
        if (!this.isGrounded) this.vy -= this.gravity;

        // Move
        this.x += this.vx;
        this.y += this.vy;

        // Ground
        if (this.y <= 0) {
            this.y = 0;
            this.vy = 0;
            if (!this.isGrounded) {
                this.isGrounded = true;
                if (this.state === STATES.JUMP) this.state = STATES.IDLE;
            }
        }

        // Bounds
        if (this.x < 10) this.x = 10;
        if (this.x + this.width > stageWidth - 10) this.x = stageWidth - 10 - this.width;

        // Update attack hitbox for specials
        if (this.attackHitbox && this.state === STATES.SPECIAL) {
            const reach = this.attackHitbox.width;
            this.attackHitbox.x = this.facingRight ? this.x + this.width - 10 : this.x + 10 - reach;
            this.attackHitbox.y = this.feetY - this.height + 30;
        }

        // Update all projectiles
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            if (p.active) {
                p.x += p.vx;
                if (!p.isTractor) p.animFrame++;

                if (p.isTractor) {
                    if (p.element) {
                        // Como o #game-container já possui 1024x600 e faz o 'scale' nativamente no CSS via transform,
                        // podemos usar as coordenadas reais diretamente.
                        p.element.style.left = p.x + 'px';
                        p.element.style.top = p.y + 'px';
                        p.element.style.width = p.width + 'px';
                        p.element.style.height = p.height + 'px';
                    }
                }

                // Remove se estiver fora da tela largamente
                if (p.x < -1000 || p.x > stageWidth + 1000) {
                    if (p.isTractor && p.element) p.element.remove();
                    this.projectiles.splice(i, 1);
                }
            } else {
                if (p.isTractor && p.element) p.element.remove();
                this.projectiles.splice(i, 1);
            }
        }

        // Build special meter passively
        if ([STATES.WALK_FORWARD, STATES.WALK_BACKWARD].includes(this.state)) {
            this.specialMeter = Math.min(this.maxSpecial, this.specialMeter + 0.08);
        }
        // Slowly build meter over time
        this.specialMeter = Math.min(this.maxSpecial, this.specialMeter + 0.02);

        // Animate
        this.animTimer++;
        if (this.state === STATES.RUN) {
            // Alterna a cada 30 frames (0.5s a 60fps)
            this.animFrame = Math.floor(this.animTimer / 30) % 2;
            if (this.animTimer >= 60) this.animTimer = 0; // Loop animTimer every second
        } else {
            if (this.animTimer >= 8) { this.animTimer = 0; this.animFrame = (this.animFrame + 1) % 4; }
        }

        this._updateDrawTransform();
    }

    _updateDrawTransform() {
        this.drawOffsetX = 0;
        this.drawOffsetY = 0;
        this.drawScaleX = 1;
        this.drawScaleY = 1;
        this.drawRotation = 0;
        this.alpha = 1;

        switch (this.state) {
            case STATES.IDLE:
                this.drawOffsetY = Math.sin(this.animTimer * 0.3 + this.animFrame) * 2;
                break;
            case STATES.WALK_FORWARD:
            case STATES.WALK_BACKWARD:
                this.drawOffsetY = Math.abs(Math.sin(this.animFrame * 1.5)) * -4;
                break;
            case STATES.JUMP:
                // No scale or rotation
                break;
            case STATES.CROUCH:
                // Adjust Y for crouching if needed, but no scale
                this.drawOffsetY = 0;
                break;
            case STATES.PUNCH:
                this.drawOffsetX = this.facingRight ? 5 : -5;
                break;
            case STATES.KICK:
                this.drawOffsetX = this.facingRight ? 8 : -8;
                break;
            case STATES.SPECIAL:
                this.drawOffsetX = this.facingRight ? 10 : -10;
                break;
            case STATES.BLOCK:
                this.drawOffsetX = this.facingRight ? -4 : 4;
                break;
            case STATES.HIT:
                this.drawOffsetX = this.facingRight ? -6 : 6;
                this.shakeX = (Math.random() - 0.5) * 4;
                this.shakeY = (Math.random() - 0.5) * 2;
                break;
            case STATES.DEFEATED:
                this.drawOffsetY = 20;
                this.alpha = 0.6 + Math.sin(this.animTimer * 0.5) * 0.3;
                break;
            case STATES.VICTORY:
                this.drawOffsetY = Math.sin(this.animTimer * 0.4) * 4 - 4;
                break;
        }
    }

    // ---- Which sprite to use for current state ----
    _getCurrentSpriteKey() {
        switch (this.state) {
            case STATES.IDLE: return 'idle';
            case STATES.BLOCK: return this.sprites['defense'] ? 'defense' : 'idle';
            case STATES.VICTORY: return this.sprites['victory'] ? 'victory' : 'idle';
            case STATES.WALK_FORWARD: case STATES.WALK_BACKWARD: return 'walk';
            case STATES.JUMP: return 'jump';
            case STATES.CROUCH: return 'crouch';
            case STATES.PUNCH: return 'punch';
            case STATES.HIT: return this.sprites['hit'] ? 'hit' : 'punch';
            case STATES.KICK: return 'kick';
            case STATES.SPECIAL: return 'magic';
            case STATES.RUN: return this.animFrame === 0 ? 'run1' : 'run2';
            case STATES.DEFEATED: return this.sprites['death'] ? 'death' : 'idle';
            default: return 'idle';
        }
    }

    // ---- Draw ----
    draw(ctx, defaultProjImage) {
        ctx.save();
        const drawX = this.x + this.drawOffsetX + (this.flashTimer > 0 ? this.shakeX : 0);
        const drawY = this.feetY - this.height + this.drawOffsetY + (this.flashTimer > 0 ? this.shakeY : 0);
        ctx.globalAlpha = this.alpha;

        const cx = drawX + this.width / 2;
        const cy = drawY + this.height / 2;
        ctx.translate(cx, cy);
        ctx.rotate(this.drawRotation);
        ctx.scale(this.drawScaleX * (this.facingRight ? 1 : -1), this.drawScaleY);
        ctx.translate(-cx, -cy);

        if (this.flashTimer > 0 && this.flashTimer % 2 === 0) {
            ctx.filter = 'brightness(3) saturate(0)';
        } else if (this.playerNum === 2) {
            // Diferencia o player 2 usando rotação de matiz se estiver usando o mesmo sprite
            ctx.filter = 'hue-rotate(140deg) brightness(0.9)';
        }

        // Try to draw sprite image: specific state -> idle fallback -> any available fallback
        const spriteKey = this._getCurrentSpriteKey();
        let sprite = this.sprites[spriteKey] || this.sprites['idle'];

        // Fallback robusto caso idle também falte
        if (!sprite) {
            sprite = this.sprites['walk'] || this.sprites['punch'] || Object.values(this.sprites)[0];
        }
        if (sprite) {
            ctx.drawImage(sprite, drawX, drawY, this.width, this.height);
        } else {
            this._drawFallback(ctx, drawX, drawY);
        }

        ctx.filter = 'none';
        ctx.globalAlpha = 1;
        ctx.restore();

        // Shadow
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        const shadowScale = Math.max(0.3, 1 - (Math.max(0, this.y) / 150));
        ctx.ellipse(this.x + this.width / 2, this.groundY + 2, (this.width / 2.5) * shadowScale, 6 * shadowScale, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Projectiles
        const projImg = this.sprites['projectile'] || defaultProjImage;
        this.projectiles.forEach(p => {
            if (p.active && !p.isTractor) this._drawProjectile(ctx, p, projImg);
        });
        // Block shield
        if (this.isBlocking) this._drawBlockShield(ctx);
    }

    _drawFallback(ctx, x, y) {
        // Método procedural removido para forçar o uso de imagens de sprites.
    }

    _drawProjectile(ctx, p, projImage) {
        ctx.save();

        // Flip image if moving left
        const movingRight = p.vx > 0;
        const cx = p.x + p.width / 2;
        const cy = p.y + p.height / 2;

        // Add a subtle glow behind the image
        const glowColor = this.playerNum === 1 ? 'rgba(0, 150, 255, 0.4)' : 'rgba(255, 50, 50, 0.4)';
        ctx.shadowBlur = 20;
        ctx.shadowColor = glowColor;

        ctx.translate(cx, cy);
        if (!movingRight) ctx.scale(-1, 1);
        ctx.translate(-cx, -cy);

        if (projImage && projImage.complete && projImage.width > 0) {
            ctx.drawImage(projImage, p.x, p.y, p.width, p.height);
        } else {
            // Fallback if image fails to load
            ctx.fillStyle = this.playerNum === 1 ? '#00aaff' : '#ff4444';
            ctx.beginPath();
            ctx.arc(cx, cy, p.width / 2, 0, Math.PI * 2);
            ctx.fill();
        }

        // Add trail effect even with image
        ctx.globalAlpha = 0.3;
        for (let i = 1; i <= 3; i++) {
            const trailX = p.x - p.vx * i * 1.5;
            const trailY = p.y + Math.sin(p.animFrame * 0.3 + i) * 3;
            if (projImage && projImage.complete) {
                ctx.globalAlpha = 0.3 / i;
                ctx.drawImage(projImage, trailX, trailY, p.width, p.height);
            }
        }

        ctx.restore();
    }

    _drawBlockShield(ctx) {
        ctx.save();
        ctx.globalAlpha = 0.3 + Math.sin(this.animTimer * 0.5) * 0.1;
        const sx = this.facingRight ? this.x + this.width - 5 : this.x - 15;
        const sy = this.feetY - this.height + 15;
        const grad = ctx.createLinearGradient(sx, sy, sx + 20, sy + this.height - 20);
        grad.addColorStop(0, 'rgba(0,200,255,0.6)');
        grad.addColorStop(0.5, 'rgba(100,220,255,0.4)');
        grad.addColorStop(1, 'rgba(0,200,255,0.6)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(sx + 10, sy + (this.height - 20) / 2, 18, (this.height - 20) / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(150,230,255,0.7)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
    }
}
