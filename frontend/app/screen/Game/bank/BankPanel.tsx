import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Slices } from '../store/gameSlice';
import { useGameSliceSelector } from '../store/reduxHooks';
import PanelActionTabButton from '../common/PanelActionTabButton';
import SavingsPanel from './SavingsPanel';
import LoansPanel from './LoansPanel';

const BankPanel = () => {
  const { subPanelStatus } = useGameSliceSelector((state: Slices) => state.game);

  return (
    <View style={styles.container} testID="bank-panel">
      <LinearGradient colors={['#F97316', '#EA580C']} style={styles.tabBar}>
        <View style={styles.tabBarContent}>
          {['savings', 'loans'].map((slug) => (
            <PanelActionTabButton slug={slug} key={slug} />
          ))}
        </View>
      </LinearGradient>

      <View style={styles.content}>
        {subPanelStatus === 'savings' && <SavingsPanel />}
        {subPanelStatus === 'loans' && <LoansPanel />}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabBar: {
    paddingVertical: 8,
  },
  tabBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  content: {
    flex: 1,
    padding: 16,
  },
});

export default BankPanel;
