import React, { useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  PanResponder,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { Song } from '../types/song';
import { usePlayer } from '../player/PlayerContext';
import { ArtworkImage } from './ArtworkImage';
import { formatTime } from '../utils/formatTime';
import {
  X,
  Trash2,
  ListMusic,
  Sparkles,
  GripVertical,
} from 'lucide-react-native';

interface QueueModalProps {
  visible: boolean;
  onClose: () => void;
}

interface DraggableQueueItemProps {
  item: Song;
  index: number;
  totalItems: number;
  onPlay: () => void;
  onRemove: () => void;
  onReorder: (from: number, to: number) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}

const DraggableQueueItem: React.FC<DraggableQueueItemProps> = ({
  item,
  index,
  totalItems,
  onPlay,
  onRemove,
  onReorder,
  onDragStart,
  onDragEnd,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(index);
  const dragY = useRef(new Animated.Value(0)).current;
  const startIndexRef = useRef(index);
  startIndexRef.current = index;
  const targetPreviewRef = useRef(index);
  targetPreviewRef.current = previewIndex;

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 2,
        onMoveShouldSetPanResponderCapture: (_, gestureState) => Math.abs(gestureState.dy) > 2,
        onPanResponderGrant: () => {
          setIsDragging(true);
          onDragStart();
          targetPreviewRef.current = startIndexRef.current;
          setPreviewIndex(startIndexRef.current);
        },
        onPanResponderMove: (_, gestureState) => {
          dragY.setValue(gestureState.dy);
          const rowHeight = 56;
          const shift = Math.round(gestureState.dy / rowHeight);
          const target = Math.max(0, Math.min(totalItems - 1, startIndexRef.current + shift));
          if (target !== targetPreviewRef.current) {
            targetPreviewRef.current = target;
            setPreviewIndex(target);
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          setIsDragging(false);
          onDragEnd();
          const rowHeight = 56;
          const shift = Math.round(gestureState.dy / rowHeight);
          const fromIdx = startIndexRef.current;
          const toIdx = Math.max(0, Math.min(totalItems - 1, fromIdx + shift));
          Animated.spring(dragY, {
            toValue: 0,
            friction: 7,
            tension: 60,
            useNativeDriver: true,
          }).start();
          if (toIdx !== fromIdx) {
            onReorder(fromIdx, toIdx);
          }
        },
        onPanResponderTerminationRequest: () => false,
        onPanResponderTerminate: () => {
          setIsDragging(false);
          onDragEnd();
          Animated.spring(dragY, {
            toValue: 0,
            friction: 7,
            tension: 60,
            useNativeDriver: true,
          }).start();
        },
      }),
    [totalItems, onReorder, dragY, onDragStart, onDragEnd]
  );

  return (
    <Animated.View
      style={[
        styles.queueItem,
        isDragging && styles.queueItemDragging,
        {
          transform: [{ translateY: dragY }],
          zIndex: isDragging ? 999 : 1,
        },
      ]}
    >
      <TouchableOpacity
        style={styles.queueItemMain}
        onPress={onPlay}
        activeOpacity={0.8}
        disabled={isDragging}
      >
        <View style={[styles.indexBox, isDragging && styles.indexBoxDragging]}>
          <Text style={[styles.indexText, isDragging && styles.indexTextDragging]}>
            {isDragging
              ? `➔${(previewIndex + 1).toString().padStart(2, '0')}`
              : (index + 1).toString().padStart(2, '0')}
          </Text>
        </View>

        <View style={styles.artFrameSmall}>
          <ArtworkImage
            songId={item.id}
            hasArtwork={item.hasArtwork}
            title={item.title}
            artist={item.artist}
            size={38}
            borderRadius={3}
          />
        </View>

        <View style={styles.itemMeta}>
          <Text numberOfLines={1} style={styles.itemTitle}>
            {item.title}
          </Text>
          <Text numberOfLines={1} style={styles.itemArtist}>
            {item.artist}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Touch drag handle & remove button */}
      <View style={styles.itemActions}>
        <TouchableOpacity
          style={styles.removeBtn}
          onPress={onRemove}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
        >
          <X size={14} color={colors.textMuted} />
        </TouchableOpacity>

        <View {...panResponder.panHandlers} style={styles.dragHandle}>
          <GripVertical
            size={20}
            color={isDragging ? colors.primaryLight : colors.textSecondary}
          />
        </View>
      </View>
    </Animated.View>
  );
};

