import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { radius } from '../../constants/radius';
import { typography } from '../../constants/typography';

interface AvatarProps {
  name: string;
  size?: number;
  style?: ViewStyle;
}

// Consistent soft palette for avatar initials
const AVATAR_PALETTES = [
  { bg: '#E8F7F0', text: '#16875D' },
  { bg: '#EEF2FF', text: '#4F46E5' },
  { bg: '#FDF2F8', text: '#DB2777' },
  { bg: '#FEF3C7', text: '#D97706' },
  { bg: '#F3E8FF', text: '#9333EA' },
  { bg: '#E0F2FE', text: '#0284C7' },
  { bg: '#ECFCCB', text: '#65A30D' },
];

function getPalette(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_PALETTES.length;
  return AVATAR_PALETTES[index];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const Avatar: React.FC<AvatarProps> = ({ name, size = 40, style }) => {
  const palette = getPalette(name || '?');
  const initials = getInitials(name || '?');
  const fontSize = size * 0.42;

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: radius.full,
          backgroundColor: palette.bg,
        },
        style,
      ]}
      accessibilityRole="image"
      accessibilityLabel={`Avatar for ${name}`}
    >
      <Text style={[styles.text, { fontSize, color: palette.text }]}>{initials}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: typography.weight.bold,
  },
});
