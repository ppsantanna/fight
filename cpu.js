/* ============================================
   CPU AI - Artificial Intelligence for Player 2
   ============================================ */

class CPUController {
    constructor(difficulty = 'normal', config = {}) {
        this.difficulty = difficulty;
        this.config = config;
        this.actionTimer = 0;

        // Aplica o fator de velocidade: valores menores aumentam o intervalo (CPU mais lenta)
        const speedFactor = config.speed || 1.0;
        this.thinkInterval = Math.round(this._getThinkInterval() / speedFactor);

        this.comboStep = 0;
        this.comboTimer = 0;
        this.retreatTimer = 0;

        // Aplica o fator de ataque: valores menores diminuem a agressividade
        const attackFactor = config.attack || 1.0;
        this.aggressiveness = this._getAggressiveness() * attackFactor;

        this.reactionTime = this._getReactionTime();
        this.blockChance = this._getBlockChance();
        this.specialUseThreshold = this._getSpecialThreshold();
    }

    _getThinkInterval() {
        switch (this.difficulty) {
            case 'easy': return 25;
            case 'normal': return 15;
            case 'hard': return 8;
            default: return 15;
        }
    }

    _getAggressiveness() {
        switch (this.difficulty) {
            case 'easy': return 0.3;
            case 'normal': return 0.55;
            case 'hard': return 0.75;
            default: return 0.55;
        }
    }

    _getReactionTime() {
        switch (this.difficulty) {
            case 'easy': return 20;
            case 'normal': return 10;
            case 'hard': return 4;
            default: return 10;
        }
    }

    _getBlockChance() {
        switch (this.difficulty) {
            case 'easy': return 0.15;
            case 'normal': return 0.35;
            case 'hard': return 0.6;
            default: return 0.35;
        }
    }

    _getSpecialThreshold() {
        switch (this.difficulty) {
            case 'easy': return 80;
            case 'normal': return 50;
            case 'hard': return 30;
            default: return 50;
        }
    }

    update(cpu, player, stageWidth) {
        if (cpu.state === STATES.DEFEATED || cpu.state === STATES.VICTORY) return;
        if (cpu.hitStun > 0) return;

        this.actionTimer++;
        if (this.comboTimer > 0) this.comboTimer--;

        // React to incoming projectile (find the closest active one)
        const incomingProj = player.projectiles.find(p => p.active);
        if (incomingProj) {
            this._reactToProjectile(cpu, incomingProj);
            return;
        }

        // React to player attacking (try to block)
        if (this._isPlayerAttacking(player) && this._isInRange(cpu, player, 120)) {
            if (Math.random() < this.blockChance && cpu.isGrounded) {
                cpu.block();
                this.actionTimer = 0;
                return;
            }
        }

        if (this.actionTimer < this.thinkInterval) return;
        this.actionTimer = 0;

        // Decide action based on distance
        const dist = Math.abs(cpu.centerX - player.centerX);
        const healthRatio = cpu.health / cpu.maxHealth;
        const playerHealthRatio = player.health / player.maxHealth;

        // Stop blocking if far away
        if (cpu.isBlocking && dist > 150) {
            cpu.stopBlocking();
        }

        // If low health, be more defensive
        if (healthRatio < 0.3 && Math.random() < 0.4) {
            this._defensiveAction(cpu, player, dist);
            return;
        }

        // Far range: approach or use projectile
        if (dist > 250) {
            this._farRangeAction(cpu, player, dist);
        }
        // Mid range: advance or jump-in
        else if (dist > 130) {
            this._midRangeAction(cpu, player, dist);
        }
        // Close range: attack!
        else {
            this._closeRangeAction(cpu, player, dist);
        }
    }

    _isPlayerAttacking(player) {
        return [STATES.PUNCH, STATES.KICK, STATES.SPECIAL].includes(player.state);
    }

    _isInRange(cpu, player, range) {
        return Math.abs(cpu.centerX - player.centerX) < range;
    }

    _reactToProjectile(cpu, proj) {
        const projDist = Math.abs(proj.x - cpu.x);
        const approaching = (proj.vx > 0 && proj.x < cpu.x) || (proj.vx < 0 && proj.x > cpu.x);

        if (approaching && projDist < 300) {
            // Jump over, crouch under, or block
            const rand = Math.random();
            if (rand < 0.4 && cpu.isGrounded) {
                cpu.jump();
                setTimeout(() => cpu.moveForward(), 100);
            } else if (rand < 0.7 && cpu.isGrounded) {
                cpu.crouch();
                // Stay crouched until projectile passes
                setTimeout(() => {
                    if (cpu.state === STATES.CROUCH) cpu.stopMoving();
                }, 600);
            } else if (cpu.isGrounded) {
                cpu.block();
            }
        }
    }

