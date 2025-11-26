// app/screen/Game/components/maps/Map01.tsx (React Native)
import React, { useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, {
  Defs,
  LinearGradient as SvgLinearGradient,
  RadialGradient,
  Stop,
  ClipPath,
  Path,
  G,
  Circle,
} from 'react-native-svg';
import { maps } from '../../data/maps';
import { RouteDanger } from '../../types';
import MapDangers from './MapDangers';

type Props = {
  location: string;
  availableLocations: string[];
  handleLocationSelect: (destination: string) => void;
};

const Map01: React.FC<Props> = ({ location, availableLocations, handleLocationSelect }) => {
  // collect all dangers (unchanged logic)
  const dangerIcons: RouteDanger[] = useMemo(() => {
    const acc: RouteDanger[] = [];
    maps[0].routes.forEach((route) => {
      route.sections.forEach((section) => {
        section.dangers.forEach((danger) => acc.push(danger));
      });
    });
    return acc;
  }, []);

  // react-native-svg doesn't have className; choose props explicitly
  const getDotFill = (dotLocation: string) => {
    const isCurrent = location === dotLocation;
    const isAvailable = availableLocations.includes(dotLocation);

    if (isAvailable) {
      return '#10B981'; // green-500
    }
    if (isCurrent) {
      return '#D1D5DB'; // gray-300
    }
    return '#7C2D12'; // orange-800-ish
  };

  const handleDotPress = (dotLocation: string) => {
    if (availableLocations.includes(dotLocation)) {
      handleLocationSelect(dotLocation);
    }
  };

  return (
    <View style={styles.container}>
      <Svg
        viewBox="0 0 100 100"
        width="100%"
        height="100%"
        testID="map-01"
      >
        <Defs>
          {/* Base blues */}
          <SvgLinearGradient id="linearGradient6774">
            <Stop offset="0" stopColor="#4ac9fd" stopOpacity="1" />
            <Stop offset="1" stopColor="#4a90fd" stopOpacity="1" />
          </SvgLinearGradient>

          {/* Warm background stops */}
          <SvgLinearGradient id="linearGradient4242">
            <Stop offset="0.555" stopColor="#ffccaa" stopOpacity="1" />
            <Stop offset="1" stopColor="#e9ab86" stopOpacity="1" />
          </SvgLinearGradient>

          {/* ⛔ no clipPathUnits prop in RN-SVG typings */}
          <ClipPath id="clipPath4124">
            <Path
              fill="#ffe6d5"
              d="M1.482 6.159L4.987 1S9.13 5.514 24.108 3.902C39.087 2.29 56.615-.29 63.307 3.579c6.692 3.87 26.77-2.257 26.77-2.257s.637 3.225 4.143 3.547c3.505.323 4.143 5.804 4.143 5.804s-4.462 42.239-2.869 45.14c1.594 2.903-2.23 19.024-.637 22.894C96.45 82.576 99 91.927 99 91.927s-3.506 2.256-4.78 4.191c-1.275 1.935-10.198 2.58-10.198 2.58s-58.001-3.87-62.463-1.29c-4.462 2.58-10.835 1.612-13.385 0-2.55-1.612-6.692-6.449-6.692-6.449s.637-23.215 2.23-26.117c1.594-2.902 1.275-23.86-.318-25.15C1.8 38.402-.112 15.51 1.8 12.608c1.912-2.902-.318-6.45-.318-6.45z"
            />
          </ClipPath>

          {/* Radial gradient: inline stops (no href/xlinkHref) */}
          <RadialGradient
            id="radialGradient4244"
            cx="50"
            cy="50"
            r="49.5"
            fx="50"
            fy="50"
            gradientTransform="matrix(.88967 -.00724 .00775 .9517 5.129 2.777)"
          >
            <Stop offset="0.555" stopColor="#ffccaa" stopOpacity="1" />
            <Stop offset="1" stopColor="#e9ab86" stopOpacity="1" />
          </RadialGradient>

          {/* Another linear gradient using same blue stops (inline, no href) */}
          <SvgLinearGradient
            id="linearGradient6776"
            x1="75.556"
            x2="77.61"
            y1="77.781"
            y2="101.503"
          >
            <Stop offset="0" stopColor="#4ac9fd" stopOpacity="1" />
            <Stop offset="1" stopColor="#4a90fd" stopOpacity="1" />
          </SvgLinearGradient>
        </Defs>

        <G>
          <G clipPath="url(#clipPath4124)" transform="translate(.692 .476)">
            {/* Background fill */}
            <Path
              fill="url(#radialGradient4244)"
              d="M0.5 0.5H99.5V99.5H0.5z"
            />

            {/* --- Terrain / paths (your shapes) --- */}
            <G>
              <Path
                fill="#0d630d"
                d="M.464 40.117s3.798 1.486 5.78-.33c1.981-1.817 4.128-6.276 5.614-6.276 1.486 0 3.798-1.156 5.45-4.293 1.65-3.138 1.486-5.945 3.302-5.945 1.817 0 2.973 2.477 5.615-.495 1.32-1.487 4.21-3.468 6.15-5.223.971-.877 1.704-1.698 1.884-2.371.181-.673.078-2.561.078-2.561s-13.397-.249-11.25-2.726c2.147-2.477 8.295-4.606 7.999-6.165l-.057-.647-36.51-6.068-.99 44.916z"
              />
              <Path
                fill="green"
                stroke="#0c550a"
                strokeWidth="0.3"
                d="M.464 38s3.798 1.486 5.78-.33c1.981-1.817 4.128-6.275 5.614-6.275 1.486 0 3.798-1.156 5.45-4.294 1.65-3.137 1.486-5.945 3.302-5.945 1.817 0 2.973 2.477 5.615-.495 2.642-2.973 11.56-7.927 6.605-9.083-4.954-1.155-11.89-1.32-9.743-3.798 2.147-2.477 9.413-3.963 7.596-5.614C28.867.515-5.48-5.1-5.48-5.1l-.99 44.916z"
              />
              <Path
                fill="none"
                stroke="#20a120"
                strokeDasharray="0.5, 4"
                strokeLinecap="round"
                strokeWidth="0.5"
                d="M-.187 1.711S10.245 5.245 14.116 7.77c3.87 2.524 11.61 2.02 11.442 5.553-.168 3.533-2.356 4.88-4.712 4.88-2.355 0-6.394.168-7.908 4.375-1.515 4.206-7.404 11.442-10.601 11.442-3.197 0-8.919-2.692-8.919-2.692"
              />
              <Path
                fill="none"
                stroke="#20a120"
                strokeDasharray="0.499999, 4"
                strokeLinecap="round"
                strokeWidth="0.5"
                d="M-.02 7.937s5.722 2.356 8.751 2.524c3.029.169 13.462 1.01 10.264 3.366-3.197 2.355-10.096 4.375-10.264 7.067C8.563 23.586-1.365 30.99-1.365 30.99l-5.048-3.702"
              />
              <Path
                fill="none"
                stroke="#20a120"
                strokeDasharray="0.499999, 4"
                strokeLinecap="round"
                strokeWidth="0.5"
                d="M-3.384 12.817s11.105-1.01 10.432 2.02C6.375 17.864 2 23.586-1.029 25.268c-3.029 1.683-6.73-1.178-6.73-1.178"
              />
            </G>

            {/* (You can keep adding the rest of your original <Path>/<G> blocks here) */}
          </G>

          {/* ---- CITY: Butre ---- */}
          <G>
            <Circle
              cx={30.745}
              cy={64.311}
              r={2}
              fill={getDotFill('butre')}
              stroke="#520"
              strokeWidth={0.3}
              testID="btn-butre"
            />
            {location === 'butre' && (
              <Path
                fill="#e92828"
                stroke="#520"
                strokeWidth={0.3}
                d="M30.758 60.016c-3.171.041.076 4.296.076 4.296s3.299-4.322 0-4.296h-.076z"
                testID="marker-butre"
              />
            )}
          </G>

          {/* ---- CITY: Tabbith ---- */}
          <G>
            <Circle
              cx={80.88}
              cy={37.673}
              r={2}
              fill={getDotFill('tabbith')}
              stroke="#520"
              strokeWidth={0.3}
              testID="btn-tabbith"
            />
            {location === 'tabbith' && (
              <Path
                fill="#e92828"
                stroke="#520"
                strokeWidth={0.3}
                d="M80.823 33.147c-3.171.041.076 4.296.076 4.296s3.299-4.322 0-4.296h-.076z"
                testID="marker-tabbith"
              />
            )}
          </G>

          {/* ---- CITY: Melaka ---- */}
          <G>
            <Circle
              cx={23.925}
              cy={35.53}
              r={2}
              fill={getDotFill('melaka')}
              stroke="#520"
              strokeWidth={0.3}
              testID="btn-melaka"
            />
            {location === 'melaka' && (
              <Path
                fill="#e92828"
                stroke="#520"
                strokeWidth={0.3}
                d="M23.906 30.913c-3.171.041.076 4.296.076 4.296s3.299-4.322 0-4.296h-.076z"
                testID="marker-melaka"
              />
            )}
          </G>

          {/* --- Connecting dashed lines --- */}
          <Path
            fill="none"
            stroke="#520"
            strokeDasharray="0.5, 1"
            strokeLinecap="square"
            strokeWidth="0.5"
            d="M36.512 63.393c4.817-.34 13.747 3.673 20.354-4.642"
          />
          <Path
            fill="none"
            stroke="#520"
            strokeDasharray="0.5, 1"
            strokeLinecap="square"
            strokeWidth="0.5"
            d="M61.288 56.318c4.638-4.27 19.145.214 19.681-6.494"
          />
          <Path
            fill="none"
            stroke="#520"
            strokeDasharray="0.5, 1"
            strokeLinecap="square"
            strokeWidth="0.5"
            d="M28.478 59.465c-3.201-3.769-5.368-7.22-5.639-12.377"
          />
          <Path
            fill="none"
            stroke="#520"
            strokeDasharray="0.5, 1"
            strokeLinecap="square"
            strokeWidth="0.5"
            d="M55.884 30.174c7.346 2.096 15.88-2.225 21.068 2.856"
          />
          <Path
            fill="none"
            stroke="#520"
            strokeDasharray="0.5, 1"
            strokeLinecap="square"
            strokeWidth="0.5"
            d="M29.281 31.96c6.83-4.452 14.326-5.013 22.496-3.036"
          />
        </G>
      </Svg>

      {/* Danger overlay (unchanged) */}
      <MapDangers dangerIcons={dangerIcons} mapVersion={0} />
      
      {/* Touch overlays for location dots */}
      {availableLocations.map((loc) => {
        const positions: { [key: string]: { x: number; y: number } } = {
          butre: { x: 30.745, y: 64.311 },
          tabbith: { x: 80.88, y: 37.673 },
          melaka: { x: 23.925, y: 35.53 },
        };
        const pos = positions[loc];
        if (!pos) return null;
        
        return (
          <TouchableOpacity
            key={loc}
            style={[
              styles.touchOverlay,
              {
                left: `${pos.x}%`,
                top: `${pos.y}%`,
                marginLeft: -12,
                marginTop: -12,
              },
            ]}
            onPress={() => handleDotPress(loc)}
            activeOpacity={0.7}
            testID={`touch-${loc}`}
          />
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    width: '100%',
    aspectRatio: 1, // keep map square
  },
  touchOverlay: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
});

export default Map01;
