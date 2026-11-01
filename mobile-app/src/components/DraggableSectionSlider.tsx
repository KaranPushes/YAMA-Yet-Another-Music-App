import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  PanResponder,
  LayoutChangeEvent,
} from 'react-native';
import { colors } from '../theme/colors';
import { formatTime } from '../utils/formatTime';
import { PlaybackSection } from '../types/section';

interface DraggableSectionSliderProps {
  durationSeconds: number;
  currentPlayheadSeconds: number;
  startSeconds: number;
  endSeconds: number;
  existingSections?: PlaybackSection[];
  onRangeChange: (start: number, end: number) => void;
  height?: number;
}

export const DraggableSectionSlider: React.FC<DraggableSectionSliderProps> = ({
  durationSeconds,
  currentPlayheadSeconds,
  startSeconds,
  endSeconds,
  existingSections = [],
  onRangeChange,
  height = 54,
}) => {
  const [trackWidth, setTrackWidth] = useState<number>(0);
  const trackWidthRef = useRef<number>(0);
  trackWidthRef.current = trackWidth;

  const durationRef = useRef<number>(durationSeconds);
  durationRef.current = Math.max(durationSeconds, 1);

  const startRef = useRef<number>(startSeconds);
  startRef.current = startSeconds;

  const endRef = useRef<number>(endSeconds);
  endRef.current = endSeconds;

  // Anchor points captured at touch-down so accumulated dx doesn't cause runaway
  const initialStartSecRef = useRef<number>(startSeconds);
  const initialEndSecRef = useRef<number>(endSeconds);

  const [activeHandle, setActiveHandle] = useState<'start' | 'end' | null>(null);

  // PanResponder for START handle
  const startPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        setActiveHandle('start');
        initialStartSecRef.current = startRef.current;
      },
      onPanResponderMove: (_, gestureState) => {
        const width = trackWidthRef.current;
        if (width <= 0) return;
        const deltaSec = (gestureState.dx / width) * durationRef.current;
        let newSec = initialStartSecRef.current + deltaSec;
        // Constraint: start must be >= 0 and <= end - 0.5s
        newSec = Math.max(0, Math.min(newSec, endRef.current - 0.5));
        onRangeChange(parseFloat(newSec.toFixed(1)), endRef.current);
      },
      onPanResponderRelease: () => setActiveHandle(null),
      onPanResponderTerminate: () => setActiveHandle(null),
    })
  ).current;

  // PanResponder for END handle
  const endPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        setActiveHandle('end');
        initialEndSecRef.current = endRef.current;
      },
      onPanResponderMove: (_, gestureState) => {
        const width = trackWidthRef.current;
        if (width <= 0) return;
        const deltaSec = (gestureState.dx / width) * durationRef.current;
        let newSec = initialEndSecRef.current + deltaSec;
        // Constraint: end must be >= start + 0.5s and <= duration
        newSec = Math.min(durationRef.current, Math.max(newSec, startRef.current + 0.5));
        onRangeChange(startRef.current, parseFloat(newSec.toFixed(1)));
      },
      onPanResponderRelease: () => setActiveHandle(null),
      onPanResponderTerminate: () => setActiveHandle(null),
    })
  ).current;

  const handleLayout = (e: LayoutChangeEvent) => {
    const { width } = e.nativeEvent.layout;
    if (width > 0) {
      setTrackWidth(width);
    }
  };

  const safeDur = Math.max(durationSeconds, 1);
  const startPercent = Math.min(Math.max((startSeconds / safeDur) * 100, 0), 100);
  const endPercent = Math.min(Math.max((endSeconds / safeDur) * 100, 0), 100);
  const widthPercent = Math.max(endPercent - startPercent, 0);

  const playheadPercent = Math.min(Math.max((currentPlayheadSeconds / safeDur) * 100, 0), 100);

  return (
    <View style={styles.outerContainer}>
      <View style={[styles.timelineTrack, { height }]} onLayout={handleLayout}>
        {/* Full Track Background */}
        <View style={styles.backgroundBar} />

        {/* Existing Configured Sections */}
        {existingSections.map((sec, idx) => {
          const l = (sec.startSeconds / safeDur) * 100;
          const w = ((sec.endSeconds - sec.startSeconds) / safeDur) * 100;
          return (
            <View
              key={sec.id || idx}
              style={[
                styles.existingSectionHighlight,
                { left: `${l}%`, width: `${w}%` },
              ]}
            />
          );
        })}

        {/* Active Selection Highlight Bar */}
        <View
          style={[
            styles.selectionHighlight,
            {
              left: `${startPercent}%`,
              width: `${widthPercent}%`,
            },
          ]}
        />

        {/* Current Audio Playhead Needle */}
        <View style={[styles.playheadNeedle, { left: `${playheadPercent}%` }]} />

        {/* DRAGGABLE START HANDLE */}
        <View
          style={[
            styles.handleWrapper,
            { left: `${startPercent}%` },
            activeHandle === 'start' && styles.handleWrapperActive,
          ]}
          {...startPanResponder.panHandlers}
        >
          <View style={[styles.handlePill, styles.handlePillStart, activeHandle === 'start' && styles.handlePillActive]}>
            <Text style={styles.handleBracketText}>[</Text>
          </View>
          <View style={styles.handleLabelTag}>
            <Text style={styles.handleLabelText}>{formatTime(startSeconds)}</Text>
          </View>
        </View>

        {/* DRAGGABLE END HANDLE */}
        <View
          style={[
            styles.handleWrapper,
            { left: `${endPercent}%` },
            activeHandle === 'end' && styles.handleWrapperActive,
          ]}
          {...endPanResponder.panHandlers}
        >
          <View style={[styles.handlePill, styles.handlePillEnd, activeHandle === 'end' && styles.handlePillActive]}>
            <Text style={styles.handleBracketText}>]</Text>
          </View>
          <View style={styles.handleLabelTag}>
            <Text style={styles.handleLabelText}>{formatTime(endSeconds)}</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    width: '100%',
    paddingVertical: 14,
  },
  timelineTrack: {
    width: '100%',
    position: 'relative',
    justifyContent: 'center',
  },
  backgroundBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 10,
    backgroundColor: colors.surfaceHighlight,
    borderRadius: 5,
  },
  existingSectionHighlight: {
    position: 'absolute',
    height: 10,
    backgroundColor: 'rgba(168, 85, 247, 0.35)',
    borderRadius: 5,
  },
  selectionHighlight: {
    position: 'absolute',
    height: 14,
    backgroundColor: colors.primary,
    borderRadius: 7,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 4,
  },
  playheadNeedle: {
    position: 'absolute',
    width: 2.5,
    height: 34,
    backgroundColor: colors.accentPurpleLight,
    marginLeft: -1.25,
    zIndex: 2,
    borderRadius: 1,
  },
  handleWrapper: {
    position: 'absolute',
    width: 50,
    height: 64,
    marginLeft: -25,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  handleWrapperActive: {
    zIndex: 25,
    transform: [{ scale: 1.15 }],
  },
  handlePill: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    borderColor: colors.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 7,
  },
  handlePillStart: {
    borderColor: colors.primary,
  },
  handlePillEnd: {
    borderColor: colors.accentPurpleLight,
  },
  handlePillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.textPrimary,
  },
  handleBracketText: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  handleLabelTag: {
    marginTop: 4,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: colors.border,
  },
  handleLabelText: {
    fontSize: 10,
    color: colors.textPrimary,
    fontWeight: '700',
  },
});
