import React from 'react';
import { Text } from 'react-native';

type CurrencyDisplayProps = { value?: number | null };

const CurrencyDisplay: React.FC<CurrencyDisplayProps> = ({ value }) => {
  const formatted =
    typeof value === 'number'
      ? new Intl.NumberFormat(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value)
      : '--';
  return <Text>{`$${formatted}`}</Text>;
};

export default CurrencyDisplay;

