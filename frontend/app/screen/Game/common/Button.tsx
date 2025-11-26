import React from "react";
import { TouchableOpacity, Text, StyleSheet } from "react-native";

type Props = {
  onPress: () => void;
  label: string; // Use plain text instead of labelKey
  variant: "primary" | "secondary";
  reverse?: boolean;
  disabled?: boolean;
};

const Button: React.FC<Props> = ({ onPress, label, variant, reverse, disabled }) => {
  const primaryStyle = [styles.base, styles.primary, disabled && styles.disabled];
  const secondaryStyle = [
    styles.base,
    styles.secondary,
    reverse && styles.secondaryReverse,
    disabled && styles.disabled,
  ];

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={variant === "primary" ? primaryStyle : secondaryStyle}
    >
      <Text
        style={[
          variant === "primary" ? styles.primaryText : styles.secondaryText,
          reverse && variant === "secondary" ? styles.secondaryReverseText : null,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
};

export default Button;

const styles = StyleSheet.create({
  base: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 6,
    minWidth: 120,
  },
  primary: {
    backgroundColor: "orange",
    borderColor: "#444",
  },
  secondary: {
    backgroundColor: "transparent",
    borderColor: "#444",
  },
  secondaryReverse: {
    borderColor: "#ccc",
    backgroundColor: "#444",
  },
  disabled: {
    backgroundColor: "#888",
    borderColor: "#555",
  },
  primaryText: {
    color: "#fff",
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  secondaryText: {
    color: "#444",
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  secondaryReverseText: {
    color: "#ccc",
  },
});
