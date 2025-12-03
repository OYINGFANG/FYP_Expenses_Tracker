import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Modal as RNModal, Platform, TouchableOpacity, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useGameSliceSelector, useGameSliceDispatch } from '../store/reduxHooks';
import { Slices } from '../store/gameSlice';
import {
  setModalStatus,
  setCurrentModal,
  processBankDepositWithdrawal,
  makeLoanPayment,
} from '../store/gameSlice';
import { FormattedMessage, useIntl } from 'react-intl';
import Button from '../common/Button';
import { getLoanByLocation } from '../utils/utils';

const BankAmountModal = () => {
  const [amt, setAmt] = useState<string>('0');
  const { currentModal, gameState } = useGameSliceSelector((state: Slices) => state.game);
  const dispatch = useGameSliceDispatch();
  const { formatMessage } = useIntl();
  const { savings, cash, location, loans } = gameState;
  const isDeposit = currentModal === 'deposit';
  let maxAmt = 0;
  const selectedLoan = getLoanByLocation(loans, location);
  switch (currentModal) {
    case 'loanpayment':
      if (selectedLoan) {
        maxAmt = Math.min(selectedLoan.principal, cash);
      }
      break;
    case 'withdrawal':
      maxAmt = savings;
      break;
    default:
    case 'deposit':
      maxAmt = cash;
      break;
  }
  const handleAmtChange = (text: string) => {
    const val = parseInt(text) || 0;
    const clampedVal = Math.max(Math.min(val, maxAmt), 0);
    setAmt(clampedVal.toString());
  };

  const handleAmtClose = () => {
    dispatch(setModalStatus('closing'));
    setTimeout(() => {
      dispatch(setCurrentModal(''));
      dispatch(setModalStatus('closed'));
    }, 510);
  };
  const handleConfirmAmt = (amount: number) => {
    if (currentModal === 'loanpayment') {
      dispatch(makeLoanPayment(amount));
    } else {
      dispatch(processBankDepositWithdrawal(isDeposit ? amount : -1 * amount));
    }
    handleAmtClose();
  };

  const visible = ['deposit', 'withdrawal', 'loanpayment'].includes(currentModal);
  const numAmt = parseInt(amt) || 0;

  return (
    <RNModal
      visible={visible}
      transparent
      animationType={Platform.select({ ios: 'slide', android: 'fade' })}
      onRequestClose={handleAmtClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <LinearGradient
            colors={['#F59E0B', '#D97706']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.header}
          >
            <View style={styles.headerLeft}>
              <Ionicons name="cash" size={18} color="#FEF3C7" />
              <Text style={styles.title}>
                <FormattedMessage id={`bank__amount_modal__title__${currentModal}`} />
              </Text>
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={handleAmtClose}
              style={styles.closeBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={18} color="#FEF3C7" />
            </TouchableOpacity>
          </LinearGradient>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            <View style={styles.content} testID={`bank-amount-modal-${currentModal}`}>
              <View style={[styles.inputContainer, { marginBottom: 16 }]}>
                <TextInput
                  testID="bank-amount-input"
                  style={styles.input}
                  value={amt}
                  onChangeText={handleAmtChange}
                  keyboardType="numeric"
                  placeholder="0"
                />
              </View>

              <View style={{ marginBottom: 16 }}>
              <Text style={styles.explainer} testID={`explainer-${currentModal}`}>
                <FormattedMessage
                  id={`bank__amount_modal__explainer__${currentModal}`}
                  values={{ maxAmt }}
                />
              </Text>
              </View>
              <View style={[styles.buttonContainer, { marginTop: 16 }]}>
                <View style={styles.buttonSpacer}>
                  <Button
                    label={formatMessage({ id: 'cancel', defaultMessage: 'Cancel' })}
                    variant="secondary"
                    onPress={handleAmtClose}
                  />
                </View>
                {maxAmt > 1 && (
                  <View style={styles.buttonSpacer}>
                    <Button
                      variant="primary"
                      label={formatMessage({ id: 'max', defaultMessage: 'Max: {labelValue}' }, { labelValue: maxAmt })}
                      onPress={() => handleConfirmAmt(maxAmt)}
                    />
                  </View>
                )}
                {maxAmt > 0 && numAmt > 0 && (
                  <View style={styles.buttonSpacer}>
                  <Button
                    variant="primary"
                    label={formatMessage({ id: 'ok', defaultMessage: 'OK' })}
                    onPress={() => handleConfirmAmt(numAmt)}
                  />
                  </View>
                )}
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </RNModal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FEF3C7',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
    minHeight: 300,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FEF3C7',
    textTransform: 'uppercase',
  },
  closeBtn: {
    padding: 4,
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
  inputContainer: {
    // marginBottom handled inline
  },
  input: {
    padding: 16,
    fontSize: 20,
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#F59E0B',
  },
  explainer: {
    fontSize: 16,
    fontStyle: 'italic',
    color: '#1F2937',
    // paddingBottom handled inline
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    // gap: 12, // May not be supported in all RN versions
  },
  buttonSpacer: {
    marginRight: 16,
  },
});

export default BankAmountModal;
