import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useGameSliceDispatch, useGameSliceSelector } from '../store/reduxHooks';
import { setSubPanelStatus } from '../store/gameSlice';

type Props = {
  slug: string;
};

const PanelActionTabButton: React.FC<Props> = ({ slug }) => {
  const dispatch = useGameSliceDispatch();
  const { subPanelStatus } = useGameSliceSelector((state) => state.game);
  const isActive = subPanelStatus === slug;

  const handlePress = () => {
    dispatch(setSubPanelStatus(slug));
  };

  return (
    <TouchableOpacity
      style={[styles.tabButton, isActive && styles.activeTab]}
      onPress={handlePress}
    >
      <Text style={[styles.tabText, isActive && styles.activeTabText]}>
        {slug.toUpperCase()}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  tabButton: {
    paddingVertical: 8,
    paddingHorizontal: 25,
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: '#fef1c7ff',
  },
  tabText: {
    color: 'black',
    fontWeight: 'bold',
  },
  activeTabText: {
    color: 'black',
  },
});

export default PanelActionTabButton;

