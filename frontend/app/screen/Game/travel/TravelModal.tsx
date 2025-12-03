import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal as RNModal, Platform, Pressable, ScrollView, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import DieOneDSix from './DieOneDSix';
import Button from '../common/Button';
import { FormattedMessage, useIntl } from 'react-intl';
import { Ionicons } from '@expo/vector-icons';
import { TravelState, DangerTypes } from '../types';

type Props = {
  travelState: TravelState;
  travelModalStatus: string;
  travelTransitionStatus: string;
  handleTravelContinue: () => void;
  closeModal: () => void;
  titleKey: string;
};

const getDangerIcon = (type: DangerTypes) => {
  const iconMap: { [key in DangerTypes]: { name: string; color: string } } = {
    [DangerTypes.Bandits]: { name: 'skull', color: '#DC2626' },
    [DangerTypes.RockSlide]: { name: 'cube', color: '#92400E' },
    [DangerTypes.Flood]: { name: 'water', color: '#1E40AF' },
    [DangerTypes.Wolves]: { name: 'paw', color: '#374151' },
    [DangerTypes.Tricksters]: { name: 'eye', color: '#7C3AED' },
  };
  const icon = iconMap[type] || { name: 'warning', color: '#DC2626' };
  return <Ionicons name={icon.name as any} size={64} color={icon.color} />;
};

