import { useState, useEffect } from 'react';
import { StyleSheet, Animated } from 'react-native';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, ClipPath, Path, Rect, RadialGradient, Circle, G } from 'react-native-svg';

type Props = {
  value: number;
  idx: number;
};
const DieOneDSix: React.FC<Props> = ({ value, idx }) => {
  const [opacity] = useState(new Animated.Value(0));
  const [rotate] = useState(new Animated.Value(-90));

  useEffect(() => {
    const delay = idx > 0 ? 200 : 0;
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(rotate, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start();
    }, delay);
  }, [idx, opacity, rotate]);

  const rotateInterpolate = rotate.interpolate({
    inputRange: [-90, 0],
    outputRange: ['-90deg', '0deg'],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity,
          transform: [{ rotate: rotateInterpolate }],
        },
      ]}
      testID={`die1d6-${idx}`}
    >
      <Svg width="64" height="64" viewBox="0 0 100 100">
        <Defs>
          <SvgLinearGradient id="linearGradient23232">
            <Stop offset="0.686" stopColor="#d9d9d9" stopOpacity="1" />
            <Stop offset="1" stopColor="#ccc" stopOpacity="1" />
          </SvgLinearGradient>
          <ClipPath id="clipPath21094">
            <Rect
              width="97.5"
              height="97.5"
              x="1.25"
              y="1.25"
              fill="#6a6a6a"
              stroke="none"
              strokeDasharray="none"
              strokeDashoffset="0"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="0"
              rx="12.557"
            />
          </ClipPath>
          <RadialGradient
            id="radialGradient23236"
            cx="50"
            cy="50"
            r="48.75"
            fx="50"
            fy="50"
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0.686" stopColor="#d9d9d9" stopOpacity="1" />
            <Stop offset="1" stopColor="#ccc" stopOpacity="1" />
          </RadialGradient>
        </Defs>
        <G>
          <G
            fill="#ccc"
            stroke="none"
            strokeDasharray="none"
            strokeDashoffset="0"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="0"
            clipPath="url(#clipPath21094)"
          >
            <Rect
              width="97.5"
              height="97.5"
              x="1.25"
              y="1.25"
              fill="url(#radialGradient23236)"
              fillOpacity="1"
              rx="12.557"
            />
            <Path
              fill="#b3b3b3"
              d="M92 3.944s.5 72.196 0 78.187c-.44 5.284-1.888 9.573-9.002 9.869-7.114.296-81 0-81 0L4 96l-4 4h100V1.058L96 4z"
            />
            <Path
              fill="#f6f6f6"
              fillOpacity="1"
              d="M8 92s-.5-68.14 0-74.131C8.44 12.585 9.888 8.296 17.002 8 24.116 7.704 92 8 92 8l4-4 4-4H0v98.942L4 96z"
            />
          </G>
          {[1, 3, 5].includes(value) && (
            <G transform="translate(3 3)" data-testid="dot-cc">
              <Circle
                cx="47"
                cy="47"
                r="8"
                fill="#f2f2f2"
                fillOpacity="1"
                fillRule="evenodd"
                strokeWidth="0.265"
              />
              <Circle
                cx="47"
                cy="47"
                r="7"
                fill="#4d4d4d"
                fillRule="evenodd"
                strokeWidth="0.265"
              />
              <Path
                fill="none"
                fillOpacity="1"
                stroke="#686868"
                strokeDasharray="none"
                strokeDashoffset="0"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeOpacity="1"
                strokeWidth="1.5"
                d="M42.567 47.405c.302-2.854 1.4-5.014 5-5"
              />
            </G>
          )}
          {[2, 4, 5, 6].includes(value) && (
            <G transform="translate(30 30)" data-testid="dot-rb">
              <Circle
                cx="47"
                cy="47"
                r="8"
                fill="#f2f2f2"
                fillOpacity="1"
                fillRule="evenodd"
                strokeWidth="0.265"
              />
              <Circle
                cx="47"
                cy="47"
                r="7"
                fill="#4d4d4d"
                fillRule="evenodd"
                strokeWidth="0.265"
              />
              <Path
                fill="none"
                fillOpacity="1"
                stroke="#686868"
                strokeDasharray="none"
                strokeDashoffset="0"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeOpacity="1"
                strokeWidth="1.5"
                d="M42.567 47.405c.302-2.854 1.4-5.014 5-5"
              />
            </G>
          )}

          {[6].includes(value) && (
            <G transform="translate(30 3)" data-testid="dot-rc">
              <Circle
                cx="47"
                cy="47"
                r="8"
                fill="#f2f2f2"
                fillOpacity="1"
                fillRule="evenodd"
                strokeWidth="0.265"
              />
              <Circle
                cx="47"
                cy="47"
                r="7"
                fill="#4d4d4d"
                fillRule="evenodd"
                strokeWidth="0.265"
              />
              <Path
                fill="none"
                fillOpacity="1"
                stroke="#686868"
                strokeDasharray="none"
                strokeDashoffset="0"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeOpacity="1"
                strokeWidth="1.5"
                d="M42.567 47.405c.302-2.854 1.4-5.014 5-5"
              />
            </G>
          )}
          {[3, 4, 5, 6].includes(value) && (
            <G transform="translate(30 -24)" data-testid="dot-rt">
              <Circle
                cx="47"
                cy="47"
                r="8"
                fill="#f2f2f2"
                fillOpacity="1"
                fillRule="evenodd"
                strokeWidth="0.265"
              />
              <Circle
                cx="47"
                cy="47"
                r="7"
                fill="#4d4d4d"
                fillRule="evenodd"
                strokeWidth="0.265"
              />
              <Path
                fill="none"
                fillOpacity="1"
                stroke="#686868"
                strokeDasharray="none"
                strokeDashoffset="0"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeOpacity="1"
                strokeWidth="1.5"
                d="M42.567 47.405c.302-2.854 1.4-5.014 5-5"
              />
            </G>
          )}

          {[3, 4, 5, 6].includes(value) && (
            <G transform="translate(-24 30)" data-testid="dot-lb">
              <Circle
                cx="47"
                cy="47"
                r="8"
                fill="#f2f2f2"
                fillOpacity="1"
                fillRule="evenodd"
                strokeWidth="0.265"
              />
              <Circle
                cx="47"
                cy="47"
                r="7"
                fill="#4d4d4d"
                fillRule="evenodd"
                strokeWidth="0.265"
              />
              <Path
                fill="none"
                fillOpacity="1"
                stroke="#686868"
                strokeDasharray="none"
                strokeDashoffset="0"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeOpacity="1"
                strokeWidth="1.5"
                d="M42.567 47.405c.302-2.854 1.4-5.014 5-5"
              />
            </G>
          )}

          {[6].includes(value) && (
            <G transform="translate(-24 3)" data-testid="dot-lc">
              <Circle
                cx="47"
                cy="47"
                r="8"
                fill="#f2f2f2"
                fillOpacity="1"
                fillRule="evenodd"
                strokeWidth="0.265"
              />
              <Circle
                cx="47"
                cy="47"
                r="7"
                fill="#4d4d4d"
                fillRule="evenodd"
                strokeWidth="0.265"
              />
              <Path
                fill="none"
                fillOpacity="1"
                stroke="#686868"
                strokeDasharray="none"
                strokeDashoffset="0"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeOpacity="1"
                strokeWidth="1.5"
                d="M42.567 47.405c.302-2.854 1.4-5.014 5-5"
              />
            </G>
          )}

          {[2, 4, 5, 6].includes(value) && (
            <G transform="translate(-24 -24)" data-testid="dot-lt">
              <Circle
                cx="47"
                cy="47"
                r="8"
                fill="#f2f2f2"
                fillOpacity="1"
                fillRule="evenodd"
                strokeWidth="0.265"
              />
              <Circle
                cx="47"
                cy="47"
                r="7"
                fill="#4d4d4d"
                fillRule="evenodd"
                strokeWidth="0.265"
              />
              <Path
                fill="none"
                fillOpacity="1"
                stroke="#686868"
                strokeDasharray="none"
                strokeDashoffset="0"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeOpacity="1"
                strokeWidth="1.5"
                d="M42.567 47.405c.302-2.854 1.4-5.014 5-5"
              />
            </G>
          )}
        </G>
      </Svg>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 64,
    height: 64,
  },
});

export default DieOneDSix;
