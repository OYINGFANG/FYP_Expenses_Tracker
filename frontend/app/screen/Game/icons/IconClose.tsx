import React from "react";
import Svg, { G, Path } from "react-native-svg";

interface IconCloseProps {
  size?: number;
  color?: string;
}

const IconClose: React.FC<IconCloseProps> = ({ size = 24, color = "#fff" }) => {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
    >
      <G transform="rotate(-45)">
        <Path
          fill={color}
          d="M6.699 13.77H-6.7v50.242H-56.94V77.41h50.242v50.242H6.7V77.41H56.94V64.012H6.699z"
        />
      </G>
    </Svg>
  );
};

export default IconClose;
