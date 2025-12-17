import { Ionicons } from "@expo/vector-icons";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  ImageBackground,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { CHAT_SERVER_URL } from "../services/api";

export default function ResetPassword() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const email = params.email as string;
  const userId = params.userId as string;

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [confirmTouched, setConfirmTouched] = useState(false);

  // Same rule as Register screen: min 8 chars, upper, lower, digit
  const validatePassword = (p: string) =>
    p.length >= 8 && /[A-Z]/.test(p) && /[a-z]/.test(p) && /\d/.test(p);

  const handleResetPassword = async () => {
    setPasswordTouched(true);
    setConfirmTouched(true);

    if (!password || !confirmPassword) {
      Alert.alert("Missing Fields", "Please fill in both password fields.");
      return;
    }

    if (!validatePassword(password)) {
      Alert.alert(
        "Weak Password",
        "Password must be at least 8 characters long and include upper, lower case letters and a number."
      );
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Password Mismatch", "Passwords do not match. Please try again.");
      return;
    }

    if (!email || !userId) {
      Alert.alert(
        "Error",
        "Missing user information. Please restart the reset process."
      );
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(
        `${CHAT_SERVER_URL}/api/auth/reset-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            userId,
            newPassword: password,
          }),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        Alert.alert(
          "Reset Failed",
          data.error || "We could not reset your password. Please try again."
        );
        return;
      }

      Alert.alert(
        "Password Updated",
        "Your password has been reset successfully. You can now sign in with your new password.",
        [
          {
            text: "Go to Sign In",
            onPress: () => router.replace("/screen/SignIn"),
          },
        ]
      );
    } catch (error) {
      console.error("Error resetting password:", error);
      Alert.alert(
        "Error",
        "Something went wrong while resetting your password. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <ImageBackground
      source={require("@/assets/images/bguser.png")}
      style={styles.background}
      resizeMode="cover"
    >
      {/* Back Button */}
      <TouchableOpacity
        onPress={() => router.back()}
        style={styles.backButton}
      >
        <Ionicons name="arrow-back-sharp" size={28} color="white" />
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* WHITE CARD */}
        <View style={styles.card}>
          {/* Small gray bar on top */}
          <View style={styles.handleBar} />

          {/* Title */}
          <Text style={styles.title}>Create New Password</Text>
          <Text style={styles.subtitle}>
            Set a strong password that you haven&apos;t used with this account
            before.
          </Text>

          {/* New Password */}
          <View style={styles.inputContainer}>
            <FontAwesome name="lock" size={30} color="#355E1C" />
            <TextInput
              placeholder="New password"
              placeholderTextColor="#9AA29A"
              secureTextEntry={!showPassword}
              style={styles.input}
              value={password}
              onChangeText={(value) => {
                setPassword(value);
                if (!passwordTouched) setPasswordTouched(true);
              }}
              autoCapitalize="none"
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
            >
              <Ionicons
                name={showPassword ? "eye-off-outline" : "eye-outline"}
                size={25}
                color="gray"
              />
            </TouchableOpacity>
          </View>
          {passwordTouched && password.length > 0 && !validatePassword(password) && (
            <Text style={styles.errorText}>
              Password must be at least 8 characters long and include upper, lower case letters and a number.
            </Text>
          )}

          {/* Confirm Password */}
          <View style={styles.inputContainer}>
            <FontAwesome name="lock" size={30} color="#355E1C" />
            <TextInput
              placeholder="Confirm new password"
              placeholderTextColor="#9AA29A"
              secureTextEntry={!showConfirmPassword}
              style={styles.input}
              value={confirmPassword}
              onChangeText={(value) => {
                setConfirmPassword(value);
                if (!confirmTouched) setConfirmTouched(true);
              }}
              autoCapitalize="none"
            />
            <TouchableOpacity
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              <Ionicons
                name={showConfirmPassword ? "eye-off-outline" : "eye-outline"}
                size={25}
                color="gray"
              />
            </TouchableOpacity>
          </View>
          {confirmTouched &&
            confirmPassword.length > 0 &&
            password !== confirmPassword && (
              <Text style={styles.errorText}>Passwords do not match</Text>
            )}

          {/* Reset Button */}
          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.buttonDisabled]}
            onPress={handleResetPassword}
            disabled={loading}
          >
            <Text style={styles.primaryButtonText}>
              {loading ? "Updating..." : "Reset Password"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1 },
  backButton: {
    position: "absolute",
    top: 50,
    left: 14,
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  container: {
    flexGrow: 1,
    justifyContent: "flex-end",
    paddingHorizontal: 0,
    paddingBottom: 0,
  },
  card: {
    backgroundColor: "white",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 25,
    paddingTop: 20,
    paddingBottom: 30,
    height: "70%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  handleBar: {
    alignSelf: "center",
    width: 80,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D3D3D3",
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    textAlign: "center",
    color: "#355E1C",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 24,
    fontWeight: "500",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 5,
    paddingHorizontal: 15,
    marginBottom: 15,
    height: 50,
    borderWidth: 1,
    borderColor: "gray",
  },
  input: {
    flex: 1,
    fontSize: 16,
    marginLeft: 10,
    fontWeight: "bold",
    color: "#111827",
  },
  errorText: {
    fontSize: 12,
    color: "#EF4444",
    marginTop: 4,
    marginLeft: 5,
    fontWeight: "500",
  },
  primaryButton: {
    backgroundColor: "#355E1C",
    borderRadius: 10,
    height: 50,
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 20,
  },
  primaryButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

