import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  TextInput,
  Alert,
} from 'react-native';
import { colors } from '../theme/colors';
import { Song } from '../types/song';
import { Playlist, PlaylistStorage } from '../cache/PlaylistStorage';
import { Plus, Check, Music, X } from 'lucide-react-native';

interface AddToPlaylistModalProps {
  visible: boolean;
  song: Song | null;
  onClose: () => void;
}

export const AddToPlaylistModal: React.FC<AddToPlaylistModalProps> = ({
  visible,
  song,
  onClose,
}) => {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [memberPlaylistIds, setMemberPlaylistIds] = useState<Set<string>>(new Set());
  const [isCreating, setIsCreating] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');

  const loadPlaylists = useCallback(async () => {
    if (!song) return;
    const list = await PlaylistStorage.getPlaylists();
    setPlaylists(list);

    const memberSet = new Set<string>();
    list.forEach((p) => {
      if (p.songIds.includes(song.id)) {
        memberSet.add(p.id);
      }
    });
    setMemberPlaylistIds(memberSet);
  }, [song]);

  useEffect(() => {
    if (visible && song) {
      loadPlaylists();
      setIsCreating(false);
      setNewPlaylistName('');
    }
  }, [visible, song, loadPlaylists]);

  const handleToggleSongInPlaylist = async (playlist: Playlist) => {
    if (!song) return;
    const isCurrentlyMember = memberPlaylistIds.has(playlist.id);

    // Optimistically update UI state immediately for instant feedback
    const nextMembers = new Set(memberPlaylistIds);
    if (isCurrentlyMember) {
      nextMembers.delete(playlist.id);
      setMemberPlaylistIds(nextMembers);
      await PlaylistStorage.removeSongFromPlaylist(playlist.id, song.id);
    } else {
      nextMembers.add(playlist.id);
      setMemberPlaylistIds(nextMembers);
      await PlaylistStorage.addSongToPlaylist(playlist.id, song.id);
    }

    // Refresh playlist items
    const updatedList = await PlaylistStorage.getPlaylists();
    setPlaylists(updatedList);
  };

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) {
      Alert.alert('Name Required', 'Please enter a name for your playlist.');
      return;
    }
    const created = await PlaylistStorage.createPlaylist(newPlaylistName.trim());
    if (song) {
      await PlaylistStorage.addSongToPlaylist(created.id, song.id);
    }
    setNewPlaylistName('');
    setIsCreating(false);
    await loadPlaylists();
  };

  if (!song) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={styles.sheetTitle}>Add to Playlist</Text>
              <Text numberOfLines={1} style={styles.sheetSubtitle}>
                {song.title} • {song.artist}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* New Playlist Row or Form */}
          {isCreating ? (
            <View style={styles.createForm}>
              <TextInput
                style={styles.input}
                placeholder="Playlist name..."
                placeholderTextColor={colors.textMuted}
                value={newPlaylistName}
                onChangeText={setNewPlaylistName}
                autoFocus
              />
              <View style={styles.createActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setIsCreating(false)}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.saveBtn}
                  onPress={handleCreatePlaylist}
                >
                  <Text style={styles.saveBtnText}>Create & Add</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.createButton}
              onPress={() => setIsCreating(true)}
            >
              <View style={styles.createIconBg}>
                <Plus size={16} color={colors.textPrimary} />
              </View>
              <Text style={styles.createButtonText}>Create New Playlist</Text>
            </TouchableOpacity>
          )}

          {/* Existing Playlists List */}
          <FlatList
            data={playlists}
            extraData={memberPlaylistIds}
            keyExtractor={(item) => item.id}
            style={styles.playlistList}
            contentContainerStyle={styles.playlistListContent}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No playlists yet. Create one above!</Text>
              </View>
            }
            renderItem={({ item }) => {
              const isInPlaylist = memberPlaylistIds.has(item.id);
              return (
                <TouchableOpacity
                  style={[
                    styles.playlistItem,
                    isInPlaylist && styles.playlistItemActive,
                  ]}
                  onPress={() => handleToggleSongInPlaylist(item)}
                  activeOpacity={0.7}
                >
                  <View style={styles.playlistInfo}>
                    <View style={styles.musicIconBadge}>
                      <Music size={15} color={isInPlaylist ? colors.primary : colors.textSecondary} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text
                        numberOfLines={1}
                        style={[styles.playlistName, isInPlaylist && styles.playlistNameActive]}
                      >
                        {item.name}
                      </Text>
                      <Text style={styles.playlistCount}>
                        {item.songIds.length} {item.songIds.length === 1 ? 'song' : 'songs'}
                      </Text>
                    </View>
                  </View>
                  <View
                    style={[
                      styles.checkbox,
                      isInPlaylist && styles.checkboxActive,
                    ]}
                  >
                    {isInPlaylist && <Check size={13} color="#FFF" />}
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.70)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  sheetContainer: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '75%',
    paddingBottom: 36,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  sheetSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  createIconBg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  createButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
    marginLeft: 12,
  },
  createForm: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  input: {
    backgroundColor: colors.surfaceElevated,
    color: colors.textPrimary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  createActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
    gap: 10,
  },
  cancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  cancelBtnText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  saveBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
  },
  saveBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  playlistList: {
    maxHeight: 340,
  },
  playlistListContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  playlistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginVertical: 3,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  playlistItemActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
  },
  playlistInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  musicIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playlistName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  playlistNameActive: {
    color: colors.primary,
  },
  playlistCount: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.textMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  emptyContainer: {
    padding: 30,
    alignItems: 'center',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 13,
  },
});
