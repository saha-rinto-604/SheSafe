import { T } from './theme';

export const G = {
    // Primary button / nav active gradient — ONLY place purple gradients appear
    // Keep this vibrant as the brand accent
    navActive: {
        colors: ['#A855F7', '#9333EA'] as const,
        start: { x: 0, y: 0 },
        end: { x: 1, y: 0 },
    },

    // App background gradient — NEUTRAL (no longer purple)
    // Use for legacy compatibility only — prefer direct colors now
    authBg: {
        colors: ['#FAFBFC', '#F9FAFB', '#F3F4F6'] as ['#FAFBFC', '#F9FAFB', '#F3F4F6'],
        start: { x: 0, y: 0 },
        end: { x: 0, y: 1 }, // Vertical
    },

    // SOS button idle — vibrant medium lavender (preserved for SOS context only)
    sosIdle: {
        colors: ['#D8B4FE', '#C084FC'] as const,
        start: { x: 0, y: 0 },
        end: { x: 1, y: 1 },
    },

    // SOS button LIVE state — danger (bright rose) → dangerLight (soft pink)
    // Base uses T.danger as start, NOT dangerPressed. Gradient goes lighter.
    sosDanger: {
        colors: [T.danger, T.dangerLight] as const,
        start: { x: 0.1, y: 0.0 },
        end: { x: 0.9, y: 1.0 },
    },

    // Soft surface tint — NEUTRAL grays instead of purple
    softTone: {
        colors: [T.bgMuted, T.disabledBg] as const,
        start: { x: 0, y: 0 },
        end: { x: 0, y: 1 },
    },

    // Card fill — NEUTRAL instead of purple gradient
    // Subtle gray gradient for card backgrounds
    cardFill: {
        colors: [T.surfaceLight, T.bgMuted] as const,
        start: { x: 0, y: 0 },
        end: { x: 1, y: 1 },
    },

    // ── SOS Pulse Ring colors ──────────────────────────────────────────
    sosRingDefault: 'rgba(168, 85, 247, 0.45)', // Tinted Primary Violet
    sosRingLive: `${T.dangerMid}66`,  // Rose ring with ~40% alpha — calmer than pure red
};
