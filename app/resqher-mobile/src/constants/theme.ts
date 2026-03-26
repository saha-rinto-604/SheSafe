// ─── ResQher Design System — Premium Tactical Dark Mode ─────────────────────
// Single source of truth. Import T, R, S, Ty, Sh from here everywhere.
// Primary: Electric Violet (#8A38F6) — High-contrast dark system.

export const T = {
  // ── Backgrounds & Surfaces — True OLED Black base
  bg: '#000000',              // True OLED Black — max battery, max contrast
  bgElevated: '#0A0A0C',     // Slightly lifted — for overlays behind cards
  surface: '#111113',        // Surface Elevated — cards, modals, headers
  surfaceCard: '#1A1A1E',    // Glassmorphism card fill (80% opacity)

  // ── Surface variants — dark grays for layering
  surfaceLight: '#1A1A1E',   // Lightest dark surface
  surfaceMid: '#2C2C2E',     // Mid dark — disabled, inactive
  surfaceDark: '#3A3A3C',    // For hovered/pressed states

  // ── Brand — Electric Violet
  violet: '#8A38F6',         // Primary Electric Violet — buttons & active accents
  violetDark: '#6D28D9',     // Deep Violet — button pressed, gradient end
  violetDim: 'rgba(138,56,246,0.10)',  // Subtle purple tint — active role cards
  violetLight: '#A855F7',    // Lighter violet — for highlights
  violetLighter: 'rgba(138,56,246,0.15)', // Very subtle bg tint

  // ── Brand Glow — for pulsing effects & halos
  brandGlow: 'rgba(138,56,246,0.40)', // Pulsing SOS glow, button aura

  // ── On-primary
  onPrimary: '#FFFFFF',

  // ── Accent — Gold (Volunteer-specific)
  accent: '#F59E0B',         // Gold — volunteer markers & accents
  accentLight: 'rgba(245,158,11,0.12)', // Gold tint for badge bg

  // ── Text scale — high-contrast luminous hierarchy
  ink: '#F5F5F7',            // Primary headings — near-white
  ink2: '#E5E5EA',           // Body text — bright white-gray
  ink3: '#8E8E93',           // Secondary metadata — tactical gray
  ink4: '#636366',           // Muted text, icons — low emphasis
  ink5: '#48484A',           // Placeholder text — very muted

  // ── Borders — Unified 1px White Stroke Requirement across the system
  line: 'rgba(255,255,255,0.1)',     // Standardized to 0.1
  lineMid: 'rgba(255,255,255,0.1)',  // Standardized to 0.1
  lineBold: 'rgba(255,255,255,0.1)', // Standardized to 0.1

  // ── Neutral grays for UI components (dark scale)
  gray50: '#1C1C1E',
  gray100: '#2C2C2E',
  gray200: '#3A3A3C',
  gray300: '#48484A',
  gray400: '#636366',
  gray500: '#8E8E93',

  // ── Feedback — Tactical colors
  danger: '#E23636',         // Safety Red — SOS Live, police alerts
  dangerMid: '#DC2626',      // Mid danger — pulse rings
  dangerPressed: '#B91C1C',  // Pressed/darker danger
  dangerLight: 'rgba(226,54,54,0.12)', // Tinted bg for danger areas
  dangerBorder: 'rgba(226,54,54,0.30)', // Subtle ring
  dangerText: '#FCA5A5',     // Text on dark danger backgrounds
  dangerBg: 'rgba(226,54,54,0.10)', // Chip background
  onDanger: '#FFFFFF',       // Text on danger fill
  success: '#10B981',        // Emerald — Secure/Success
  safeLight: 'rgba(16,185,129,0.10)', // Success bg tint
  gold: '#F59E0B',           // Volunteer markers

  // ── Disabled & Inactive
  disabled: '#2C2C2E',
  disabledBg: '#1C1C1E',
  disabledText: '#48484A',

  // ── Nav icon inactive — high-contrast for low-light legibility (global)
  navIconMuted: '#6B5B95',   // Legacy — desaturated violet
  navIconInactive: '#9CA3AF', // Higher-contrast neutral gray — use across ALL pages

  // ── Input icon affordance
  inputIconDefault: '#8E8E93', // Brighter default icon for input fields

  // ── Glass surface tokens (dark glassmorphism)
  surfaceGlass: 'rgba(26,26,30,0.80)',   // 80% dark glass
  surfaceOverlay: 'rgba(138,56,246,0.07)', // Violet tint overlay
  gradientOverlayOpacity: 0.07 as number,

  // ── Universal Bulky Glass — The Material Mandate
  // Every UI bar, card, and floating element uses this exact material.
  // Color + border are IDENTICAL across all screens for visual consistency.
  surfaceBulky: '#1E153A',               // Solid tinted fill — carved from background
  // Translucent variant used by floating bars (e.g., PremiumBar in SOS/Explore)
  // Matches T.surfaceBulky at ~65% opacity.
  surfaceBulkyGlass: 'rgba(30,21,58,0.65)',
  surfaceBulkyActive: '#251B48',         // Elevated for LIVE/active state
  hairlineMicro: 'rgba(255, 255, 255, 0.1)', // Standardized to 0.1

  // ── Glow tokens for ambient lighting effects
  glowViolet: 'rgba(138,56,246,0.15)',   // Ambient violet halo
  glowDanger: 'rgba(226,54,54,0.15)',    // Ambient red halo (LIVE)
} as const;

