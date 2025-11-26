import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { useGameSliceSelector } from '../store/reduxHooks';
import BuySubPanel from './BuySubPanel';
import SellSubPanel from './SellSubPanel';

const PanelActionTabButton: React.FC<{
  slug: string;
  active: boolean;
  onPress: (slug: string) => void;
}> = ({ slug, active, onPress }) => {
  return (
    <TouchableOpacity
      style={[styles.tabButton, active && styles.activeTab]}
      onPress={() => onPress(slug)}
    >
      <Text style={[styles.tabText, active && styles.activeTabText]}>
        {slug.toUpperCase()}
      </Text>
    </TouchableOpacity>
  );
};

const MarketPanel: React.FC = () => {
  const { subPanelStatus } = useGameSliceSelector((state) => state.game);
  const [activeTab, setActiveTab] = React.useState(subPanelStatus);

  const handleTabPress = (slug: string) => {
    setActiveTab(slug);
  };

  return (
    <View style={styles.container}>
      <View style={styles.tabBar}>
        {['buy', 'sell'].map((slug) => (
          <PanelActionTabButton
            key={slug}
            slug={slug}
            active={activeTab === slug}
            onPress={handleTabPress}
          />
        ))}
      </View>

      <View style={styles.subPanel}>
        {activeTab === 'buy' && <BuySubPanel />}
        {activeTab === 'sell' && <SellSubPanel />}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FCD34D', // tailwind orange-500
    justifyContent: 'space-around',
    paddingVertical: 8,
    marginBottom: -2,
  },
  tabButton: {
    paddingVertical: 8,
    paddingHorizontal: 25,
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: '#fef1c7ff', // slightly lighter for active
  },
  tabText: {
    color: 'black',
    fontWeight: 'bold',
  },
  activeTabText: {
    color: 'black',
  },
  subPanel: {
    flex: 1,
    padding: 16,
  },
});

export default MarketPanel;
