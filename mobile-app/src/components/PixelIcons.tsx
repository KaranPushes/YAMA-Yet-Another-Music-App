import React from 'react';
import Svg, { Rect } from 'react-native-svg';

interface PixelIconProps {
  size?: number;
  color?: string;
}

/**
 * 8-Bit Pixelated Home Icon (Classic Arcade Cottage)
 * Grid: 16x16
 */
export const PixelHomeIcon: React.FC<PixelIconProps> = ({ size = 24, color = '#ffffff' }) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16">
      {/* Roof peak */}
      <Rect x="7" y="1" width="2" height="2" fill={color} />
      {/* Roof step 1 */}
      <Rect x="5" y="3" width="2" height="2" fill={color} />
      <Rect x="9" y="3" width="2" height="2" fill={color} />
      {/* Roof step 2 */}
      <Rect x="3" y="5" width="2" height="2" fill={color} />
      <Rect x="11" y="5" width="2" height="2" fill={color} />
      {/* Chimney */}
      <Rect x="11" y="2" width="2" height="3" fill={color} />
      {/* Roof base */}
      <Rect x="1" y="7" width="14" height="2" fill={color} />
      {/* Walls */}
      <Rect x="3" y="9" width="2" height="6" fill={color} />
      <Rect x="11" y="9" width="2" height="6" fill={color} />
      {/* Wall header above door */}
      <Rect x="5" y="9" width="6" height="2" fill={color} />
      {/* Floor */}
      <Rect x="3" y="14" width="10" height="1" fill={color} />
    </Svg>
  );
};

/**
 * 8-Bit Pixelated Search Icon (Arcade Magnifying Glass)
 * Grid: 16x16
 */
export const PixelSearchIcon: React.FC<PixelIconProps> = ({ size = 24, color = '#ffffff' }) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16">
      {/* Top rim */}
      <Rect x="4" y="1" width="5" height="2" fill={color} />
      {/* Left and right rims */}
      <Rect x="2" y="3" width="2" height="5" fill={color} />
      <Rect x="9" y="3" width="2" height="5" fill={color} />
      {/* Bottom rim of lens */}
      <Rect x="4" y="8" width="5" height="2" fill={color} />
      {/* Stepped pixel handle */}
      <Rect x="9" y="9" width="2" height="2" fill={color} />
      <Rect x="11" y="11" width="2" height="2" fill={color} />
      <Rect x="13" y="13" width="2" height="2" fill={color} />
    </Svg>
  );
};

/**
 * 8-Bit Pixelated Library Icon (Arcade Cassette / Cartridge)
 * Grid: 16x16
 */
export const PixelLibraryIcon: React.FC<PixelIconProps> = ({ size = 24, color = '#ffffff' }) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16">
      {/* Outer cartridge shell */}
      <Rect x="1" y="2" width="14" height="2" fill={color} />
      <Rect x="1" y="12" width="14" height="2" fill={color} />
      <Rect x="1" y="4" width="2" height="8" fill={color} />
      <Rect x="13" y="4" width="2" height="8" fill={color} />
      {/* Center label separator */}
      <Rect x="3" y="6" width="10" height="1" fill={color} />
      {/* Left tape reel spool */}
      <Rect x="4" y="8" width="2" height="2" fill={color} />
      {/* Right tape reel spool */}
      <Rect x="10" y="8" width="2" height="2" fill={color} />
      {/* Bottom cartridge notch */}
      <Rect x="4" y="13" width="8" height="2" fill={color} />
    </Svg>
  );
};

/**
 * 8-Bit Pixelated Settings Icon (Arcade Cog / Sprocket)
 * Grid: 16x16
 */
export const PixelSettingsIcon: React.FC<PixelIconProps> = ({ size = 24, color = '#ffffff' }) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16">
      {/* Top and bottom teeth */}
      <Rect x="6" y="0" width="4" height="2" fill={color} />
      <Rect x="6" y="14" width="4" height="2" fill={color} />
      {/* Left and right teeth */}
      <Rect x="0" y="6" width="2" height="4" fill={color} />
      <Rect x="14" y="6" width="2" height="4" fill={color} />
      {/* Diagonal corner teeth */}
      <Rect x="2" y="2" width="2" height="2" fill={color} />
      <Rect x="12" y="2" width="2" height="2" fill={color} />
      <Rect x="2" y="12" width="2" height="2" fill={color} />
      <Rect x="12" y="12" width="2" height="2" fill={color} />
      {/* Gear body ring */}
      <Rect x="4" y="3" width="8" height="2" fill={color} />
      <Rect x="4" y="11" width="8" height="2" fill={color} />
      <Rect x="3" y="5" width="2" height="6" fill={color} />
      <Rect x="11" y="5" width="2" height="6" fill={color} />
      {/* Central spindle */}
      <Rect x="7" y="7" width="2" height="2" fill={color} />
    </Svg>
  );
};

/**
 * 8-Bit Pixelated Dice / Shuffle Icon
 * Grid: 16x16
 */
export const PixelDiceIcon: React.FC<PixelIconProps> = ({ size = 20, color = '#ffffff' }) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16">
      {/* Outer border */}
      <Rect x="1" y="1" width="14" height="2" fill={color} />
      <Rect x="1" y="13" width="14" height="2" fill={color} />
      <Rect x="1" y="3" width="2" height="10" fill={color} />
      <Rect x="13" y="3" width="2" height="10" fill={color} />
      {/* Pips */}
      <Rect x="4" y="4" width="2" height="2" fill={color} />
      <Rect x="10" y="4" width="2" height="2" fill={color} />
      <Rect x="7" y="7" width="2" height="2" fill={color} />
      <Rect x="4" y="10" width="2" height="2" fill={color} />
      <Rect x="10" y="10" width="2" height="2" fill={color} />
    </Svg>
  );
};

/**
 * 8-Bit Pixelated Play Icon
 * Grid: 16x16
 */
export const PixelPlayIcon: React.FC<PixelIconProps> = ({ size = 16, color = '#ffffff' }) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16">
      <Rect x="3" y="2" width="2" height="12" fill={color} />
      <Rect x="5" y="3" width="2" height="10" fill={color} />
      <Rect x="7" y="5" width="2" height="6" fill={color} />
      <Rect x="9" y="6" width="2" height="4" fill={color} />
      <Rect x="11" y="7" width="2" height="2" fill={color} />
    </Svg>
  );
};

/**
 * 8-Bit Pixelated Pause Icon
 * Grid: 16x16
 */
export const PixelPauseIcon: React.FC<PixelIconProps> = ({ size = 16, color = '#ffffff' }) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16">
      <Rect x="3" y="2" width="3" height="12" fill={color} />
      <Rect x="10" y="2" width="3" height="12" fill={color} />
    </Svg>
  );
};

/**
 * 8-Bit Pixelated Sparkle / Star Icon
 * Grid: 16x16
 */
export const PixelSparkleIcon: React.FC<PixelIconProps> = ({ size = 14, color = '#ffffff' }) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16">
      <Rect x="7" y="1" width="2" height="14" fill={color} />
      <Rect x="1" y="7" width="14" height="2" fill={color} />
      <Rect x="6" y="6" width="4" height="4" fill={color} />
      <Rect x="4" y="4" width="2" height="2" fill={color} />
      <Rect x="10" y="4" width="2" height="2" fill={color} />
      <Rect x="4" y="10" width="2" height="2" fill={color} />
      <Rect x="10" y="10" width="2" height="2" fill={color} />
    </Svg>
  );
};
