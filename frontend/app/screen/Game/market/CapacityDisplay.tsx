import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { useGameSliceSelector } from '../store/reduxHooks';

const CapacityDisplay = () => {
  const {
    gameState: {
      capacity: { used, max },
    },
  } = useGameSliceSelector((state) => state.game);

  const isOverCapacity = used.volume >= max.volume || used.weight >= max.weight;

  return (
    <Text
      testID="market-capacity"
      style={[styles.text, isOverCapacity ? styles.overCapacity : styles.normal]}
    >
      {/* Replace this with your localization solution if needed */}
      Capacity: {used.weight}/{max.weight} weight, {used.volume}/{max.volume} volume
    </Text>
  );
};

const styles = StyleSheet.create({
  text: {
    fontSize: 16,
  },
  normal: {
    color: '#D1D5DB', // gray-200
    fontWeight: '400',
  },
  overCapacity: {
    color: '#F59E0B', // orange-500
    fontWeight: '700',
  },
});

export default CapacityDisplay;
