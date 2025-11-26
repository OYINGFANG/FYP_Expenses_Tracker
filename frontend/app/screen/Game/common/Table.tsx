import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { FormattedMessage, useIntl } from 'react-intl';
import { TableFieldLabel } from '../types';

type TableProps = {
  data: any[];
  fieldLabels: TableFieldLabel[];
  actions?: (id: string) => React.ReactNode;
  sortField?: string;
  sortDir?: 'asc' | 'desc';
};

const Table: React.FC<TableProps> = ({ data, fieldLabels, actions, sortField, sortDir = 'asc' }) => {
  const { formatMessage } = useIntl();

  const sortedData = React.useMemo(() => {
    if (!sortField) return data;
    return [...data].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (sortDir === 'asc') {
        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      } else {
        return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
      }
    });
  }, [data, sortField, sortDir]);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={styles.table}>
        <View style={styles.header}>
          {fieldLabels.map((field) => (
            <View key={field.slug} style={styles.headerCell}>
              <Text style={styles.headerText}>
                <FormattedMessage id={field.titleKey} />
              </Text>
            </View>
          ))}
          {actions && <View style={styles.headerCell}><Text style={styles.headerText}>Actions</Text></View>}
        </View>
        {sortedData.map((row, idx) => (
          <View key={row.id || idx} style={[styles.row, idx % 2 === 0 && styles.rowEven]}>
            {fieldLabels.map((field) => (
              <View key={field.slug} style={styles.cell}>
                <Text style={styles.cellText}>
                  {typeof row[field.slug] === 'boolean' ? (row[field.slug] ? 'Yes' : 'No') : String(row[field.slug] || '—')}
                </Text>
              </View>
            ))}
            {actions && (
              <View style={styles.cell}>
                {actions(row.id || String(idx))}
              </View>
            )}
          </View>
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  table: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    backgroundColor: '#1F2937',
    borderBottomWidth: 2,
    borderBottomColor: '#F59E0B',
  },
  headerCell: {
    padding: 12,
    minWidth: 120,
    borderRightWidth: 1,
    borderRightColor: '#374151',
  },
  headerText: {
    color: '#FDE68A',
    fontWeight: '800',
    fontSize: 14,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  rowEven: {
    backgroundColor: '#F9FAFB',
  },
  cell: {
    padding: 12,
    minWidth: 120,
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
    justifyContent: 'center',
  },
  cellText: {
    color: '#1F2937',
    fontSize: 14,
  },
});

export default Table;

