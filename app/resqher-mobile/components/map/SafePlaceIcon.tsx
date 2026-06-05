import React from 'react';
import Svg, {
  Path,
  Ellipse,
  Circle,
  Defs,
  LinearGradient,
  Stop,
} from 'react-native-svg';

type SafePlaceIconProps = {
  size?: number;
  bgColor?: string;
};

export const SafePlaceIcon = ({
  size = 40,
  bgColor = 'rgba(4, 24, 27, 0.94)',
}: SafePlaceIconProps) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Defs>
        <LinearGradient id="safeStroke" x1="6" y1="3" x2="26" y2="29">
          <Stop offset="0%" stopColor="#A7F3D0" />
          <Stop offset="45%" stopColor="#5EEAD4" />
          <Stop offset="100%" stopColor="#14B8A6" />
        </LinearGradient>

        <LinearGradient id="safeSoftFill" x1="8" y1="4" x2="24" y2="24">
          <Stop offset="0%" stopColor="#5EEAD4" stopOpacity="0.18" />
          <Stop offset="100%" stopColor="#0F766E" stopOpacity="0.05" />
        </LinearGradient>
      </Defs>

      {/* Soft glass halo inside the SVG */}
      <Circle cx="16" cy="13.2" r="10.4" fill="url(#safeSoftFill)" />

      {/* Subtle ground glow */}
      <Ellipse
        cx="16"
        cy="27.55"
        rx="6.8"
        ry="1.5"
        fill="#5EEAD4"
        fillOpacity="0.18"
      />

      {/* Slim safe-zone base */}
      <Path
        d="M10.3 25.1 H21.7 L22.8 27.1 H9.2 L10.3 25.1 Z"
        fill="#5EEAD4"
        fillOpacity="0.10"
        stroke="url(#safeStroke)"
        strokeWidth="1.15"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity="0.82"
      />

      {/* Inner base detail */}
      <Path
        d="M12.4 26.1 H19.6"
        stroke="url(#safeStroke)"
        strokeWidth="1"
        strokeLinecap="round"
        strokeOpacity="0.58"
      />

      {/* Main safe location body */}
      <Path
        d="M16 3.5 C11 3.5 7.7 7.45 7.7 12.05 C7.7 17.35 16 22.85 16 22.85 C16 22.85 24.3 17.35 24.3 12.05 C24.3 7.45 21 3.5 16 3.5 Z"
        stroke="url(#safeStroke)"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={bgColor}
      />

      {/* Inner shield */}
      <Path
        d="M16 7.2 L12.3 8.65 V11.55 C12.3 14.2 16 16.75 16 16.75 C16 16.75 19.7 14.2 19.7 11.55 V8.65 L16 7.2 Z"
        stroke="url(#safeStroke)"
        strokeWidth="1.55"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Checkmark */}
      <Path
        d="M13.95 11.75 L15.3 13.1 L18.15 10.15"
        stroke="#CCFBF1"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
};
