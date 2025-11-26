// components/BackButton.tsx
import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import { StyleSheet, TouchableOpacity } from "react-native";

type BackButtonProps = {
  onPress: () => void;
};

const BackButton: React.FC<BackButtonProps> = ({ onPress }) => {
  return (
    <TouchableOpacity style={styles.button} onPress={onPress}>
      <Ionicons name="arrow-back-sharp" size={28} color="black" />
    </TouchableOpacity>
  );
};

export default BackButton;

const styles = StyleSheet.create({
  button: {
    position: "absolute",
    top: 60, // adjust for safe area
    left: 14,
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
  },
});
