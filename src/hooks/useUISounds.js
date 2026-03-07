/**
 * useUISounds — generates subtle UI sound effects via the Web Audio API.
 * No audio files required. Works in all modern browsers.
 *
 * Usage:
 *   const { playHover, playClick } = useUISounds();
 */

let _ctx = null;

function getCtx() {
    if (!_ctx) {
        try {
            _ctx = new (window.AudioContext || window.webkitAudioContext)();
        } catch {
            return null;
        }
    }
    // Resume context if suspended (browser autoplay policy)
    if (_ctx.state === 'suspended') _ctx.resume();
    return _ctx;
}

/**
 * Play a short sine-wave blip.
 * @param {number} freq   - Frequency in Hz
 * @param {number} vol    - Peak gain (0–1)
 * @param {number} dur    - Duration in seconds
 * @param {number} attack - Attack time (s)
 * @param {number} decay  - Decay time (s)
 */
function playTone(freq, vol, dur, attack = 0.005, decay = 0.06) {
    const ctx = getCtx();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.value = freq;

    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(vol, now + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    osc.start(now);
    osc.stop(now + dur + decay);
}

/** Subtle, airy hover blip */
export function playHover() {
    playTone(900, 0.06, 0.08);
}

/** Crisp, satisfying click tick */
export function playClick() {
    playTone(600, 0.18, 0.12);
    // Add a tiny harmonic layer
    setTimeout(() => playTone(1200, 0.05, 0.06), 10);
}

/** Default hook export (convenience) */
export default function useUISounds() {
    return { playHover, playClick };
}
