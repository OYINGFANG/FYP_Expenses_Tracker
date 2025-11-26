import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
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
        <Button
          onPress={() => handleInfoClick(id)}
          label={formatMessage({ id: 'market__buy__table___btn_info', defaultMessage: 'Info' })}
          variant="secondary"
        />
      </View>
      {!gameState.flags[`upgrade__${id}`] && (
        <Button
          onPress={() => handleBuyUpgrade(id, getUpgradePrice(id))}
          label={formatMessage({ id: 'market__buy__table___btn_buy', defaultMessage: 'Buy' })}
          variant="primary"
          disabled={getUpgradeGuildOnly(id) && !hasGuildMembership}
        />
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
    gap: 16,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  actionButtonWrapper: {
    marginRight: 16,
  },
});

export default ToolsPanel;
