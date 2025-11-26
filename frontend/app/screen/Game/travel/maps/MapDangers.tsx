// app/screen/Game/travel/maps/MapDangers.tsx (React Native)
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { RouteDanger } from '../../types';

type Props = {
  dangerIcons: RouteDanger[];
  mapVersion: number;
};

const DOT_SIZE_PCT = 3.5; // matches the old w-[3.5%]

const MapDangers: React.FC<Props> = ({ dangerIcons, mapVersion }) => {
  return (
    <View pointerEvents="none" style={styles.overlay}>
      {dangerIcons.map((icon, idx) => {
        const pos = icon.positions?.[mapVersion];
        if (!pos) return null;

        return (
          <View
            key={`dangerIcon-${idx}`}
            style={[
              styles.dot,
              {
                top: `${pos.y}%`,
                left: `${pos.x}%`,
                width: `${DOT_SIZE_PCT}%`,
              },
            ]}
          >
            {/* Place your RN icon here if needed, e.g. <IconDanger type={icon.type} /> */}
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject, // absolute top/left/right/bottom 0
  },
  dot: {
    position: 'absolute',
    backgroundColor: 'rgba(229,231,235,0.8)', // Tailwind gray-200 @ 80%
    aspectRatio: 1, // keep it circular with width %
    borderRadius: 9999,
    padding: 4, // ~ p-1
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default MapDangers;
