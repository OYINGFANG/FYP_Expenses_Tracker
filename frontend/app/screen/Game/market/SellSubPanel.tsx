import React, { useMemo, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useIntl } from 'react-intl';
import { useGameSliceSelector, useGameSliceDispatch } from '../store/reduxHooks';
import { setModalStatus, sellItem, setCurrentModal } from '../store/gameSlice';
import CapacityDisplay from './CapacityDisplay';
import QtyModal from './QtyModal';
import ItemInfoModal from './ItemInfoModal';
import itemsData from '../data/itemsData';
import { getHasOverdueLoanForLocation } from '../utils/utils';
import { Ionicons } from '@expo/vector-icons';

type PriceRow = {
  id?: string;
  value: number;
  actions?: string[] | string;
  guildDiscount?: number;
  qty?: number;
};

const SellSubPanel: React.FC = () => {
  const dispatch = useGameSliceDispatch();
  const [selectedItem, setSelectedItem] = useState<any>({});
  const { formatMessage } = useIntl();
  const { gameState, modalStatus, currentModal } = useGameSliceSelector((state) => state.game);

  const hasOverdueLoan = getHasOverdueLoanForLocation(gameState, gameState.location);
  const isModalOpen = modalStatus !== 'closed' && ['sellQty', 'info'].includes(currentModal);

  const prices = (gameState?.prices ?? {}) as Record<string, PriceRow>;
  const inventory = (gameState?.inventory ?? {}) as Record<string, { qty?: number }>;
  const hasGuildMembership = !!gameState?.flags?.[`guild__${gameState.location?.toLowerCase?.()}`];

  // Build list of items you currently carry (qty > 0), and that can be sold
  const inventoryItems = useMemo(() => {
    const keys = Array.isArray(itemsData)
      ? (itemsData as any[]).map((it) => String(it?.id ?? it?.key)).filter(Boolean)
      : Object.keys(itemsData || {});
    return keys
      .filter((key) => (inventory?.[key]?.qty ?? 0) > 0)
      .map((key) => {
        const priceRow = prices?.[key] ?? {};
        const actions = Array.isArray(priceRow?.actions)
          ? priceRow.actions
          : (priceRow?.actions ? [priceRow.actions] : []);
        const canSell = actions.map((a) => String(a).toLowerCase()).includes('sell');

        return {
          ...priceRow,
          id: key,
          guildDependentTitle: formatMessage({ id: `items__${key}__title` }),
          discountablePrice: priceRow?.value ?? 0,
          hasGuildMembership,
          qty: inventory?.[key]?.qty ?? 0,
          canSell,
        };
      })
      .filter((it) => it.canSell);
  }, [itemsData, prices, inventory, hasGuildMembership, formatMessage, gameState.location]);

  const openModal = (slug: string) => {
    dispatch(setCurrentModal(slug));
    dispatch(setModalStatus('opening'));
    setTimeout(() => dispatch(setModalStatus('open')), 510);
  };

  const closeModal = () => {
    dispatch(setModalStatus('closing'));
    setTimeout(() => {
      dispatch(setModalStatus('closed'));
      dispatch(setCurrentModal(''));
    }, 510);
  };

  const handleItemClick = (id: string, slug: string) => {
    const foundItem = inventoryItems.find((item: any) => item.id === id);
    setSelectedItem({ ...foundItem });
    openModal(slug);
  };

  const handleQtyClose = () => {
    closeModal();
  };

  const handleSellConfirm = (sellQty: number) => {
    const price = hasGuildMembership
      ? (selectedItem.value ?? 0) - (selectedItem.guildDiscount ?? 0)
      : (selectedItem.value ?? 0);

    dispatch(
      sellItem({
        qty: sellQty,
        itemId: selectedItem.id,
        price,
        action: 'sell',
      }),
    );
    handleQtyClose();
  };

  const renderItem = ({ item, index }: { item: any; index: number }) => {
    const hasDiscount = hasGuildMembership && (item.guildDiscount ?? 0) > 0;
    const finalPrice = hasDiscount
      ? (item.discountablePrice ?? 0) - (item.guildDiscount ?? 0)
      : (item.discountablePrice ?? 0);

    return (
      <View style={[styles.itemCard, index % 2 === 0 && styles.itemCardAlt]}>
        <LinearGradient
          colors={index % 2 === 0 ? ['#FEF3C7', '#FDE68A'] : ['#FDE68A', '#FCD34D']}
          style={styles.itemCardGradient}
        >
          {/* Item Header */}
          <View style={styles.itemHeader}>
            <View style={styles.itemIconCircle}>
              <Text style={styles.itemIcon}>📦</Text>
            </View>
            <View style={styles.itemTitleContainer}>
              <Text style={styles.itemName} numberOfLines={1}>
                {item.guildDependentTitle}
              </Text>
              {hasDiscount && (
                <View style={styles.discountBadge}>
                  <Text style={styles.discountText}>
                    {formatMessage({ id: 'common__discount', defaultMessage: 'GUILD DISCOUNT' })}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Item Details */}
          <View style={styles.itemDetails}>
            <View style={styles.detailRow}>
              <View style={styles.priceContainer}>
                <Text style={styles.priceLabel}>
                  {formatMessage({ id: 'market__sell__price_label', defaultMessage: 'Sell Price' })}
                </Text>
                {hasDiscount && (
                  <Text style={styles.originalPrice}>${item.discountablePrice}</Text>
                )}
                <Text style={[styles.itemPrice, hasDiscount && styles.discountedPrice]}>
                  ${finalPrice}
                </Text>
              </View>

              <View style={styles.qtyContainer}>
                <Text style={styles.qtyLabel}>
                  {formatMessage({ id: 'market__sell__carried_label', defaultMessage: 'Carried' })}
                </Text>
                <View style={styles.qtyBadge}>
                  <Text style={styles.itemQty}>{item.qty ?? 0}</Text>
                </View>
              </View>
            </View>

            {/* Actions */}
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.infoButton}
                onPress={() => handleItemClick(item.id, 'info')}
                activeOpacity={0.7}
              >
                <Ionicons name="information-circle-outline" size={16} color="#78350F" />
                <Text style={styles.infoButtonText}>
                  {formatMessage({ id: 'market__buy__table___btn_info', defaultMessage: 'Info' })}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.sellButton, hasOverdueLoan && styles.disabledButton]}
                onPress={() => handleItemClick(item.id, 'sellQty')}
                disabled={hasOverdueLoan}
                activeOpacity={0.7}
              >
                <LinearGradient
                  colors={hasOverdueLoan ? ['#9CA3AF', '#6B7280'] : ['#FCD34D', '#F59E0B']}
                  style={styles.sellButtonGradient}
                >
                  <Ionicons
                    name="pricetag"
                    size={16}
                    color={hasOverdueLoan ? '#D1D5DB' : '#78350F'}
                  />
                  <Text style={[styles.sellButtonText, hasOverdueLoan && styles.disabledText]}>
                    {formatMessage({ id: 'market__sell__table___btn_sell', defaultMessage: 'Sell' })}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>
      </View>
    );
  };

  return (
    <LinearGradient colors={['#FEF3C7', '#FFFBEB']} style={styles.container}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <LinearGradient colors={['#F59E0B', '#D97706']} style={styles.headerGradient}>
          <View style={styles.headerContent}>
            <Ionicons name="cash-outline" size={26} color="#FEF3C7" />
            <Text style={styles.header}>
              {formatMessage({ id: 'market__sell_title', defaultMessage: 'Market - Sell Items' })}
            </Text>
          </View>
        </LinearGradient>
      </View>

      {/* Overdue Loan Warning */}
      {hasOverdueLoan && (
        <View style={styles.warningBanner}>
          <Ionicons name="warning" size={18} color="#DC2626" />
          <Text style={styles.warningText}>
            {formatMessage({
              id: 'market__sell__disabled_overdue',
              defaultMessage: 'Trading disabled due to overdue loan',
            })}
          </Text>
        </View>
      )}

      {/* Items List */}
      <FlatList
        data={inventoryItems}
        keyExtractor={(it) => String(it.id)}
        renderItem={renderItem}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="cube-outline" size={44} color="#D97706" />
            </View>
            <Text style={styles.emptyText}>
              {formatMessage({
                id: 'market__sell__empty',
                defaultMessage: 'No sellable items in your inventory.',
              })}
            </Text>
            <Text style={styles.emptySubtext}>
              {formatMessage({
                id: 'market__sell__empty_sub',
                defaultMessage: 'Acquire items first, then come back to sell.',
              })}
            </Text>
          </View>
        }
        removeClippedSubviews
      />

      {/* Capacity */}
      <View style={styles.capacityContainer}>
        <CapacityDisplay />
      </View>

      {/* Modals */}
      {isModalOpen && currentModal === 'info' && (
        <ItemInfoModal itemId={selectedItem?.id} closeInfoModal={closeModal} visible={true} />
      )}
      {isModalOpen && currentModal === 'sellQty' && (
        <QtyModal
          action="sell"
          selectedItem={selectedItem}
          handleConfirm={handleSellConfirm}
          handleQtyClose={handleQtyClose}
          visible={true}
        />
      )}
    </LinearGradient>
  );
};

