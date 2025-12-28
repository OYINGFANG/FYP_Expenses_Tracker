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
          {fieldLabels.map((field, index) => {
            // Determine flex style based on column index to match data cells
            let flexStyle = styles.headerCellFlex;
            if (index === 0) {
              // Location column - smaller width
              flexStyle = styles.headerCellFlexSmall;
            } else if (index === 1) {
              // Date column - larger width
              flexStyle = styles.headerCellFlexLarge;
            } else if (index === 2) {
              // Net wealth column - extra small width
              flexStyle = styles.headerCellFlexExtraSmall;
            }
            return (
              <View 
                key={field.slug} 
                style={[styles.headerCell, useFlexWidths ? flexStyle : { width: regularColumnWidth }]}
              >
                <Text style={styles.headerText}>
                  <FormattedMessage id={field.titleKey} />
                </Text>
              </View>
            );
          })}
          {actions && (
            <View 
              style={[styles.headerCell, styles.headerCellNoBorder, useFlexWidths ? styles.actionsHeaderCellFlex : { width: actionColumnWidth }]}
            >
              <Text style={styles.headerText}>Actions</Text>
            </View>
          )}
        </View>
        {sortedData.map((row, idx) => (
          <View key={row.id || idx} style={[styles.row, idx % 2 === 0 && styles.rowEven]}>
            {fieldLabels.map((field, index) => {
              // Allow text wrapping for text fields (not boolean)
              const isTextField = typeof row[field.slug] !== 'boolean';
              // Determine flex style based on column index
              let flexStyle = styles.cellFlex;
              if (index === 0) {
                // Location column - smaller width
                flexStyle = styles.cellFlexSmall;
              } else if (index === 1) {
                // Date column - larger width
                flexStyle = styles.cellFlexLarge;
              } else if (index === 2) {
                // Net wealth column - extra small width
                flexStyle = styles.cellFlexExtraSmall;
              }
              return (
                <View 
                  key={field.slug} 
                  style={[
                    styles.cell, 
                    useFlexWidths ? flexStyle : { width: regularColumnWidth }
                  ]}
                >
                  <Text 
                    style={styles.cellText} 
                    numberOfLines={isTextField ? undefined : 1}
                    ellipsizeMode="tail"
                  >
                    {typeof row[field.slug] === 'boolean' ? (row[field.slug] ? 'Yes' : 'No') : String(row[field.slug] || '—')}
                  </Text>
                </View>
              );
            })}
            {actions && (
              <View 
                style={[
                  styles.cell, 
                  styles.cellNoBorder,
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
    width: '100%',
  },
  headerCell: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRightWidth: 1,
    borderRightColor: '#374151',
  },
  headerCellNoBorder: {
    borderRightWidth: 0,
  },
  headerCellFlex: {
    flex: 1,
    flexBasis: 0,
    minWidth: 80,
    maxWidth: '100%',
  },
  headerCellFlexLarge: {
    flex: 2.5,
    flexBasis: 0,
    minWidth: 85,
    maxWidth: '100%',
  },
  headerCellFlexSmall: {
    flex: 0.6,
    flexBasis: 0,
    minWidth: 80,
    maxWidth: '100%',
  },
  headerCellFlexExtraSmall: {
    flex: 0.4,
    flexBasis: 0,
    minWidth: 60,
    maxWidth: '100%',
  },
  actionsHeaderCellFlex: {
    flex: 1,
    flexBasis: 0,
    minWidth: 100,
    maxWidth: '100%',
  },
  headerText: {
    color: '#FDE68A',
    fontWeight: '800',
    fontSize: 12,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    alignItems: 'flex-start',
    width: '100%',
  },
  rowEven: {
    backgroundColor: '#F9FAFB',
  },
  cell: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    minWidth: 80,
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  },
  cellNoBorder: {
    borderRightWidth: 0,
  },
  cellFlex: {
    flex: 1,
    flexBasis: 0,
    minWidth: 80,
    maxWidth: '100%',
  },
  cellFlexLarge: {
    flex: 2.5,
    flexBasis: 0,
    minWidth: 85,
    maxWidth: '100%',
  },
  cellFlexSmall: {
    flex: 0.6,
    flexBasis: 0,
    minWidth: 80,
    maxWidth: '100%',
  },
  cellFlexExtraSmall: {
    flex: 0.4,
    flexBasis: 0,
    minWidth: 60,
    maxWidth: '100%',
  },
  actionsCellFlex: {
    flex: 1,
    flexBasis: 0,
    minWidth: 100,
  },
  actionsCell: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  cellText: {
    color: '#1F2937',
    fontSize: 14,
    flexShrink: 1,
    flexWrap: 'wrap',
  },
});

export default Table;

