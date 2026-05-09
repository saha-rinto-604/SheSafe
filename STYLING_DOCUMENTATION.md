# ResQher App Styling Documentation
**Generated:** March 7, 2026  
**Purpose:** Complete reference of styling values, constants, and component styles

---

## 1. THEME CONSTANTS
**Location:** [`src/constants/theme.ts`](src/constants/theme.ts)

### Color Palette (T tokens)

#### Backgrounds & Surfaces
```
bg:                 '#000000'              // True OLED Black — max battery, max contrast
bgElevated:         '#0A0A0C'              // Slightly lifted — for overlays
surface:            '#111113'              // Surface Elevated — cards, modals, headers
surfaceCard:        '#1A1A1E'              // Glassmorphism card fill (80% opacity)
surfaceLight:       '#1A1A1E'              // Lightest dark surface
surfaceMid:         '#2C2C2E'              // Mid dark — disabled, inactive
surfaceDark:        '#3A3A3C'              // For hovered/pressed states
```

#### Brand — Electric Violet (Primary)
```
violet:             '#8A38F6'              // Primary Electric Violet
violetDark:         '#6D28D9'              // Deep Violet — button pressed
violetDim:          'rgba(138,56,246,0.10)'  // Subtle purple tint — active role cards
violetLight:        '#A855F7'              // Lighter violet — highlights
violetLighter:      'rgba(138,56,246,0.15)'  // Very subtle bg tint
brandGlow:          'rgba(138,56,246,0.40)'  // Pulsing SOS glow, button aura
```

#### Text Hierarchy (ink tokens)
```
ink:                '#F5F5F7'              // Primary headings — near-white
ink2:               '#E5E5EA'              // Body text — bright white-gray
ink3:               '#8E8E93'              // Secondary metadata — tactical gray
ink4:               '#636366'              // Muted text, icons — low emphasis
ink5:               '#48484A'              // Placeholder text — very muted
```

#### Borders
```
line:               'rgba(255,255,255,0.04)'   // Very faint divider
lineMid:            'rgba(255,255,255,0.08)'   // Standard border
lineBold:           'rgba(255,255,255,0.14)'   // Stronger border for contrast
```

#### Feedback Colors
```
danger:             '#E23636'              // Safety Red — SOS Live, police alerts
dangerMid:          '#DC2626'              // Mid danger — pulse rings
dangerPressed:      '#B91C1C'              // Pressed/darker danger
dangerLight:        'rgba(226,54,54,0.12)'  // Tinted bg for danger areas
dangerBorder:       'rgba(226,54,54,0.30)'  // Subtle ring
dangerText:         '#FCA5A5'              // Text on dark danger backgrounds
dangerBg:           'rgba(226,54,54,0.10)'  // Chip background
success:            '#10B981'              // Emerald — Secure/Success
safeLight:          'rgba(16,185,129,0.10)'  // Success bg tint
accent:             '#F59E0B'              // Gold — volunteer markers & accents
accentLight:        'rgba(245,158,11,0.12)'   // Gold tint for badge bg
```

#### Glass Surfaces (Glassmorphism)
```
surfaceBulky:       '#1E153A'              // Universal Glass—carved from background
surfaceBulkyActive: '#251B48'              // Elevated for LIVE/active state
surfaceGlass:       'rgba(26,26,30,0.80)'  // 80% dark glass
surfaceOverlay:     'rgba(138,56,246,0.07)'  // Violet tint overlay
hairlineMicro:      'rgba(255,255,255,0.03)'  // Microscopic edge-light catcher
```

#### Disabled & Navigation
```
disabled:           '#2C2C2E'              // Disabled component bg
disabledBg:         '#1C1C1E'              // Disabled bg
disabledText:       '#48484A'              // Disabled text
navIconInactive:    '#9CA3AF'              // Higher-contrast neutral gray
inputIconDefault:   '#8E8E93'              // Brighter default icon for inputs
onPrimary:          '#FFFFFF'              // Text on primary fill
onDanger:           '#FFFFFF'              // Text on danger fill
```

