import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Map, RouteDanger, TravelState } from '../types';
import { FormattedMessage } from 'react-intl';
import { Slices, processTravelDay, relocate } from '../store/gameSlice';
import { useGameSliceSelector, useGameSliceDispatch } from '../store/reduxHooks';
import MapDisplay from './maps/MapDisplay';
import { getRnd1d6 } from '../utils/utils';
import { maps } from '../data/maps';
import TravelModal from './TravelModal';

const TravelPanel = () => {
  const initTravelState: TravelState = {
    destination: '',
    progress: 0,
    routeDays: 0,
    route: null,
    danger: null,
    upgradeUsed: false,
    dice: {
      encounterCheck1: 0,
      encounterCheck2: 0,
    },
  };
  const [travelState, setTravelState] = useState<TravelState>(initTravelState);
  const [travelModalStatus, setTravelModalStatus] = useState('');
  const [travelTransitionStatus, setTravelTransitionStatus] = useState('');
  const { gameState } = useGameSliceSelector((state: Slices) => state.game);
  const isModalOpen = travelModalStatus !== '';
  const { location, mapVersion } = gameState;
  const mapData: Map = maps[mapVersion];
  const availableLocations: string[] = [];
  const dispatch = useGameSliceDispatch();
  mapData.routes.forEach((route) => {
    // Normalize locations for comparison
    const normalizedCurrentLocation = String(location).toLowerCase().trim();
    const routeLocationStrings = route.locations.map((loc) => String(loc).toLowerCase().trim());
    if (routeLocationStrings.includes(normalizedCurrentLocation)) {
      const otherLocation = route.locations.find(
        (loc) => String(loc).toLowerCase().trim() !== normalizedCurrentLocation
      );
      if (otherLocation) {
        // Normalize the destination location
        availableLocations.push(String(otherLocation).toLowerCase().trim());
      }
    }
  });
  const openModal = () => {
    setTravelModalStatus('opening');
    setTravelTransitionStatus('opening');
    setTimeout(() => {
      setTravelModalStatus('open');
      setTravelTransitionStatus('');
    }, 510);
  };
  const closeModal = () => {
    setTravelModalStatus('closing');
    setTimeout(() => {
      setTravelModalStatus('');
      setTravelState({ ...initTravelState });
    }, 510);
  };

  const handleTravelTurn = (initTravelState?: TravelState | null) => {
    const tempTravelState: TravelState = initTravelState || travelState;
    const rolls = [getRnd1d6(), getRnd1d6(), getRnd1d6(), getRnd1d6()];
    const perc = (rolls[0] + rolls[1] - 2) / 10;
    let thresh = 0;
    let dangerEncountered: RouteDanger | null = null;
    let upgradeUsed = false;
    const { route, destination, progress, routeDays } = tempTravelState;
    const reversedSections = route?.locations[0] !== location;
    if (route) {
      if (progress >= routeDays) {
        dispatch(relocate(destination));
      } else {
        const routeSectionDangers =
          route.sections[reversedSections ? routeDays - 1 - progress : progress].dangers;
        routeSectionDangers.forEach((danger) => {
          if (!dangerEncountered) {
            thresh += danger.chance;
            if (perc <= thresh) {
              dangerEncountered = danger;
              upgradeUsed = !!gameState.flags[`upgrade__counterDanger__${dangerEncountered.type}`];
            }
          }
        });
        const newTravelState = {
          destination,
          progress: progress + 1,
          route,
          routeDays: route.sections.length,
          danger: dangerEncountered,
          upgradeUsed,
          dice: {
            encounterCheck1: rolls[0],
            encounterCheck2: rolls[1],
          },
        };
        setTravelState(newTravelState);
        dispatch(processTravelDay({ danger: dangerEncountered, upgradeUsed }));
      }
    }
  };
  const handleTravelStart = (destination: string) => {
    // Normalize destination to ensure consistency
    const normalizedDestination = String(destination).toLowerCase().trim();
    const route = mapData.routes.find(
      (item) =>
        item.locations.map((loc) => String(loc).toLowerCase().trim()).includes(String(location).toLowerCase().trim()) &&
        item.locations.map((loc) => String(loc).toLowerCase().trim()).includes(normalizedDestination),
    );
    if (route) {
      const initTravelState = {
        destination: normalizedDestination,
        progress: 0,
        route,
        routeDays: route.sections.length,
        danger: null,
        upgradeUsed: false,
        dice: {
          encounterCheck1: 0,
          encounterCheck2: 0,
        },
      };
      setTravelState({ ...initTravelState });
      // Open modal first, then process first day when user clicks Continue
      openModal();
    }
  };
  const handleTravelContinue = () => {
    if (travelState.progress < travelState.routeDays) {
      // If this is the first day (progress is 0), process it immediately
      if (travelState.progress === 0) {
        handleTravelTurn();
        return;
      }
      // For subsequent days, use transition animation
      setTravelTransitionStatus('closing');
      setTimeout(() => {
        setTravelTransitionStatus('off');
        setTimeout(() => {
          handleTravelTurn();
          setTravelTransitionStatus('opening');
        }, 10);
        setTimeout(() => {
          setTravelTransitionStatus('');
        }, 500);
      }, 500);
    } else {
      // Travel complete - relocate to destination
      handleTravelTurn();
    }
  };
  return (
    <View style={styles.container} testID="travel-panel">
      <View style={styles.content}>
        <View style={styles.explainerContainer}>
          <Text style={styles.explainerText}>
            <FormattedMessage id="travel__explainer" />
          </Text>
        </View>
        <MapDisplay
          mapVersion={gameState.mapVersion}
          location={location}
          availableLocations={availableLocations}
          handleLocationSelect={handleTravelStart}
        />
        <View style={styles.mapVersionContainer}>
          <Text style={styles.mapVersionText}>
            <FormattedMessage id={`travel__map_version_${mapVersion}`} />
          </Text>
        </View>
      </View>

      {isModalOpen && (
        <TravelModal
          travelState={travelState}
          travelModalStatus={travelModalStatus}
          travelTransitionStatus={travelTransitionStatus}
          handleTravelContinue={handleTravelContinue}
          closeModal={closeModal}
          titleKey={`travel__modal__title__${travelState.destination}`}
        />
      )}
    </View>
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
    marginBottom: 16,
  },
  explainerText: {
    textAlign: 'center',
    fontStyle: 'italic',
    color: '#FDE68A',
    fontSize: 14,
  },
  mapVersionContainer: {
    alignItems: 'flex-end',
    paddingBottom: 16,
    marginTop: 8,
  },
  mapVersionText: {
    color: '#FDE68A',
    fontSize: 12,
  },
});

export default TravelPanel;
