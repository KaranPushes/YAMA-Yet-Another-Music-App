import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Song } from '../types/song';
import { PlaybackSection } from '../types/section';
import { colors } from '../theme/colors';
import { formatTime } from '../utils/formatTime';
import { usePlayer } from '../player/PlayerContext';
import { fetchSections, createSection, deleteSection } from '../api/sectionApi';
import { DraggableSectionSlider } from '../components/DraggableSectionSlider';
import {
  ArrowLeft,
  Scissors,
  Trash2,
  Play,
  Clock,
  Plus,
  Sliders,
} from 'lucide-react-native';

interface SectionEditorScreenProps {
  route: { params: { song: Song } };
  navigation: any;
}

export const SectionEditorScreen: React.FC<SectionEditorScreenProps> = ({
  route,
  navigation,
}) => {
  const { song } = route.params;
  const { state, controls } = usePlayer();
  const [sections, setSections] = useState<PlaybackSection[]>(song.sections || []);
  const [startSec, setStartSec] = useState<number>(0);
  const [endSec, setEndSec] = useState<number>(Math.min(30, song.duration || 30));
  const [startInput, setStartInput] = useState<string>('0.0');
  const [endInput, setEndInput] = useState<string>(Math.min(30, song.duration || 30).toFixed(1));
  const [isSaving, setIsSaving] = useState(false);

  // Load fresh sections from server
  useEffect(() => {
    fetchSections(song.id)
      .then((serverSections) => {
        setSections(serverSections);
        controls.refreshSongSections(serverSections);
      })
      .catch((err) => console.warn('Failed to load sections:', err));
  }, [song.id]);

  const currentPos = state.positionSeconds;

  const handleSliderRangeChange = (newStart: number, newEnd: number) => {
    setStartSec(newStart);
    setEndSec(newEnd);
    setStartInput(newStart.toFixed(1));
    setEndInput(newEnd.toFixed(1));
  };

  const handleStartInputChange = (val: string) => {
    setStartInput(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num >= 0 && num < endSec) {
      setStartSec(num);
    }
  };

  const handleEndInputChange = (val: string) => {
    setEndInput(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num > startSec) {
      setEndSec(num);
    }
  };

  const handleSetStartCurrent = () => {
    const cur = parseFloat(currentPos.toFixed(1));
    setStartSec(cur);
    setStartInput(cur.toFixed(1));
    if (cur >= endSec) {
      const nextEnd = Math.min(cur + 15, song.duration || cur + 15);
      setEndSec(nextEnd);
      setEndInput(nextEnd.toFixed(1));
    }
  };

  const handleSetEndCurrent = () => {
    const cur = parseFloat(currentPos.toFixed(1));
    setEndSec(cur);
    setEndInput(cur.toFixed(1));
    if (cur <= startSec) {
      const nextStart = Math.max(0, cur - 15);
      setStartSec(nextStart);
      setStartInput(nextStart.toFixed(1));
    }
  };

  const handleSaveSection = async () => {
    const parsedStart = parseFloat(startInput);
    const parsedEnd = parseFloat(endInput);

    if (isNaN(parsedStart) || isNaN(parsedEnd)) {
      Alert.alert('Invalid Input', 'Please specify both start and end times in seconds.');
      return;
    }

    if (parsedStart < 0) {
      Alert.alert('Invalid Start', 'Start time must be greater than or equal to 0.');
      return;
    }

    if (parsedEnd <= parsedStart) {
      Alert.alert('Invalid Range', 'End time must be strictly greater than start time.');
      return;
    }

    if (song.duration > 0 && parsedEnd > song.duration + 2) {
      Alert.alert('Out of Bounds', `End time cannot exceed track duration (${formatTime(song.duration)}).`);
      return;
    }

    setIsSaving(true);
    try {
      const created = await createSection(song.id, parsedStart, parsedEnd);
      const updated = [...sections, created].sort((a, b) => a.startSeconds - b.startSeconds);
      setSections(updated);
      controls.refreshSongSections(updated);
      Alert.alert('Success', `Added section ${formatTime(parsedStart)} → ${formatTime(parsedEnd)}`);
    } catch (err: any) {
      Alert.alert('Failed to Save', err.message || 'Could not save section.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSection = async (sectionId: string) => {
    try {
      await deleteSection(song.id, sectionId);
      const filtered = sections.filter((s) => s.id !== sectionId);
      setSections(filtered);
      controls.refreshSongSections(filtered);
    } catch (err: any) {
      Alert.alert('Delete Failed', err.message || 'Could not delete section.');
    }
  };

  const handlePreviewSection = (section: PlaybackSection) => {
    controls.seekTo(section.startSeconds);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <ArrowLeft size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerTitles}>
            <Text style={styles.headerMainTitle}>Section Editor</Text>
            <Text numberOfLines={1} style={styles.headerSubTitle}>
              {song.title} — {song.artist}
            </Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Live Playhead Info Card */}
          <View style={styles.livePositionCard}>
            <View style={styles.livePositionHeader}>
              <Clock size={16} color={colors.primary} />
              <Text style={styles.livePositionTitle}>Live Playhead Position</Text>
            </View>
            <Text style={styles.livePositionValue}>{formatTime(currentPos)}</Text>
            <Text style={styles.livePositionSubtext}>
              {currentPos.toFixed(1)}s / {song.duration.toFixed(1)}s total
            </Text>
          </View>

          {/* Draggable Visual Section Slider Card */}
          <View style={styles.creatorCard}>
            <View style={styles.cardHeaderRow}>
              <Sliders size={18} color={colors.sectionActive} />
              <Text style={styles.cardTitle}>Drag Handles to Custom Set Range</Text>
            </View>
            <Text style={styles.cardInstruction}>
              Drag the <Text style={styles.highlightText}>[ Start</Text> and <Text style={styles.highlightText}>End ]</Text> handles along the bar to visually frame the section:
            </Text>

            {/* Draggable Dual-Handle Bar */}
            <DraggableSectionSlider
              durationSeconds={song.duration}
              currentPlayheadSeconds={currentPos}
              startSeconds={startSec}
              endSeconds={endSec}
              existingSections={sections}
              onRangeChange={handleSliderRangeChange}
              height={50}
            />

            {/* Time input boxes with quick 'Set Current' buttons */}
            <View style={styles.inputsRow}>
              {/* Start Column */}
              <View style={styles.inputCol}>
                <Text style={styles.inputLabel}>From (seconds)</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="numeric"
                  placeholder="0.0"
                  placeholderTextColor={colors.textMuted}
                  value={startInput}
                  onChangeText={handleStartInputChange}
                />
                <TouchableOpacity style={styles.setButton} onPress={handleSetStartCurrent}>
                  <Text style={styles.setButtonText}>Set Current ({formatTime(currentPos)})</Text>
                </TouchableOpacity>
              </View>

              {/* End Column */}
              <View style={styles.inputCol}>
                <Text style={styles.inputLabel}>To (seconds)</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="numeric"
                  placeholder="30.0"
                  placeholderTextColor={colors.textMuted}
                  value={endInput}
                  onChangeText={handleEndInputChange}
                />
                <TouchableOpacity style={styles.setButton} onPress={handleSetEndCurrent}>
                  <Text style={styles.setButtonText}>Set Current ({formatTime(currentPos)})</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Save Button */}
            <TouchableOpacity
              style={[styles.saveButton, isSaving && styles.savingButton]}
              onPress={handleSaveSection}
              disabled={isSaving}
            >
              <Plus size={16} color={colors.background} />
              <Text style={styles.saveButtonText}>
                Add Section ({formatTime(startSec)} → {formatTime(endSec)})
              </Text>
            </TouchableOpacity>
          </View>

          {/* Configured Sections List */}
          <View style={styles.sectionsListHeader}>
            <Scissors size={18} color={colors.sectionActive} />
            <Text style={styles.sectionsListTitle}>
              Active Playback Sections ({sections.length})
            </Text>
          </View>

          {sections.length === 0 ? (
            <View style={styles.emptySectionsBox}>
              <Text style={styles.emptySectionsText}>
                No playback sections defined yet. Full track will play without skips.
              </Text>
            </View>
          ) : (
            sections.map((section, index) => {
              const isPlayingThis =
                currentPos >= section.startSeconds && currentPos < section.endSeconds;
              return (
                <View
                  key={section.id || index}
                  style={[
                    styles.sectionItem,
                    isPlayingThis && styles.activePlayingSectionItem,
                  ]}
                >
                  <View style={styles.sectionIndexBadge}>
                    <Text style={styles.sectionIndexText}>{index + 1}</Text>
                  </View>

                  <View style={styles.sectionTimingInfo}>
                    <Text style={styles.sectionTimingText}>
                      {formatTime(section.startSeconds)} → {formatTime(section.endSeconds)}
                    </Text>
                    <Text style={styles.sectionDurationText}>
                      Duration: {(section.endSeconds - section.startSeconds).toFixed(1)}s
                    </Text>
                  </View>

                  <View style={styles.sectionActions}>
                    <TouchableOpacity
                      style={styles.previewButton}
                      onPress={() => handlePreviewSection(section)}
                    >
                      <Play size={14} color={colors.primary} fill={colors.primary} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => handleDeleteSection(section.id)}
                    >
                      <Trash2 size={16} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitles: {
    flex: 1,
  },
  headerMainTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  headerSubTitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  livePositionCard: {
    backgroundColor: colors.surfaceElevated,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    marginVertical: 12,
  },
  livePositionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  livePositionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  livePositionValue: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.primary,
    marginTop: 4,
  },
  livePositionSubtext: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  creatorCard: {
    backgroundColor: colors.surfaceCard,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  cardInstruction: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: 4,
  },
  highlightText: {
    color: colors.sectionActive,
    fontWeight: '700',
  },
  inputsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  inputCol: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 6,
    fontWeight: '500',
  },
  textInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: colors.textPrimary,
    marginBottom: 6,
  },
  setButton: {
    backgroundColor: colors.surfaceElevated,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  setButtonText: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.sectionActive,
    paddingVertical: 12,
    borderRadius: 10,
  },
  savingButton: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: colors.background,
    fontWeight: '800',
    fontSize: 14,
  },
  sectionsListHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionsListTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  emptySectionsBox: {
    backgroundColor: colors.surfaceCard,
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptySectionsText: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  sectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceCard,
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  activePlayingSectionItem: {
    borderColor: colors.sectionBoundary,
    backgroundColor: colors.surfaceElevated,
  },
  sectionIndexBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  sectionIndexText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.sectionActive,
  },
  sectionTimingInfo: {
    flex: 1,
  },
  sectionTimingText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  sectionDurationText: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  sectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  previewButton: {
    padding: 8,
    backgroundColor: colors.surface,
    borderRadius: 6,
  },
  deleteButton: {
    padding: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 6,
  },
});
