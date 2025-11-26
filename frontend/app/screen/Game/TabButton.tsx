import React, { useEffect, useMemo, useRef } from 'react';
import { Pressable, View, Text, StyleSheet, Animated } from 'react-native';
import { useIntl } from 'react-intl';
import { useGameSliceDispatch } from './store/reduxHooks';
import { setGamePanel } from './store/gameSlice';

type Props = {
  slug: string;
  isActive: boolean;
};

const TabButton: React.FC<Props> = ({ slug, isActive }) => {
  const dispatch = useGameSliceDispatch();
  const { formatMessage } = useIntl();

  const slugLowerCase = useMemo(() => slug.toLowerCase(), [slug]);
  const title = formatMessage({ id: `game_tabs__${slugLowerCase}_title` });
  const label = formatMessage({ id: `game_tabs__${slugLowerCase}_label` });

  const underline = useRef(new Animated.Value(isActive ? 1 : 0)).current;
  const bgFill = useRef(new Animated.Value(0)).current; // subtle background sweep on press

  useEffect(() => {
    Animated.timing(underline, {
      toValue: isActive ? 1 : 0,
      duration: 150,
      useNativeDriver: false,
    }).start();
  }, [isActive, underline]);

  const handlePress = () => {
    dispatch(setGamePanel(slugLowerCase));
  };

  const onPressIn = () => {
    Animated.timing(bgFill, {
      toValue: 1,
      duration: 120,
      useNativeDriver: false,
    }).start();
  };

  const onPressOut = () => {
    Animated.timing(bgFill, {
      toValue: 0,
      duration: 160,
      useNativeDriver: false,
    }).start();
  };

  // Interpolations for animations
  const underlineWidth = underline.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });
  const underlineLeft = underline.interpolate({
    inputRange: [0, 1],
    outputRange: ['50%', '0%'],
  });
  const bgWidth = bgFill.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });
  const bgLeft = bgFill.interpolate({
    inputRange: [0, 1],
    outputRange: ['50%', '0%'],
  });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={handlePress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      testID={`tab-button-${slug}`}
      style={styles.button}
    >
      {/* Press background sweep */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.pressBg,
          {
            width: bgWidth as any,
            left: bgLeft as any,
          },
        ]}
      />

      {/* Active underline */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.underline,
          {
            width: underlineWidth as any,
            left: underlineLeft as any,
            backgroundColor: isActive ? '#f97316' : '#f97316',
          },
        ]}
      />

      <Text
        style={[
          styles.label,
          { color: isActive ? '#fdba74' : '#d1d5db' }, // orange-300 vs gray-300
        ]}
        numberOfLines={1}
      >
        {label.toUpperCase()}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    position: 'relative',
    paddingVertical: 16, // ~py-4
    paddingHorizontal: 12,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  label: {
    fontSize: 16, // ~lg on larger screens; tweak as needed
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowRadius: 2,
    textShadowOffset: { width: 1, height: 1 },
  },
  underline: {
    position: 'absolute',
    bottom: 0,
    height: 8, // h-2
  },
  pressBg: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: '#c2410c', // orange-700
    shadowColor: '#f97316',
    shadowOpacity: 1,
    shadowRadius: 10,
  },
});

export default TabButton;