export const QueueModal: React.FC<QueueModalProps> = ({ visible, onClose }) => {
  const { state, controls } = usePlayer();
  const { queue, currentSong } = state;
  const [isDraggingActive, setIsDraggingActive] = useState(false);

  const handleClear = () => {
    Alert.alert(
      'CLEAR QUEUE',
      'Do you want to clear all upcoming tracks from the queue?',
      [
        { text: 'CANCEL', style: 'cancel' },
        {
          text: 'CLEAR',
          style: 'destructive',
          onPress: () => controls.clearQueue(),
        },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <View style={styles.arcadeBadge}>
                <Sparkles size={11} color={colors.primary} />
                <Text style={styles.arcadeBadgeText}>[QUEUE // MATRIX]</Text>
              </View>
              <Text style={styles.headerTitle}>UPCOMING TRACKS</Text>
            </View>

            <View style={styles.headerActions}>
              {queue.length > 0 && (
                <TouchableOpacity
                  style={styles.clearBtn}
                  onPress={handleClear}
                  activeOpacity={0.8}
                >
                  <Trash2 size={12} color={colors.error} />
                  <Text style={styles.clearBtnText}>CLEAR</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={onClose}
                activeOpacity={0.8}
              >
                <X size={16} color={colors.cream} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Current Playing Track Banner */}
          {currentSong && (
            <View style={styles.nowPlayingCard}>
              <View style={styles.nowPlayingTag}>
                <Text style={styles.nowPlayingTagText}>▶ NOW PLAYING</Text>
              </View>
              <View style={styles.nowPlayingContent}>
                <View style={styles.artFrame}>
                  <ArtworkImage
                    songId={currentSong.id}
                    hasArtwork={currentSong.hasArtwork}
                    title={currentSong.title}
                    artist={currentSong.artist}
                    size={46}
                    borderRadius={3}
                  />
                </View>
                <View style={styles.nowPlayingMeta}>
                  <Text numberOfLines={1} style={styles.nowPlayingTitle}>
                    {currentSong.title}
                  </Text>
                  <Text numberOfLines={1} style={styles.nowPlayingArtist}>
                    {currentSong.artist}
                  </Text>
                </View>
                <Text style={styles.nowPlayingDuration}>
                  {formatTime(currentSong.duration)}
                </Text>
              </View>
            </View>
          )}

          {/* Upcoming Queue List */}
          <FlatList
            data={queue}
            keyExtractor={(item, idx) => `${item.id}_${idx}`}
            contentContainerStyle={styles.listContent}
            getItemLayout={(data, index) => ({ length: 60, offset: 60 * index, index })}
            initialNumToRender={12}
            maxToRenderPerBatch={10}
            windowSize={5}
            removeClippedSubviews={true}
            scrollEnabled={!isDraggingActive}
            ListHeaderComponent={
              queue.length > 0 ? (
                <View style={styles.queueHeader}>
                  <Text style={styles.queueCountText}>
                    NEXT IN QUEUE ({queue.length})
                  </Text>
                  <Text style={styles.reorderHint}>HOLD ≡ TO DRAG & REORDER</Text>
                </View>
              ) : null
            }
            renderItem={({ item, index }) => (
              <DraggableQueueItem
                key={`${item.id}_${index}`}
                item={item}
                index={index}
                totalItems={queue.length}
                onPlay={() => controls.jumpToQueueItem(index)}
                onRemove={() => controls.removeFromQueue(index)}
                onReorder={(from, to) => controls.reorderQueue(from, to)}
                onDragStart={() => setIsDraggingActive(true)}
                onDragEnd={() => setIsDraggingActive(false)}
              />
            )}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <ListMusic size={36} color={colors.primary} />
                <Text style={styles.emptyTitle}>NO UPCOMING TRACKS</Text>
                <Text style={styles.emptySubtext}>
                  Add songs using "Play Next" or "Add to Queue" from any track's action menu.
                </Text>
              </View>
            }
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: colors.pixelBorder,
    backgroundColor: colors.surface,
  },
  headerLeft: {
    gap: 2,
  },
  arcadeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  arcadeBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: 0.8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#2A141A',
    borderWidth: 1.5,
    borderColor: colors.error,
    borderRadius: 3,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  clearBtnText: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.error,
    letterSpacing: 0.5,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: colors.pixelBorder,
  },
  nowPlayingCard: {
    margin: 12,
    backgroundColor: colors.surface,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.primary,
    padding: 10,
    shadowColor: colors.pixelShadow,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  nowPlayingTag: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryDark,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
    marginBottom: 8,
  },
  nowPlayingTagText: {
    fontSize: 9,
    fontWeight: '900',
    color: colors.textDark,
    letterSpacing: 0.6,
  },
  nowPlayingContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  artFrame: {
    borderWidth: 1.5,
    borderColor: colors.pixelBorder,
    borderRadius: 4,
    overflow: 'hidden',
  },
  nowPlayingMeta: {
    flex: 1,
    marginLeft: 10,
  },
  nowPlayingTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  nowPlayingArtist: {
    fontSize: 11,
    color: colors.primaryLight,
    fontWeight: '700',
    marginTop: 2,
  },
  nowPlayingDuration: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  listContent: {
    paddingHorizontal: 12,
    paddingBottom: 40,
  },
  queueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.pixelBorderSoft,
    marginBottom: 6,
  },
  queueCountText: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: 0.8,
  },
  reorderHint: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.accentSecondary,
    letterSpacing: 0.6,
  },
  queueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.pixelBorder,
    borderRadius: 4,
    paddingVertical: 8,
    paddingHorizontal: 8,
    marginVertical: 3,
  },
  queueItemDragging: {
    borderColor: colors.primary,
    borderWidth: 2,
    backgroundColor: colors.surfaceHighlight,
    zIndex: 100,
    elevation: 6,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
  },
  queueItemMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  indexBox: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indexBoxDragging: {
    backgroundColor: colors.primary,
    borderRadius: 3,
    paddingHorizontal: 4,
    width: 'auto',
    minWidth: 32,
  },
  indexText: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  indexTextDragging: {
    color: colors.textDark,
    fontWeight: '900',
  },
  artFrameSmall: {
    borderWidth: 1,
    borderColor: colors.pixelBorder,
    borderRadius: 3,
    overflow: 'hidden',
    marginRight: 10,
  },
  itemMeta: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  itemArtist: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 2,
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 6,
  },
  removeBtn: {
    padding: 6,
  },
  dragHandle: {
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: 1,
  },
  emptySubtext: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 16,
  },
});
