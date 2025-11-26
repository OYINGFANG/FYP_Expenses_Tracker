import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Modal as RNModal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { FormattedMessage } from 'react-intl';
import itemsData from '../data/itemsData';

type ItemRecord =
  | { id?: string; key?: string; weight?: number; volume?: number }
  | Record<string, any>;

type Props = {
  itemId?: string;                 // <- tolerate undefined to avoid crashes
  closeInfoModal: () => void;
  visible: boolean;
};

// Works whether itemsData is an object map OR an array
function resolveItemById(all: any, id?: string) {
  if (!id) return undefined;
  if (all && typeof all === 'object' && !Array.isArray(all) && id in all) {
    return all[id];
  }
  if (Array.isArray(all)) {
    return all.find((it: ItemRecord) => it?.id === id || String(it?.key) === String(id));
  }
  return undefined;
}

const ItemInfoModal: React.FC<Props> = ({ itemId, closeInfoModal, visible }) => {
  const item = useMemo(() => resolveItemById(itemsData, itemId), [itemId]);

  const weight = (item as any)?.weight ?? 0;
  const volume = (item as any)?.volume ?? 0;

  return (
    <RNModal visible={visible} transparent animationType="fade" onRequestClose={closeInfoModal}>
      <View style={styles.overlay}>
        <View style={styles.container}>

          {/* Header Ribbon */}
          <LinearGradient
            colors={['#F59E0B', '#D97706']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.headerRibbon}
          >
            <View style={styles.headerLeft}>
              <Ionicons name="pricetag" size={18} color="#FEF3C7" />
              <Text style={styles.title}>
                {itemId ? <FormattedMessage id={`items__${itemId}__title`} /> : '—'}
              </Text>
            </View>

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={closeInfoModal}
              style={styles.closeBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={18} color="#FEF3C7" />
            </TouchableOpacity>
          </LinearGradient>

          {/* Body */}
          {item ? (
            <View style={styles.body}>
              {/* Icon Tile */}
              <LinearGradient
                colors={['#FEF3C7', '#FDE68A']}
                style={styles.iconContainer}
              >
                <View style={styles.iconInner}>
                  <Text style={styles.iconText}>{itemId}</Text>
                </View>
              </LinearGradient>

              {/* Info */}
              <View style={styles.infoContainer}>
                <Text style={styles.description}>
                  <FormattedMessage id={`items__${itemId}__description`} />
                </Text>

                {/* ONE ROW: Weight • Volume */}
                <View style={styles.statsRow}>
                  <View style={styles.statGroup}>
                    <Text style={styles.statText}>
                      <FormattedMessage id="weight_label" defaultMessage="Weight" />: {weight}
                    </Text>
                  </View>

                  <View style={styles.dot} />

                  <View style={styles.statGroup}>
                    <Text style={styles.statText}>
                      <FormattedMessage id="volume_label" defaultMessage="Volume" />: {volume}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          ) : (
            <Text style={styles.missing}>
              <FormattedMessage id="common__not_found" defaultMessage="Item not found." />
            </Text>
          )}

          {/* Footer Button */}
          <TouchableOpacity style={styles.button} onPress={closeInfoModal} activeOpacity={0.85}>
            <LinearGradient
              colors={['#FCD34D', '#F59E0B']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.buttonBg}
            >
              <Ionicons name="checkmark-circle" size={18} color="#78350F" />
              <Text style={styles.buttonText}>
                <FormattedMessage id="ok" defaultMessage="OK" />
              </Text>
            </LinearGradient>
          </TouchableOpacity>

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
  container: {
    width: CARD_WIDTH,
    backgroundColor: '#FFFBEB', // soft yellow background
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

  // Header
  headerRibbon: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  title: {
    color: '#FEF3C7',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  closeBtn: {
    padding: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(254,243,199,0.5)',
  },

  // Body
  body: {
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#F59E0B',
  },
  iconInner: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.55)',
    margin: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#78350F',
    textAlign: 'center',
  },
  infoContainer: {
    flex: 1,
    gap: 10,
  },
  description: {
    color: '#78350F',
    fontSize: 14,
    lineHeight: 20,
  },

  /* ONE ROW STATS */
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#FEF3C7',
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    alignSelf: 'flex-start',
  },
  statGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#F59E0B',
    opacity: 0.8,
  },
  statText: {
    color: '#78350F',
    fontWeight: '800',
    fontSize: 12.5,
    letterSpacing: 0.2,
  },

  // Missing state
  missing: {
    textAlign: 'center',
    paddingVertical: 14,
    color: '#B45309',
    fontWeight: '700',
  },

  // Footer
  button: {
    marginHorizontal: 14,
    marginBottom: 14,
    borderRadius: 10,
    overflow: 'hidden',
  },
  buttonBg: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#92400E',
    backgroundColor: '#F59E0B',
  },
  buttonText: {
    color: '#78350F',
    fontWeight: '900',
    fontSize: 14,
  },
});

export default ItemInfoModal;
