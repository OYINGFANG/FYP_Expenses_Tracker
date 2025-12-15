import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ImageBackground,
  StyleSheet,
  Pressable,
  Platform,
  Modal as RNModal,
  ScrollView,
  Alert,
  ImageSourcePropType,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router'; // << use expo-router to navigate
import { useGameSliceSelector, useGameSliceDispatch } from './store/reduxHooks';
import { closeGame, setModalStatus, setCurrentModal, quickSave, loadSavedGame } from './store/gameSlice';
import { getQuickSave } from './utils/saveLoadUtils';
import { GameTabSlugs } from './types';
import { FormattedMessage, MessageDescriptor } from 'react-intl';
import TabButton from './TabButton';
import LoanExpirationWarning from './LoanExpirationWarning';
import { getHasOverdueLoanForLocation } from './utils/utils';
import { getBgImg } from './headerUtils';
import { Ionicons } from '@expo/vector-icons';

// ---------- Helpers ----------
type CurrencyDisplayProps = { value?: number | null };
const CurrencyDisplay: React.FC<CurrencyDisplayProps> = ({ value }) => {
  const formatted =
    typeof value === 'number'
      ? new Intl.NumberFormat(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value)
      : '--';
  return <Text>{`$${formatted}`}</Text>;
};

const InGameDateDisplay: React.FC<{ numTurns?: number | null }> = ({ numTurns }) => (
  <Text>{`Turn ${numTurns ?? 0}`}</Text>
);

const SafeFM: React.FC<
  MessageDescriptor & {
    values?: Record<string, any>;
    children?: (chunks: React.ReactNode) => React.ReactNode;
  }
> = ({ values, ...rest }) => {
  const safeValues =
    typeof Proxy !== 'undefined'
      ? new Proxy(values || {}, { get: (t, p: string) => (p in t ? (t as any)[p] : '') })
      : (values || {});
  return <FormattedMessage {...rest} values={safeValues} />;
};

const QuickActionButton: React.FC<{ label: string; onPress: () => void }> = ({ label, onPress }) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    style={({ pressed }) => [styles.quickBtn, pressed && styles.pressed]}
  >
    <LinearGradient colors={['#FCD34D', '#F59E0B']} style={styles.quickBtnGradient}>
      <Text style={styles.quickBtnText}>{label}</Text>
    </LinearGradient>
  </Pressable>
);

const UC = (s?: string) => (typeof s === 'string' ? s.toUpperCase() : '');

