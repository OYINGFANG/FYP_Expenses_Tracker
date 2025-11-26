// app/screen/Game/components/maps/Map02.tsx (React Native)
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

const Map02: React.FC<Props> = ({ location, availableLocations, handleLocationSelect }) => {
  // collect dangers
  const dangerIcons: RouteDanger[] = useMemo(() => {
    const acc: RouteDanger[] = [];
    maps[1].routes.forEach((route) => {
      route.sections.forEach((section) => {
        section.dangers.forEach((d) => acc.push(d));
      });
    });
    return acc;
  }, []);

  // --- helpers to avoid duplicate "fill" on <Circle> ---
  const getDotFill = (dotLocation: string) => {
    if (availableLocations.includes(dotLocation)) return '#10B981'; // available (green)
    if (location === dotLocation) return '#D1D5DB';                 // current (gray)
    return '#7C2D12';                                               // locked (brownish)
  };

  const handleDotPress = (dotLocation: string) => {
    if (availableLocations.includes(dotLocation)) {
      handleLocationSelect(dotLocation);
    }
  };

  return (
    <View style={styles.container}>
      <Svg viewBox="0 0 100 100" width="100%" height="100%" testID="map-02">
        <Defs>
          {/* Gradients */}
          <SvgLinearGradient id="linearGradient10425">
            <Stop offset="0" stopColor="#007400" stopOpacity="1" />
            <Stop offset="1" stopColor="#009100" stopOpacity="1" />
          </SvgLinearGradient>

          <SvgLinearGradient id="linearGradient10199">
            <Stop offset="0" stopColor="#008d00" stopOpacity="1" />
            <Stop offset="1" stopColor="#007600" stopOpacity="1" />
          </SvgLinearGradient>

          <SvgLinearGradient id="linearGradient6774">
            <Stop offset="0" stopColor="#4ac9fd" stopOpacity="1" />
            <Stop offset="1" stopColor="#4a90fd" stopOpacity="1" />
          </SvgLinearGradient>

          {/* this was linearGradient4242, referenced by the radial one */}
          <SvgLinearGradient id="linearGradient4242">
            <Stop offset="0.555" stopColor="#ffccaa" stopOpacity="1" />
            <Stop offset="1" stopColor="#e9ab86" stopOpacity="1" />
          </SvgLinearGradient>

          {/* Inline stops instead of href for better RN-SVG compatibility */}
          <RadialGradient
            id="radialGradient4244"
            cx="50"
            cy="50"
            r="49.5"
            fx="50"
            fy="50"
            gradientTransform="matrix(1.76137 -.01434 .01534 1.88418 -38.836 -43.492)"
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0.555" stopColor="#ffccaa" stopOpacity="1" />
            <Stop offset="1" stopColor="#e9ab86" stopOpacity="1" />
          </RadialGradient>

          <SvgLinearGradient
            id="linearGradient6776"
            x1="75.556"
            x2="74.013"
            y1="77.781"
            y2="120.389"
          >
            <Stop offset="0" stopColor="#4ac9fd" stopOpacity="1" />
            <Stop offset="1" stopColor="#4a90fd" stopOpacity="1" />
          </SvgLinearGradient>

          <SvgLinearGradient
            id="linearGradient10201"
            x1="31.069"
            x2="-9.412"
            y1="86.018"
            y2="105.473"
          >
            <Stop offset="0" stopColor="#008d00" stopOpacity="1" />
            <Stop offset="1" stopColor="#007600" stopOpacity="1" />
          </SvgLinearGradient>

          <SvgLinearGradient
            id="linearGradient10427"
            x1="-14.302"
            x2="31.287"
            y1="21.741"
            y2="5.751"
          >
            <Stop offset="0" stopColor="#007400" stopOpacity="1" />
            <Stop offset="1" stopColor="#009100" stopOpacity="1" />
          </SvgLinearGradient>

          <SvgLinearGradient
            id="linearGradient15741"
            x1="75.515"
            x2="92.363"
            y1="-23.487"
            y2="-50.41"
          >
            <Stop offset="0" stopColor="#008d00" stopOpacity="1" />
            <Stop offset="1" stopColor="#007600" stopOpacity="1" />
          </SvgLinearGradient>

          <ClipPath id="clipPath1079">
            <Path
              fill="#ffe6d5"
              d="M-20.386-28.398l11.748-1.404s-.104 4.866 23.633 1.208c12.471-1.921 50.283-4.59 63.438-1.377 13.156 3.213 48.913-3.435 52.025 1.44 3.112 4.873 4.709 13.454 4.709 13.454s2.958 75.337 0 84.277c-1.683 5.083-3.658 19.164-.535 25.739 2.903 6.113 1.566 8.391 1.472 13.555-.095 5.163-4.784 8.47-2.504 17.168.95 3.624-21.642 1.604-21.642 1.604C82.51 116.32-26.825 133.6-20.93 121.796c0 0-3.09-37.157-.51-39.865 5.275-5.535-.934-48.995.688-52.883 1.277-3.06-2.112-40.207-.01-44.12 2.244-4.175.375-13.326.375-13.326z"
            />
          </ClipPath>
        </Defs>

        {/* SCALE + CLIP GROUP */}
        <G strokeWidth={1.96} transform="matrix(.5102 0 0 .5102 24.137 24.247)">
          <G
            clipPath="url(#clipPath1079)"
            transform="matrix(1.21109 0 0 1.21206 -18.216 -8.33)"
            strokeWidth={1.618}
          >
            {/* background */}
            <Path fill="url(#radialGradient4244)" d="M-48 -48H148V148H-48z" />

            {/* terrain shapes */}
            <G strokeLinejoin="round" strokeWidth={1.618}>
              <Path
                fill="#0d630d"
                d="M6.429-8.12c-6.287.179-9.52 4.67-16.885 3.951-3.683-.359-6.888.437-8.213 2.39-1.325 1.954-.77 5.066.668 6.592 2.874 3.054 12.754 8.263 4.49 10.778-4.13 1.258-12.187 8.797-12.187 8.797s-.656 2.61.871 3.599c3.054 1.976 12.575 3.233 9.161 7.724-1.706 2.245-3.01 2.973-3.19 4.59-.179 1.617.399 4.179 2.652 4.392 3.427.324 6.958-.206 9.732-2.727v.007l6.936-1.817s2.76-.588 4.742-2.404c1.982-1.817 5.166-4.2 6.652-4.2 1.486 0 3.798-1.157 5.45-4.294 1.65-3.138 1.486-5.946 3.302-5.946s2.972 2.477 5.614-.495c1.321-1.486 4.211-3.468 6.152-5.222 1.94-1.755 2.128-2.933 2.13-4.663-4.954-1.156-13.565-.519-11.419-2.996 2.147-2.477 8.355-3.5 8.059-5.73-.026-1.034.715-1.827-1.434-1.846-2.597-.022-9.7.374-12.164-1.233-2.464-1.608-1.395-6.992-5.373-5.888-2.346.651-3.032-3.437-5.746-3.36z"
              />
              <Path
                fill="url(#linearGradient10427)"
                stroke="#0c550a"
                strokeWidth={0.485}
                d="M7.121-9.8C.834-9.622-2.399-5.13-9.764-5.85-17.13-6.567-20.184.08-17.31 3.133c2.874 3.054 12.754 8.263 4.491 10.778-8.263 2.515-14.37 10.42-11.317 12.396 3.054 1.976 12.575 3.233 9.162 7.724-3.413 4.49-4.312 8.443-.54 8.982 3.408.486 6.96-.207 9.733-2.727v.007l6.936-1.817s2.761-.588 4.743-2.404c1.981-1.817 5.165-4.2 6.651-4.2 1.486 0 3.798-1.157 5.45-4.294 1.65-3.138 1.486-5.946 3.302-5.946 1.817 0 2.972 2.477 5.614-.495 2.643-2.972 11.56-7.926 6.606-9.082-4.954-1.156-11.89-1.322-9.742-3.799 2.146-2.477 9.411-3.963 7.595-5.614-.713-.648-8.206.02-13.135-3.195-2.464-1.608-1.395-6.993-5.372-5.888-2.346.651-3.033-3.437-5.747-3.36z"
                transform="translate(-.692 -.476)"
              />
            </G>

            {/* mountains / structures etc */}
            <G strokeLinejoin="round" strokeWidth={1.618}>
              <Path
                fill="#0d630d"
                d="M54.138 68.149c-1.072-.016-2.374.14-3.823.493-4.637 1.128-3.008 3.133-5.014 3.509-2.005.376-3.257.376-3.383 2.13-.125 1.755-3.634 3.453-7.645 2.325-4.01-1.128-7.143.057-10.15.934-3.008.877-6.564 5.261-10.152 2.883-4.19-2.778-9.65 0-12.784-1.003-2.209-.707-3.838.447-4.618 1.194-5.593 2.015-8.235 8.502-13.52 7.495-6.038-1.15-5.75 8.05-5.75 8.05-.288 1.724-9.487 11.786-7.475 15.523 2.013 3.738 8.625-2.3 10.062 3.738 1.437 6.037-3.738 16.673 2.3 16.386 6.036-.288 11.787 12.362 18.399 6.9 6.612-5.463 6.611-19.549 12.36-18.111 5.75 1.437 8.626 11.786 10.925 5.174 2.3-6.612-3.737-11.5-1.15-13.799 2.588-2.3 9.226-2.928 9.47-7.243.177-3.114-.781-2.372-1.752-3.75.556-1.275 1.8-4.426 1.204-6.017-.752-2.005-1.254-.376.752-2.507 2.005-2.13.751-3.008 3.258-3.384 2.506-.376 6.767.377 8.397-3.132 1.629-3.51 4.01-5.64 8.773-6.267 4.762-.627 3.497-4.868 3.47-7.279-.016-1.465.202-4.207-2.154-4.242z"
              />
              <Path
                fill="url(#linearGradient10201)"
                stroke="#0c550a"
                strokeWidth={0.485}
                d="M54.138 66.58c-1.072-.016-2.374.141-3.823.494-4.637 1.128-3.008 3.132-5.014 3.508-2.005.376-3.257.377-3.383 2.131-.125 1.755-3.634 3.453-7.645 2.325-4.01-1.128-7.143.057-10.15.934-3.008.877-6.564 5.26-10.152 2.882-4.19-2.777-9.65 0-12.784-1.002-2.209-.707-3.838.447-4.618 1.194-5.593 2.015-8.235 8.502-13.52 7.495-6.038-1.15-5.75 8.05-5.75 8.05-.288 1.724-9.487 11.786-7.475 15.523 2.013 3.737 8.625-2.3 10.062 3.738 1.437 6.037-3.738 16.673 2.3 16.386 6.036-.288 11.787 12.361 18.399 6.9 6.612-5.463 6.611-19.549 12.36-18.112 5.75 1.438 8.626 11.787 10.925 5.175 2.3-6.612-3.737-11.5-1.15-13.8 2.588-2.299 8.912-3.162 9.2-7.474.06-.91-.511-2.14-1.482-3.519.556-1.274 1.8-4.425 1.204-6.016-.752-2.005-1.254-.376.752-2.507 2.005-2.13.751-3.008 3.258-3.384 2.506-.376 6.767.376 8.397-3.133 1.629-3.509 4.01-5.64 8.773-6.266 4.762-.627 3.007-7.018 4.135-9.148.776-1.465-.463-2.338-2.82-2.373z"
              />
            </G>

            {/* more shapes … (kept as-is) */}
            <G>
              <Path
                fill="#6a6a6a"
                d="M34.951 54.785l-.768 5.341 4.268.114 8.715.612 7.492-4.768 2.908-1.229 4.233-3.187 3.336-.227 1.309-7.463-3.315-7.213-6.288.726-6.894-.242-2.298 5.563-2.902 5.2-7.377 4.959.363 1.935z"
                transform="translate(-.692 -.476)"
              />
              <Path
                fill="gray"
                d="M34.951 54.785l-.121 4.233 3.991.483 8.345.242 9.433-6.893.967 1.451 4.233-4.112 2.782.605.846-7.74-2.298-6.289-6.288.726-6.894-.242-2.298 5.563-2.902 5.2-7.377 4.959.363 1.935z"
                transform="translate(-.692 -.476)"
              />
              <Path
                fill="#999"
                d="M55.907 50.56l-.726-5.443L57.6 41.61l6.289.847-5.805.483 2.54 5.2-3.266-3.023z"
              />
              <Path
                fill="#999"
                d="M45.99 57.453L44.9 52.01l-5.08 5.2 5.201-7.377 6.652-3.507-4.233 3.628 6.41.483-7.136.726z"
              />
              <Path
                fill="#999"
                d="M48.65 43.061l1.452-4.958 4.716.12 4.475.243-5.684 1.209-.847 4.958-1.21-3.507-1.45 4.233v-2.902z"
              />
            </G>

            {/* rivers/paths */}
            <Path
              fill="none"
              stroke="#277cb3"
              strokeLinecap="round"
              strokeWidth={0.809}
              d="M55.856 11.933s2.706 7.885 7.348 9.67c4.642 1.786 15.687 7.99 20.711 13.927 3.928 4.642 11.3 5.494 7.499 17.497-4.089 12.914.36 17.24.36 17.24"
            />
            <Path
              fill="none"
              stroke="#277cb3"
              strokeLinecap="round"
              strokeWidth={0.809}
              d="M26.049-46.859s-.606 4.743 3.57 7.655c7.461 5.2-4.395 8.095-2.27 14.707 2.142 6.664 6.73 19.486 18.817 19.981 5.558.228 4.345 8.589 4.964 9.337 2.477 2.99 5.022 6.606 5.29 9.105.535 5-11.427 12.32-14.998 19.283-3.57 6.963 6.603 13.91-12.141 19.461-7.408 2.195-11.447 8.447-15.102 13.819-.913 1.343-1.777 5.357-7.525 7.118-5.748 1.762-19.913 7.394-29.295 3.728-7.564-2.956-2.674 10.926-14.251 16.713-7.913 3.956-9.175 15.958-9.5 27.708"
            />

            <Path
              fill="url(#linearGradient6776)"
              stroke="#277cb3"
              strokeLinecap="round"
              strokeWidth={1.618}
              d="M42.663 90.735c-6.751-.573-7.627 1.126-6.923 7.334.703 6.208-.64 12.836-7.175 16.521-3.268 1.843 3.643 13.137-4.82 16.612-6.898 2.832 1.729 15.057 5.023 17.477 8.681 6.376 35.53-7.714 45.59-3.12 9.343 4.265 23.151-1.232 29.757-6.93 3.172-2.736-.222-4.815 1.161-6.908 2.052-3.105-2.814-4.628-1.249-8.273 1.63-3.794 5.555-9.303 9.998-7.946 4.206 1.285 8.457-3.74 10.261-6.71 2.535-4.17-1.668-7.04-.648-10.818 1.47-5.441-5.417-6.428-7.351-10.157-1.935-3.73-8.08-1.13-9.594-9.03C105.9 74.66 100 75.35 100 75.35s-3.335-7.786-12.025-3.567c-4.721 2.292-9.948 7.408-14.596 3.937-4.4-3.286-5.657 2.69-10.68 1.198-2.818-.837-3.394 3.074-3.995 4.74-.6 1.668-1.22 2.784-4.109 1.435-8.598-4.015-7.38 8.027-11.932 7.64z"
            />
            <Path
              fill="#277cb3"
              d="M89.684 63.335c-.32.796-.833 6.268-2.37 8.257 1.813-.303 3.565-1.628 7.345-1.317-3.37-1.407-4.672-6.293-4.975-6.94z"
            />

            {/* green strokes */}
            <Path
              fill="none"
              stroke="#20a120"
              strokeLinecap="round"
              strokeWidth={0.809}
              d="M-10.204 95.498c-5.125 4.057-7.9 6.833-5.979 9.61 1.922 2.775 5.339 3.63 7.901 10.89 2.563 7.26 4.698 8.755 7.688 3.63 2.99-5.125 9.182-7.901 13.239-9.823 4.057-1.922 7.26-4.911 7.901-8.541.64-3.63 4.057-15.375 8.114-16.23 4.058-.853 5.552-7.26 2.35-5.338-3.204 1.922-14.094 10.25-18.579 10.25-4.484 0-11.53-2.776-13.88-.427-2.348 2.349-8.755 5.98-8.755 5.98z"
            />
            <Path
              fill="none"
              stroke="#20a120"
              strokeLinecap="round"
              strokeWidth={0.809}
              d="M15.091 93.936c-.586-.462-2.525 2.244-9.486-.121-5.988-2.035-10.146 4.08-11.683 6.184-3.075 4.209.093 10.146 4.025 10.905 3.884.75 8.192-2.661 11.169-5.627 4.046-4.032 7.734-9.957 5.975-11.341z"
            />
            <Path
              fill="none"
              stroke="#20a120"
              strokeLinecap="round"
              strokeWidth={0.809}
              d="M1.307-4.918c3.86-2.117 6.795-.431 7.791.939.996 1.37 1.739 2.566 4.603 4.931 2.863 2.366 7.52 2.13 6.399 4.745-1.121 2.614.133 5.198 1.877 6.07 1.743.871 5.852 1.992 4.109 3.984-1.744 1.992-7.347.249-8.467 2.988-1.121 2.74-4.234 8.094-7.222 9.339-2.988 1.245-6.6 5.478-11.33 6.599-4.732 1.12-11.705 5.603-11.705 3.237 0-2.365 3.362-6.1 1.245-8.84s-7.368-3.464-6.497-7.449c.872-3.984 9.028-4.91 10.647-8.022 1.618-3.113-.147-7.778-5.28-12.043-2.931-2.434 2.811-4.601 6.173-4.477 3.362.125 7.657-2.001 7.657-2.001z"
            />
            <Path
              fill="none"
              stroke="#20a120"
              strokeLinecap="round"
              strokeWidth={0.809}
              d="M-3.074 2.371C-1.94.972 3.354-.654 5.018.178c1.664.832 8.017 5.748 7.942 6.807 1.284 5.99 4.987 5.576-.454 9.68-2.647 1.967-3.857 8.925-6.05 9.53-2.194.606-9.757 6.732-10.59 4.16-.831-2.571-7.411-4.991-6.882-7.336.53-2.345 9.076-5.143 9.53-8.168.454-3.026-2.723-11.08-1.588-12.48z"
            />
            <Path
              fill="none"
              stroke="#20a120"
              strokeLinecap="round"
              strokeWidth={0.809}
              d="M3.506 5.472c4.31.832 8.017 5.37 6.277 7.715-1.74 2.344-5.9 12.63-9.076 11.193-3.176-1.437 2.42-5.52 2.27-9.227-.152-3.706.529-9.68.529-9.68z"
            />
            {/* long green guides */}
            <Path
              fill="none"
              stroke="#20a120"
              strokeLinecap="round"
              strokeWidth={0.809}
              d="M40.192-45.03s2.785 8.541 1.671 13.369c-1.114 4.827-1.114 7.426 4.085 4.827 5.199-2.6 3.713 3.156 9.84 2.785s11.14-2.785 14.111-.557c2.97 2.228 15.225 2.6 15.41-1.485.186-4.085 2.414-8.912 7.984-8.912s18.381-.743 18.938 3.156c.557 3.9-.557 8.54 6.127 7.427 6.684-1.114 14.668-4.828 17.639-2.785 2.97 2.042 10.397 6.684 10.397 6.684v-6.684"
            />
            <Path
              fill="none"
              stroke="#20a120"
              strokeLinecap="round"
              strokeWidth={0.809}
              d="M48.733-46.886s-2.97 5.941 1.114 10.769c4.085 4.827 6.684 5.198 13.554 4.641 6.87-.557 14.11 5.2 15.967 1.3 1.857-3.899 5.756-9.098 13.182-9.283 7.427-.186 25.066-1.671 25.623 2.97.557 4.642 6.87 5.942 14.482 4.642 7.612-1.3 13.182 2.785 13.182 2.785"
            />
            <Path
              fill="none"
              stroke="#20a120"
              strokeLinecap="round"
              strokeWidth={0.809}
              d="M53.746-47.814c.186 5.198 1.857 11.697 11.326 11.882 9.469.186 16.524-7.426 22.651-8.726 6.127-1.3 28.964-2.414 32.12 0 3.157 2.414 2.414 7.241 7.242 7.241 4.827 0 20.794.186 20.794.186"
            />
          </G>

          {/* dashed connectors */}
          <G
            fill="none"
            stroke="#520"
            strokeDasharray="0.808866, 1.61773"
            strokeLinecap="square"
            strokeOpacity="1"
            strokeWidth={0.809}
            paintOrder="stroke fill markers"
            transform="matrix(1.21109 0 0 1.21206 -19.054 -8.907)"
          >
            <Path d="M61.288 56.318c4.638-4.27 19.145.214 19.681-6.494" />
            <Path d="M36.512 63.393c4.817-.34 13.747 3.673 20.354-4.642" />
            <Path d="M28.478 59.465c-3.201-3.769-5.368-7.22-5.639-12.377" />
            <Path d="M55.884 30.174c7.346 2.096 15.88-2.225 21.068 2.856" />
            <Path d="M29.281 31.96c6.83-4.452 14.326-5.013 22.496-3.036" />
            <Path d="M14.897 64.083c6.829-4.451 2.47 2.268 12.478.767" />
            <Path d="M-1.38 55.682C5.644 53.659.694 66.81 10.702 65.309" />
            <Path d="M-2.175 52.77c4.12-7.76 9.725-19.126 22.258-16.84" />
            <Path d="M109.587 43.052c-4.242-9.681-15.616-8.798-23.127-8.402" />
            <Path d="M132.319 48.824c-2.818-7.124-9.936 2.731-16.872 2.558-2.475-.062-3.844-2.726-4.245-4.318" />
            <Path d="M112.718 70.937c10.67.309 21.652-8.003 20.554-19.063" />
          </G>

          {/* ---- CITY: Butre ---- */}
          <G strokeWidth={1.618} transform="matrix(1.21109 0 0 1.21206 -19.054 -8.907)">
            <Circle
              cx={30.834}
              cy={63.642}
              r={3.626}
              stroke="#520"
              strokeWidth={0.485}
              testID="btn-butre"
              fill={getDotFill('butre')}
            />
            {location === 'butre' && (
              <Path
                fill="#e92828"
                stroke="#520"
                strokeWidth={0.485}
                d="M30.666 54.419c-6.987.09.168 9.371.168 9.371s7.268-9.427 0-9.371h-.168z"
                testID="marker-butre"
              />
            )}
          </G>

          {/* ---- CITY: Tabbith ---- */}
          <G strokeWidth={1.618} transform="matrix(1.21109 0 0 1.21206 -19.054 -8.907)">
            <Circle
              cx={80.432}
              cy={37.224}
              r={3.626}
              stroke="#520"
              strokeWidth={0.485}
              testID="btn-tabbith"
              fill={getDotFill('tabbith')}
            />
            {location === 'tabbith' && (
              <Path
                fill="#e92828"
                stroke="#520"
                strokeWidth={0.485}
                d="M80.264 27.957c-6.987.088.167 9.18.167 9.18s7.268-9.235 0-9.18a8.3 8.3 0 00-.167 0z"
                testID="marker-tabbith"
              />
            )}
          </G>

          {/* ---- CITY: Oskah ---- */}
          <G strokeWidth={1.618} transform="matrix(1.21109 0 0 1.21206 -18.066 -7.432)">
            <Circle
              cx={23.925}
              cy={35.07}
              r={3.626}
              stroke="#520"
              strokeWidth={0.485}
              testID="btn-oskah"
              fill={getDotFill('oskah')}
            />
            {location === 'oskah' && (
              <Path
                fill="#e92828"
                stroke="#520"
                strokeWidth={0.485}
                d="M23.757 25.213c-6.987.09.167 9.371.167 9.371s7.268-9.427 0-9.37c-.056-.001-.112-.002-.167 0z"
                testID="marker-oskah"
              />
            )}
          </G>

          {/* ---- CITY: Luci ---- */}
          <G strokeWidth={1.618} transform="matrix(1.21109 0 0 1.21206 -56.738 16.235)">
            <Circle
              cx={23.925}
              cy={35.07}
              r={3.626}
              stroke="#520"
              strokeWidth={0.485}
              testID="btn-luci"
              fill={getDotFill('luci')}
            />
            {location === 'luci' && (
              <Path
                fill="#e92828"
                stroke="#520"
                strokeWidth={0.485}
                d="M23.757 25.213c-6.987.09.167 9.371.167 9.371s7.268-9.427 0-9.37c-.056-.001-.112-.002-.167 0z"
                testID="marker-luci"
              />
            )}
          </G>

          {/* ---- CITY: Clionne ---- */}
          <G strokeWidth={1.618} transform="matrix(1.21109 0 0 1.21206 80.413 34.854)">
            <Circle
              cx={23.925}
              cy={35.07}
              r={3.626}
              stroke="#520"
              strokeWidth={0.485}
              testID="btn-clionne"
              fill={getDotFill('clionne')}
            />
            {location === 'clionne' && (
              <Path
                fill="#e92828"
                stroke="#520"
                strokeWidth={0.485}
                d="M23.757 25.213c-6.987.09.167 9.371.167 9.371s7.268-9.427 0-9.37c-.056-.001-.112-.002-.167 0z"
                testID="marker-clionne"
              />
            )}
          </G>
        </G>
      </Svg>

      <MapDangers dangerIcons={dangerIcons} mapVersion={1} />
      
      {/* Touch overlays for location dots */}
      {availableLocations.map((loc) => {
        const positions: { [key: string]: { x: number; y: number } } = {
          butre: { x: 30.834, y: 63.642 },
          tabbith: { x: 80.432, y: 37.224 },
          oskah: { x: 23.925, y: 35.07 },
          luci: { x: 23.925, y: 35.07 },
          clionne: { x: 23.925, y: 35.07 },
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

export default Map02;
