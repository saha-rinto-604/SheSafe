// ─── ResQher Design System ─────────────────────────────────────────────────────
// Single source of truth. Import T, R, S, Ty, Sh from here everywhere.

// ── Exact color palette extracted from the reference image.
// ── Vibrant Lavender & Violet theme for a premium safety app.

export const T = {
  // ── Backgrounds
  // The app uses a full-screen vertical gradient background.
  bg: '#FFFFFF',          // Base white for card surfaces
  bgMuted: '#F9F5FF',     // Extremely light lavender for subtle areas
  surface: '#FFFFFF',     // Pure white for the main container

  // ── Brand — Exact saturation from image
  violet: '#A855F7',      // Primary Violet — used for buttons (CHECKOUT/PAY)
  violetDark: '#9333EA',  // Deep Purple — for button shadows and active states
  violetDim: '#F5F3FF',   // Softest lily tint — for inactive/muted states
  violetLight: '#C084FC', // Medium Lavender — for product cards and highlights

  // ── On-primary
  onPrimary: '#FFFFFF',

  // ── Accent
  accent: '#F97316',
  accentLight: '#FFF7ED',

  // ── Text scale
  ink: '#111827', // Headings — Maximum contrast dark grey
  ink2: '#374151', // Body text
  ink3: '#6B7280', // Secondary body
  ink4: '#9CA3AF', // Muted text
  ink5: '#D8B4FE', // Placeholder — tinted lavender

  // ── Borders
  line: '#F3E8FF',   // Very soft lavender divider
  lineMid: '#E9D5FF', // Form border — soft purple

  // ── Feedback — violet-harmonious danger scale (rose/crimson, not pure red)
  danger: '#BE123C', // Primary danger — deep rose (LIVE button, critical icons)
  dangerMid: '#E11D48', // Mid danger — for pulse rings only
  dangerPressed: '#9F1239', // Pressed/darker danger — for press states
  dangerLight: '#FFF1F2', // Tinted background surface for danger areas
  dangerBorder: '#FDA4AF', // Subtle border/ring — pinkish, non-jarring
  dangerText: '#9F1239', // Text on light danger backgrounds
  dangerBg: '#FFF1F2', // Chip / badge background
  onDanger: '#FFFFFF', // Text/icon on danger fill surfaces
  success: '#10B981',
  safeLight: '#ECFDF5',

  // ── Disabled
  disabled: '#E9D5FF',
  disabledBg: '#FAF5FF',

  // ── Nav icon inactive — violet-tinted soft lavender for premium inactive state
  // Warmer than neutral grey; on-brand with the violet design language
  // rgba(168,85,247,0.38) over white ≈ #C9A8F7 — sits between violetLight and ink5
  navIconMuted: '#7D6BBE', // Darker violet for better contrast in inactive state

  // ── Glass surface tokens (for header / navbar overlay approach)
  // Layer 1: translucent white base for floating bars over map
  surfaceGlass: 'rgba(255,255,255,0.92)',
  // Layer 2: single solid violet tint at 7% — replaces the heavier gradient overlay
  // Use this as backgroundColor on an absoluteFill view instead of LinearGradient
  surfaceOverlay: 'rgba(168,85,247,0.07)',
  // Deprecated fraction kept for back-compat (not used in new components)
  gradientOverlayOpacity: 0.07 as number,
} as const;

// ── Legacy export
export const Theme = {
  colors: {
    background: T.bg,
    surface: T.surface,
    primary: T.violet,
    primaryDark: T.violetDark,
    primaryLight: T.violetLight,
    // Auth shell background: Top soft lavender (#F5F3FF) → Bottom saturated lavender (#D8B4FE)
    gradientStart: '#F5F3FF',
    gradientEnd: '#D8B4FE',
    accent: T.accent,
    accentLight: T.accentLight,
    text: T.ink,
    muted: T.ink4,
    mutedDark: T.ink3,
    border: T.lineMid,
    danger: T.danger,
    success: T.success,
    safe: '#ECFDF5',
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

// ─── Typography scale ──────────────────────────────────────────────────────────
export const Ty = {
  // Headings
  h1: { fontSize: 28, fontWeight: '800' as const, letterSpacing: -0.5, color: T.ink },
  h2: { fontSize: 22, fontWeight: '800' as const, letterSpacing: -0.4, color: T.ink },
  h3: { fontSize: 18, fontWeight: '700' as const, letterSpacing: -0.2, color: T.ink },

  // Body
  body: { fontSize: 15, fontWeight: '400' as const, color: T.ink2, lineHeight: 22 },
  bodyMd: { fontSize: 14, fontWeight: '400' as const, color: T.ink2, lineHeight: 20 },
  bodySm: { fontSize: 13, fontWeight: '400' as const, color: T.ink3, lineHeight: 18 },

  // Labels (form, section)
  label: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 0.7, textTransform: 'uppercase' as const, color: T.ink2 },

  // UI text
  btn: { fontSize: 16, fontWeight: '700' as const, color: T.onPrimary, letterSpacing: 0.2 },
  link: { fontSize: 14, fontWeight: '600' as const, color: T.violet },
  helper: { fontSize: 12, fontWeight: '400' as const, color: T.ink4 },
  error: { fontSize: 12, fontWeight: '500' as const, color: T.danger },
} as const;

// ─── Shadow system ─────────────────────────────────────────────────────────────
export const Sh = {
  // For floating elements over white backgrounds
  card: {
    ios: { shadowColor: '#5B21B6', shadowOpacity: 0.10, shadowRadius: 16, shadowOffset: { width: 0, height: 4 } } as const,
    android: { elevation: 6 },
  },
  // For heavy modal / drawer (violet-tinted shadow like the reference)
  modal: {
    ios: { shadowColor: '#5B21B6', shadowOpacity: 0.15, shadowRadius: 28, shadowOffset: { width: 0, height: 8 } } as const,
    android: { elevation: 14 },
  },
  // For floating map elements (subtle)
  map: {
    ios: { shadowColor: '#5B21B6', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } } as const,
    android: { elevation: 3 },
  },
} as const;