export default SellSubPanel;

/* --- Yellow-theme styles to match Buy panel (tightened gaps) --- */
const styles = StyleSheet.create({
  container: { flex: 1 },
  headerContainer: {
    marginBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: '#F59E0B',
  },
  headerGradient: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  header: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FEF3C7',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowRadius: 1.5,
    textShadowOffset: { width: 0, height: 1 },
  },

  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEE2E2',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginHorizontal: 12,
    marginBottom: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#DC2626',
  },
  warningText: {
    color: '#DC2626',
    fontWeight: '700',
    fontSize: 13,
  },

  listContainer: {
    paddingBottom: 8,
    paddingHorizontal: 12,
  },

  itemCard: {
    marginBottom: 10,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2.5,
    elevation: 2,
  },
  itemCardAlt: {},
  itemCardGradient: {
    padding: 6,
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    borderRadius: 14,
  },

  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  itemIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#F59E0B',
  },
  itemIcon: {
    fontSize: 20,
  },
  itemTitleContainer: { flex: 1 },
  itemName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#78350F',
    marginBottom: 2,
  },
  discountBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  discountText: {
    color: '#fff',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },

  itemDetails: { gap: 8 },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  priceContainer: { flex: 1 },
  priceLabel: {
    fontSize: 11,
    color: '#92400E',
    fontWeight: '600',
    marginBottom: 2,
  },
  originalPrice: {
    fontSize: 13,
    color: '#92400E',
    textDecorationLine: 'line-through',
    opacity: 0.6,
    marginBottom: 1,
  },
  itemPrice: {
    fontSize: 20,
    fontWeight: '800',
    color: '#78350F',
  },
  discountedPrice: { color: '#10B981' },

  qtyContainer: { alignItems: 'flex-end' },
  qtyLabel: {
    fontSize: 11,
    color: '#92400E',
    fontWeight: '600',
    marginBottom: 2,
  },
  qtyBadge: {
    backgroundColor: 'rgba(255,255,255,0.7)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    minWidth: 44,
    alignItems: 'center',
  },
  itemQty: {
    fontSize: 18,
    fontWeight: '800',
    color: '#78350F',
  },

  actionButtons: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 2,
  },
  infoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#F59E0B',
  },
  infoButtonText: {
    color: '#78350F',
    fontWeight: '700',
    fontSize: 13,
  },

  sellButton: {
    flex: 1,
    borderRadius: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.16,
    shadowRadius: 2.0,
    elevation: 2,
  },
  sellButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: '#92400E',
    borderRadius: 10,
  },
  sellButtonText: {
    color: '#78350F',
    fontWeight: '800',
    fontSize: 13,
  },
  disabledButton: { opacity: 0.5 },
  disabledText: { color: '#D1D5DB' },

  capacityContainer: {
    marginTop: 4,
    marginBottom: 4,
    marginHorizontal: 12,
    padding: 6,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#F59E0B',
  },

  emptyContainer: {
    paddingVertical: 48,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  emptyIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#F59E0B',
    marginBottom: 14,
  },
  emptyText: {
    textAlign: 'center',
    color: '#78350F',
    fontSize: 16.5,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptySubtext: {
    textAlign: 'center',
    color: '#92400E',
    fontSize: 13,
  },
});
