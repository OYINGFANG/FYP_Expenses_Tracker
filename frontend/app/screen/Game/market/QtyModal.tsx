import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Modal as RNModal,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { FormattedMessage } from 'react-intl';
import { useGameSliceSelector } from '../store/reduxHooks';
import itemsData from '../data/itemsData';
import { getMaxQty } from '../utils/utils';

type Props = {
  action: 'buy' | 'sell';
  selectedItem: {
    id?: string;
    qty?: number;
    value?: number;
    guildDiscount?: number;
  } | null;
  handleConfirm: (qty: number) => void;
  handleQtyClose: () => void;
  visible: boolean;
};

const QtyModal: React.FC<Props> = ({
  action,
  selectedItem,
  handleConfirm,
  handleQtyClose,
  visible,
}) => {
  const { gameState } = useGameSliceSelector((state) => state.game);
  const hasGuildMembership = !!gameState?.flags?.[`guild__${gameState.location?.toLowerCase?.()}`];

  // --- derive max qty ---
  const maxQty = useMemo(() => {
    const hasId = !!selectedItem?.id;
    if (!hasId) return 0;
    if (action === 'buy') {
      try {
        return Math.max(0, Number(getMaxQty(gameState, selectedItem as any, itemsData)) || 0);
      } catch {
        return 0;
      }
    }
    return Math.max(0, Number(selectedItem?.qty ?? 0));
  }, [action, gameState, selectedItem]);

  // --- qty state ---
  const [qty, setQty] = useState<number>(0);
  useEffect(() => {
    setQty(maxQty > 0 ? 1 : 0);
  }, [maxQty, selectedItem?.id, visible]);

  if (!selectedItem?.id) return null;

  const clamp = (n: number) => Math.max(0, Math.min(n, maxQty));
  const handleQtyChange = (val: string) => {
    const n = parseInt(val.replace(/[^\d]/g, ''), 10);
    setQty(Number.isFinite(n) ? clamp(n) : 0);
  };
  const inc = () => setQty((q) => clamp(q + 1));
  const dec = () => setQty((q) => clamp(q - 1));
  const setQuick = (n: number) => setQty(clamp(n));
  const onConfirmMax = () => handleConfirm(maxQty);
  const onConfirmQty = () => handleConfirm(qty);

  // --- pricing display ---
  const base = Number(selectedItem?.value ?? 0);
  const discount = Number(selectedItem?.guildDiscount ?? 0);
  const hasDiscount = hasGuildMembership && discount > 0;
  const unitPrice = hasDiscount ? base - discount : base;
  const total = unitPrice * qty;

  const titleId = 'market__buy__qty_modal__title';
  const explainerId =
    action === 'buy' ? 'market__buy__qty_modal__explainer' : 'market__sell__qty_modal__explainer';

  return (
    <RNModal
      visible={visible}
      transparent
      animationType={Platform.select({ ios: 'slide', android: 'fade' })}
      onRequestClose={handleQtyClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>

          {/* Header */}
          <LinearGradient colors={['#F59E0B', '#D97706']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name={action === 'buy' ? 'cart' : 'pricetag'} size={18} color="#FEF3C7" />
              <Text style={styles.headerTitle}>
                <FormattedMessage id={titleId} defaultMessage="Select Quantity" />
              </Text>
            </View>
            <TouchableOpacity onPress={handleQtyClose} style={styles.headerClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={18} color="#FEF3C7" />
            </TouchableOpacity>
          </LinearGradient>

          {/* Body */}
          <View style={styles.body}>

            {/* === SINGLE ROW: ID • UNIT PRICE • TOTAL === */}
            <View style={styles.topRow}>
              {/* ID block */}
              <View style={styles.idBlock}>
                <View style={styles.idBadge}>
                  <Ionicons name="pricetag-outline" size={12} color="#92400E" />
                  <Text style={styles.itemTitle} numberOfLines={1}>{selectedItem.id}</Text>
                </View>
              </View>

              {/* Unit price block */}
              <View style={styles.unitBlock}>
                <Text style={styles.labelMini}>
                  {action === 'buy'
                    ? <FormattedMessage id="market__buy__unit_price" defaultMessage="Unit" />
                    : <FormattedMessage id="market__sell__unit_price" defaultMessage="Sell" />}
                </Text>
                {hasDiscount && <Text style={styles.strike}>${base}</Text>}
                <Text style={[styles.valueBig, hasDiscount && styles.valueDiscount]} numberOfLines={1}>
                  ${unitPrice}
                </Text>
              </View>

              {/* Total block */}
              <LinearGradient colors={['#FDE68A', '#FCD34D']} style={styles.totalBlock}>
                <Text style={styles.labelMiniDark}>
                  <FormattedMessage id="total" defaultMessage="Total" />
                </Text>
                <Text style={styles.totalValue} numberOfLines={1}>${total || 0}</Text>
              </LinearGradient>
            </View>

            {/* Quantity controls */}
            <View style={styles.stepperRow}>
              <TouchableOpacity onPress={dec} style={[styles.stepBtn, qty <= 0 && styles.stepBtnDisabled]} disabled={qty <= 0}>
                <Ionicons name="remove" size={18} color={qty <= 0 ? '#D1D5DB' : '#78350F'} />
              </TouchableOpacity>

              <TextInput
                style={styles.input}
                keyboardType={Platform.OS === 'ios' ? 'number-pad' : 'numeric'}
                value={String(qty)}
                onChangeText={handleQtyChange}
                maxLength={6}
              />

              <TouchableOpacity onPress={inc} style={[styles.stepBtn, maxQty <= 0 && styles.stepBtnDisabled]} disabled={maxQty <= 0}>
                <Ionicons name="add" size={18} color={maxQty <= 0 ? '#D1D5DB' : '#78350F'} />
              </TouchableOpacity>
            </View>

            {/* Explainer */}
            <Text style={styles.explainer}>
              <FormattedMessage
                id={explainerId}
                defaultMessage={
                  action === 'buy'
                    ? 'Max quantity: {maxQty} based on available cash and storage capacity.'
                    : 'Max quantity: {maxQty} based on the items in your inventory.'
                }
                values={{ maxQty }}
              />
            </Text>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity style={[styles.btn, styles.secondary]} onPress={handleQtyClose}>
              <Text style={styles.btnTextAlt}>
                <FormattedMessage id="cancel" defaultMessage="Cancel" />
              </Text>
            </TouchableOpacity>

            {maxQty > 0 && (
              <TouchableOpacity style={[styles.btn, styles.primary]} onPress={onConfirmMax}>
                <LinearGradient colors={['#FCD34D', '#F59E0B']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.btnBg}>
                  <Ionicons name="flash" size={16} color="#78350F" />
                  <Text style={styles.btnText}>
                    <FormattedMessage id="max" defaultMessage="Max: {labelValue}" values={{ labelValue: maxQty }} />
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            )}

            {maxQty > 0 && qty > 0 && (
              <TouchableOpacity style={[styles.btn, styles.primary]} onPress={onConfirmQty}>
                <LinearGradient colors={['#FCD34D', '#F59E0B']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.btnBg}>
                  <Ionicons name="checkmark-circle" size={16} color="#78350F" />
                  <Text style={styles.btnText}>
                    <FormattedMessage id="ok" defaultMessage="OK" />
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>

        </View>
      </View>
    </RNModal>
  );
};

const CARD_WIDTH = Math.min(Dimensions.get('window').width * 0.92, 520);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  card: {
    width: CARD_WIDTH,
    backgroundColor: '#FFFBEB',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#F59E0B',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },

  header: { paddingVertical: 10, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center' },
  headerLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: {
    color: '#FEF3C7', fontSize: 16, fontWeight: '800', letterSpacing: 0.3, textTransform: 'uppercase',
  },
  headerClose: { padding: 6, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(254,243,199,0.5)' },

  body: { paddingHorizontal: 14, paddingVertical: 12, gap: 12 },

  /* === the single row layout === */
  topRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
  },

  // left: ID + title
  idBlock: { flex: 1, minWidth: 0, marginTop: 15},
  idBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
    marginBottom: 4,
  },
  idText: { color: '#92400E', fontSize: 11.5, fontWeight: '800' },
  itemTitle: { color: '#78350F', fontWeight: '900', fontSize: 15 },

  // middle: unit price pill
  unitBlock: {
    paddingVertical: 6, paddingHorizontal: 10,
    borderRadius: 12, minWidth: 92,
    borderWidth: 1.5, borderColor: '#F59E0B',
    backgroundColor: '#FEF3C7',
    alignItems: 'flex-end', justifyContent: 'center',
  },
  labelMini: { color: '#92400E', fontSize: 11, fontWeight: '700', marginBottom: 2 },
  strike: { color: '#92400E', fontSize: 12, textDecorationLine: 'line-through', opacity: 0.7, marginBottom: 1 },
  valueBig: { color: '#78350F', fontSize: 18, fontWeight: '900' },
  valueDiscount: { color: '#065F46' },

  // right: total gradient pill
  totalBlock: {
    paddingVertical: 6, paddingHorizontal: 10,
    borderRadius: 12, minWidth: 110,
    borderWidth: 1.5, borderColor: '#F59E0B',
    alignItems: 'flex-end', justifyContent: 'center',
  },
  labelMiniDark: { color: '#92400E', fontSize: 11, fontWeight: '800', marginBottom: 2 },
  totalValue: { color: '#78350F', fontSize: 18, fontWeight: '900' },

  // controls
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepBtn: {
    width: 40, height: 40, borderRadius: 10,
    borderWidth: 1.5, borderColor: '#F59E0B',
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center', justifyContent: 'center',
  },
  stepBtnDisabled: { opacity: 0.5 },
  input: {
    flex: 1,
    borderWidth: 1.5, borderColor: '#F59E0B', borderRadius: 10,
    paddingVertical: 8, paddingHorizontal: 12,
    fontSize: 18, color: '#78350F',
    backgroundColor: '#FEF3C7',
    textAlign: 'center',
  },

  explainer: { color: '#78350F', fontStyle: 'italic', textAlign: 'center' },

  footer: { padding: 12, flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  btn: { borderRadius: 10, overflow: 'hidden', minWidth: 90 },
  primary: {},
  secondary: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5, borderColor: '#E5E7EB',
    paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center',
  },
  btnBg: {
    paddingVertical: 10, paddingHorizontal: 16,
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6,
    borderRadius: 10, borderWidth: 1.5, borderColor: '#92400E',
  },
  btnText: { color: '#78350F', fontWeight: '900', fontSize: 14 },
  btnTextAlt: { color: '#374151', fontWeight: '800', fontSize: 14 },
});

export default QtyModal;