// ── Legacy export — maps to T tokens for backward compat
export const Theme = {
  colors: {
    background: T.bg,
    surface: T.surface,
    primary: T.violet,
    primaryDark: T.violetDark,
    primaryLight: T.violetLight,
    // Auth gradient: Deep Midnight → subtle violet glow
    gradientStart: '#08070B',
    gradientMid: '#1A1033',
    gradientEnd: 'rgba(138,56,246,0.15)',
    accent: T.accent,
    accentLight: T.accentLight,
    text: T.ink,
    muted: T.ink4,
    mutedDark: T.ink3,
    border: T.lineMid,
    danger: T.danger,
    success: T.success,
    safe: T.safeLight,
    safeLight: T.safeLight,
  },
};

// ─── Radius scale ──────────────────────────────────────────────────────────────
export const R = {
  xs: 8,    // chips, badges
  sm: 12,   // inputs, small cards
  md: 14,   // primary buttons, medium cards
  lg: 16,   // large cards
  xl: 20,   // hero panels, bottom sheets
  hBtn: 13, // header icon buttons (rounded-square)
  pill: 999, // true capsule pill (navbar, status badges)
  full: 999, // alias — same as pill
} as const;

// ─── Spacing scale (4-pt grid) ─────────────────────────────────────────────────
export const S = {
  s1: 4,
  s2: 8,
  s3: 12,
  s4: 16,
  s5: 24,
  s6: 32,
  s7: 48,
  s8: 64,
} as const;

// ─── Typography scale — luminous on dark ────────────────────────────────────────
export const Ty = {
  // Headings — near-white for max contrast
  h1: { fontSize: 28, fontWeight: '800' as const, letterSpacing: -0.5, color: T.ink },
  h2: { fontSize: 22, fontWeight: '800' as const, letterSpacing: -0.4, color: T.ink },
  h3: { fontSize: 18, fontWeight: '700' as const, letterSpacing: -0.2, color: T.ink },

  // Body — bright gray
  body: { fontSize: 15, fontWeight: '400' as const, color: T.ink2, lineHeight: 22 },
  bodyMd: { fontSize: 14, fontWeight: '400' as const, color: T.ink2, lineHeight: 20 },
  bodySm: { fontSize: 13, fontWeight: '400' as const, color: T.ink3, lineHeight: 18 },

  // Labels (form, section) — muted metadata
  label: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 0.7, textTransform: 'uppercase' as const, color: T.ink3 },

  // UI text
  btn: { fontSize: 16, fontWeight: '700' as const, color: T.onPrimary, letterSpacing: 0.2 },
  link: { fontSize: 14, fontWeight: '600' as const, color: T.violet },
  helper: { fontSize: 12, fontWeight: '400' as const, color: T.ink4 },
  error: { fontSize: 12, fontWeight: '500' as const, color: T.dangerText },
} as const;

// ─── Shadow system — violet-tinted glows on dark ────────────────────────────────
export const Sh = {
  // For floating cards on dark backgrounds
  card: {
    ios: { shadowColor: '#8A38F6', shadowOpacity: 0.12, shadowRadius: 20, shadowOffset: { width: 0, height: 6 } } as const,
    android: { elevation: 8 },
  },
  // For heavy modals / drawers
  modal: {
    ios: { shadowColor: '#8A38F6', shadowOpacity: 0.20, shadowRadius: 32, shadowOffset: { width: 0, height: 10 } } as const,
    android: { elevation: 16 },
  },
  // For floating map elements
  map: {
    ios: { shadowColor: '#8A38F6', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } } as const,
    android: { elevation: 4 },
  },
  // SOS glow effect
  sosGlow: {
    ios: { shadowColor: '#8A38F6', shadowOpacity: 0.40, shadowRadius: 30, shadowOffset: { width: 0, height: 0 } } as const,
    android: { elevation: 12 },
  },
  sosGlowDanger: {
    ios: { shadowColor: '#E23636', shadowOpacity: 0.35, shadowRadius: 30, shadowOffset: { width: 0, height: 0 } } as const,
    android: { elevation: 12 },
  },
} as const;
