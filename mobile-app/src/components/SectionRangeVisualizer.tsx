import React, { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  PanResponder,
  LayoutChangeEvent,
  Text,
} from 'react-native';
import { PlaybackSection } from '../types/section';
import { colors } from '../theme/colors';
import { formatTime } from '../utils/formatTime';

interface SectionRangeVisualizerProps {
  durationSeconds: number;
  positionSeconds: number;
  sections: PlaybackSection[];
  isSectionModeEnabled: boolean;
  onSeek?: (seconds: number) => void;
  height?: number;
}

export const SectionRangeVisualizer: React.FC<SectionRangeVisualizerProps> = ({
  durationSeconds,
  positionSeconds,
  sections,
  isSectionModeEnabled,
  onSeek,
  height = 38,
}) => {
  const [trackWidth, setTrackWidth] = useState<number>(0);
  const [isScrubbing, setIsScrubbing] = useState<boolean>(false);
  const [scrubPosition, setScrubPosition] = useState<number>(positionSeconds);

  const scrubPositionRef = useRef<number>(positionSeconds);
  scrubPositionRef.current = isScrubbing ? scrubPosition : positionSeconds;

  const trackWidthRef = useRef<number>(trackWidth);
  trackWidthRef.current = trackWidth;

  const durationRef = useRef<number>(durationSeconds);
  durationRef.current = durationSeconds;

  const safeDuration = Math.max(durationSeconds, 1);
  const activePosition = isScrubbing ? scrubPosition : positionSeconds;
  const playheadPercent = Math.min(Math.max((activePosition / safeDuration) * 100, 0), 100);

  const calculateSecondsFromX = (locationX: number): number => {
    const width = trackWidthRef.current;
    if (width <= 0) return 0;
    const clampedX = Math.max(0, Math.min(locationX, width));
    const ratio = clampedX / width;
    const target = ratio * Math.max(durationRef.current, 1);
    return Math.max(0, Math.min(target, durationRef.current));
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        setIsScrubbing(true);
        const sec = calculateSecondsFromX(evt.nativeEvent.locationX);
        scrubPositionRef.current = sec;
        setScrubPosition(sec);
      },
      onPanResponderMove: (evt) => {
        const sec = calculateSecondsFromX(evt.nativeEvent.locationX);
        scrubPositionRef.current = sec;
        setScrubPosition(sec);
      },
      onPanResponderRelease: (evt) => {
        const sec = calculateSecondsFromX(evt.nativeEvent.locationX);
        setIsScrubbing(false);
        if (onSeek) {
          onSeek(sec);
        }
      },
      onPanResponderTerminate: () => {
        setIsScrubbing(false);
      },
    })
  ).current;

  const handleLayout = (e: LayoutChangeEvent) => {
    const { width } = e.nativeEvent.layout;
    if (width > 0) {
      setTrackWidth(width);
    }
  };

  return (
    <View style={styles.outerContainer}>
      {/* Scrub Time Tooltip popup when dragging */}
      {isScrubbing && (
        <View
          pointerEvents="none"
          style={[styles.tooltipContainer, { left: `${playheadPercent}%` }]}
        >
          <View style={styles.tooltipBubble}>
            <Text style={styles.tooltipText}>{formatTime(scrubPosition)}</Text>
          </View>
          <View style={styles.tooltipArrow} />
        </View>
      )}

      {/* Main Scrubber Hit Target */}
      <View
        style={[styles.container, { height }]}
        onLayout={handleLayout}
        {...panResponder.panHandlers}
      >
        {/* Background track (represents unplayed / skipped area) */}
        <View pointerEvents="none" style={styles.trackBackground} />

        {/* Allowed Sections highlight overlay */}
        {isSectionModeEnabled &&
          sections.map((sec, idx) => {
            const leftPercent = (sec.startSeconds / safeDuration) * 100;
            const widthPercent = ((sec.endSeconds - sec.startSeconds) / safeDuration) * 100;

            // Check if playhead is currently inside this section
            const isCurrent = activePosition >= sec.startSeconds && activePosition < sec.endSeconds;

            return (
              <View
                key={sec.id || idx}
                pointerEvents="none"
                style={[
                  styles.sectionHighlight,
                  {
                    left: `${leftPercent}%`,
                    width: `${widthPercent}%`,
                    backgroundColor: isCurrent ? 'rgba(0, 245, 155, 0.45)' : 'rgba(168, 85, 247, 0.25)',
                    borderColor: isCurrent ? colors.primary : colors.accentPurple,
                  },
                ]}
              />
            );
          })}

        {/* When section mode is disabled or no sections, show standard progress fill */}
        {(!isSectionModeEnabled || sections.length === 0) && (
          <View
            pointerEvents="none"
            style={[styles.standardProgressFill, { width: `${playheadPercent}%` }]}
          />
        )}

        {/* Playhead indicator draggable needle & thumb */}
        <View
          pointerEvents="none"
          style={[
            styles.playheadNeedleContainer,
            { left: `${playheadPercent}%` },
            isScrubbing && styles.playheadNeedleActive,
          ]}
        >
          <View style={[styles.needleThumb, isScrubbing && styles.needleThumbActive]} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    width: '100%',
    position: 'relative',
    marginVertical: 4,
  },
  container: {
    width: '100%',
    position: 'relative',
    justifyContent: 'center',
  },
  tooltipContainer: {
    position: 'absolute',
    top: -30,
    marginLeft: -26,
    alignItems: 'center',
    zIndex: 10,
  },
  tooltipBubble: {
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 5,
  },
  tooltipText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
  },
  tooltipArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 5,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: colors.primary,
  },
  trackBackground: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 6,
    backgroundColor: colors.surfaceHighlight,
    borderRadius: 3,
  },
  sectionHighlight: {
    position: 'absolute',
    height: 12,
    borderRadius: 4,
    borderWidth: 1.5,
  },
  standardProgressFill: {
    position: 'absolute',
    height: 6,
    left: 0,
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  playheadNeedleContainer: {
    position: 'absolute',
    width: 32,
    height: 32,
    marginLeft: -16,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  playheadNeedleActive: {
    transform: [{ scale: 1.25 }],
  },
  needleThumb: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.textPrimary,
    borderWidth: 2.5,
    borderColor: colors.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
    elevation: 5,
  },
  needleThumbActive: {
    backgroundColor: colors.primary,
    borderColor: colors.textPrimary,
    width: 18,
    height: 18,
    borderRadius: 9,
  },
});
