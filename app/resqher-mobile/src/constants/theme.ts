// ─── ResQher Design System ─────────────────────────────────────────────────────
// Single source of truth. Import T, R, S, Ty, Sh from here everywhere.

// ── Brand color is #00BCD4 (Cyan/Teal). NEVER replace with purple.
// ── All "T.violet" references are the primary brand. Name kept for BC.

export const T = {
  // ── Backgrounds
  bg: '#FFFFFF',     // Root page background
  bgMuted: '#F8FAFC',     // Subtle surface (form bg, section bg)
  surface: '#FFFFFF',     // Cards, modals, sheets

  // ── Brand — Cyan/Teal
  violet: '#00BCD4', // primary brand (name kept for backward compat)
  violetDark: '#0097A7', // filled button background, darker accents
  violetDim: '#E0F7FA', // tinted backgrounds behind icons/pills
  violetLight: '#B2EBF2', // very light tint, selected bg

  // ── On-primary (text/icon on a #00BCD4 or #0097A7 fill)
  onPrimary: '#FFFFFF',

  // ── Accent
  accent: '#FF7043',
  accentLight: '#FFF3EE',

  // ── Text scale
  ink: '#0D1B2A', // headings, critical text
  ink2: '#1E293B', // body
  ink3: '#334155', // secondary body
  ink4: '#64748B', // muted, disabled
  ink5: '#94A3B8', // placeholder

  // ── Borders
  line: '#E9EEF4', // subtle divider
  lineMid: '#CBD5E1', // form idle border

  // ── Feedback
  danger: '#EF4444',
  dangerLight: '#FEF2F2',
  danger2: '#B91C1C', // deeper red (gradient end)
  success: '#10B981',
  safeLight: '#ECFDF5',

  // ── Disabled
  disabled: '#CBD5E1',
  disabledBg: '#F1F5F9',
} as const;

// ── Legacy export (some screens import Theme.colors.X)
export const Theme = {
  colors: {
    background: T.bgMuted,
    surface: T.surface,
    primary: T.violet,
    primaryDark: T.violetDark,
    primaryLight: T.violetLight,
    gradientStart: '#E0F7FA',
    gradientEnd: '#B2EBF2',
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
  xs: 8,   // chips, badges
  sm: 12,  // inputs, small cards
  md: 14,  // primary buttons, medium cards
  lg: 16,  // large cards, nav bar
  xl: 20,  // hero panels, bottom sheets
  full: 999, // pills
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

// ─── Shadow system (border-first for map overlays, shadow for sheets) ──────────
export const Sh = {
  // For floating elements over white backgrounds
  card: {
    ios: { shadowColor: '#0B0A14', shadowOpacity: 0.07, shadowRadius: 16, shadowOffset: { width: 0, height: 4 } } as const,
    android: { elevation: 6 },
  },
  // For heavy modal / drawer
  modal: {
    ios: { shadowColor: '#0B0A14', shadowOpacity: 0.12, shadowRadius: 28, shadowOffset: { width: 0, height: 8 } } as const,
    android: { elevation: 14 },
  },
  // For floating map elements (subtle — avoid dirty shadow over tiles)
  map: {
    ios: { shadowColor: '#0B0A14', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } } as const,
    android: { elevation: 3 },
  },
} as const;
