# SheSafe Styling Quick Reference Guide

## 🎨 Color Quick Reference

### Primary Colors
- **Violet (Brand):** `#8A38F6` — Buttons, active states, accents
- **Danger (Alert):** `#E23636` — SOS LIVE, emergencies, destructive actions
- **Success:** `#10B981` — Resolved incidents, confirmations

### Surface Colors
- **OLED Black:** `#000000` — Base background
- **Surface:** `#111113` — Most cards/modals
- **Surface Card:** `#1A1A1E` — Nested cards, secondary elements
- **Glass Bulky:** `#1E153A` — Headers, navbars (glassmorphism base)

### Text Colors (High Contrast)
- **Primary (ink):** `#F5F5F7` — Headings, important text
- **Body (ink2):** `#E5E5EA` — Regular body text
- **Secondary (ink3):** `#8E8E93` — Metadata, labels
- **Muted (ink4):** `#636366` — Placeholder, disabled

### Border Color (Universal)
```
rgba(255, 255, 255, 0.08)  // T.lineMid — Used on 95% of cards
```

---

## 📐 Sizing Reference

| Component | Size | Radius |
|-----------|------|--------|
| Card | - | 16pt (R.lg) |
| Badge/Pill | - | 999pt (R.pill) |
| Header Button | 36×36 | 13pt (R.hBtn) |
| Input Field | 48h | 14pt (R.md) |
| Small Badge | - | 8pt (R.xs) |

---

## 🎭 Incident Cards Pattern

### Visual Hierarchy
```
┌─────────────────────────────────────┐
│ ┌─────┐  [Card Title]         [Time]│
│ │Icon │  [Status Badge]              │
│ └─────┘                              │
└─────────────────────────────────────┘
```

### States

**LIVE (Active SOS):**
- BG: Elevated violet-tinted glass
- Border: Bright edge with violet glow
- Shadow: Violet shadow (iOS), elevation 4 (Android)
- Icon Box: Red danger tint (`rgba(226,54,54,0.12)`)

**RESOLVED (Inactive):**
- BG: Standard glass (`#1A1A1E`)
- Border: Standard fine line
- Opacity: 70% (lower priority signal)

**SOS (Emergency):**
- Border: Red danger accent
- Shadow: Red safety red shadow effect
- All other properties same as LIVE

### Code Template
```tsx
card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 28,
    padding: 16,
    gap: 16,
    borderWidth: 1,
    borderColor: isDangerous ? '#E23636' : 'rgba(255,255,255,0.08)',
    backgroundColor: isLive ? elevatedGlass : standardGlass,
    ...Platform.select({
        ios: {
            shadowColor: isDangerous ? '#E23636' : '#8A38F6',
            shadowOpacity: isDangerous ? 0.12 : 0.10,
            shadowRadius: 20,
            shadowOffset: { width: 0, height: 6 }
        },
        android: { elevation: 4 }
    })
}
```

---

## 🔝 Top Header Pattern

### SOS/Map Screens (Floating)
```
• Position: absolute (top)
• Left/Right inset: 14pt
• Background: Glass (rgba(30,21,58,0.65)) + BlurView
• Border: 1px hairline (barely visible)
• Overlay: Violet tint for depth
• Shadow: Violet shadow, opacity 0.12, radius 10
```

### List Screens (Fixed)
```
• Background: Glass surface (rgba(26,26,30,0.80))
• Border Bottom: 1px T.lineMid
• Buttons: 36×36, borderRadius 13
• Title: Centered, fontSize 16, fontWeight 700
```

---

## 📱 Bottom Navbar Pattern

### Universal Pattern
```
Position: absolute bottom
Width: 88% of screen
BorderRadius: 999 (full capsule pill)
Padding: 8px horizontal/vertical

Content:
├─ Tab 1: Icon + optional underline
├─ Tab 2: Icon + optional underline
└─ Tab 3: Icon + optional underline
```

### Active Tab Styling
```
Icon Box:
├─ Background: rgba(138,56,246,0.12)  // Violet dim
├─ Border: rgba(138,56,246,0.40)      // Violet 40%
└─ Underline: T.violet (#8A38F6), width 16, height 3

Inactive Tab:
├─ Background: #1A1A1E
├─ Border: rgba(255,255,255,0.08)
└─ Icon Color: #9CA3AF (neutral gray)
```

---

## 🃏 Card Pattern (Secondary Screens)

### Reusable Section Card
```
BackgroundColor:  #1A1A1E (T.surfaceCard)
BorderRadius:     16pt (R.lg)
BorderWidth:      1
BorderColor:      rgba(255,255,255,0.08)
Padding:          16pt horizontal, 12pt vertical
Dividers:         StyleSheet.hairlineWidth, T.lineMid
```

### Emergency Contacts Modal (Special)
```
BorderRadius:     20pt (R.xl)
BorderColor:      rgba(138,56,246,0.19)  // Soft violet ~30%
Background:       Tinted with rgba(18,11,41,0.85)
Shadow (iOS):     Violet, opacity 0.30, radius 24, y-offset -8
Shadow (Android): elevation 16
```

---

## 🎯 Verification Cards

### Status Card Pattern
```
StatusCard:
├─ Background: T.surfaceCard
├─ Border: T.lineMid
├─ IconRing:
│  ├─ Width/Height: 72
│  ├─ BorderWidth: 2
│  └─ BorderColor: T.accent (pending) | T.success (verified) | T.danger (rejected)
└─ StatusBadge:
   ├─ BorderRadius: R.pill (999)
   └─ BorderColor: dynamic per status

Upload Button:
├─ Background: rgba(138,56,246,0.10)     // Violet dim
├─ Border: rgba(138,56,246,0.19)         // ~30% opacity
└─ TextColor: T.violet
```

