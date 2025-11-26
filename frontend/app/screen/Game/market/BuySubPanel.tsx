import React, { useMemo, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useIntl } from 'react-intl';
import { useGameSliceSelector, useGameSliceDispatch } from '../store/reduxHooks';
import { setModalStatus, buyItem, setCurrentModal } from '../store/gameSlice';
import CapacityDisplay from './CapacityDisplay';
import QtyModal from './QtyModal';
import ItemInfoModal from './ItemInfoModal';
import { getHasOverdueLoanForLocation } from '../utils/utils';
import { Ionicons } from '@expo/vector-icons';

type PriceRow = {
  id?: string;
  value: number;
  actions?: string[] | string;
  guildDiscount?: number;
  qty?: number;
};

const BuySubPanel: React.FC = () => {
  const dispatch = useGameSliceDispatch();
  const [selectedItem, setSelectedItem] = useState<any>({});
  const { formatMessage } = useIntl();
  const { gameState, modalStatus, currentModal } = useGameSliceSelector((state) => state.game);

  const hasOverdueLoan = getHasOverdueLoanForLocation(gameState, gameState.location);
  const isModalOpen = modalStatus !== 'closed';

  const pricesRaw = gameState?.prices as Record<string, PriceRow> | PriceRow[] | undefined;
  const hasGuildMembership = !!gameState?.flags?.[`guild__${gameState.location?.toLowerCase?.()}`];

  const priceEntries: Array<[string, PriceRow]> = useMemo(() => {
    if (!pricesRaw) return [];
    if (Array.isArray(pricesRaw)) {
      return pricesRaw.map((row, idx) => [String(row?.id ?? idx), row]);
    }
    return Object.keys(pricesRaw).map((k) => [k, pricesRaw[k]]);
  }, [pricesRaw, gameState.location]);

  const itemsForSale = useMemo(() => {
    const result = priceEntries
      .filter(([, row]) => {
        const a = row?.actions;
        const list = Array.isArray(a) ? a : (typeof a === 'string' ? [a] : []);
        const lower = list.map((s) => String(s).toLowerCase());
        return lower.includes('buy');
      })
      .map(([k, base]) => {
        const id = base?.id ?? k;
        return {
          ...base,
          id,
          guildDependentTitle: formatMessage({ id: `items__${id}__title` }),
          discountablePrice: base?.value ?? 0,
          hasGuildMembership,
        };
      });

    return result;
  }, [priceEntries, hasGuildMembership, formatMessage, gameState.location]);

  const openModal = (modalSlug: string) => {
    dispatch(setCurrentModal(modalSlug));
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

  const handleItemClick = (id: string, modalSlug: string) => {
    const foundItem = itemsForSale.find((it) => it.id === id);
    setSelectedItem(foundItem ?? {});
    openModal(modalSlug);
  };

  const handleQtyClose = () => closeModal();

  const handleBuyConfirm = (buyQty: number) => {
    const price = hasGuildMembership
      ? (selectedItem.value ?? 0) - (selectedItem.guildDiscount ?? 0)
      : (selectedItem.value ?? 0);

    dispatch(
      buyItem({
        qty: buyQty,
        itemId: selectedItem.id,
        price,
        action: 'buy',
      })
    );
    handleQtyClose();
  };

  const renderItem = ({ item, index }: { item: any; index: number }) => {
    const hasDiscount = hasGuildMembership && (item.guildDiscount ?? 0) > 0;
    const finalPrice = hasDiscount
      ? item.discountablePrice - (item.guildDiscount ?? 0)
      : item.discountablePrice;

    return (
      <View style={[styles.itemCard, index % 2 === 0 && styles.itemCardAlt]}>
        <LinearGradient
          colors={index % 2 === 0 ? ['#FEF3C7', '#FDE68A'] : ['#FDE68A', '#FCD34D']}
          style={styles.itemCardGradient}
        >
          {/* Item Header */}
          <View style={styles.itemHeader}>
            <View style={styles.itemIconCircle}>
              <Text style={styles.itemIcon}>🍞</Text>
            </View>
            <View style={styles.itemTitleContainer}>
              <Text style={styles.itemName} numberOfLines={1}>{item.guildDependentTitle}</Text>
              {hasDiscount && (
                <View style={styles.discountBadge}>
                  <Text style={styles.discountText}>GUILD DISCOUNT</Text>
                </View>
              )}
            </View>
          </View>

          {/* Item Details */}
          <View style={styles.itemDetails}>
            <View style={styles.detailRow}>
              <View style={styles.priceContainer}>
                <Text style={styles.priceLabel}>Price</Text>
                {hasDiscount && (
                  <Text style={styles.originalPrice}>${item.discountablePrice}</Text>
                )}
                <Text style={[styles.itemPrice, hasDiscount && styles.discountedPrice]}>
                  ${finalPrice}
                </Text>
              </View>

              <View style={styles.qtyContainer}>
                <Text style={styles.qtyLabel}>Available</Text>
                <View style={styles.qtyBadge}>
                  <Text style={styles.itemQty}>{item.qty ?? 0}</Text>
                </View>
              </View>
            </View>

            {/* Action Buttons */}
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

              {(item.qty ?? 0) > 0 ? (
                <TouchableOpacity
                  style={[styles.buyButton, hasOverdueLoan && styles.disabledButton]}
                  onPress={() => handleItemClick(item.id, 'qty')}
                  disabled={hasOverdueLoan}
                  activeOpacity={0.7}
                >
                  <LinearGradient
                    colors={hasOverdueLoan ? ['#9CA3AF', '#6B7280'] : ['#FCD34D', '#F59E0B']}
                    style={styles.buyButtonGradient}
                  >
                    <Ionicons
                      name="cart"
                      size={16}
                      color={hasOverdueLoan ? '#D1D5DB' : '#78350F'}
                    />
                    <Text style={[styles.buyButtonText, hasOverdueLoan && styles.disabledText]}>
                      {formatMessage({ id: 'market__buy__table___btn_buy', defaultMessage: 'Buy' })}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              ) : (
                <View style={styles.outOfStockBadge}>
                  <Text style={styles.outOfStockText}>OUT OF STOCK</Text>
                </View>
              )}
            </View>
          </View>
        </LinearGradient>
      </View>
    );
  };

  return (
    <LinearGradient colors={['#FEF3C7', '#FFFBEB']} style={styles.container}>
      {/* Header Section */}
      <View style={styles.headerContainer}>
        <LinearGradient
          colors={['#F59E0B', '#D97706']}
          style={styles.headerGradient}
        >
          <View style={styles.headerContent}>
            <Ionicons name="storefront" size={26} color="#FEF3C7" />
            <Text style={styles.header}>
              {formatMessage({ id: 'market__buy_title', defaultMessage: 'Market - Buy Items' })}
            </Text>
          </View>
        </LinearGradient>
      </View>

      {/* Overdue Loan Warning */}
      {hasOverdueLoan && (
        <View style={styles.warningBanner}>
          <Ionicons name="warning" size={18} color="#DC2626" />
          <Text style={styles.warningText}>
            Trading disabled due to overdue loan
          </Text>
        </View>
      )}

      {/* Items List */}
      <FlatList
        data={itemsForSale}
        keyExtractor={(it) => String(it.id)}
        renderItem={renderItem}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="basket-outline" size={44} color="#D97706" />
            </View>
            <Text style={styles.emptyText}>
              {formatMessage({ id: 'common__empty', defaultMessage: 'No items available.' })}
            </Text>
            <Text style={styles.emptySubtext}>
              Check back later for new inventory!
            </Text>
          </View>
        }
        removeClippedSubviews
      />

      {/* Capacity Display */}
      <View style={styles.capacityContainer}>
        <CapacityDisplay />
      </View>

      {/* Modals */}
      {isModalOpen && currentModal === 'info' && (
        <ItemInfoModal
          itemId={selectedItem?.id}
          closeInfoModal={closeModal}
          visible={true}
        />
      )}

      {isModalOpen && currentModal === 'qty' && (
        <QtyModal
          action="buy"
          selectedItem={selectedItem}
          handleConfirm={handleBuyConfirm}
          handleQtyClose={handleQtyClose}
          visible={true}
        />
      )}
    </LinearGradient>
  );
};

