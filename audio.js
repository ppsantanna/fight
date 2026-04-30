/* ============================================
   AUDIO MANAGER - Sound Effects & Music
   Uses Web Audio API with procedural sound generation
   ============================================ */

class AudioManager {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.musicGain = null;
        this.sfxGain = null;
        this.initialized = false;
        this.musicVolume = 0.3;
        this.sfxVolume = 0.5;
        this.currentMusic = null;
        this.buffers = {}; // Store loaded audio buffers
    }

    init() {
        if (this.initialized) return;
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGain = this.ctx.createGain();
            this.masterGain.connect(this.ctx.destination);

            this.musicGain = this.ctx.createGain();
            this.musicGain.gain.value = this.musicVolume;
            this.musicGain.connect(this.masterGain);

            this.sfxGain = this.ctx.createGain();
            this.sfxGain.gain.value = this.sfxVolume;
            this.sfxGain.connect(this.masterGain);

            this.initialized = true;
        } catch (e) {
            console.warn('Audio not supported:', e);
        }
    }

    async loadSFX(name, url) {
        if (!this.initialized) this.init();
        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
            this.buffers[name] = audioBuffer;
        } catch (e) {
            console.warn(`Failed to load sound ${name} from ${url}:`, e);
        }
    }

    playExternalSFX(name) {
        if (!this.initialized || !this.buffers[name]) return;
        const source = this.ctx.createBufferSource();
        source.buffer = this.buffers[name];
        source.connect(this.sfxGain);
        source.start(this.ctx.currentTime);
    }

    // Generate a procedural hit sound
    playPunch() {
        if (!this.initialized) return;
        const t = this.ctx.currentTime;

        // Noise burst for impact
        const bufferSize = this.ctx.sampleRate * 0.08;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 3);
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        // Low thump
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, t);
        osc.frequency.exponentialRampToValueAtTime(50, t + 0.1);

        const oscGain = this.ctx.createGain();
        oscGain.gain.setValueAtTime(0.6, t);
        oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.4, t);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);

        // Filter
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 2000;

        noise.connect(noiseGain).connect(filter).connect(this.sfxGain);
        osc.connect(oscGain).connect(this.sfxGain);

        noise.start(t);
        noise.stop(t + 0.08);
        osc.start(t);
        osc.stop(t + 0.12);
    }

    playKick() {
        if (!this.initialized) return;
        const t = this.ctx.currentTime;

        // Heavier than punch
        const bufferSize = this.ctx.sampleRate * 0.12;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2.5);
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(100, t);
        osc.frequency.exponentialRampToValueAtTime(30, t + 0.15);

        const oscGain = this.ctx.createGain();
        oscGain.gain.setValueAtTime(0.8, t);
        oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.5, t);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.12);

        noise.connect(noiseGain).connect(this.sfxGain);
        osc.connect(oscGain).connect(this.sfxGain);

        noise.start(t);
        noise.stop(t + 0.12);
        osc.start(t);
        osc.stop(t + 0.18);
    }

    playBlock() {
        if (!this.initialized) return;
        const t = this.ctx.currentTime;

        const osc = this.ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(800, t);
        osc.frequency.exponentialRampToValueAtTime(200, t + 0.15);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);

        osc.connect(gain).connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.15);
    }

    playSpecial() {
        if (!this.initialized) return;
        const t = this.ctx.currentTime;

        // Whoosh + energy sound
        const osc1 = this.ctx.createOscillator();
        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(200, t);
        osc1.frequency.exponentialRampToValueAtTime(800, t + 0.2);
        osc1.frequency.exponentialRampToValueAtTime(100, t + 0.5);

        const osc2 = this.ctx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(400, t);
        osc2.frequency.exponentialRampToValueAtTime(1200, t + 0.15);

        const gain1 = this.ctx.createGain();
        gain1.gain.setValueAtTime(0.3, t);
        gain1.gain.exponentialRampToValueAtTime(0.01, t + 0.5);

        const gain2 = this.ctx.createGain();
        gain2.gain.setValueAtTime(0.2, t);
        gain2.gain.exponentialRampToValueAtTime(0.01, t + 0.3);

        // Distortion
        const distortion = this.ctx.createWaveShaper();
        const curve = new Float32Array(256);
        for (let i = 0; i < 256; i++) {
            const x = (i * 2) / 256 - 1;
            curve[i] = Math.tanh(x * 3);
        }
        distortion.curve = curve;

        osc1.connect(gain1).connect(distortion).connect(this.sfxGain);
        osc2.connect(gain2).connect(this.sfxGain);

        osc1.start(t);
        osc1.stop(t + 0.5);
        osc2.start(t);
        osc2.stop(t + 0.3);
    }

    playProjectileHit() {
        if (!this.initialized) return;
        const t = this.ctx.currentTime;

        // Explosion-like
        const bufferSize = this.ctx.sampleRate * 0.3;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, t);
        osc.frequency.exponentialRampToValueAtTime(20, t + 0.3);

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.5, t);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);

        const oscGain = this.ctx.createGain();
        oscGain.gain.setValueAtTime(0.6, t);
        oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.25);

        noise.connect(noiseGain).connect(this.sfxGain);
        osc.connect(oscGain).connect(this.sfxGain);

        noise.start(t);
        noise.stop(t + 0.3);
        osc.start(t);
        osc.stop(t + 0.3);
    }

    // Voice announcements
    playFight() {
        if (!this.initialized) return;
        this._playVoice([600, 800, 1000, 700], 0.08, 0.5);
    }

    playKO() {
        if (!this.initialized) return;
        const t = this.ctx.currentTime;

        // Big dramatic "KO" sound
        const osc = this.ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.setValueAtTime(400, t);
        osc.frequency.setValueAtTime(300, t + 0.2);
        osc.frequency.exponentialRampToValueAtTime(80, t + 0.8);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.4, t);
        gain.gain.setValueAtTime(0.5, t + 0.15);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.8);

        osc.connect(gain).connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.8);

        // Cymbal crash
        const bufferSize = this.ctx.sampleRate * 0.6;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 1.5);
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.3, t);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.6);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 3000;

        noise.connect(noiseGain).connect(filter).connect(this.sfxGain);
        noise.start(t);
        noise.stop(t + 0.6);
    }

    playRound() {
        if (!this.initialized) return;
        this._playVoice([500, 700, 500], 0.1, 0.3);
    }

    playVictory() {
        if (!this.initialized) return;
        const t = this.ctx.currentTime;
        const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
        notes.forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            osc.type = 'square';
            osc.frequency.value = freq;
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0, t + i * 0.15);
            gain.gain.linearRampToValueAtTime(0.3, t + i * 0.15 + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.01, t + i * 0.15 + 0.4);
            osc.connect(gain).connect(this.sfxGain);
            osc.start(t + i * 0.15);
            osc.stop(t + i * 0.15 + 0.4);
        });
    }

    _playVoice(freqs, duration, volume) {
        const t = this.ctx.currentTime;
        freqs.forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            osc.type = 'square';
            osc.frequency.value = freq;
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(volume, t + i * duration);
            gain.gain.exponentialRampToValueAtTime(0.01, t + i * duration + duration * 0.9);
            osc.connect(gain).connect(this.sfxGain);
            osc.start(t + i * duration);
            osc.stop(t + (i + 1) * duration);
        });
    }

    // Background music - procedural chiptune loop
    startMusic() {
        if (!this.initialized) return;
        this.stopMusic();

        const bpm = 140;
        const beatDur = 60 / bpm;
        const barDur = beatDur * 4;

        // Bass pattern
        const bassNotes = [110, 110, 146.83, 130.81, 110, 110, 146.83, 164.81];
        // Melody pattern  
        const melodyNotes = [440, 0, 523, 440, 0, 392, 349, 392, 440, 0, 523, 659, 0, 523, 440, 0];

        const loopDuration = barDur * 2;

        const scheduleLoop = () => {
            if (!this.ctx || this.ctx.state === 'closed') return;

            const startTime = this.ctx.currentTime;

            // Bass line
            bassNotes.forEach((freq, i) => {
                if (freq === 0) return;
                const osc = this.ctx.createOscillator();
                osc.type = 'square';
                osc.frequency.value = freq;
                const gain = this.ctx.createGain();
                const noteStart = startTime + i * beatDur;
                gain.gain.setValueAtTime(0.15, noteStart);
                gain.gain.exponentialRampToValueAtTime(0.01, noteStart + beatDur * 0.8);
                osc.connect(gain).connect(this.musicGain);
                osc.start(noteStart);
                osc.stop(noteStart + beatDur * 0.9);
            });

            // Melody
            melodyNotes.forEach((freq, i) => {
                if (freq === 0) return;
                const osc = this.ctx.createOscillator();
                osc.type = 'square';
                const noteStart = startTime + i * (beatDur / 2);
                osc.frequency.value = freq;
                const gain = this.ctx.createGain();
                gain.gain.setValueAtTime(0.08, noteStart);
                gain.gain.exponentialRampToValueAtTime(0.01, noteStart + beatDur * 0.4);
                osc.connect(gain).connect(this.musicGain);
                osc.start(noteStart);
                osc.stop(noteStart + beatDur * 0.45);
            });

            // Hi-hat pattern
            for (let i = 0; i < 16; i++) {
                const bufLen = this.ctx.sampleRate * 0.03;
                const buf = this.ctx.createBuffer(1, bufLen, this.ctx.sampleRate);
                const d = buf.getChannelData(0);
                for (let j = 0; j < bufLen; j++) {
                    d[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / bufLen, 4);
                }
                const src = this.ctx.createBufferSource();
                src.buffer = buf;
                const g = this.ctx.createGain();
                const noteS = startTime + i * (beatDur / 2);
                g.gain.setValueAtTime(i % 2 === 0 ? 0.06 : 0.03, noteS);
                g.gain.exponentialRampToValueAtTime(0.001, noteS + 0.03);
                const hpf = this.ctx.createBiquadFilter();
                hpf.type = 'highpass';
                hpf.frequency.value = 8000;
                src.connect(g).connect(hpf).connect(this.musicGain);
                src.start(noteS);
                src.stop(noteS + 0.04);
            }

            this.currentMusic = setTimeout(scheduleLoop, loopDuration * 1000 - 50);
        };

        scheduleLoop();
    }

    stopMusic() {
        if (this.currentMusic) {
            clearTimeout(this.currentMusic);
            this.currentMusic = null;
        }
    }
}

// Global instance
const audio = new AudioManager();
