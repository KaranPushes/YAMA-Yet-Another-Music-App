import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
  Switch,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { getApiBaseUrl, setApiBaseUrl, apiFetch, DEFAULT_API_URL } from '../api/client';
import { CacheStorage } from '../cache/CacheStorage';
import { DownloadManager } from '../cache/DownloadManager';
import { CacheManager } from '../cache/CacheManager';
import { PlaylistStorage } from '../cache/PlaylistStorage';
import { triggerLibraryScan, fetchSongs } from '../api/songApi';
import { formatBytes } from '../utils/formatTime';
import {
  Server,
  HardDrive,
  Trash2,
  CheckCircle,
  AlertCircle,
  HelpCircle,
  Radio,
  Sliders,
  Sparkles,
  Zap,
  Volume2,
  RefreshCw,
  Cpu,
  Database,
  Layers,
} from 'lucide-react-native';

const STORAGE_QUALITY_KEY = 'yama_streaming_quality';
const STORAGE_SEEK_KEY = 'yama_seek_interval';
const STORAGE_CROSSFADE_KEY = 'yama_crossfade_duration';
const STORAGE_NORM_KEY = 'yama_normalization';
const STORAGE_QUOTA_KEY = 'yama_cache_quota';
const STORAGE_AUTO_RESCAN_KEY = 'yama_auto_rescan';

