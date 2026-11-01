import React, { useState, useEffect } from 'react';
import { View, Image, StyleSheet, Text } from 'react-native';
import { Music } from 'lucide-react-native';
import { colors } from '../theme/colors';
import { getFullArtworkUrl } from '../api/songApi';

interface ArtworkImageProps {
  songId?: string;
  hasArtwork?: boolean;
  title?: string;
  artist?: string;
  size?: number;
  borderRadius?: number;
}

export const ArtworkImage: React.FC<ArtworkImageProps> = ({
  songId,
  hasArtwork = false,
  title,
  artist,
  size = 56,
  borderRadius = 8,
}) => {
  const [artworkUrl, setArtworkUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    if (songId) {
      getFullArtworkUrl(songId).then((url) => {
        if (isMounted) {
          setArtworkUrl(url);
          setLoadError(false);
        }
      });
    } else {
      setArtworkUrl(null);
    }
    return () => {
      isMounted = false;
    };
  }, [songId]);

  if (loadError || !artworkUrl) {
    const initials = title
      ? title
          .split(' ')
          .map((w) => w[0])
          .join('')
          .slice(0, 2)
          .toUpperCase()
      : '♪';

    return (
      <View
        style={[
          styles.placeholder,
          {
            width: size,
            height: size,
            borderRadius,
          },
        ]}
      >
        <Music size={size * 0.38} color={colors.primary} />
        {size >= 100 && (
          <Text style={[styles.initialsText, { fontSize: size * 0.12 }]}>
            {initials}
          </Text>
        )}
      </View>
    );
  }

  return (
    <Image
      source={{ uri: artworkUrl }}
      style={{
        width: size,
        height: size,
        borderRadius,
      }}
      onError={() => setLoadError(true)}
      resizeMode="cover"
    />
  );
};

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  initialsText: {
    color: colors.textSecondary,
    fontWeight: '800',
    marginTop: 6,
    letterSpacing: 1.5,
  },
});
