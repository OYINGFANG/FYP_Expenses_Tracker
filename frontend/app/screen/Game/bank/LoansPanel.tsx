import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Slices } from '../store/gameSlice';
import { useGameSliceSelector, useGameSliceDispatch } from '../store/reduxHooks';
import { FormattedMessage, useIntl } from 'react-intl';
import CurrencyDisplay from '../common/CurrencyDisplay';
import { TableFieldLabel } from '../types';
import { acceptLoanOffer, setCurrentModal, setModalStatus } from '../store/gameSlice';
import loansData from '../data/loansData';
import Table from '../common/Table';
import { getHasLocalLoan, getHasOverdueLoanForLocation } from '../utils/utils';
import Button from '../common/Button';
import { Ionicons } from '@expo/vector-icons';
import BankAmountModal from './BankAmountModal';

const LoansPanel = () => {
  const { gameState, currentModal, modalStatus } = useGameSliceSelector(
    (state: Slices) => state.game,
  );
  const { loans, location, numTurns } = gameState;
  const { formatMessage } = useIntl();
  const dispatch = useGameSliceDispatch();
  const hasLocalLoan = getHasLocalLoan(loans, location);
  const currentLoans = loans.map((loan) => ({
    id: formatMessage({ id: `location__${loan.location}__title` }),
    principal: loan.principal,
    due: Math.max(loan.dueDate - numTurns, 0),
  }));
  const shouldShowLoansList = currentLoans.length > 0;
  const fieldLabels: TableFieldLabel[] = [
    { slug: 'id', titleKey: 'bank__loans__loans_list__table__location' },
    { slug: 'principal', titleKey: 'bank__loans__loans_list__table__principal' },
    { slug: 'due', titleKey: 'bank__loans__loans_list__table__due' },
  ];
  const handleAcceptLoanOfferClick = () => {
    dispatch(acceptLoanOffer(location));
  };

  const handlePayLoanModalOpen = () => {
    dispatch(setCurrentModal('loanpayment'));
    dispatch(setModalStatus('opening'));
    setTimeout(() => {
      dispatch(setModalStatus('open'));
    }, 510);
  };

  const loansTableActions = (id: string) => (
    <View style={styles.tableActions}>
      {id.toLowerCase() === location && (
        <View style={styles.actionButtonWrapper}>
          <Button
            onPress={handlePayLoanModalOpen}
            label={formatMessage({ id: 'bank__loans__loans_list__btn_pay', defaultMessage: 'Pay' })}
            variant="secondary"
          />
        </View>
      )}
      {getHasOverdueLoanForLocation(gameState, id.toLowerCase()) && (
        <View style={styles.warningIcon} accessibilityLabel="This loan has expired">
          <Ionicons name="warning" size={44} color="#DC2626" />
        </View>
      )}
    </View>
  );
  const isModalOpen = currentModal === 'loanpayment' && modalStatus !== 'closed';
  const localLoan = loansData[location];
  return (
    <ScrollView style={styles.container} testID="loans-panel">
      <View style={styles.explainerContainer}>
        <Text style={styles.explainerText}>
          <FormattedMessage id="bank__loans__explainer" />
        </Text>
      </View>

      <View style={styles.content}>
        {!hasLocalLoan && (
          <View style={styles.offerCard}>
            <View style={styles.offerContent}>
              <View style={styles.offerLeft}>
                <Text style={styles.offerTitle}>
                  <FormattedMessage id="bank__loans__offer__headline" values={{ location }} />
                </Text>
                {!localLoan.guildOnly && (
                  <Text style={styles.offerSubtitle}>
                    (<FormattedMessage id="bank__loans__offer__guild_only" />)
                  </Text>
                )}
                <View style={styles.offerTextContainer}>
                  <Text style={styles.offerText}>
                    <FormattedMessage id="bank__loans__offer__text1" />
                  </Text>
                  <Text style={styles.offerTextBold}>
                    <CurrencyDisplay value={localLoan.amount} />
                  </Text>
                  <Text style={styles.offerText}>
                    <FormattedMessage id="bank__loans__offer__text2" />
                  </Text>
                  <Text style={styles.offerTextBold}>
                    <CurrencyDisplay value={localLoan.markup} />.
                  </Text>
                  <Text style={styles.offerText}>
                    <FormattedMessage id="bank__loans__offer__text3" />{' '}
                    <Text style={styles.offerTextBold}>
                      <FormattedMessage
                        id="bank__loans__offer__text4"
                        values={{ term: localLoan.term }}
                      />
                    </Text>{' '}
                    <FormattedMessage id="bank__loans__offer__text5" />
                  </Text>
                </View>
              </View>
              <View style={styles.offerRight}>
                <View style={styles.loanDetails}>
                  <View style={styles.loanDetailItem}>
                    <Text style={styles.loanDetailLabel}>Loan Amount</Text>
                    <Text style={styles.loanDetailValue}>
                      <CurrencyDisplay value={localLoan.amount} />
                    </Text>
                  </View>
                  <View style={styles.loanDetailItem}>
                    <Text style={styles.loanDetailLabel}>Markup</Text>
                    <Text style={styles.loanDetailValue}>
                      <CurrencyDisplay value={localLoan.markup} />
                    </Text>
                  </View>
                  <View style={styles.loanDetailItem}>
                    <Text style={styles.loanDetailLabel}>Loan Term (Days)</Text>
                    <Text style={styles.loanDetailValue}>{localLoan.term}</Text>
                  </View>
                </View>
                <View style={styles.acceptButtonContainer}>
                  <Button
                    label={formatMessage({ id: 'bank__loans__offer__btn_ok', defaultMessage: 'Accept' })}
                    variant="primary"
                    onPress={handleAcceptLoanOfferClick}
                  />
                </View>
              </View>
            </View>
          </View>
        )}
        <View style={styles.loansListContainer}>
          <Text style={styles.loansListTitle}>
            <FormattedMessage id="bank__loans__loans_list__title" />
          </Text>
          {shouldShowLoansList ? (
            <View style={styles.tableContainer}>
              <Table
                data={currentLoans}
                fieldLabels={fieldLabels}
                actions={loansTableActions}
                sortField="id"
                sortDir="asc"
              />
            </View>
          ) : (
            <View style={styles.noLoansContainer}>
              <Text style={styles.noLoansText}>
                <FormattedMessage id="bank__loans__loans_list__no_loans" />
              </Text>
            </View>
          )}
        </View>
      </View>
      {isModalOpen && <BankAmountModal />}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  explainerContainer: {
    marginBottom: 24,
  },
  explainerText: {
    color: '#FDE68A',
    fontSize: 14,
  },
  content: {
    paddingBottom: 24,
  },
  offerCard: {
    textAlign: 'center',
    paddingHorizontal: 48,
    paddingVertical: 16,
    backgroundColor: '#1F2937',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#6B7280',
    marginBottom: 24,
  },
  offerContent: {
    flexDirection: 'row',
    gap: 24,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  offerLeft: {
    flex: 1,
    minWidth: 200,
  },
  offerTitle: {
    fontSize: 30,
    textTransform: 'uppercase',
    color: '#FDE68A',
    marginBottom: 8,
  },
  offerSubtitle: {
    fontStyle: 'italic',
    fontSize: 18,
    color: '#FDE68A',
    marginBottom: 12,
  },
  offerTextContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  offerText: {
    fontSize: 14,
    color: '#FDE68A',
  },
  offerTextBold: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FDE68A',
    marginHorizontal: 8,
  },
  offerRight: {
    flex: 1,
    minWidth: 200,
  },
  loanDetails: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 24,
    alignItems: 'flex-end',
    flexWrap: 'wrap',
  },
  loanDetailItem: {
    alignItems: 'center',
  },
  loanDetailLabel: {
    textTransform: 'uppercase',
    color: '#FDE68A',
    fontSize: 12,
    marginBottom: 4,
  },
  loanDetailValue: {
    fontWeight: '800',
    fontSize: 30,
    color: '#FDE68A',
  },
  acceptButtonContainer: {
    alignItems: 'center',
  },
  loansListContainer: {
    marginTop: 16,
  },
  loansListTitle: {
    fontSize: 20,
    fontWeight: '800',
    textTransform: 'uppercase',
    color: '#FDE68A',
    marginBottom: 16,
  },
  tableContainer: {
    backgroundColor: '#F3F4F6',
    marginBottom: 48,
  },
  noLoansContainer: {
    padding: 16,
  },
  noLoansText: {
    color: '#FDE68A',
    fontSize: 14,
  },
  tableActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButtonWrapper: {
    marginRight: 16,
  },
  warningIcon: {
    width: 44,
    height: 44,
  },
});

export default LoansPanel;
