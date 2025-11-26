import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FormattedMessage } from 'react-intl';

type Props = {
  location: string;
};

const LoanExpirationWarning: React.FC<Props> = ({ location }) => {
  const locationUpper = useMemo(() => (location ?? '').toUpperCase(), [location]);

  return (
    <View
      style={styles.wrapper}
      testID="loan-expiration-warning-message"
      accessibilityRole="alert"
    >
      <View style={styles.inner}>
        <Text style={styles.title}>
          <FormattedMessage id="loans__loan_expired_warning_title" />
        </Text>

        <Text style={styles.body}>
          <FormattedMessage
            id="loans__loan_expired_warning_description"
            values={{ location: locationUpper }}
          />
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: '#7f1d1d', // approx: from-red-800
    paddingVertical: 24,         // py-6
    paddingHorizontal: 16,       // px-4
    borderTopWidth: 2,           // border-t-2
    borderTopColor: '#f97316',   // border-orange-500
  },
  inner: {
    width: '100%',
    alignSelf: 'center',         // like mx-auto
    maxWidth: 1200,
  },
  title: {
    color: '#e5e7eb',            // text-gray-200
    fontSize: 20,                // ~text-2xl
    fontWeight: '800',           // font-bold
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  body: {
    color: '#e5e7eb',            // text-gray-200
    fontSize: 18,                // text-xl
  },
});

export default LoanExpirationWarning;
