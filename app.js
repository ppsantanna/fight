/* ============================================
   APP - UI Controller & Entry Point
   ============================================ */

(function () {
    'use strict';

    // ---- DOM Elements ----
    const titleScreen = document.getElementById('title-screen');
    const gameScreen = document.getElementById('game-screen');
    const victoryScreen = document.getElementById('victory-screen');
    const btnStart = document.getElementById('btn-start');
    const btnSettings = document.getElementById('btn-settings');
    const btnSaveSettings = document.getElementById('btn-save-settings');
    const btnResetSettings = document.getElementById('btn-reset-settings');
    const btnRematch = document.getElementById('btn-rematch');
    const btnMenu = document.getElementById('btn-menu');
    const canvas = document.getElementById('game-canvas');
    const overlay = document.getElementById('overlay');
    const overlayText = document.getElementById('overlay-text');
    const timerEl = document.getElementById('timer');
    const roundLabel = document.getElementById('round-label');
    const victoryText = document.getElementById('victory-text');
    const comboP1 = document.getElementById('combo-p1');
    const comboP2 = document.getElementById('combo-p2');
    const hitEffects = document.getElementById('hit-effects');
    const settingsScreen = document.getElementById('settings-screen');
    
    // Settings inputs
    const setFighterScale = document.getElementById('set-fighter-scale');
    const setMagicScale = document.getElementById('set-magic-scale');
    const setStartY = document.getElementById('set-start-y');
    const setCpuSpeed = document.getElementById('set-cpu-speed');
    const setCpuAttack = document.getElementById('set-cpu-attack');
    const valFighterScale = document.getElementById('val-fighter-scale');
    const valMagicScale = document.getElementById('val-magic-scale');
    const valStartY = document.getElementById('val-start-y');
    const valCpuSpeed = document.getElementById('val-cpu-speed');
    const valCpuAttack = document.getElementById('val-cpu-attack');

    const healthP1Fill = document.querySelector('#health-p1 .health-fill');
    const healthP1Damage = document.querySelector('#health-p1 .health-damage');
    const healthP2Fill = document.querySelector('#health-p2 .health-fill');
    const healthP2Damage = document.querySelector('#health-p2 .health-damage');
    const specialP1Fill = document.querySelector('#special-p1 .special-fill');
    const specialP2Fill = document.querySelector('#special-p2 .special-fill');
    const winsP1Dots = document.querySelectorAll('#wins-p1 .win-dot');
    const winsP2Dots = document.querySelectorAll('#wins-p2 .win-dot');

    let game = null;
    let comboTimerP1 = null;
    let comboTimerP2 = null;

    // ---- Background Management ----
    const TOTAL_BACKGROUNDS = 12;
    function setRandomBackground() {
        const urlParams = new URLSearchParams(window.location.search);
        const forcedBg = urlParams.get('f');
        
        const bgNum = forcedBg || (Math.floor(Math.random() * TOTAL_BACKGROUNDS) + 1);
        const bgEl = document.getElementById('game-bg');
        if (bgEl) {
            bgEl.style.backgroundImage = `url('assets/fundos/${bgNum}.gif')`;
        }
    }

    // ---- Screen Management ----
    function showScreen(screen) {
        [titleScreen, gameScreen, victoryScreen, settingsScreen].forEach(s => {
            if (s) s.classList.remove('active');
        });
        if (screen) screen.classList.add('active');
    }

    // ---- Settings Management ----
    const DEFAULT_SETTINGS = {
        fighterScale: 1.0,
        magicScale: 1.0,
        startY: 540,
        cpuSpeed: 1.0,
        cpuAttack: 1.0
    };

    let currentConfig = { ...DEFAULT_SETTINGS };

    function loadSettings() {
        const saved = localStorage.getItem('battle_arena_settings');
        if (saved) {
            try {
                currentConfig = { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
            } catch (e) {
                console.error("Erro ao carregar configurações:", e);
            }
        }
        updateSettingsUI();
    }

    function updateSettingsUI() {
        setFighterScale.value = currentConfig.fighterScale;
        setMagicScale.value = currentConfig.magicScale;
        setStartY.value = currentConfig.startY;
        setCpuSpeed.value = currentConfig.cpuSpeed;
        setCpuAttack.value = currentConfig.cpuAttack;
        
        valFighterScale.textContent = currentConfig.fighterScale.toFixed(1);
        valMagicScale.textContent = currentConfig.magicScale.toFixed(1);
        valStartY.textContent = currentConfig.startY;
        valCpuSpeed.textContent = currentConfig.cpuSpeed.toFixed(1);
        valCpuAttack.textContent = currentConfig.cpuAttack.toFixed(1);
    }

    function saveSettings() {
        currentConfig.fighterScale = parseFloat(setFighterScale.value);
        currentConfig.magicScale = parseFloat(setMagicScale.value);
        currentConfig.startY = parseInt(setStartY.value);
        currentConfig.cpuSpeed = parseFloat(setCpuSpeed.value);
        currentConfig.cpuAttack = parseFloat(setCpuAttack.value);
        
        localStorage.setItem('battle_arena_settings', JSON.stringify(currentConfig));
    }

    loadSettings();

    // ---- Health tracking for damage animation ----
    let prevHealthP1 = 100;
    let prevHealthP2 = 100;
    let damageTimeoutP1 = null;
    let damageTimeoutP2 = null;

    // ---- Start Game ----
    function startGame() {
        audio.init();
        audio.loadSFX('magic', 'assets/sounds/fighter_a_magic_s.mp3');
        setRandomBackground();
        showScreen(gameScreen);
        
        // Pass current configuration to Game
        game = new Game(canvas, currentConfig);

        // Reset win dots
        winsP1Dots.forEach(d => d.classList.remove('won'));
        winsP2Dots.forEach(d => d.classList.remove('won'));
        prevHealthP1 = 100;
        prevHealthP2 = 100;

        // Wire up callbacks
        game.onHealthUpdate = (player, health) => {
            const pct = Math.max(0, health);
            if (player === 1) {
                healthP1Fill.style.width = pct + '%';
                // Damage bar with delay
                if (pct < prevHealthP1) {
                    clearTimeout(damageTimeoutP1);
                    damageTimeoutP1 = setTimeout(() => {
                        healthP1Damage.style.width = pct + '%';
                    }, 400);
                }
                prevHealthP1 = pct;
            } else {
                healthP2Fill.style.width = pct + '%';
                if (pct < prevHealthP2) {
                    clearTimeout(damageTimeoutP2);
                    damageTimeoutP2 = setTimeout(() => {
                        healthP2Damage.style.width = pct + '%';
                    }, 400);
                }
                prevHealthP2 = pct;
            }
        };

        game.onSpecialUpdate = (player, value) => {
            const pct = Math.min(100, value);
            if (player === 1) {
                specialP1Fill.style.width = pct + '%';
            } else {
                specialP2Fill.style.width = pct + '%';
            }
        };

        game.onTimerUpdate = (time) => {
            timerEl.textContent = time;
            if (time <= 10) {
                timerEl.classList.add('warning');
            } else {
                timerEl.classList.remove('warning');
            }
        };

        game.onOverlay = (text, type) => {
            overlayText.textContent = text;
            overlayText.className = 'overlay-text ' + type;
            overlay.classList.remove('hidden');

            // Update round label
            if (type === 'round') {
                roundLabel.textContent = text;
            }
        };

        game.onHideOverlay = () => {
            overlay.classList.add('hidden');
        };

        game.onCombo = (player, count) => {
            const el = player === 1 ? comboP1 : comboP2;
            el.textContent = `${count} HIT COMBO!`;
            el.classList.remove('hidden');
            el.style.animation = 'none';
            el.offsetHeight; // reflow
            el.style.animation = 'overlayPop 0.3s ease';

            const timer = player === 1 ? comboTimerP1 : comboTimerP2;
            if (timer) clearTimeout(timer);

            const newTimer = setTimeout(() => {
                el.classList.add('hidden');
            }, 1500);

            if (player === 1) comboTimerP1 = newTimer;
            else comboTimerP2 = newTimer;
        };

        game.onHit = (x, y, damage) => {
            createHitSpark(x, y, damage >= 12);
        };

        game.onBlock = (x, y) => {
            createBlockSpark(x, y);
        };

        game.onShake = (intensity) => {
            const container = document.getElementById('game-container');
            container.classList.remove('shake', 'heavy-shake');
            container.offsetHeight;
            container.classList.add(intensity === 'heavy' ? 'heavy-shake' : 'shake');
            setTimeout(() => {
                container.classList.remove('shake', 'heavy-shake');
            }, 300);
        };

        game.onRoundWin = (player) => {
            const dots = player === 1 ? winsP1Dots : winsP2Dots;
            const wins = player === 1 ? game.p1.wins : game.p2.wins;
            for (let i = 0; i < wins && i < dots.length; i++) {
                dots[i].classList.add('won');
            }
        };

        game.onMatchEnd = (player) => {
            setTimeout(() => {
                showScreen(victoryScreen);
                victoryText.textContent = player === 1 ? 'VOCÊ VENCEU!' : 'CPU VENCEU!';
                audio.playVictory();
            }, 2000);
        };

        game.start();
    }

    // ---- Hit Effects ----
    function createHitSpark(x, y, heavy) {
        const spark = document.createElement('div');
        spark.className = 'hit-spark';
        // Convert canvas coords to screen coords
        const rect = canvas.getBoundingClientRect();
        const scaleX = rect.width / canvas.width;
        const scaleY = rect.height / canvas.height;
        spark.style.left = (x * scaleX - 30) + 'px';
        spark.style.top = (y * scaleY - 30) + 'px';
        if (heavy) {
            spark.style.width = '90px';
            spark.style.height = '90px';
            spark.style.left = (x * scaleX - 45) + 'px';
            spark.style.top = (y * scaleY - 45) + 'px';
        }
        hitEffects.appendChild(spark);
        setTimeout(() => spark.remove(), 300);
    }

    function createBlockSpark(x, y) {
        const spark = document.createElement('div');
        spark.className = 'block-spark';
        const rect = canvas.getBoundingClientRect();
        const scaleX = rect.width / canvas.width;
        const scaleY = rect.height / canvas.height;
        spark.style.left = (x * scaleX - 40) + 'px';
        spark.style.top = (y * scaleY - 40) + 'px';
        hitEffects.appendChild(spark);
        setTimeout(() => spark.remove(), 400);
    }

    // ---- Event Listeners ----
    btnStart.addEventListener('click', () => {
        startGame();
    });

    btnSettings.addEventListener('click', () => {
        showScreen(settingsScreen);
    });

    btnSaveSettings.addEventListener('click', () => {
        saveSettings();
        showScreen(titleScreen);
    });

    btnResetSettings.addEventListener('click', () => {
        currentConfig = { ...DEFAULT_SETTINGS };
        updateSettingsUI();
    });

    // Update value displays in real-time
    [setFighterScale, setMagicScale, setStartY, setCpuSpeed, setCpuAttack].forEach(input => {
        input.addEventListener('input', () => {
            const id = input.id.replace('set-', 'val-');
            const display = document.getElementById(id);
            if (display) {
                const val = parseFloat(input.value);
                display.textContent = Number.isInteger(val) ? val : val.toFixed(1);
            }
        });
    });

    btnRematch.addEventListener('click', () => {
        setRandomBackground();
        showScreen(gameScreen);
        if (game) {
            game.restartMatch();
            game.start();
        }
        // Reset health bars
        healthP1Fill.style.width = '100%';
        healthP1Damage.style.width = '100%';
        healthP2Fill.style.width = '100%';
        healthP2Damage.style.width = '100%';
        specialP1Fill.style.width = '0%';
        specialP2Fill.style.width = '0%';
        prevHealthP1 = 100;
        prevHealthP2 = 100;
        winsP1Dots.forEach(d => d.classList.remove('won'));
        winsP2Dots.forEach(d => d.classList.remove('won'));
    });

    btnMenu.addEventListener('click', () => {
        if (game) {
            game.stop();
            audio.stopMusic();
        }
        showScreen(titleScreen);
    });

    // Prevent scrolling with arrow keys
    window.addEventListener('keydown', (e) => {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
            e.preventDefault();
        }
    });

})();
