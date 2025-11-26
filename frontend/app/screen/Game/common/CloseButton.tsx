import React from "react";
import { TouchableOpacity, View, StyleSheet } from "react-native";
import IconClose from "../icons/IconClose";

type Props = {
  handleClose: () => void;
};

const CloseButton: React.FC<Props> = ({ handleClose }) => {
  return (
    <TouchableOpacity
      onPress={handleClose}
      style={styles.button}
      activeOpacity={0.7}
      testID="btn-close"
    >
      <View style={styles.iconWrapper}>
        <IconClose size={20} color="#fff" />
      </View>
    </TouchableOpacity>
  );
};

export default CloseButton;

const styles = StyleSheet.create({
  button: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#7c2d12", // orange-900 equivalent
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapper: {
    transform: [{ rotate: "0deg" }],
  },
});
