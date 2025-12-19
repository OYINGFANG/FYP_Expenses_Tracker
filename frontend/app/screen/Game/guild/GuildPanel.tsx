import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useGameSliceSelector, useGameSliceDispatch } from '../store/reduxHooks';
import { Slices, purchaseGuildMembership } from '../store/gameSlice';
import { Locations } from '../types';
import { FormattedMessage } from 'react-intl';
import CurrencyDisplay from '../common/CurrencyDisplay';
import { getGuildBenefitsByLocation } from '../utils/utils';
import guildsData from '../data/guildsData';
import { Ionicons } from '@expo/vector-icons';
import Button from '../common/Button';

const GuildPanel = () => {
  const { gameState } = useGameSliceSelector((state: Slices) => state.game);
  const { location, flags } = gameState;
  const dispatch = useGameSliceDispatch();
  const guildMemberships: string[] = [];
  Object.keys(Locations).forEach((guildLocation) => {
    if (flags[`guild__${guildLocation.toLowerCase()}`]) {
      guildMemberships.push(guildLocation);
    }
  });
  const isMemberOfLocalGuild = flags[`guild__${location}`];
  const benefits = getGuildBenefitsByLocation(location);
  // Normalize location key to match guildsData keys
  // Map 'kl' to 'Kuala_Lumpur' to match guildsData structure
  const locationKeyMap: { [key: string]: string } = {
    'kl': 'Kuala_Lumpur',
  };
  const normalizedLocation = locationKeyMap[location.toLowerCase()] || location.toLowerCase();
  const guildData = guildsData[normalizedLocation as keyof typeof guildsData];
  const membershipPrice = guildData?.price ?? 0;
  const canAfford = gameState.cash >= membershipPrice;
  const handlePurchaseMembership = () => {
    dispatch(purchaseGuildMembership(location));
  };
  return (
    <ScrollView style={styles.container} testID="guild-panel">
      <View style={styles.content}>
        <View style={styles.explainerContainer}>
          <Text style={styles.explainerText}>
            <FormattedMessage id="guild__explainer" />
          </Text>
        </View>

        <View style={styles.benefitsCard}>
          <View style={styles.benefitsContent}>
            <View style={styles.benefitsLeft}>
              <Text style={styles.benefitsTitle}>
                <FormattedMessage id="bank__loans__offer__headline" values={{ location }} />
              </Text>
              <View style={styles.benefitsList}>
                <View style={styles.benefitItem}>
                  <Text style={styles.benefitLabel}>
                    <FormattedMessage id="guild__local_benefits__items_title" />
                  </Text>
                  {benefits.exclusiveItems.length === 0 ? (
                    <Text style={styles.benefitText}>
                      <FormattedMessage id="guild__local_benefits_none" />
                    </Text>
                  ) : (
                    <Text style={styles.benefitText}>
                      {benefits.exclusiveItems.map((id, idx) => (
                        <React.Fragment key={id}>
                          {idx > 0 && ', '}
                          <FormattedMessage id={`items__${id}__title`} />
                        </React.Fragment>
                      ))}
                    </Text>
                  )}
                </View>
                <View style={styles.benefitItem}>
                  <Text style={styles.benefitLabel}>
                    <FormattedMessage id="guild__local_benefits__upgrades_title" />
                  </Text>
                  {benefits.exclusiveUpgrades.length === 0 ? (
                    <Text style={styles.benefitText}>
                      <FormattedMessage id="guild__local_benefits_none" />
                    </Text>
                  ) : (
                    <Text style={styles.benefitText}>
                      {benefits.exclusiveUpgrades.map((id, idx) => (
                        <React.Fragment key={id}>
                          {idx > 0 && ', '}
                          <FormattedMessage id={`upgrades__${id}__title`} />
                        </React.Fragment>
                      ))}
                    </Text>
                  )}
                </View>
                <View style={styles.benefitItem}>
                  <Text style={styles.benefitLabel}>
                    <FormattedMessage id="guild__local_benefits__loan_title" />
                  </Text>
                  <Text style={styles.benefitText}>
                    <FormattedMessage id={benefits.exclusiveLoan ? 'yes' : 'no'} />
                  </Text>
                </View>
              </View>
            </View>
            <View style={styles.benefitsRight}>
              <View style={styles.iconContainer}>
                <Ionicons 
                  name={isMemberOfLocalGuild ? "shield-checkmark" : "shield-outline"} 
                  size={64} 
                  color={isMemberOfLocalGuild ? "#10B981" : "#6B7280"} 
                />
              </View>

              {isMemberOfLocalGuild ? (
                <View style={styles.memberContainer}>
                  <Text style={styles.memberText}>
                    <FormattedMessage id="guild__member" />
                  </Text>
                </View>
              ) : (
                <View style={styles.purchaseContainer}>
                  <Text style={styles.purchaseTitle}>
                    <FormattedMessage id="guild__local_benefits__cta" />
                  </Text>
                  <Text style={styles.purchasePrice}>
                    <CurrencyDisplay value={membershipPrice} />
                  </Text>
                  <Button
                    label="Purchase Membership"
                    variant="primary"
                    onPress={handlePurchaseMembership}
                    disabled={!canAfford}
                  />
                </View>
              )}
            </View>
          </View>
        </View>

        <View style={styles.membershipsContainer}>
          <Text style={styles.membershipsTitle}>
            <FormattedMessage id="guild__memberships_list__title" />
          </Text>
          {guildMemberships.length === 0 ? (
            <Text style={styles.noMembershipsText}>
              <FormattedMessage id="guild__memberships_list__none" />
            </Text>
          ) : (
            <View style={styles.membershipsList}>
              {guildMemberships.map((membershipLocation) => (
                <View key={membershipLocation} style={styles.membershipItem}>
                  <Text style={styles.membershipText}>{membershipLocation}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  explainerContainer: {
    paddingBottom: 24,
  },
  explainerText: {
    color: '#FDE68A',
    fontSize: 14,
  },
  benefitsCard: {
    textAlign: 'center',
    paddingHorizontal: 48,
    paddingVertical: 16,
    backgroundColor: '#1F2937',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#6B7280',
    marginBottom: 24,
  },
  benefitsContent: {
    flexDirection: 'row',
    gap: 24,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  benefitsLeft: {
    flex: 1,
    minWidth: 200,
  },
  benefitsTitle: {
    fontSize: 30,
    textTransform: 'uppercase',
    color: '#FDE68A',
    marginBottom: 8,
  },
  benefitsList: {
    gap: 16,
  },
  benefitItem: {
    marginBottom: 16,
  },
  benefitLabel: {
    fontWeight: '800',
    color: '#FDE68A',
    fontSize: 16,
    marginBottom: 4,
  },
  benefitText: {
    color: '#FDE68A',
    fontSize: 14,
  },
  benefitsRight: {
    flex: 1,
    minWidth: 200,
    alignItems: 'center',
  },
  iconContainer: {
    width: 96,
    height: 96,
    marginBottom: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberContainer: {
    alignItems: 'center',
  },
  memberText: {
    color: '#FDE68A',
    fontSize: 16,
    fontWeight: '600',
  },
  purchaseContainer: {
    alignItems: 'center',
  },
  purchaseTitle: {
    color: '#FDE68A',
    fontSize: 16,
    marginBottom: 16,
  },
  purchasePrice: {
    fontSize: 30,
    fontWeight: '800',
    color: '#FDE68A',
    marginBottom: 16,
  },
  membershipsContainer: {
    marginTop: 16,
  },
  membershipsTitle: {
    fontSize: 24,
    fontWeight: '800',
    textTransform: 'uppercase',
    color: '#FDE68A',
    marginBottom: 16,
  },
  noMembershipsText: {
    color: '#FDE68A',
    fontSize: 14,
  },
  membershipsList: {
    gap: 8,
  },
  membershipItem: {
    padding: 8,
  },
  membershipText: {
    color: '#FDE68A',
    fontSize: 14,
  },
});

export default GuildPanel;
