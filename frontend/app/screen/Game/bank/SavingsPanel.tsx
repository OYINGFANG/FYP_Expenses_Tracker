import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FormattedMessage, useIntl } from 'react-intl';
import { Slices } from '../store/gameSlice';
import { Loan } from '../types';
import { useGameSliceSelector, useGameSliceDispatch } from '../store/reduxHooks';
import { setModalStatus, setCurrentModal } from '../store/gameSlice';
import CurrencyDisplay from '../common/CurrencyDisplay';
import Button from '../common/Button';
import BankAmountModal from './BankAmountModal';

const SavingsPanel = () => {
  const { gameState, modalStatus, currentModal } = useGameSliceSelector(
    (state: Slices) => state.game,
  );
  const { formatMessage } = useIntl();
  const { cash, loans, savings, netWealth } = gameState;
  const loansTotal = loans.reduce((acc: number, val: Loan) => acc + val.principal, 0);
  const dispatch = useGameSliceDispatch();
  const isModalOpen = ['deposit', 'withdrawal'].includes(currentModal) && modalStatus !== 'closed';
  const handleOpenModal = (modalSlug: string) => {
    dispatch(setCurrentModal(modalSlug));
    dispatch(setModalStatus('opening'));
    setTimeout(() => {
      dispatch(setModalStatus('open'));
    }, 510);
  };

  return (
    <View style={styles.container} testID="savings-panel">
      <View style={styles.explainerContainer}>
        <Text style={styles.explainerText}>
          <FormattedMessage id="bank__savings__explainer" />
        </Text>
      </View>
      <View style={styles.buttonContainer}>
        <Button
          variant="primary"
          label={formatMessage({ id: 'bank__savings__deposit_btn', defaultMessage: 'Deposit' })}
          onPress={() => handleOpenModal('deposit')}
        />
        <Button
          variant="primary"
          label={formatMessage({ id: 'bank__savings__withdrawal_btn', defaultMessage: 'Withdraw' })}
          onPress={() => handleOpenModal('withdrawal')}
        />
      </View>
      <View style={styles.contentContainer}>
        <View style={styles.savingsCard}>
          <Text style={styles.savingsLabel}>
            <FormattedMessage id="bank__savings__current_savings" />
          </Text>
          <Text style={styles.savingsAmount}>
            <CurrencyDisplay value={savings} />
          </Text>
        </View>

        <View style={styles.calcContainer}>
          <View style={styles.calcItem}>
            <Text style={styles.calcLabel}>
              <FormattedMessage id="bank__savings__calc__cash" />
            </Text>
            <Text style={styles.calcValue}>
              <CurrencyDisplay value={cash} />
            </Text>
          </View>
          <Text style={styles.calcOperator}>+</Text>
          <View style={styles.calcItem}>
            <Text style={styles.calcLabel}>
              <FormattedMessage id="bank__savings__calc__savings" />
            </Text>
            <Text style={styles.calcValue}>
              <CurrencyDisplay value={savings} />
            </Text>
          </View>
          <Text style={styles.calcOperator}>-</Text>
          <View style={styles.calcItem}>
            <Text style={styles.calcLabel}>
              <FormattedMessage id="bank__savings__calc__loans" />
            </Text>
            <Text style={styles.calcValue}>
              <CurrencyDisplay value={loansTotal} />
            </Text>
          </View>
          <Text style={styles.calcOperator}>=</Text>
          <View style={styles.calcItem}>
            <Text style={styles.calcLabel}>
              <FormattedMessage id="bank__savings__calc__net_wealth" />
            </Text>
            <Text style={[styles.calcValue, styles.calcValueBold]}>
              <CurrencyDisplay value={netWealth} />
            </Text>
          </View>
        </View>
      </View>
      {isModalOpen && <BankAmountModal />}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  explainerContainer: {
    marginBottom: 14,
  },
  explainerText: {
    color: '#FDE68A',
    fontSize: 14,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 15,
    paddingBottom: 14,
  },
  contentContainer: {
    paddingBottom: 48,
  },
  savingsCard: {
    paddingHorizontal: 48,
    paddingVertical: 15,
    backgroundColor: '#1F2937',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#6B7280',
    marginBottom: 24,
  },
  savingsLabel: {
    textAlign: 'center',
    fontSize: 20,
    textTransform: 'uppercase',
    color: '#FDE68A',
    paddingBottom: 8,
  },
  savingsAmount: {
    textAlign: 'center',
    fontSize: 48,
    color: '#FDE68A',
    fontWeight: '800',
  },
  calcContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  calcItem: {
    alignItems: 'center',
    minWidth: 80,
  },
  calcLabel: {
    fontSize: 18,
    textTransform: 'uppercase',
    color: '#FDE68A',
    marginBottom: 4,
  },
  calcValue: {
    fontSize: 24,
    color: '#FDE68A',
  },
  calcValueBold: {
    fontWeight: '800',
  },
  calcOperator: {
    fontSize: 24,
    color: '#FDE68A',
    textAlign: 'center',
  },
});

export default SavingsPanel;