    _farRangeAction(cpu, player, dist) {
        const rand = Math.random();

        // 10% de chance de ativar o atropelamento se não foi usado (ou se infinito estiver ativo)
        if ((!cpu.usedTractorMatch || cpu.config.tractorInfinite) && rand < 0.1) {
            cpu.addInput('down');
            setTimeout(() => {
                cpu.addInput('forward');
                setTimeout(() => cpu.magic(), 80);
            }, 80);
            return;
        }

        // Use fireball if have meter
        if (cpu.specialMeter >= this.specialUseThreshold && rand < 0.35) {
            cpu.magic();
            return;
        }

        // Walk forward or Run
        if (rand < 0.7 + this.aggressiveness * 0.2) {
            if (rand < 0.2 && this.aggressiveness > 0.5) {
                cpu.run();
            } else {
                cpu.moveForward();
                // Keep walking for multiple ticks
                setTimeout(() => {
                    if (cpu.state === STATES.WALK_FORWARD) cpu.stopMoving();
                }, 300 + Math.random() * 200);
            }
        }
        // Jump forward
        else if (rand < 0.85) {
            cpu.jump();
            setTimeout(() => cpu.moveForward(), 50);
        }
    }

    _midRangeAction(cpu, player, dist) {
        const rand = Math.random();

        // chance de ativar o trator de média distância
        if ((!cpu.usedTractorMatch || cpu.config.tractorInfinite) && rand < 0.05) {
            cpu.addInput('down');
            setTimeout(() => {
                cpu.addInput('forward');
                setTimeout(() => cpu.magic(), 80);
            }, 80);
            return;
        }

        if (rand < this.aggressiveness * 0.5) {
            // Dash/Run forward to attack range
            if (rand < 0.2) {
                cpu.run();
            } else {
                cpu.moveForward();
                setTimeout(() => {
                    cpu.stopMoving();
                    if (Math.random() < 0.5) cpu.punch();
                    else cpu.kick();
                }, 200 + Math.random() * 150);
            }
        }
        else if (rand < 0.5 && cpu.specialMeter >= this.specialUseThreshold) {
            // Use magic at mid range
            cpu.magic();
        }
        else if (rand < 0.7) {
            // Jump-in attack
            cpu.jump();
            setTimeout(() => {
                cpu.moveForward();
                setTimeout(() => {
                    if (!cpu.isGrounded) {
                        // Air attack not implemented, but will kick on landing
                    }
                }, 200);
            }, 50);
            // Attack when landing
            setTimeout(() => {
                if (cpu.isGrounded && Math.abs(cpu.centerX - player.centerX) < 130) {
                    if (Math.random() < 0.5) cpu.punch();
                    else cpu.kick();
                }
            }, 500);
        }
        else {
            cpu.moveForward();
            setTimeout(() => cpu.stopMoving(), 150);
        }
    }

    _closeRangeAction(cpu, player, dist) {
        const rand = Math.random();

        // Stop blocking first
        if (cpu.isBlocking) cpu.stopBlocking();

        if (rand < 0.35) {
            // Punch
            cpu.punch();
            // Follow up combo
            if (Math.random() < this.aggressiveness * 0.6) {
                setTimeout(() => {
                    if (Math.abs(cpu.centerX - player.centerX) < 130) {
                        cpu.kick();
                    }
                }, 350);
            }
        }
        else if (rand < 0.6) {
            // Kick
            cpu.kick();
        }
        else if (rand < 0.75 && cpu.specialMeter >= this.specialUseThreshold) {
            // Special move at close range
            if (Math.random() < 0.5) {
                // Dragon kick
                cpu.addInput('down');
                setTimeout(() => {
                    cpu.addInput('down');
                    setTimeout(() => cpu.kick(), 80);
                }, 80);
            } else {
                cpu.magic();
            }
        }
        else if (rand < 0.85) {
            // Jump and attack
            cpu.jump();
            setTimeout(() => cpu.kick(), 300);
        }
        else {
            // Back away briefly
            cpu.moveBackward();
            setTimeout(() => cpu.stopMoving(), 200);
        }
    }

    _defensiveAction(cpu, player, dist) {
        const rand = Math.random();

        if (dist < 120) {
            // Block at close range
            if (rand < 0.5) {
                cpu.block();
                setTimeout(() => cpu.stopBlocking(), 400 + Math.random() * 300);
            }
            // Jump away
            else if (rand < 0.8) {
                cpu.jump();
                cpu.moveBackward();
                setTimeout(() => cpu.stopMoving(), 300);
            }
            // Counter attack
            else {
                cpu.punch();
            }
        } else {
            // Stay back and use fireballs
            if (cpu.specialMeter >= this.specialUseThreshold && rand < 0.4) {
                cpu.magic();
            } else {
                cpu.moveBackward();
                setTimeout(() => cpu.stopMoving(), 200);
            }
        }
    }
}