---

## 💬 Chat Elements

### Message Bubbles
```
Own Message (User):
├─ Background: rgba(138,56,246,0.15)
├─ BorderColor: rgba(138,56,246,0.25)
├─ BorderTopRightRadius: 4 (speech tail)
└─ BorderRadius: 16 (all other corners)

Other Message (Responder):
├─ Background: #1A1A1E
├─ BorderColor: rgba(255,255,255,0.08)
├─ BorderTopLeftRadius: 4 (speech tail)
└─ BorderRadius: 16 (all other corners)

SOS Message:
├─ Background: rgba(226,54,54,0.08)      // Red dim
├─ BorderColor: rgba(226,54,54,0.30)
├─ BorderLeftWidth: 3
└─ BorderLeftColor: #E23636              // Accent red
```

### Input Container (Floating Pill)
```
BorderRadius:     28 (3/4 pill)
BorderColor:      rgba(255,255,255,0.10)
Background:       rgba(30,21,58,0.45)    // Bulky glass
BlurView:         intensity 20, tint "dark"
Shadow (iOS):     Black opacity 0.2, radius 14, y-offset -3
Shadow (Android): elevation 8
```

---

## ✨ Shadow/Elevation System

### When to Use Each Shadow Preset

| Preset | Use Case | Opacity | Radius | Y-Offset |
|--------|----------|---------|--------|----------|
| **card** | Floating UI cards | 0.12 | 20 | 6 |
| **modal** | Drawers, modals | 0.20 | 32 | 10 |
| **map** | Map floating elements | 0.08 | 10 | 3 |
| **sosGlow** | SOS idle/pulse | 0.40 | 30 | 0 |
| **sosGlowDanger** | SOS LIVE/emergency | 0.30 (red) | 28 | 0 |

**Shadow Color Rule:**
- Most UI: `#8A38F6` (Violet brand)
- SOS/Danger: `#E23636` (Red alert)
- Applied via `Platform.select()` for iOS/Android compatibility

---

## 🎨 Glassmorphism Structure

### Header/Navbar Glass Layer
```
JSX Structure:
<View style={pb.bar}>
    <BlurView intensity={20} tint="dark" />           // Blur layer
    <View style={pb.tint} pointerEvents="none" />     // Violet tint
    <View style={pb.content}>{children}</View>        // Content
</View>

Styles:
bar = {
    backgroundColor: rgba(30, 21, 58, 0.65),         // Solid tint base
    borderWidth: 1,
    borderColor: rgba(255,255,255,0.03)              // Microscopic edge
}

tint = {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: rgba(138,56,246,0.07)           // Violet overlay
}
```

---

## 🔄 Consistent Patterns Across All Screens

### All Secondary Profile Screens Use:
1. **Header with Glass Background** — T.surfaceGlass with bottom border
2. **Section Cards** — T.surfaceCard background, 16pt radius, T.lineMid border
3. **Hairline Dividers** — Between rows inside cards
4. **Icon Buttons** — 36×36, border radius 13, T.surfaceCard background
5. **Spacing Grid** — 4pt base (S1–S8)

### Never Mix Patterns:
- ❌ Don't use `T.surface` for cards; use `T.surfaceCard`
- ❌ Don't use different border colors; stick to `T.lineMid`
- ❌ Don't create custom radii; use R.lg (16), R.md (14), R.hBtn (13)
- ❌ Don't use hardcoded colors; reference theme constants

---

## 📋 Copy-Paste Templates

### Standard Card
```typescript
const s = StyleSheet.create({
    card: {
        backgroundColor: T.surfaceCard,
        borderRadius: R.lg,
        borderWidth: 1,
        borderColor: T.lineMid,
        paddingHorizontal: S.s4,
        paddingVertical: S.s3,
        marginBottom: S.s3
    }
});
```

### Floating Modal
```typescript
const modal = StyleSheet.create({
    container: {
        borderRadius: R.xl,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: `${T.violet}30`,  // ~30% opacity
        ...Platform.select({
            ios: {
                shadowColor: '#8A38F6',
                shadowOpacity: 0.30,
                shadowRadius: 24,
                shadowOffset: { width: 0, height: -8 }
            },
            android: { elevation: 16 }
        })
    }
});
```

### Header
```typescript
const s = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: T.lineMid,
        backgroundColor: T.surfaceGlass
    },
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
});
```

---

## 🎯 Implementation Checklist

When styling new screens:
- [ ] Use T tokens for all colors (never hardcode)
- [ ] Use R tokens for all border radii
- [ ] Use S tokens for all spacing/padding
- [ ] Apply T.lineMid to all card borders
- [ ] Apply T.surfaceCard to all card backgrounds
- [ ] Add hairline dividers with T.lineMid
- [ ] Wrap modals in PremiumBar component for glass effect
- [ ] Apply appropriate shadow preset via Platform.select()
- [ ] Header: T.surfaceGlass + bottom border
- [ ] Icons: T.ink4 for muted, T.ink for active
- [ ] Disabled states: T.disabledBg + T.disabledText
- [ ] Use StyleSheet.hairlineWidth for dividers

---

## 📂 File References

**Theme Constants:** `src/constants/theme.ts`
**Gradients:** `src/constants/gradients.ts`
**Primary Incident Cards:** `app/(tabs)/users/standard-user/chat_home.tsx`
**Secondary Screens:** `app/(tabs)/users/standard-user/*.tsx`
**Headers/Navbars:** `app/(tabs)/users/sos_screen.tsx`, `ExploreScreen.tsx`

---

Generated: March 7, 2026 | SheSafe Mobile App v1.0
