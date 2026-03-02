import { T } from './theme';

export const G = {
    // Primary button / nav active gradient
    // Matches the vibrant "CHECKOUT" / "PAY" violet exactly.
    navActive: {
        colors: ['#A855F7', '#9333EA'] as const,
        start: { x: 0, y: 0 },
        end: { x: 1, y: 0 },
    },

    // App background gradient — vertical purple transition from image
    authBg: {
        colors: ['#F5F3FF', '#E9D5FF', '#D8B4FE'] as ['#F5F3FF', '#E9D5FF', '#D8B4FE'],
        start: { x: 0, y: 0 },
        end: { x: 0, y: 1 }, // Vertical
    },

    // SOS button idle — vibrant medium lavender
    sosIdle: {
        colors: ['#D8B4FE', '#C084FC'] as const,
        start: { x: 0, y: 0 },
        end: { x: 1, y: 1 },
    },

    // SOS button active / triggered (violet-harmonious rose/crimson)
    sosDanger: {
        colors: [T.dangerMid, T.danger] as const,
        start: { x: 0.2, y: 0.1 },
        end: { x: 0.8, y: 0.9 },
    },

    // Soft surface tint
    softTone: {
        colors: [T.bgMuted, T.disabledBg] as const,
        start: { x: 0, y: 0 },
        end: { x: 0, y: 1 },
    },

    // Card fill — matching the product items (Tomato Candle, etc.)
    cardFill: {
        colors: ['#E9D5FF', '#D8B4FE'] as ['#E9D5FF', '#D8B4FE'],
        start: { x: 0, y: 0 },
        end: { x: 1, y: 1 },
    },

    // ── SOS Pulse Ring colors ──────────────────────────────────────────
    sosRingDefault: 'rgba(168, 85, 247, 0.45)', // Tinted Primary Violet
    sosRingLive: `${T.dangerMid}66`,  // Rose ring with ~40% alpha — calmer than pure red
};
