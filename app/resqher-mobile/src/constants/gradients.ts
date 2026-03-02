// ─── Gradient Presets ─────────────────────────────────────────────────────────
// Updated to use Cyan/Teal palette (was violet/purple)

export const G = {
    // Primary button / nav active gradient (Cyan → Teal)
    navActive: {
        colors: ['#00BCD4', '#0097A7'] as const,
        start: { x: 0, y: 0 },
        end: { x: 1, y: 1 },
    },

    // Auth shell background gradient (light cyan fog)
    authBg: {
        colors: ['#E0F7FA', '#B2EBF2'] as const,
        start: { x: 0, y: 0 },
        end: { x: 1, y: 1 },
    },

    // SOS button idle (light cyan → deep cyan)
    sosIdle: {
        colors: ['#E0F7FA', '#00BCD4'] as const,
        start: { x: 0.2, y: 0.1 },
        end: { x: 0.8, y: 0.9 },
    },

    // SOS button active / triggered (danger red)
    sosDanger: {
        colors: ['#EF4444', '#B91C1C'] as const,
        start: { x: 0.2, y: 0.1 },
        end: { x: 0.8, y: 0.9 },
    },

    // Soft surface tint
    softTint: {
        colors: ['#F8FAFC', '#F1F5F9'] as const,
        start: { x: 0, y: 0 },
        end: { x: 0, y: 1 },
    },

    // ── SOS Pulse Ring colors ──────────────────────────────────────────
    sosRingDefault: 'rgba(0,188,212,0.55)',   // Cyan ring when idle
    sosRingLive: 'rgba(239,68,68,0.55)',    // Red ring when SOS is live
};
