import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
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
  const screenWidth = Dimensions.get('window').width;
  const numColumns = fieldLabels.length + (actions ? 1 : 0);
  // Calculate column width: screen width minus padding (32) divided by number of columns
  // Actions column gets 30% more space
  const baseColumnWidth = (screenWidth - 32) / (numColumns + (actions ? 0.3 : 0));
  const actionColumnWidth = actions ? baseColumnWidth * 1.3 : 0;
  const regularColumnWidth = baseColumnWidth;
  
  // Use flex for responsive width instead of fixed width
  const useFlexWidths = true;

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
    <View style={styles.table}>
        <View style={styles.header}>
          {fieldLabels.map((field) => (
            <View 
              key={field.slug} 
              style={[
                styles.headerCell, 
                useFlexWidths ? styles.headerCellFlex : { width: regularColumnWidth }
              ]}
            >
              <Text style={styles.headerText} numberOfLines={1} ellipsizeMode="tail">
                <FormattedMessage id={field.titleKey} />
              </Text>
            </View>
          ))}
          {actions && (
            <View 
              style={[
                styles.headerCell, 
                useFlexWidths ? styles.actionsHeaderCellFlex : { width: actionColumnWidth }
              ]}
            >
              <Text style={styles.headerText}>Actions</Text>
            </View>
          )}
        </View>
        {sortedData.map((row, idx) => (
          <View key={row.id || idx} style={[styles.row, idx % 2 === 0 && styles.rowEven]}>
            {fieldLabels.map((field) => {
              // Allow text wrapping for text fields (not boolean)
              const isTextField = typeof row[field.slug] !== 'boolean';
              return (
                <View 
                  key={field.slug} 
                  style={[
                    styles.cell, 
                    useFlexWidths ? styles.cellFlex : { width: regularColumnWidth }
                  ]}
                >
                  <Text style={styles.cellText} numberOfLines={isTextField ? undefined : 1}>
                    {typeof row[field.slug] === 'boolean' ? (row[field.slug] ? 'Yes' : 'No') : String(row[field.slug] || '—')}
                  </Text>
                </View>
              );
            })}
            {actions && (
              <View 
                style={[
                  styles.cell, 
                  useFlexWidths ? styles.actionsCellFlex : { width: actionColumnWidth },
                  styles.actionsCell
                ]}
              >
                {actions(row.id || String(idx))}
              </View>
            )}
          </View>
        ))}
      </View>
  );
};

const styles = StyleSheet.create({
  table: {
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    backgroundColor: '#1F2937',
    borderBottomWidth: 2,
    borderBottomColor: '#F59E0B',
  },
  headerCell: {
    padding: 12,
    minWidth: 100,
    borderRightWidth: 1,
    borderRightColor: '#374151',
  },
  headerCellFlex: {
    flex: 1,
    flexBasis: 0,
    minWidth: 80,
  },
  actionsHeaderCellFlex: {
    flexBasis: '35%',
    flexGrow: 0,
    flexShrink: 0,
    minWidth: 150,
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
    alignItems: 'stretch',
  },
  rowEven: {
    backgroundColor: '#F9FAFB',
  },
  cell: {
    padding: 12,
    minWidth: 100,
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
  },
  cellFlex: {
    flex: 1,
    flexBasis: 0,
    minWidth: 80,
    maxWidth: '100%',
  },
  actionsCellFlex: {
    flexBasis: '35%',
    flexGrow: 0,
    flexShrink: 0,
    minWidth: 150,
  },
  actionsCell: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  cellText: {
    color: '#1F2937',
    fontSize: 14,
    flexShrink: 1,
  },
});

export default Table;

