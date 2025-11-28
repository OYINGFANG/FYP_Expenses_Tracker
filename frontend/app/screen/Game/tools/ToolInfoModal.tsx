import React from 'react';
import { View, Text, StyleSheet, Modal as RNModal, Platform, TouchableOpacity, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FormattedMessage, useIntl } from 'react-intl';
import { Ionicons } from '@expo/vector-icons';
import Button from '../common/Button';

type Props = {
  selectedItemId: string;
  closeInfoModal: () => void;
};

const ToolInfoModal: React.FC<Props> = ({ selectedItemId, closeInfoModal }) => {
  const { formatMessage } = useIntl();
  const visible = !!selectedItemId;

  return (
    <RNModal
      visible={visible}
      transparent
      animationType={Platform.select({ ios: 'slide', android: 'fade' })}
      onRequestClose={closeInfoModal}
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
              <Ionicons name="construct" size={18} color="#FEF3C7" style={{ marginRight: 10 }} />
              <Text style={styles.title}>
                {selectedItemId ? (
                  <FormattedMessage id={`upgrades__${selectedItemId}__title`} />
                ) : (
                  '—'
                )}
              </Text>
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={closeInfoModal}
              style={styles.closeBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={18} color="#FEF3C7" />
            </TouchableOpacity>
          </LinearGradient>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            <View style={styles.iconContainer}>
              <Ionicons name="construct" size={80} color="#F59E0B" />
            </View>
            <View style={styles.descriptionContainer}>
              <Text style={styles.description}>
                <FormattedMessage id={`upgrades__${selectedItemId}__description`} />
              </Text>
            </View>
            <View style={styles.buttonContainer}>
              <Button
                variant="primary"
                label={formatMessage({ id: 'ok', defaultMessage: 'OK' })}
                onPress={closeInfoModal}
              />
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
    // gap: 10, // May not be supported in all RN versions
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
  iconContainer: {
    width: 160,
    height: 160,
    backgroundColor: '#D1D5DB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
  },
  descriptionContainer: {
    marginBottom: 24,
  },
  description: {
    fontSize: 16,
    color: '#1F2937',
    lineHeight: 24,
  },
  buttonContainer: {
    alignItems: 'center',
  },
});

export default ToolInfoModal;
