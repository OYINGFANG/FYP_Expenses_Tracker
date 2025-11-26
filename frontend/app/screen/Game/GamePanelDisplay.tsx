import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useGameSliceSelector } from './store/reduxHooks';
import { GameTabSlugs } from './types';
import { Slices } from './store/gameSlice';
import MarketPanel from './market/MarketPanel';
import BankPanel from './bank/BankPanel';
import TravelPanel from './travel/TravelPanel';
import ToolsPanel from './tools/ToolsPanel';
import GuildPanel from './guild/GuildPanel';

const GamePanelDisplay: React.FC = () => {
  const { gamePanel } = useGameSliceSelector((state: Slices) => state.game);

  const renderPanel = () => {
    switch (gamePanel) {
      case GameTabSlugs.Bank.toLowerCase():
        return <BankPanel />;
      case GameTabSlugs.Tools.toLowerCase():
        return <ToolsPanel />;
      case GameTabSlugs.Travel.toLowerCase():
        return <TravelPanel />;
      case GameTabSlugs.Guild.toLowerCase():
        return <GuildPanel />;
      case GameTabSlugs.Market.toLowerCase():
      default:
        return <MarketPanel />;
    }
  };

  return <View style={styles.container}>{renderPanel()}</View>;
};

const styles = StyleSheet.create({
  container: { flex: 1, marginTop: -18, marginBottom: -16 },
});

export default GamePanelDisplay;