// ---------- Component ----------
const GameHeader: React.FC = () => {
  const [bgImg, setBgImg] = useState<ImageSourcePropType | undefined>(undefined);
  const [hasQuickSave, setHasQuickSave] = useState<boolean>(false);
  const [isShowingBg, setIsShowingBg] = useState<boolean>(false);
  const [nativeModalOpen, setNativeModalOpen] = useState<boolean>(false);

  const dispatch = useGameSliceDispatch();
  const { gameState, gamePanel, modalStatus, currentModal } = useGameSliceSelector((state) => state.game);
  const { location } = gameState;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const qs = await getQuickSave();
      if (!cancelled) setHasQuickSave(!!qs);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLocationChange = useCallback(() => {
    setIsShowingBg(false);
    setTimeout(() => {
      setBgImg(getBgImg(location));
      setIsShowingBg(true);
    }, 500);
  }, [location]);

  useEffect(() => {
    handleLocationChange();
  }, [handleLocationChange]);

  const isModalOpen = modalStatus !== 'closed';

  const openModal = () => {
    dispatch(setCurrentModal('location'));
    dispatch(setModalStatus('opening'));
    setTimeout(() => {
      dispatch(setModalStatus('open'));
      setNativeModalOpen(true);
    }, 510);
  };

  const closeModal = () => {
    setNativeModalOpen(false);
    dispatch(setCurrentModal(''));
    dispatch(setModalStatus('closed'));
  };

  // FIX: use expo-router to go to your TitlePage route
  const handleCloseGame = () => {
    if (isModalOpen) closeModal();
    dispatch(closeGame());
    // Try to dismiss modals, but don't fail if there's no navigation stack
    try {
      router.dismissAll();
    } catch (e) {
      // Ignore navigation errors - router.replace will handle navigation
    }
    router.replace('/screen/Game/titlePage/TitlePage'); // path must match your file
  };

  const handleQuickSave = () => {
    dispatch(quickSave());
    setHasQuickSave(true);
  };

  const handleQuickLoad = async () => {
    const gs = await getQuickSave();
    if (gs) {
      dispatch(loadSavedGame(gs));
    } else {
      setHasQuickSave(false);
      Alert.alert('No Quick Save', 'There is no quick save available to load.');
    }
  };

  const isThisModalOpen = isModalOpen && currentModal === 'location';

  return (
    <View style={styles.wrapper} testID="game-header">
      {/* Background */}
      <View style={styles.heroContainer}>
        <ImageBackground
          source={bgImg || undefined}
          resizeMode="cover"
          style={styles.bgImage}
          imageStyle={styles.bgImageStyle}
        >
          {/* Warm gradient overlay (won't block touches) */}
          <LinearGradient
            colors={['rgba(217,119,6,0.85)', 'rgba(217,119,6,0.0)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.leftGradient}
            pointerEvents="none"
          />

          {/* Decorative sparkles (won't block touches) */}
          <View style={styles.sparklesContainer} pointerEvents="none">
            <View style={[styles.sparkle, { top: 60, left: '15%' }]} />
            <View style={[styles.sparkle, { top: 120, right: '25%' }]} />
            <View style={[styles.sparkle, { bottom: 80, left: '60%' }]} />
          </View>

          {/* Title / Info */}
          <View style={styles.titleContainer}>
            <View style={styles.titleWrapper}>
              <Text style={styles.titleText}>
                <SafeFM
                  id={`location__${location}__title`}
                  defaultMessage={UC(location)}
                  values={{ location, LOCATION: UC(location) }}
                />
              </Text>
            </View>

            <Pressable
              testID="location-info-btn"
              accessibilityRole="button"
              accessibilityLabel="Info"
              onPress={openModal}
              hitSlop={8}
              style={({ pressed }) => [styles.infoButton, pressed && styles.pressed]}
            >
              <View style={styles.infoIconContainer}>
                <Ionicons name="information-circle" size={32} color="#FCD34D" />
              </View>
            </Pressable>
          </View>

          {!isShowingBg && <View pointerEvents="none" style={styles.fadeOverlay} />}

          {/* Close */}
          <View style={styles.topRightButton} testID="close-game">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close game"
              onPress={handleCloseGame}
              style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
            >
              <LinearGradient
                colors={['rgba(30,30,30,0.95)', 'rgba(20,20,20,0.95)']}
                style={styles.closeBtnGradient}
              >
                <Text style={styles.closeBtnText}>×</Text>
              </LinearGradient>
            </Pressable>
          </View>

          {/* Stats */}
          <View style={styles.bottomRightStats}>
            <View style={styles.statCard}>
              <Text style={styles.dateText}>
                <InGameDateDisplay numTurns={gameState?.numTurns} />
              </Text>
              <Text style={styles.cashText}>
                <SafeFM id="game_header__cash" defaultMessage="Cash" />: <CurrencyDisplay value={gameState?.cash} />
              </Text>
              <Text style={styles.netWealthText}>
                <SafeFM id="game_header__net_wealth" defaultMessage="Net Wealth" />{' '}
                <CurrencyDisplay value={gameState?.netWealth} />
              </Text>
            </View>
          </View>
        </ImageBackground>
      </View>

      {/* Compact bar */}
      <LinearGradient colors={['#D97706', '#B45309']} style={styles.compactBar}>
        <View style={styles.compactBarInner}>
          <Text style={styles.compactBarText}>
            <CurrencyDisplay value={gameState?.cash} />
          </Text>
          <Text style={styles.compactBarText}>
            <InGameDateDisplay numTurns={gameState?.numTurns} />
          </Text>
        </View>
      </LinearGradient>

      {getHasOverdueLoanForLocation(gameState, location) && <LoanExpirationWarning location={location} />}

      {/* Tabs */}
      <LinearGradient colors={['#78716C', '#292524']} style={styles.navBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.navInner}>
          {Object.keys(GameTabSlugs).map((slug) => (
            <TabButton key={slug} slug={slug} isActive={gamePanel === slug.toLowerCase()} />
          ))}
        </ScrollView>
      </LinearGradient>

      {/* Location modal */}
      {isThisModalOpen && (
        <RNModal
          visible={nativeModalOpen}
          transparent
          animationType={Platform.select({ ios: 'slide', android: 'fade' })}
          onRequestClose={closeModal}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <LinearGradient colors={['#FEF3C7', '#FDE68A']} style={styles.modalGradient}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>
                    <SafeFM
                      id={`location__${location}__title`}
                      defaultMessage={UC(location)}
                      values={{ location, LOCATION: UC(location) }}
                    />
                  </Text>
                  <View style={styles.modalDivider} />
                </View>
                <Text style={styles.modalBody}>
                  <SafeFM
                    id={`location__${location}__description`}
                    defaultMessage={`Welcome to ${UC(location)}.`}
                    values={{ location, LOCATION: UC(location) }}
                  />
                </Text>
                <Pressable onPress={closeModal} style={({ pressed }) => [styles.modalCloseBtn, pressed && styles.pressed]}>
                  <LinearGradient colors={['#FCD34D', '#F59E0B']} style={styles.modalCloseBtnGradient}>
                    <Text style={styles.modalCloseText}>
                      <SafeFM id="common__close" defaultMessage="Close" />
                    </Text>
                  </LinearGradient>
                </Pressable>
              </LinearGradient>
            </View>
          </View>
        </RNModal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: { width: '100%' },
  heroContainer: { position: 'relative', width: '100%', minHeight: 170 },
  bgImage: { flex: 1, width: '100%', height: '100%', justifyContent: 'flex-start' },
  bgImageStyle: {},
  leftGradient: { position: 'absolute', top: 0, left: 0, bottom: 0, width: '35%' },
  sparklesContainer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  sparkle: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FCD34D',
    opacity: 0.7,
    shadowColor: '#FCD34D',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
  titleContainer: {
    paddingTop: 58,
    paddingBottom: 8,
    paddingHorizontal: 16,
    maxWidth: '90%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  titleWrapper: { flex: 1 },
  titleText: {
    fontSize: 52,
    lineHeight: 56,
    color: '#FCD34D',
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 3 },
    letterSpacing: -1,
  },
  subtitleText: {
    fontSize: 14,
    lineHeight: 18,
    color: '#FDE68A',
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 3,
    textShadowOffset: { width: 0, height: 1 },
    letterSpacing: 2,
    marginTop: 4,
  },
  infoButton: { marginTop: 8 },
  infoIconContainer: {
    width: 44,
    height: 44,
    marginLeft: -110,
    marginTop: 3,
    borderRadius: 22,
    backgroundColor: 'rgba(20,20,20,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FCD34D',
  },
  pressed: { opacity: 0.7, transform: [{ scale: 0.96 }] },
  quickBtn: {
    borderRadius: 9999,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  quickBtnGradient: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 9999,
    borderWidth: 2,
    borderColor: '#92400E',
  },
  quickBtnText: {
    color: '#78350F',
    fontWeight: '800',
    fontSize: 15,
    textShadowColor: 'rgba(255,255,255,0.3)',
    textShadowRadius: 1,
    textShadowOffset: { width: 0, height: 1 },
  },
  fadeOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#1f2937', opacity: 1 },
  topLeftButtons: { position: 'absolute', left: 16, top: 16, flexDirection: 'row', gap: 8 },
  topRightButton: { position: 'absolute', right: 16, top: 16, zIndex: 50, elevation: 8 }, // ensure on top
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
  closeBtnGradient: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FCD34D',
  },
  closeBtnText: { color: '#FCD34D', fontSize: 28, fontWeight: '800', lineHeight: 28, marginTop: -3 },
  bottomRightStats: { position: 'absolute', right: 5, bottom: 5, alignItems: 'flex-end' },
  statCard: { paddingHorizontal: 16, paddingVertical: 12, textAlign: 'left' },
  dateText: {
    color: '#FDE68A',
    fontSize: 12,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowRadius: 3,
    textShadowOffset: { width: 0, height: 1 },
    textAlign: 'right',
  },
  cashText: {
    color: '#FCD34D',
    fontSize: 16,
    textAlign: 'right',
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowRadius: 3,
    textShadowOffset: { width: 0, height: 1 },
  },
  netWealthText: {
    color: '#FDE68A',
    fontSize: 12,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowRadius: 3,
    textShadowOffset: { width: 0, height: 1 },
    textAlign: 'right',
  },
  compactBar: { width: '100%', paddingVertical: 5 },
  compactBarInner: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 16 },
  compactBarText: {
    color: '#FEF3C7',
    fontWeight: '800',
    fontSize: 15,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 2,
    textShadowOffset: { width: 0, height: 1 },
  },
  navBar: {
    width: '100%',
    height: 60,
    borderTopWidth: 3,
    borderBottomWidth: 3,
    borderTopColor: '#57534E',
    borderBottomColor: '#FCD34D',
  },
  navInner: { paddingHorizontal: 12, alignItems: 'center' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },
  modalGradient: {
    padding: 24,
    borderWidth: 3,
    borderColor: '#F59E0B',
    borderRadius: 20,
  },
  modalHeader: { marginBottom: 16 },
  modalTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#78350F',
    textShadowColor: 'rgba(255,255,255,0.5)',
    textShadowRadius: 1,
    textShadowOffset: { width: 0, height: 1 },
    marginBottom: 8,
  },
  modalDivider: { height: 3, backgroundColor: '#F59E0B', borderRadius: 2, width: '30%' },
  modalBody: { fontSize: 16, color: '#78350F', lineHeight: 24, marginBottom: 20 },
  modalCloseBtn: {
    alignSelf: 'center',
    borderRadius: 9999,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  modalCloseBtnGradient: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 9999,
    borderWidth: 2,
    borderColor: '#92400E',
  },
  modalCloseText: {
    color: '#78350F',
    fontWeight: '800',
    fontSize: 16,
    textShadowColor: 'rgba(255,255,255,0.3)',
    textShadowRadius: 1,
    textShadowOffset: { width: 0, height: 1 },
  },
});

export default GameHeader;