const TravelModal: React.FC<Props> = ({
  travelState,
  travelModalStatus,
  handleTravelContinue,
  closeModal,
  titleKey,
  travelTransitionStatus,
}) => {
  const [isInitted, setIsInitted] = useState(false);
  const [scaleAnim] = useState(new Animated.Value(1));
  const [opacityAnim] = useState(new Animated.Value(1));
  const { formatMessage } = useIntl();
  const isOpening = ['opening', 'open'].includes(travelModalStatus) && isInitted;
  // Show card if modal is visible
  const showCard = travelModalStatus !== '';
  const visible = travelModalStatus !== '';

  useEffect(() => {
    setIsInitted(true);
  }, []);

  useEffect(() => {
    if (travelModalStatus === 'opening') {
      // Start from 0 and animate to 1 when opening
      scaleAnim.setValue(0);
      opacityAnim.setValue(0);
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (travelModalStatus === 'open') {
      // Ensure fully visible when open
      scaleAnim.setValue(1);
      opacityAnim.setValue(1);
    } else if (travelModalStatus === 'closing') {
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 0.5,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [travelModalStatus, scaleAnim, opacityAnim]);

  // Card wrapper should always be visible when modal is open
  const cardOpacity = travelModalStatus === 'closing' ? 0 : 1;

  return (
    <RNModal
      visible={visible}
      transparent
      animationType={Platform.select({ ios: 'slide', android: 'fade' })}
      onRequestClose={closeModal}
    >
      <View style={styles.container} testID="travel-modal">
        <Pressable
          style={[styles.backdrop, { opacity: isOpening ? 0.75 : 0 }]}
          onPress={closeModal}
          testID="travel-modal-bg-btn"
        />
        <Animated.View
          style={[
            styles.cardWrapper,
            {
              opacity: cardOpacity,
              transform: [{ scale: scaleAnim }],
            },
          ]}
          testID="travel-modal-card-wrap"
        >
          {showCard && (
            <View
              style={styles.card}
              testID="travel-modal-card"
            >
              <LinearGradient colors={['#D97706', '#B45309']} style={styles.header}>
                <Text style={styles.headerText}>
                  <FormattedMessage id={titleKey} />
                </Text>
              </LinearGradient>

              <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
                <View style={styles.content}>
                  <View style={{ marginBottom: 16 }}>
                  <Text style={styles.dayNumText}>
                    <FormattedMessage
                      id="travel__modal__day_num"
                        values={{ 
                          dayNum: travelState.progress || 1, 
                          maxDays: travelState.routeDays || 1 
                        }}
                    />
                  </Text>
                  </View>

                  {travelState.progress > 0 && (
                    <>
                  <View style={styles.diceContainer}>
                    <View style={styles.dieWrapper}>
                      <DieOneDSix value={travelState.dice.encounterCheck1} idx={0} />
                    </View>
                    <View style={styles.dieWrapper}>
                      <DieOneDSix value={travelState.dice.encounterCheck2} idx={1} />
                    </View>
                  </View>

                  <Animated.View
                    style={[
                      styles.dangerContainer,
                      {
                        opacity: travelTransitionStatus === '' ? 1 : 0,
                      },
                    ]}
                  >
                    <View style={styles.dangerContent}>
                      {travelState.danger && (
                        <View style={styles.iconContainer}>
                          {getDangerIcon(travelState.danger.type)}
                        </View>
                      )}
                      {travelState.danger && travelState.upgradeUsed && (
                        <View style={styles.iconContainer}>
                          <Ionicons name="shield-checkmark" size={64} color="#10B981" />
                        </View>
                      )}

                      <View style={styles.dangerTextContainer}>
                        {!travelState.danger ? (
                          <Text style={styles.dangerText}>
                            <FormattedMessage id="travel__modal__danger__none" />
                          </Text>
                        ) : (
                          <View>
                            <Text style={styles.dangerText}>
                              <FormattedMessage
                                id={`travel__modal__danger__${travelState.danger.type}${
                                  travelState.upgradeUsed ? '_avoided' : ''
                                }`}
                              />
                            </Text>
                            {!travelState.upgradeUsed &&
                              travelState.danger.effects.map((dangerEffect) => (
                                <Text key={dangerEffect.type} style={styles.dangerText}>
                                  <FormattedMessage
                                    id={`travel__modal__danger__effect__${dangerEffect.type}__${dangerEffect.severity}`}
                                  />{' '}
                                </Text>
                              ))}
                          </View>
                        )}
                      </View>
                    </View>
                  </Animated.View>
                    </>
                  )}

                  {travelState.progress === 0 && (
                    <View style={[styles.dangerContainer, { marginBottom: 16 }]}>
                      <Text style={styles.dangerText}>
                        <FormattedMessage 
                          id="travel__modal__ready" 
                          defaultMessage="Ready to begin your journey? Click Continue to start traveling."
                        />
                      </Text>
                    </View>
                  )}

                  <View style={[styles.buttonContainer, { marginTop: 16 }]}>
                    {travelState.progress < travelState.routeDays && (
                      <View style={styles.buttonSpacer}>
                        <Button
                          onPress={closeModal}
                          label={formatMessage({ id: 'travel__modal__btn_cancel', defaultMessage: 'Cancel' })}
                          variant="secondary"
                        />
                      </View>
                    )}
                    <Button
                      onPress={handleTravelContinue}
                      label={formatMessage({ id: 'travel__modal__btn_ok', defaultMessage: 'Continue' })}
                      variant="primary"
                    />
                  </View>
                </View>
              </ScrollView>
            </View>
          )}
        </Animated.View>
      </View>
    </RNModal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#374151',
  },
  cardWrapper: {
    width: '95%',
    maxWidth: 600,
    maxHeight: '90%',
  },
  card: {
    backgroundColor: '#E5E7EB',
    borderRadius: 8,
    borderWidth: 4,
    borderColor: '#B45309',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.9,
    shadowRadius: 10,
    elevation: 10,
    overflow: 'hidden',
    minHeight: 300,
  },
  header: {
    padding: 16,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  headerText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#F3F4F6',
    textTransform: 'uppercase',
  },
  body: {
    maxHeight: 400,
  },
  bodyContent: {
    padding: 24,
  },
  content: {
    // gap: 16, // May not be supported in all RN versions
  },
  dayNumText: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    textTransform: 'uppercase',
    color: '#1F2937',
    marginBottom: 8,
  },
  diceContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 16,
  },
  dieWrapper: {
    width: 64,
    height: 64,
  },
  dangerContainer: {
    paddingBottom: 16,
  },
  dangerContent: {
    flexDirection: 'row',
    gap: 24,
    alignItems: 'center',
  },
  iconContainer: {
    width: 96,
    height: 96,
    backgroundColor: '#D1D5DB',
    borderRadius: 12,
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dangerTextContainer: {
    flex: 1,
  },
  dangerText: {
    fontSize: 16,
    color: '#1F2937',
    lineHeight: 24,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  buttonSpacer: {
    marginRight: 16,
  },
});

export default TravelModal;
