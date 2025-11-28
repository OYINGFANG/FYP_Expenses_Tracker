import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal as RNModal,
  Platform,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FormattedMessage, useIntl } from 'react-intl';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useGameSliceDispatch } from '../store/reduxHooks';
import { loadSavedGame } from '../store/gameSlice';
import { getLocalSavesList, getLocalGameSave, deleteSaveItem } from '../utils/saveLoadUtils';
import { GameSaveListItem } from '../types';
import Table from '../common/Table';
import { TableFieldLabel } from '../types';

type Props = {
  visible: boolean;
  onClose: () => void;
};

const SavedGameModal: React.FC<Props> = ({ visible, onClose }) => {
  const [savesList, setSavesList] = useState<GameSaveListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const dispatch = useGameSliceDispatch();
  const router = useRouter();
  const { formatMessage } = useIntl();

  useEffect(() => {
    if (visible) {
      loadSavesList();
    }
  }, [visible]);

  const loadSavesList = async () => {
    setIsLoading(true);
    try {
      const saves = await getLocalSavesList();
      // Saves should already be sorted by newest first from saveLoadUtils
      // But we'll ensure they're sorted here as well
      const sortedSaves = [...saves].sort((a, b) => {
        // Sort by modifiedAt string in descending order (newest first)
        return b.modifiedAt.localeCompare(a.modifiedAt);
      });
      setSavesList(sortedSaves);
    } catch (err) {
      console.error('Error loading saves list', err);
      setSavesList([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadGame = async (gameId: string) => {
    try {
      const gameState = await getLocalGameSave(gameId);
      if (gameState) {
        dispatch(loadSavedGame(gameState));
        onClose();
        router.replace('/screen/Game/GamePage');
      } else {
        Alert.alert('Error', 'Failed to load saved game.');
        loadSavesList(); // Refresh list
      }
    } catch (err) {
      console.error('Error loading game', err);
      Alert.alert('Error', 'Failed to load saved game.');
    }
  };

  const handleDeleteGame = (gameId: string) => {
    Alert.alert(
      formatMessage({ id: 'title_page__saved_game_modal__btn_delete', defaultMessage: 'Delete' }),
      'Are you sure you want to delete this saved game?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteSaveItem(gameId);
            loadSavesList();
          },
        },
      ]
    );
  };

  const tableActions = (id: string) => (
    <View style={styles.tableActions}>
      <TouchableOpacity
        style={styles.actionButton}
        onPress={() => handleLoadGame(id)}
        activeOpacity={0.7}
      >
        <LinearGradient colors={['#FCD34D', '#F59E0B']} style={styles.actionButtonGradient}>
          <Ionicons name="play" size={12} color="#78350F" />
          <Text style={styles.actionButtonText}>
            <FormattedMessage id="title_page__saved_game_modal__btn_load" defaultMessage="Load" />
          </Text>
        </LinearGradient>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.actionButton, styles.deleteButton]}
        onPress={() => handleDeleteGame(id)}
        activeOpacity={0.7}
      >
        <Ionicons name="trash" size={12} color="#DC2626" />
        <Text style={styles.deleteButtonText}>
          <FormattedMessage id="title_page__saved_game_modal__btn_delete" defaultMessage="Delete" />
        </Text>
      </TouchableOpacity>
    </View>
  );

  const fieldLabels: TableFieldLabel[] = [
    { slug: 'location', titleKey: 'title_page__saved_game_modal__table_field__location' },
    { slug: 'modifiedAt', titleKey: 'title_page__saved_game_modal__table_field__dateModified' },
    { slug: 'netWealth', titleKey: 'title_page__saved_game_modal__table_field__netWealth' },
  ];

  const adaptedSavesList = savesList.map((save) => ({
    ...save,
    netWealth: `$${new Intl.NumberFormat().format(save.netWealth)}`,
  }));

  return (
    <RNModal
      visible={visible}
      transparent
      animationType={Platform.select({ ios: 'slide', android: 'fade' })}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <LinearGradient colors={['#F59E0B', '#D97706']} style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="folder" size={18} color="#FEF3C7" />
              <Text style={styles.title}>
                <FormattedMessage id="title_page__saved_game_modal__title" defaultMessage="Saved Games" />
              </Text>
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={onClose}
              style={styles.closeBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={18} color="#FEF3C7" />
            </TouchableOpacity>
          </LinearGradient>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Loading...</Text>
              </View>
            ) : savesList.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  <FormattedMessage
                    id="title_page__saved_game_modal__no_results"
                    defaultMessage="You have no local saves currently. Please start a new game."
                  />
                </Text>
              </View>
            ) : (
              <View style={styles.tableWrapper}>
                <View style={styles.tableContainer}>
                  <Table data={adaptedSavesList} fieldLabels={fieldLabels} actions={tableActions} />
                </View>
              </View>
            )}
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
    maxWidth: 600,
    backgroundColor: '#FEF3C7',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
    minHeight: 300,
    maxHeight: '80%',
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
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FEF3C7',
    textTransform: 'uppercase',
    marginLeft: 10,
  },
  closeBtn: {
    padding: 4,
  },
  body: {
    maxHeight: 500,
  },
  bodyContent: {
    padding: 16,
    width: '100%',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#1F2937',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#1F2937',
    textAlign: 'center',
    lineHeight: 24,
  },
  tableWrapper: {
    width: '100%',
    overflow: 'hidden',
  },
  tableContainer: {
    backgroundColor: '#F3F4F6',
    width: '100%',
    overflow: 'hidden',
  },
  tableActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    width: '100%',
    justifyContent: 'flex-start',
  },
  actionButton: {
    borderRadius: 6,
    overflow: 'hidden',
    flexShrink: 0,
  },
  actionButtonGradient: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#92400E',
    minWidth: 50,
  },
  actionButtonText: {
    color: '#78350F',
    fontWeight: 'bold',
    fontSize: 10,
    textTransform: 'uppercase',
  },
  deleteButton: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#DC2626',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    minWidth: 50,
  },
  deleteButtonText: {
    color: '#DC2626',
    fontWeight: 'bold',
    fontSize: 10,
    textTransform: 'uppercase',
  },
});

export default SavedGameModal;

