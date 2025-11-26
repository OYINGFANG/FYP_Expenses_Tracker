// app/screen/Game/components/maps/MapDisplay.tsx (React Native)
import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';

import Map01 from './Map01';
import Map02 from './Map02';
import Map03 from './Map03';

type Props = {
  mapVersion: number;
  location: string;
  availableLocations: string[];
  handleLocationSelect: (destination: string) => void;
};

const MapDisplay: React.FC<Props> = ({
  mapVersion,
  location,
  availableLocations,
  handleLocationSelect,
}) => {
  const MapComponent =
    mapVersion === 1 ? Map02 : mapVersion === 2 ? Map03 : Map01;

  return (
    <View style={styles.container} testID="map-display">
      <MapComponent
        location={location}
        availableLocations={availableLocations}
        handleLocationSelect={handleLocationSelect}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    // Let each map control its own height via aspectRatio.
    // Add padding/margins here if needed.
  },
});

export default memo(MapDisplay);
