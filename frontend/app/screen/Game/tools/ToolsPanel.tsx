import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Slices } from '../store/gameSlice';
import upgradesData from '../data/upgrades';
import Table from '../common/Table';
import { FormattedMessage, useIntl } from 'react-intl';
import { useGameSliceSelector, useGameSliceDispatch } from '../store/reduxHooks';
import { buyUpgrade, setModalStatus, setCurrentModal } from '../store/gameSlice';
import { Transaction, TableFieldLabel } from '../types';
import Button from '../common/Button';
import ToolInfoModal from './ToolInfoModal';

const ToolsPanel = () => {
  const [selectedItemId, setSelectedItemId] = useState('');
  const { gameState, modalStatus, currentModal } = useGameSliceSelector(
    (state: Slices) => state.game,
  );
  const dispatch = useGameSliceDispatch();
  const { formatMessage } = useIntl();
  const { location, flags } = gameState;
  const hasGuildMembership = flags[`guild__${location}`];
  const flagsArr = Object.keys(flags);
  const upgradesOnOffer = Object.values(upgradesData)
    .filter((item) =>
      item.prices.some(
        (price) =>
          price.locations.includes(location) &&
          item.dependencies.every((dep) => flagsArr.includes(dep)),
      ),
    )
    .map((item) => {
      const thisPrice = item.prices.find((price) => price.locations.includes(location));
      return {
        id: item.slug,
        guildDependentTitle: formatMessage({ id: `upgrades__${item.slug}__title` }),
        price: thisPrice?.price,
        guildOnly: thisPrice?.guildOnly,
        hasGuildMembership: hasGuildMembership,
        owned: Object.keys(gameState.flags).includes(`upgrade__${item.slug}`),
      };
    });
  const getUpgradeGuildOnly = (id: string) =>
    upgradesOnOffer.find((item) => item.id === id)?.guildOnly;

  const getUpgradePrice = (id: string) =>
    upgradesOnOffer.find((item) => item.id === id)?.price || 0;
  const handleBuyUpgrade = (itemId: string, price: number) => {
    if (gameState.cash >= price) {
      const transaction: Transaction = {
        itemId,
        action: 'buy',
        qty: 1,
        price,
      };
      dispatch(buyUpgrade(transaction));
    }
  };
  const handleInfoClick = (id: string) => {
    setSelectedItemId(id);
    dispatch(setCurrentModal('upgrade-info'));
    dispatch(setModalStatus('opening'));
    setTimeout(() => {
      dispatch(setModalStatus('open'));
    }, 510);
  };
  const closeInfoModal = () => {
    dispatch(setModalStatus('closing'));
    setTimeout(() => {
      dispatch(setModalStatus('closed'));
      dispatch(setCurrentModal(''));
    }, 510);
  };

  const buyTableActions = (id: string) => (
    <View style={styles.tableActions}>
      <View style={styles.actionButtonWrapper}>
        <TouchableOpacity
          onPress={() => handleInfoClick(id)}
          style={styles.compactButton}
        >
          <Text style={styles.compactButtonText}>
            {formatMessage({ id: 'market__buy__table___btn_info', defaultMessage: 'Info' })}
          </Text>
        </TouchableOpacity>
      </View>
      {!gameState.flags[`upgrade__${id}`] && (
        <TouchableOpacity
          onPress={() => handleBuyUpgrade(id, getUpgradePrice(id))}
          style={[styles.compactButton, styles.compactButtonPrimary]}
          disabled={getUpgradeGuildOnly(id) && !hasGuildMembership}
        >
          <Text style={[styles.compactButtonText, styles.compactButtonTextPrimary]}>
            {formatMessage({ id: 'market__buy__table___btn_buy', defaultMessage: 'Buy' })}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
  const fieldLabels: TableFieldLabel[] = [
    { slug: 'guildDependentTitle', titleKey: 'upgrades__buy__table_field__itemName' },
    { slug: 'price', titleKey: 'upgrades__buy__table_field__price' },
    { slug: 'owned', titleKey: 'upgrades__buy__table_field__owned' },
  ];
  const isModalOpen = modalStatus !== 'closed' && currentModal === 'upgrade-info';

  return (
    <View style={styles.container} testID="tools-panel">
      <View style={styles.content}>
        <Text style={styles.title}>
          <FormattedMessage id="upgrades__buy_title" />
        </Text>
        <View style={styles.tableContainer}>
          <Table
            data={upgradesOnOffer}
            fieldLabels={fieldLabels}
            actions={buyTableActions}
            sortField="guildDependentTitle"
            sortDir="asc"
          />
        </View>
      </View>
      {isModalOpen && (
        <ToolInfoModal selectedItemId={selectedItemId} closeInfoModal={closeInfoModal} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    textTransform: 'uppercase',
    color: '#FDE68A',
    marginBottom: 16,
  },
  tableContainer: {
    backgroundColor: '#F3F4F6',
  },
  tableActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
    justifyContent: 'flex-start',
    width: '100%',
    flexShrink: 1,
  },
  actionButtonWrapper: {
    marginRight: 8,
    flexShrink: 0,
  },
  compactButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#444',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 60,
  },
  compactButtonPrimary: {
    backgroundColor: 'orange',
    borderColor: '#444',
  },
  compactButtonText: {
    color: '#444',
    fontWeight: 'bold',
    fontSize: 12,
    textTransform: 'uppercase',
  },
  compactButtonTextPrimary: {
    color: '#fff',
  },
});

export default ToolsPanel;