### Radius Scale (R tokens)
```
xs:     8          // chips, badges
sm:     12         // inputs, small cards
md:     14         // primary buttons, medium cards
lg:     16         // large cards
xl:     20         // hero panels, bottom sheets
hBtn:   13         // header icon buttons (rounded-square)
pill:   999        // true capsule pill (navbar, status badges)
full:   999        // alias — same as pill
```

### Spacing Scale (S tokens - 4pt grid)
```
s1:     4
s2:     8
s3:     12
s4:     16
s5:     24
s6:     32
s7:     48
s8:     64
```

### Typography Scale (Ty tokens)
```
h1:     fontSize: 28, fontWeight: '800', letterSpacing: -0.5
h2:     fontSize: 22, fontWeight: '800', letterSpacing: -0.4
h3:     fontSize: 18, fontWeight: '700', letterSpacing: -0.2
body:   fontSize: 15, fontWeight: '400', letterSpacing: 0
btn:    fontSize: 16, fontWeight: '700', letterSpacing: 0.2
```

---

## 2. INCIDENT CARDS STYLING

### Primary Location
[`app/(tabs)/users/standard-user/chat_home.tsx`](app/(tabs)/users/standard-user/chat_home.tsx#L360)

### Card Base Styling (Lines 435-480)
```typescript
card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: D.cardRadius,        // 28pt (rounded pill-like)
    padding: D.cardPadding,            // 16pt
    gap: S.s4,                         // 16pt
    borderWidth: 1,
}

// LIVE state cards
cardLive: {
    backgroundColor: D.cardFillActive,  // Elevated violet-tinted glass
    borderColor: D.hairlineActive,      // Brighter edge
    iOS: {
        shadowColor: D.neonViolet,      // '#8A38F6' — Electric Violet
        shadowOpacity: 0.10,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 6 }
    },
    Android: { elevation: 4 }
}

// SOS indicator styling
cardSOS: {
    borderColor: D.hairline,
    iOS: {
        shadowColor: D.vividRed,        // '#E23636' — Safety Red
        shadowOpacity: 0.12,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 4 }
    },
    Android: { elevation: 4 }
}

// RESOLVED state cards
cardResolved: {
    backgroundColor: D.cardFill,        // Standard glass
    borderColor: D.hairline,
    opacity: 0.70                       // Interactive, lower priority
}
```

### Incident Card Color Variables (from chat_home.tsx)
```
D.cardRadius:       28            // Pill-like radius
D.cardPadding:      16
D.cardFill:         See gradients
D.cardFillActive:   See gradients
D.hairline:         See gradients
D.hairlineActive:   See gradients
D.neonViolet:       '#8A38F6'
D.vividRed:         '#E23636'
D.avatarSize:       48
```

### Icon Box Styling (Within Card)
```typescript
iconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: T.surfaceMid,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: S.s3,              // 12pt
    flexShrink: 0
}

iconBoxLive: {
    backgroundColor: T.dangerLight,  // 'rgba(226,54,54,0.12)'
    borderWidth: 1,
    borderColor: T.dangerBorder      // 'rgba(226,54,54,0.30)'
}
```

---

## 3. FLOATING TOP HEADER STYLES

### SOS Screen Header
**Location:** [`app/(tabs)/users/sos_screen.tsx`](app/(tabs)/users/sos_screen.tsx#L820)

```typescript
// PremiumBar component (reusable header/navbar)
header: {
    position: 'absolute',
    left: 14,
    right: 14,
    borderRadius: R.lg,               // 16pt
    zIndex: 300,
    iOS: {
        shadowColor: '#8A38F6',
        shadowOpacity: 0.12,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 3 }
    },
    Android: { elevation: 6 }
}

// PremiumBar glass structure
pb.bar: {
    backgroundColor: 'rgba(30,21,58,0.65)',  // T.surfaceBulky at 65%
    borderWidth: 1,
    borderColor: T.hairlineMicro,            // 'rgba(255,255,255,0.03)'
    overflow: 'hidden'
}

pb.tint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: T.surfaceOverlay        // 'rgba(138,56,246,0.07)' — Violet tint
}

pb.content: {
    flexDirection: 'row',
    alignItems: 'center'
}
```

### Incident History Header
**Location:** [`app/(tabs)/users/standard-user/incident-history.tsx`](app/(tabs)/users/standard-user/incident-history.tsx#L212)

```typescript
header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: T.lineMid,
    backgroundColor: T.surfaceGlass          // 'rgba(26,26,30,0.80)'
}

headerBtn: {
    width: 36,
    height: 36,
    borderRadius: R.hBtn,                    // 13pt
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: T.lineMid,
    backgroundColor: T.surfaceCard
}

headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: T.ink,
    marginHorizontal: 10
}
```

---

## 4. BOTTOM NAVBAR STYLES

### ExploreScreen Navbar
**Location:** [`app/(tabs)/users/standard-user/ExploreScreen.tsx`](app/(tabs)/users/standard-user/ExploreScreen.tsx#L667)

```typescript
// Container positioning
navWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 200
}

// Bar styling (wrapped in PremiumBar component)
navBar: {
    width: width * 0.88,
    borderRadius: R.pill,                    // 999pt — full capsule
    iOS: {
        shadowColor: '#8A38F6',
        shadowOpacity: 0.12,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 2 }
    },
    Android: { elevation: 6 }
}

navBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    paddingVertical: 8
}

// Individual tab styling
navTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48
}

navTabInner: {
    alignItems: 'center',
    gap: 0
}

navUnderline: {
    width: 16,
    height: 3,
    borderRadius: 1.5,
    marginTop: 5,
    // backgroundColor animated: T.violet when active
}

navIconBox: {
    width: 36,
    height: 36,
    borderRadius: R.hBtn,                    // 13pt
    backgroundColor: T.surfaceCard,
    borderWidth: 1,
    borderColor: T.lineMid,
    alignItems: 'center',
    justifyContent: 'center'
}

navIconBoxActive: {
    backgroundColor: 'rgba(138,56,246,0.12)',
    borderColor: 'rgba(138,56,246,0.25)'    // ~40% opacity
}
```

### SOS Screen Navbar (Identical)
**Location:** [`app/(tabs)/users/sos_screen.tsx`](app/(tabs)/users/sos_screen.tsx#L980)

- Same structure as ExploreScreen
- `navBar` width: `width * 0.88`
- `navBar` borderRadius: `R.pill` (999)
- Shadow/elevation identical

---

## 5. SECONDARY SCREEN FILES & STYLESHEET DEFINITIONS

### Profile-Related Screens

#### 1. Profile Information (Read-only)
**File:** [`app/(tabs)/users/standard-user/profile-information.tsx`](app/(tabs)/users/standard-user/profile-information.tsx#L220)

**Key Styles:**
- Header: `backgroundColor: T.surfaceGlass`, `borderBottomColor: T.lineMid`
- Section Cards: `backgroundColor: T.surfaceCard`, `borderRadius: R.lg`, `borderWidth: 1`, `borderColor: T.lineMid`
- Avatar: `width: 88`, `height: 88`, `borderRadius: 44`, `borderWidth: 2.5`, `borderColor: 'rgba(138,56,246,0.50)'`
- Info Rows: Dividers use `backgroundColor: T.lineMid`, `height: StyleSheet.hairlineWidth`

#### 2. Edit Profile
**File:** [`app/(tabs)/users/standard-user/edit-profile.tsx`](app/(tabs)/users/standard-user/edit-profile.tsx#L150)

**Key Styles:**
- Section Card: `backgroundColor: T.surfaceCard`, `borderRadius: R.lg`, `borderWidth: 1`, `borderColor: T.lineMid`
- Input Row: `backgroundColor: T.surfaceCard`, `borderRadius: R.md`, `borderWidth: 1`, `borderColor: T.lineMid`
- Dropdown: `backgroundColor: T.surfaceBulky`, `borderRadius: R.sm`, `borderWidth: 1`, `borderColor: 'rgba(138,56,246,0.19)'`
- Dropdown Item Active: `backgroundColor: T.violetDim`

#### 3. Emergency Contacts
**File:** [`app/(tabs)/users/standard-user/emergency-contacts.tsx`](app/(tabs)/users/standard-user/emergency-contacts.tsx#L770)

**Key Styles - Floating Modal Card:**
```typescript
floatingCard: {
    borderRadius: R.xl,                      // 20pt
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(138,56,246,0.19)',   // Soft violet edge (~30%)
    maxHeight: '90%',
    iOS: {
        shadowColor: '#8A38F6',
        shadowOpacity: 0.30,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: -8 }
    },
    Android: { elevation: 16 }
}

cardTint: {
    backgroundColor: 'rgba(18,11,41,0.85)'  // Deep purple tint
}

cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16
}

cardCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: R.hBtn,                    // 13pt
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.surfaceCard,
    borderWidth: 1,
    borderColor: T.lineMid
}
```

**Empty State Card:**
```typescript
emptyCard: {
    backgroundColor: T.surfaceCard,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: T.lineMid,
    paddingVertical: 36,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 8
}
```

**Contact Card:**
```typescript
contactCard: {
    backgroundColor: T.surfaceCard,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: T.lineMid,
    paddingHorizontal: 14
}
```

---

### Safety & Security Screens

#### 4. Safety Settings
**File:** [`app/(tabs)/users/standard-user/safety-settings.tsx`](app/(tabs)/users/standard-user/safety-settings.tsx#L1)

**Key Styles:**
- Section Card: `backgroundColor: T.surfaceCard`, `borderRadius: R.lg`, `borderWidth: 1`, `borderColor: T.lineMid`
- Toggle Switch: Uses T.violet for active state
- Recommended Wrap: `borderTopWidth: StyleSheet.hairlineWidth`, `borderTopColor: T.lineMid`

#### 5. Privacy & Security Hub
**File:** [`app/(tabs)/users/standard-user/privacy-security.tsx`](app/(tabs)/users/standard-user/privacy-security.tsx#L1)

**Navigation Items:**
- Links to: Change Password, Two-Factor Auth, Blocked Users
- Section Card styling consistent with other screens

#### 6. Change Password
**File:** [`app/(tabs)/users/standard-user/change-password.tsx`](app/(tabs)/users/standard-user/change-password.tsx#L1)

**Password Input Component:**
```typescript
row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.surfaceCard,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: T.lineMid,
    paddingHorizontal: 14,
    height: 48
}

rowError: {
    borderColor: T.danger
}
```

**Section Card:**
```typescript
sectionCard: {
    backgroundColor: T.surfaceCard,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: T.lineMid,
    paddingHorizontal: S.s4,
    paddingVertical: S.s4
}
```

#### 7. Two-Factor Authentication
**File:** [`app/(tabs)/users/standard-user/two-factor-auth.tsx`](app/(tabs)/users/standard-user/two-factor-auth.tsx#L129)

**Header:**
```typescript
header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: T.lineMid,
    backgroundColor: T.surfaceGlass
}

headerBtn: {
    width: 36,
    height: 36,
    borderRadius: R.hBtn,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: T.lineMid,
    backgroundColor: T.surfaceCard
}
```

**Section Card:**
```typescript
sectionCard: {
    backgroundColor: T.surfaceCard,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: T.lineMid,
    paddingHorizontal: 16,
    paddingVertical: 12
}
```

#### 8. Blocked Users
**File:** [`app/(tabs)/users/standard-user/blocked-users.tsx`](app/(tabs)/users/standard-user/blocked-users.tsx#L1)

**Section Card:**
```typescript
sectionCard: {
    backgroundColor: T.surfaceCard,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: T.lineMid,
    paddingHorizontal: 16,
    paddingVertical: 12
}

noteCard: {
    backgroundColor: T.surfaceCard,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: T.lineMid,
    paddingHorizontal: 14,
    paddingVertical: 14
}
```

---

### Verification & Additional Screens

#### 9. Volunteer Verification
**File:** [`app/(tabs)/users/standard-user/volunteer-verification.tsx`](app/(tabs)/users/standard-user/volunteer-verification.tsx#L1)

**Status Card:**
```typescript
statusCard: {
    alignItems: 'center',
    backgroundColor: T.surfaceCard,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: T.lineMid,
    paddingVertical: 28,
    paddingHorizontal: 20,
    marginBottom: 20
}

statusIconRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16
    // borderColor: T.accent (pending), T.success (verified), T.danger (rejected)
}

statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: R.pill,
    borderWidth: 1,
    marginBottom: 10
    // backgroundColor & borderColor dynamic based on status
}
```

**Upload Buttons:**
```typescript
uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: R.sm,
    backgroundColor: T.violetDim,                    // 'rgba(138,56,246,0.10)'
    borderWidth: 1,
    borderColor: 'rgba(138,56,246,0.19)'            // ~30% opacity
}

uploadBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: T.violet
}
```

**Tip Card:**
```typescript
tipCard: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: 'rgba(245,158,11,0.10)',       // T.accent tinted
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.19)',           // T.accent ~30%
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 24
}
```

#### 10. Incident History
**File:** [`app/(tabs)/users/standard-user/incident-history.tsx`](app/(tabs)/users/standard-user/incident-history.tsx#L200)

**Incident Card:**
```typescript
card: {
    backgroundColor: T.surfaceCard,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: T.lineMid,
    paddingHorizontal: S.s4,
    paddingVertical: 14,
    marginBottom: 12
}

statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: R.pill,
    borderWidth: 1
    // Dynamic: backgroundColor & borderColor per status
}

statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3
}
```

**Status Colors:**
- Active: `color: T.accent` (#F59E0B), `bg: 'rgba(245,158,11,0.25)'`, `border: 'rgba(245,158,11,0.35)'`
- Resolved: `color: T.success` (#10B981), `bg: T.safeLight`, `border: 'rgba(16,185,129,0.35)'`
- Cancelled: `color: T.danger` (#E23636), `bg: T.dangerLight`, `border: T.dangerBorder`

#### 11. Chat Home (Incident List)
**File:** [`app/(tabs)/users/standard-user/chat_home.tsx`](app/(tabs)/users/standard-user/chat_home.tsx#L360)

See **Incident Cards Styling** section above.

#### 12. Chat Room (Message Threads)
**File:** [`app/(tabs)/users/standard-user/chat_room.tsx`](app/(tabs)/users/standard-user/chat_room.tsx#L1053)

**Floating Input Container:**
```typescript
inputPillContainer: {
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    iOS: {
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: -3 }
    },
    Android: { elevation: 8 }
}

inputPillBg: {
    backgroundColor: '#1E153A',                      // T.surfaceBulky
    opacity: 0.45
}
```

**Message Bubbles:**
```typescript
bubble: {
    maxWidth: '78%',
    borderRadius: R.lg,
    padding: S.s3,
    borderWidth: 1
}

bubbleOther: {
    backgroundColor: T.surfaceCard,
    borderColor: T.lineMid,
    borderTopLeftRadius: 4
}

bubbleOwn: {
    backgroundColor: 'rgba(138,56,246,0.15)',
    borderColor: 'rgba(138,56,246,0.25)',
    borderTopRightRadius: 4
}

bubbleVictim: {
    backgroundColor: 'rgba(226,54,54,0.08)',
    borderColor: T.dangerBorder,
    borderLeftWidth: 3,
    borderLeftColor: T.danger
}
```

---

## 6. GRADIENT CONSTANTS
**Location:** [`src/constants/gradients.ts`](src/constants/gradients.ts)

```typescript
G = {
    // Premium Glow Background
    premiumBg: {
        colors: ['#08070B', '#1A1033', 'rgba(138,56,246,0.15)'],
        start: { x: 0, y: 0 },
        end: { x: 0, y: 1 }
    },

    // Auth Background
    authBg: {
        colors: ['#000000', '#000000', '#0D0015', '#1A0033'],
        locations: [0, 0.55, 0.8, 1.0],
        start: { x: 0.5, y: 0 },
        end: { x: 0.5, y: 1 }
    },

    // Nav Active Gradient
    navActive: {
        colors: ['#8A38F6', '#6D28D9'],
        start: { x: 0, y: 0 },
        end: { x: 1, y: 0 }
    },

    // SOS Button Idle
    sosIdle: {
        colors: ['#8A38F6', '#7C3AED'],
        start: { x: 0, y: 0 },
        end: { x: 1, y: 1 }
    },

    // SOS Button LIVE (Danger)
    sosDanger: {
        colors: ['#E23636', '#991B1B'],
        start: { x: 0.1, y: 0.0 },
        end: { x: 0.9, y: 1.0 }
    },

    // Card Fill (Dark Surface)
    cardFill: {
        colors: [T.surface, T.surfaceCard],
        start: { x: 0, y: 0 },
        end: { x: 1, y: 1 }
    },

    // Soft Surface Tint
    softTone: {
        colors: [T.bg, T.surface],
        start: { x: 0, y: 0 },
        end: { x: 0, y: 1 }
    },

    // SOS Pulse Ring
    sosRingDefault: 'rgba(138,56,246,0.40)',         // Electric Violet
    sosRingLive: 'rgba(226,54,54,0.45)',             // Safety Red

    // Emergency Aura
    sosAuraPulse: {
        colors: ['transparent', 'rgba(226,54,54,0.14)'],
        start: { x: 0.5, y: 0 },
        end: { x: 0.5, y: 1 }
    },

    // Atmospheric Environment
    atmosphericBg: {
        colors: ['#120B29', '#0D0820', '#090514'],
        start: { x: 0, y: 0 },
        end: { x: 0, y: 1 }
    }
}
```

---

## 7. SHADOW/ELEVATION SYSTEM
**Location:** [`src/constants/theme.ts`](src/constants/theme.ts#L169)

```typescript
// For floating cards on dark backgrounds
card: {
    ios: { shadowColor: '#8A38F6', shadowOpacity: 0.12, shadowRadius: 20, shadowOffset: { width: 0, height: 6 } },
    android: { elevation: 8 }
}

// For heavy modals / drawers
modal: {
    ios: { shadowColor: '#8A38F6', shadowOpacity: 0.20, shadowRadius: 32, shadowOffset: { width: 0, height: 10 } },
    android: { elevation: 16 }
}

// For floating map elements
map: {
    ios: { shadowColor: '#8A38F6', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } },
    android: { elevation: 4 }
}

// SOS glow effect
sosGlow: {
    ios: { shadowColor: '#8A38F6', shadowOpacity: 0.40, shadowRadius: 30, shadowOffset: { width: 0, height: 0 } },
    android: { elevation: 12 }
}

// SOS danger glow
sosGlowDanger: {
    ios: { shadowColor: '#E23636', shadowOpacity: 0.30, shadowRadius: 28, shadowOffset: { width: 0, height: 0 } },
    android: { elevation: 12 }
}
```

---

## 8. SCREEN FILE LOCATIONS SUMMARY

| Screen | File Path | StyleSheet Key | Card BgColor | Border Color |
|--------|-----------|-----------------|--------------|--------------|
| Profile Information | `profile-information.tsx` | `sectionCard` | `T.surfaceCard` | `T.lineMid` |
| Edit Profile | `edit-profile.tsx` | `sectionCard` | `T.surfaceCard` | `T.lineMid` |
| Emergency Contacts | `emergency-contacts.tsx` | `emptyCard`, `contactCard`, `floatingCard` | `T.surfaceCard` / `rgba(18,11,41,0.85)` | `T.lineMid` / `rgba(138,56,246,0.19)` |
| Safety Settings | `safety-settings.tsx` | `sectionCard` | `T.surfaceCard` | `T.lineMid` |
| Privacy & Security | `privacy-security.tsx` | `sectionCard` | `T.surfaceCard` | `T.lineMid` |
| Change Password | `change-password.tsx` | `sectionCard` | `T.surfaceCard` | `T.lineMid` |
| Two-Factor Auth | `two-factor-auth.tsx` | `sectionCard` | `T.surfaceCard` | `T.lineMid` |
| Blocked Users | `blocked-users.tsx` | `sectionCard`, `noteCard` | `T.surfaceCard` | `T.lineMid` |
| Volunteer Verification | `volunteer-verification.tsx` | `statusCard`, `sectionCard` | `T.surfaceCard` | `T.lineMid` |
| Incident History | `incident-history.tsx` | `card` | `T.surfaceCard` | `T.lineMid` |
| Chat Home (Incident List) | `chat_home.tsx` | `card` (Live/Resolved/SOS) | Dynamic (see above) | Dynamic |
| Chat Room | `chat_room.tsx` | `bubble`, `inputPillContainer` | Dynamic per state | `T.lineMid` / Dynamic |
| Explore Screen (Map) | `ExploreScreen.tsx` | `navBar` | `T.surfaceCard` | `T.lineMid` |
| SOS Screen (Map) | `sos_screen.tsx` | `navBar` | `T.surfaceCard` | `T.lineMid` |

---

## 9. CONSISTENT PATTERNS

### All Secondary Screens Use:
- **Section Card Pattern:**
  - `backgroundColor: T.surfaceCard` (#1A1A1E)
  - `borderRadius: R.lg` (16pt)
  - `borderWidth: 1`
  - `borderColor: T.lineMid` (rgba(255,255,255,0.08))

- **Header Pattern:**
  - `backgroundColor: T.surfaceGlass` (rgba(26,26,30,0.80))
  - `borderBottomWidth: 1`
  - `borderBottomColor: T.lineMid`
  - Header Buttons: 36×36 with `borderRadius: R.hBtn` (13pt)

- **Dividers:**
  - `height: StyleSheet.hairlineWidth`
  - `backgroundColor: T.lineMid`

### Card Shadow Consistency:
All elevated cards use either:
- **card** preset: shadowOpacity 0.12, shadowRadius 20 (UI cards, floating elements)
- **modal** preset: shadowOpacity 0.20, shadowRadius 32 (modals, drawers)

All shadows use `shadowColor: '#8A38F6'` (Electric Violet brand) for dark-mode cohesion

---

## 10. KEY DESIGN VALUES REFERENCE

| Property | Value | Usage |
|----------|-------|-------|
| Primary Brand Color | #8A38F6 | Buttons, active states, focus indicators |
| Danger Color | #E23636 | SOS LIVE state, alerts, destructive actions |
| Card Border Radius | 16pt (R.lg) | Standard cards, modals |
| Pill Border Radius | 999pt (R.pill) | Nav bars, badges, status pills |
| Header Button Radius | 13pt (R.hBtn) | Icon buttons only |
| Standard Border | rgba(255,255,255,0.08) | All card edges, dividers |
| Standard Padding | 16pt (S.s4) | Card content padding |
| Standard Shadow (Cards) | Opacity 0.12, Radius 20, Y-offset 6 | Floating elements |
| Heavy Shadow (Modals) | Opacity 0.20, Radius 32, Y-offset 10 | Drawers, bottom sheets |
| Glassmorphism BG | rgba(30,21,58,0.65) | Header/navbar bars |
| Glassmorphism Overlay | rgba(138,56,246,0.07) | Tint effect on glass |

---

## 11. NOTES

- All styling uses **dark mode exclusively** (OLED black base: #000000)
- **Glassmorphism pattern**: BlurView (intensity 20, tint "dark") + solid semi-transparent bg + tint overlay
- **Color opacity scheme** is consistent: 40% for glows, 30% for borders, 15% for dim backgrounds
- **Active state visual feedback** uses elevated glass + brighter borders + shadow effect
- **All components follow 4pt spacing grid** (S1–S8)
- Shadow colors match brand (Violet for standard, Red for SOS/danger)
- **No light mode implementation** — pure dark tactical design

