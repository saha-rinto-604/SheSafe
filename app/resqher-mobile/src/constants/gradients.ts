import { T } from './theme';

// ─── ResQher Gradient System — Premium Tactical Dark Mode ───────────────────
export const G = {
    // ── Premium Glow Background — vertical gradient for auth & home
    // Deep Midnight → subtle purple center → soft violet aura at bottom
    premiumBg: {
        colors: ['#08070B', '#1A1033', 'rgba(138,56,246,0.15)'] as const,
        start: { x: 0, y: 0 },
        end: { x: 0, y: 1 },
    },

    // Auth background — SocialGrow 'Rising Violet Aura'
    // True black → dark purple → Electric Violet light emission from below
    authBg: {
        // Deeper, less bright purple gradient for premium dark look
        colors: ['#000000', '#1A1033', '#240046'] as const,
        locations: [0, 0.7, 1.0] as const,
        start: { x: 0.5, y: 0 },
        end: { x: 0.5, y: 1 },
    },

    // Primary button / nav active gradient — Electric Violet
    navActive: {
        colors: ['#8A38F6', '#6D28D9'] as const,
        start: { x: 0, y: 0 },
        end: { x: 1, y: 0 },
    },

    // SOS button idle — Electric Violet outer glow
    sosIdle: {
        colors: ['#8A38F6', '#7C3AED'] as const,
        start: { x: 0, y: 0 },
        end: { x: 1, y: 1 },
    },

    // SOS button LIVE state — Safety Red gradient
    sosDanger: {
        colors: ['#E23636', '#991B1B'] as const,
        start: { x: 0.1, y: 0.0 },
        end: { x: 0.9, y: 1.0 },
    },

    // Card fill — dark surface gradient
    cardFill: {
        colors: [T.surface, T.surfaceCard] as const,
        start: { x: 0, y: 0 },
        end: { x: 1, y: 1 },
    },

    // Soft surface tint — dark layering
    softTone: {
        colors: [T.bg, T.surface] as const,
        start: { x: 0, y: 0 },
        end: { x: 0, y: 1 },
    },

    // ── SOS Pulse Ring colors ──────────────────────────────────────────
    sosRingDefault: T.brandGlow,                     // Electric Violet glow (40%)
    sosRingLive: 'rgba(226,54,54,0.45)',              // Safety Red ring
};