export const SettingsScreen: React.FC = () => {
  const [apiUrl, setApiUrl] = useState('');
  const [cachedSongsCount, setCachedSongsCount] = useState(0);
  const [cacheBytesUsed, setCacheBytesUsed] = useState(0);
  const [autoCacheEnabled, setAutoCacheEnabledState] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  // Music App Configuration States
  const [streamingQuality, setStreamingQuality] = useState<'320' | '192' | '128'>('320');
  const [seekInterval, setSeekInterval] = useState<'NONE' | '5' | '10' | '15'>('10');
  const [crossfadeDuration, setCrossfadeDuration] = useState<'OFF' | '2s' | '4s' | '6s'>('OFF');
  const [normalizationEnabled, setNormalizationEnabled] = useState(true);
  const [cacheQuota, setCacheQuota] = useState<'500MB' | '1GB' | '2GB' | 'UNLIMITED'>('1GB');
  const [autoRescanEnabled, setAutoRescanEnabled] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const currentUrl = await getApiBaseUrl();
      setApiUrl(currentUrl);

      const isAuto = await CacheManager.isAutoCacheEnabled();
      setAutoCacheEnabledState(isAuto);

      const stats = await CacheStorage.getStats();
      setCachedSongsCount(stats.totalSongsCached);
      setCacheBytesUsed(stats.totalBytesUsed);

      const savedQuality = await AsyncStorage.getItem(STORAGE_QUALITY_KEY);
      if (savedQuality) setStreamingQuality(savedQuality as any);

      const savedSeek = await AsyncStorage.getItem(STORAGE_SEEK_KEY);
      if (savedSeek) setSeekInterval(savedSeek as any);

      const savedCrossfade = await AsyncStorage.getItem(STORAGE_CROSSFADE_KEY);
      if (savedCrossfade) setCrossfadeDuration(savedCrossfade as any);

      const savedNorm = await AsyncStorage.getItem(STORAGE_NORM_KEY);
      if (savedNorm !== null) setNormalizationEnabled(savedNorm === 'true');

      const savedQuota = await AsyncStorage.getItem(STORAGE_QUOTA_KEY);
      if (savedQuota) setCacheQuota(savedQuota as any);

      const savedRescan = await AsyncStorage.getItem(STORAGE_AUTO_RESCAN_KEY);
      if (savedRescan !== null) setAutoRescanEnabled(savedRescan === 'true');
    } catch (e) {
      console.warn('Failed to load settings:', e);
    }
  };

  const handleToggleAutoCache = async (val: boolean) => {
    setAutoCacheEnabledState(val);
    await CacheManager.setAutoCacheEnabled(val);
  };

  const handleQualityChange = async (quality: '320' | '192' | '128') => {
    setStreamingQuality(quality);
    await AsyncStorage.setItem(STORAGE_QUALITY_KEY, quality);
  };

  const handleSeekChange = async (seek: 'NONE' | '5' | '10' | '15') => {
    setSeekInterval(seek);
    await AsyncStorage.setItem(STORAGE_SEEK_KEY, seek);
  };

  const handleCrossfadeChange = async (duration: 'OFF' | '2s' | '4s' | '6s') => {
    setCrossfadeDuration(duration);
    await AsyncStorage.setItem(STORAGE_CROSSFADE_KEY, duration);
  };

  const handleNormalizationChange = async (val: boolean) => {
    setNormalizationEnabled(val);
    await AsyncStorage.setItem(STORAGE_NORM_KEY, String(val));
  };

  const handleQuotaChange = async (quota: '500MB' | '1GB' | '2GB' | 'UNLIMITED') => {
    setCacheQuota(quota);
    await AsyncStorage.setItem(STORAGE_QUOTA_KEY, quota);
  };

  const handleAutoRescanChange = async (val: boolean) => {
    setAutoRescanEnabled(val);
    await AsyncStorage.setItem(STORAGE_AUTO_RESCAN_KEY, String(val));
  };

  const handleSaveUrl = async () => {
    if (!apiUrl.trim()) {
      Alert.alert('Invalid URL', 'Please enter a valid backend URL.');
      return;
    }
    await setApiBaseUrl(apiUrl);
    Alert.alert('Saved', 'API Base URL updated successfully.');
    handleTestConnection();
  };

  const handleResetToDefaultUrl = async () => {
    setApiUrl(DEFAULT_API_URL);
    await setApiBaseUrl(DEFAULT_API_URL);
    Alert.alert('Reset Complete', `API URL updated to permanent tunnel:\n${DEFAULT_API_URL}`);
    handleTestConnection();
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setConnectionStatus(null);
    const startTime = Date.now();
    try {
      const res: any = await apiFetch('/api/health');
      const latency = Date.now() - startTime;
      if (res && res.status === 'UP') {
        setConnectionStatus({
          ok: true,
          message: `LINK ACTIVE (${latency}ms) — ONLINE & READY`,
        });
      } else {
        setConnectionStatus({
          ok: false,
          message: 'Server responded but status is degraded.',
        });
      }
    } catch (err: any) {
      setConnectionStatus({
        ok: false,
        message: err.message || 'Failed to reach server.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleTriggerRescan = async () => {
    setIsScanning(true);
    try {
      await triggerLibraryScan();
      Alert.alert('Scanner Engaged', 'Background scan queued on server. Check Library in a few moments.');
    } catch (e: any) {
      Alert.alert('Scan Failed', e.message || 'Could not reach server scanner.');
    } finally {
      setIsScanning(false);
    }
  };

  const handlePruneGhostTracks = async () => {
    try {
      const res = await fetchSongs('');
      const songList = res.content || [];
      const validIds = new Set(songList.map((s) => s.id));
      await PlaylistStorage.pruneDeletedSongs(validIds);
      Alert.alert('Inventory Cleaned', `Cross-referenced ${validIds.size} server tracks. Orphaned references removed from local playlists.`);
    } catch (e: any) {
      Alert.alert('Prune Failed', 'Could not reach server to cross-reference track inventory.');
    }
  };

  const handleClearCache = () => {
    Alert.alert(
      'Purge Music Cache',
      'Are you sure you want to delete all locally cached audio files? Future plays will stream directly from the server.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Purge All',
          style: 'destructive',
          onPress: async () => {
            await DownloadManager.clearAllCache();
            await loadSettings();
            Alert.alert('Cache Purged', 'Local storage freed. All offline audio files removed.');
          },
        },
      ]
    );
  };

  // Compute quota progress percentage
  const getQuotaBytes = () => {
    switch (cacheQuota) {
      case '500MB': return 500 * 1024 * 1024;
      case '1GB': return 1024 * 1024 * 1024;
      case '2GB': return 2 * 1024 * 1024 * 1024;
      default: return 10 * 1024 * 1024 * 1024; // 10GB for meter calc
    }
  };
  const quotaBytes = getQuotaBytes();
  const usagePercent = Math.min(100, Math.round((cacheBytesUsed / quotaBytes) * 100));

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        {/* Retro Header */}
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <Text style={styles.headerTitle}>SETTINGS</Text>
            <View style={styles.arcadeBadge}>
              <Text style={styles.arcadeBadgeText}>[CONFIG MATRIX]</Text>
            </View>
          </View>
          <Text style={styles.headerSubtitle}>AUDIO ENGINE, CACHE QUOTA & SERVER DIAGNOSTICS</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* 1. AUDIO ENGINE & PLAYBACK */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Sliders size={16} color={colors.primary} />
              <Text style={styles.cardTitle}>AUDIO ENGINE & PLAYBACK</Text>
            </View>

            {/* Streaming Bitrate Selector */}
            <Text style={styles.sectionLabel}>STREAMING BITRATE PROFILE</Text>
            <View style={styles.chipRow}>
              {(['320', '192', '128'] as const).map((q) => (
                <TouchableOpacity
                  key={q}
                  style={[styles.chip, streamingQuality === q && styles.chipActive]}
                  onPress={() => handleQualityChange(q)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.chipText, streamingQuality === q && styles.chipTextActive]}>
                    {q === '320' ? '320K HQ' : q === '192' ? '192K STD' : '128K ECO'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Seek Interval Selector */}
            <Text style={styles.sectionLabel}>SEEK JUMP STEP</Text>
            <View style={styles.chipRow}>
              {(['NONE', '5', '10', '15'] as const).map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.chip, seekInterval === s && styles.chipActive]}
                  onPress={() => handleSeekChange(s)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.chipText, seekInterval === s && styles.chipTextActive]}>
                    {s === 'NONE' ? 'NONE' : `±${s}S`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Crossfade / Fade Between Songs */}
            <Text style={styles.sectionLabel}>FADE BETWEEN SONGS (CROSSFADE)</Text>
            <View style={styles.chipRow}>
              {(['OFF', '2s', '4s', '6s'] as const).map((cf) => (
                <TouchableOpacity
                  key={cf}
                  style={[styles.chip, crossfadeDuration === cf && styles.chipActive]}
                  onPress={() => handleCrossfadeChange(cf)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.chipText, crossfadeDuration === cf && styles.chipTextActive]}>
                    {cf === 'OFF' ? 'OFF' : `${cf} FADE`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Normalization switch */}
            <View style={styles.toggleRow}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={styles.toggleTitle}>Audio ReplayGain Normalization</Text>
                <Text style={styles.toggleSubtitle}>
                  Equalize volume across varying song rips and YouTube acquisition masters.
                </Text>
              </View>
              <Switch
                value={normalizationEnabled}
                onValueChange={handleNormalizationChange}
                trackColor={{ false: colors.surfaceElevated, true: colors.primary }}
                thumbColor={colors.textDark}
              />
            </View>
          </View>

          {/* 2. STORAGE & OFFLINE CACHE */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <HardDrive size={16} color={colors.accentSecondary} />
              <Text style={styles.cardTitle}>STORAGE & OFFLINE CACHE</Text>
            </View>

            {/* Cache Quota Meter */}
            <View style={styles.meterContainer}>
              <View style={styles.meterHeader}>
                <Text style={styles.meterLabel}>LOCAL STORAGE USAGE</Text>
                <Text style={styles.meterValue}>
                  {formatBytes(cacheBytesUsed)} / {cacheQuota} ({usagePercent}%)
                </Text>
              </View>
              <View style={styles.meterTrack}>
                <View
                  style={[
                    styles.meterFill,
                    {
                      width: `${usagePercent}%`,
                      backgroundColor: usagePercent > 85 ? colors.error : colors.accentSecondary,
                    },
                  ]}
                />
              </View>
            </View>

            {/* Quota Limit Selector */}
            <Text style={styles.sectionLabel}>CACHE QUOTA LIMIT</Text>
            <View style={styles.chipRow}>
              {(['500MB', '1GB', '2GB', 'UNLIMITED'] as const).map((q) => (
                <TouchableOpacity
                  key={q}
                  style={[styles.chip, cacheQuota === q && styles.chipActiveSecondary]}
                  onPress={() => handleQuotaChange(q)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.chipText,
                      cacheQuota === q && styles.chipTextActiveSecondary,
                    ]}
                  >
                    {q}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Stats Row */}
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statNumber}>{cachedSongsCount}</Text>
                <Text style={styles.statLabel}>TRACKS CACHED</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statNumber}>{formatBytes(cacheBytesUsed)}</Text>
                <Text style={styles.statLabel}>BYTES COMMITTED</Text>
              </View>
            </View>

            {/* Auto-Cache Toggle */}
            <View style={styles.toggleRow}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={styles.toggleTitle}>Auto-Cache Streamed Tracks</Text>
                <Text style={styles.toggleSubtitle}>
                  Persist audio locally in background during streaming for instant zero-bandwidth offline replay.
                </Text>
              </View>
              <Switch
                value={autoCacheEnabled}
                onValueChange={handleToggleAutoCache}
                trackColor={{ false: colors.surfaceElevated, true: colors.accentSecondary }}
                thumbColor={colors.textDark}
              />
            </View>

            <TouchableOpacity style={styles.clearCacheButton} onPress={handleClearCache} activeOpacity={0.8}>
              <Trash2 size={14} color={colors.error} />
              <Text style={styles.clearCacheText}>PURGE OFFLINE CACHE</Text>
            </TouchableOpacity>
          </View>

          {/* 3. LIBRARY & ACQUISITION AUTOMATION */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Database size={16} color={colors.accentPurpleLight} />
              <Text style={styles.cardTitle}>LIBRARY AUTOMATION & PRUNING</Text>
            </View>

            <View style={styles.actionButtonsRow}>
              <TouchableOpacity
                style={[styles.actionBtn, isScanning && styles.disabledButton]}
                onPress={handleTriggerRescan}
                disabled={isScanning}
                activeOpacity={0.8}
              >
                {isScanning ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <>
                    <RefreshCw size={13} color={colors.primary} />
                    <Text style={styles.actionBtnText}>TRIGGER SERVER RESCAN</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionBtn}
                onPress={handlePruneGhostTracks}
                activeOpacity={0.8}
              >
                <Layers size={13} color={colors.accentPurpleLight} />
                <Text style={[styles.actionBtnText, { color: colors.accentPurpleLight }]}>
                  PRUNE GHOST TRACKS
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.toggleRow}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={styles.toggleTitle}>Auto-Crossreference on Startup</Text>
                <Text style={styles.toggleSubtitle}>
                  Keep playlist track counts synchronized with physical files present on the server.
                </Text>
              </View>
              <Switch
                value={autoRescanEnabled}
                onValueChange={handleAutoRescanChange}
                trackColor={{ false: colors.surfaceElevated, true: colors.accentPurpleLight }}
                thumbColor={colors.textDark}
              />
            </View>
          </View>

          {/* 4. SERVER CONNECTION & DIAGNOSTICS */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Server size={16} color={colors.primary} />
              <Text style={styles.cardTitle}>SERVER UPLINK & DIAGNOSTICS</Text>
            </View>

            <Text style={styles.inputLabel}>API BASE URL (BACKEND NODE)</Text>
            <TextInput
              style={styles.textInput}
              value={apiUrl}
              onChangeText={setApiUrl}
              placeholder="e.g. http://192.168.1.15:8080 or https://tunnel.example.com"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={styles.buttonsRow}>
              <TouchableOpacity
                style={[styles.testButton, isTesting && styles.disabledButton]}
                onPress={handleTestConnection}
                disabled={isTesting}
                activeOpacity={0.8}
              >
                {isTesting ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <>
                    <Radio size={14} color={colors.primary} />
                    <Text style={styles.testButtonText}>PING SERVER</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.saveButton} onPress={handleSaveUrl} activeOpacity={0.8}>
                <Text style={styles.saveButtonText}>COMMIT URL</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.resetTunnelBtn}
              onPress={handleResetToDefaultUrl}
              activeOpacity={0.8}
            >
              <Sparkles size={13} color={colors.seaGreenLight} />
              <Text style={styles.resetTunnelBtnText}>SET TO PERMANENT TUNNEL</Text>
            </TouchableOpacity>

            {/* Connection Test Result */}
            {connectionStatus && (
              <View
                style={[
                  styles.statusBanner,
                  connectionStatus.ok ? styles.statusSuccess : styles.statusError,
                ]}
              >
                {connectionStatus.ok ? (
                  <CheckCircle size={15} color={colors.success} />
                ) : (
                  <AlertCircle size={15} color={colors.error} />
                )}
                <Text
                  style={[
                    styles.statusText,
                    connectionStatus.ok ? styles.statusTextSuccess : styles.statusTextError,
                  ]}
                >
                  {connectionStatus.message}
                </Text>
              </View>
            )}
          </View>

          {/* 5. ARCHITECTURE & SPEC BANNER */}
          <View style={styles.infoCard}>
            <View style={styles.cardHeader}>
              <Cpu size={15} color={colors.accentSecondary} />
              <Text style={styles.infoCardTitle}>YAMA ARCHITECTURE // SPECS</Text>
            </View>
            <Text style={styles.infoText}>
              • PROGRESSIVE AUDIO: Streams via HTTP 206 Partial Content range requests.{'\n'}
              • HYBRID OFFLINE: Automatic local chunk caching eliminates cellular network latency.{'\n'}
              • ACQUISITION PORTAL: Savify + yt-dlp dual-pipeline with Spotify oEmbed fallback.{'\n'}
              • SECTION ENGINE: Hardware-timed boundary skipping with seamless millisecond looping.
            </Text>
            <Text style={styles.versionTag}>
              YAMA CORE v2.4.0 • RETRO ARCADE OBSIDIAN EDITION
            </Text>
          </View>
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
  header: {
    paddingVertical: 12,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: 1.5,
  },
  arcadeBadge: {
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: colors.pixelBorder,
  },
  arcadeBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: colors.accentSecondary,
    letterSpacing: 0.8,
  },
  headerSubtitle: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 3,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  scrollContent: {
    paddingBottom: 90,
  },
  card: {
    backgroundColor: colors.surface,
    padding: 14,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.pixelBorder,
    marginBottom: 14,
    shadowColor: colors.pixelShadow,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: 0.8,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 0.6,
    marginTop: 6,
    marginBottom: 6,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: colors.pixelBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
  },
  chipActiveSecondary: {
    backgroundColor: colors.accentSecondary,
    borderColor: '#0D9488',
  },
  chipText: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.textMuted,
    letterSpacing: 0.6,
  },
  chipTextActive: {
    color: colors.textDark,
  },
  chipTextActiveSecondary: {
    color: colors.textDark,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderColor: colors.pixelBorder,
    marginTop: 6,
  },
  toggleTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  toggleSubtitle: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
    lineHeight: 14,
  },
  meterContainer: {
    marginBottom: 12,
  },
  meterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  meterLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  meterValue: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.accentSecondary,
    fontVariant: ['tabular-nums'],
  },
  meterTrack: {
    height: 8,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.pixelBorder,
    overflow: 'hidden',
  },
  meterFill: {
    height: '100%',
    borderRadius: 3,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    padding: 10,
    borderRadius: 4,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.pixelBorder,
  },
  statNumber: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    fontSize: 9,
    color: colors.textMuted,
    marginTop: 2,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: colors.pixelBorder,
    paddingVertical: 9,
    borderRadius: 4,
  },
  actionBtnText: {
    fontSize: 9,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: 0.6,
  },
  clearCacheButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2A141A',
    paddingVertical: 9,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.error,
    marginTop: 8,
  },
  clearCacheText: {
    color: colors.error,
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 0.6,
  },
  inputLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    marginBottom: 6,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  textInput: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: colors.pixelBorder,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    color: colors.textPrimary,
    marginBottom: 10,
    fontFamily: 'monospace',
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  testButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surfaceElevated,
    paddingVertical: 9,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.pixelBorder,
  },
  disabledButton: {
    opacity: 0.5,
  },
  testButtonText: {
    color: colors.primary,
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 0.6,
  },
  saveButton: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: 9,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: colors.textDark,
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 0.6,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 4,
    marginTop: 10,
    borderWidth: 1.5,
  },
  statusSuccess: {
    backgroundColor: '#0D261E',
    borderColor: colors.success,
  },
  statusError: {
    backgroundColor: '#2A141A',
    borderColor: colors.error,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
    flex: 1,
    letterSpacing: 0.4,
  },
  statusTextSuccess: {
    color: colors.success,
  },
  statusTextError: {
    color: colors.error,
  },
  resetTunnelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0D261E',
    borderWidth: 1.5,
    borderColor: colors.seaGreenLight,
    paddingVertical: 10,
    borderRadius: 4,
    marginTop: 8,
    shadowColor: colors.pixelShadow,
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 1,
  },
  resetTunnelBtnText: {
    color: colors.seaGreenLight,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  infoCard: {
    backgroundColor: colors.surface,
    padding: 14,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.pixelBorder,
    marginBottom: 20,
    shadowColor: colors.pixelShadow,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  infoCardTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.textSecondary,
    letterSpacing: 0.8,
  },
  infoText: {
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 18,
    marginTop: 4,
  },
  versionTag: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.accentSecondary,
    marginTop: 10,
    letterSpacing: 0.8,
  },
});
