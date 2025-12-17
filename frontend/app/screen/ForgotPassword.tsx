import { Ionicons } from "@expo/vector-icons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useRouter } from "expo-router";
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

export default function ForgotPassword() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const validateEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  const handleSendCode = async () => {
    if (!email) {
      Alert.alert("Missing Email", "Please enter your email address.");
      return;
    }

    if (!validateEmail(email)) {
      Alert.alert("Invalid Email", "Please enter a valid email address.");
      return;
    }

    try {
      setLoading(true);

      // Ask backend to send a password-reset OTP email
      const response = await fetch(
        `${CHAT_SERVER_URL}/api/auth/request-password-reset`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email }),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        Alert.alert(
          "Request Failed",
          data.error ||
            "We could not start the reset process. Please check your email and try again."
        );
        return;
      }

      // We expect the backend to return the userId and (optionally) username
      const userId = data.userId as string | undefined;
      const username = (data.username as string | undefined) || "User";

      Alert.alert(
        "Code Sent",
        "A 6-digit verification code has been sent to your email.",
        [
          {
            text: "OK",
            onPress: () =>
              router.push({
                pathname: "/screen/OTPVerification",
                params: {
                  email,
                  userId,
                  username,
                  purpose: "resetPassword",
                },
              }),
          },
        ]
      );
    } catch (error) {
      console.error("Error requesting password reset:", error);
      Alert.alert(
        "Error",
        "Something went wrong while requesting the reset code. Please try again."
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
      {/* Back Button (same style as SignIn / SignUp) */}
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
          <Text style={styles.title}>Forgot Password</Text>
          <Text style={styles.subtitle}>
            Enter your registered email and we&apos;ll send you a verification
            code to reset your password.
          </Text>

          {/* Email */}
          <View style={styles.inputContainer}>
            <MaterialCommunityIcons name="email" size={30} color="#355E1C" />
            <TextInput
              placeholder="Enter your email"
              placeholderTextColor="#9AA29A"
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          {/* Send Code Button */}
          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.buttonDisabled]}
            onPress={handleSendCode}
            disabled={loading}
          >
            <Text style={styles.primaryButtonText}>
              {loading ? "Sending..." : "Send Code"}
            </Text>
          </TouchableOpacity>

          {/* Back to Sign In */}
          <Text style={styles.footerText}>
            Remember your password?{" "}
            <Text
              style={styles.link}
              onPress={() => router.push("/screen/SignIn")}
            >
              Sign In
            </Text>
          </Text>
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
  footerText: {
    textAlign: "center",
    color: "black",
    fontSize: 14,
  },
  link: {
    color: "#355E1C",
    fontWeight: "bold",
    fontSize: 16,
  },
});