export default BuySubPanel;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
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
    paddingHorizontal: 12, // was 15
  },

  itemCard: {
    marginBottom: 10, // was 15
    borderRadius: 14,  // was 16
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, // was 0.1
    shadowRadius: 2.5,   // was 4
    elevation: 2,        // was 3
  },
  itemCardAlt: {},

  itemCardGradient: {
    padding: 6,          // was 8
    borderWidth: 1.5,    // was 2
    borderColor: '#F59E0B',
    borderRadius: 14,    // was 16
  },

  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,     // was 12
    gap: 8,              // was 12
  },
  itemIconCircle: {
    width: 40,           // was 48
    height: 40,          // was 48
    borderRadius: 20,    // was 24
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,    // was 2
    borderColor: '#F59E0B',
  },
  itemIcon: {
    fontSize: 20,        // was 24
  },
  itemTitleContainer: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,        // was 18
    fontWeight: '800',
    color: '#78350F',
    marginBottom: 2,     // was 4
  },
  discountBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 6, // was 8
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  discountText: {
    color: '#fff',
    fontSize: 9.5,      // was 10
    fontWeight: '800',
    letterSpacing: 0.4, // was 0.5
  },

  itemDetails: {
    gap: 8,              // was 12
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  priceContainer: { flex: 1 },
  priceLabel: {
    fontSize: 11,        // was 12
    color: '#92400E',
    fontWeight: '600',
    marginBottom: 2,     // was 4
  },
  originalPrice: {
    fontSize: 13,        // was 14
    color: '#92400E',
    textDecorationLine: 'line-through',
    opacity: 0.6,
    marginBottom: 1,     // was 2
  },
  itemPrice: {
    fontSize: 20,        // was 24
    fontWeight: '800',
    color: '#78350F',
  },
  discountedPrice: {
    color: '#10B981',
  },

  qtyContainer: {
    alignItems: 'flex-end',
  },
  qtyLabel: {
    fontSize: 11,        // was 12
    color: '#92400E',
    fontWeight: '600',
    marginBottom: 2,     // was 4
  },
  qtyBadge: {
    backgroundColor: 'rgba(255,255,255,0.7)',
    paddingHorizontal: 10, // was 12
    paddingVertical: 5,    // was 6
    borderRadius: 10,      // was 12
    borderWidth: 1.5,      // was 2
    borderColor: '#F59E0B',
    minWidth: 44,          // was 50
    alignItems: 'center',
  },
  itemQty: {
    fontSize: 18,         // was 20
    fontWeight: '800',
    color: '#78350F',
  },

  actionButtons: {
    flexDirection: 'row',
    gap: 6,               // was 8
    marginTop: 2,         // was 4
  },
  infoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,               // was 6
    paddingVertical: 10,  // was 12
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 10,     // was 12
    borderWidth: 1.5,     // was 2
    borderColor: '#F59E0B',
  },
  infoButtonText: {
    color: '#78350F',
    fontWeight: '700',
    fontSize: 13,         // was 14
  },
  buyButton: {
    flex: 1,
    borderRadius: 10,     // was 12
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.16,  // was 0.2
    shadowRadius: 2.0,    // was 3
    elevation: 2,         // was 3
  },
  buyButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,               // was 6
    paddingVertical: 10,  // was 12
    borderWidth: 1.5,     // was 2
    borderColor: '#92400E',
    borderRadius: 10,     // was 12
  },
  buyButtonText: {
    color: '#78350F',
    fontWeight: '800',
    fontSize: 13,         // was 14
  },
  disabledButton: { opacity: 0.5 },
  disabledText: { color: '#D1D5DB' },

  outOfStockBadge: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 10,  // was 12
    borderRadius: 10,     // was 12
    borderWidth: 1.5,     // was 2
    borderColor: '#D1D5DB',
    alignItems: 'center',
  },
  outOfStockText: {
    color: '#6B7280',
    fontWeight: '700',
    fontSize: 11.5,       // was 12
    letterSpacing: 0.4,   // was 0.5
  },

  capacityContainer: {
    marginTop: 4,         // was 5
    marginBottom: 4,      // was 5
    marginHorizontal: 12, // was 16
    padding: 6,           // was 8
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 14,     // was 16
    borderWidth: 1.5,     // was 2
    borderColor: '#F59E0B',
  },

  emptyContainer: {
    paddingVertical: 48,  // was 60
    paddingHorizontal: 16,// was 20
    alignItems: 'center',
  },
  emptyIconCircle: {
    width: 88,            // was 96
    height: 88,           // was 96
    borderRadius: 44,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,     // was 3
    borderColor: '#F59E0B',
    marginBottom: 14,     // was 16
  },
  emptyText: {
    textAlign: 'center',
    color: '#78350F',
    fontSize: 16.5,       // was 18
    fontWeight: '700',
    marginBottom: 6,      // was 8
  },
  emptySubtext: {
    textAlign: 'center',
    color: '#92400E',
    fontSize: 13,         // was 14
  },
});
