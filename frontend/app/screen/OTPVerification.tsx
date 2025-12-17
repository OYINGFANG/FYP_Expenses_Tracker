// app/screen/OTPVerification.tsx
import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Keyboard,
  ImageBackground,
  ScrollView,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { CHAT_SERVER_URL } from "../services/api";

export default function OTPVerification() {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  const email = params.email as string;
  const userId = params.userId as string;
  const username = (params.username as string) || "User";
  const purpose = (params.purpose as string) || "verifyEmail"; // "verifyEmail" | "resetPassword"

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  // Start countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleOtpChange = (index: number, value: string) => {
    // Only allow numbers
    if (value && !/^\d+$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value.slice(-1); // Only take last character
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits are filled
    if (index === 5 && value) {
      const fullOtp = newOtp.join("");
      if (fullOtp.length === 6) {
        handleVerify(fullOtp);
      }
    }
  };

  const handleKeyPress = (index: number, key: string) => {
    if (key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (otpCode?: string) => {
    const code = otpCode || otp.join("");
    
    if (code.length !== 6) {
      Alert.alert("Invalid Code", "Please enter a 6-digit code");
      return;
    }

    if (!userId) {
      Alert.alert("Error", "User ID is missing");
      return;
    }

    setLoading(true);
    Keyboard.dismiss();

    try {
      const endpoint =
        purpose === "resetPassword"
          ? "/api/auth/verify-reset-otp"
          : "/api/email/verify-otp";

      const response = await fetch(`${CHAT_SERVER_URL}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          otpCode: code,
          email,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        if (purpose === "resetPassword") {
          // Go to reset password screen after successful OTP verification
          router.push({
            pathname: "/screen/ResetPassword",
            params: {
              email,
              userId,
            },
          });
        } else {
          Alert.alert(
            "✅ Success",
            "Your email has been verified successfully!",
            [
              {
                text: "Continue",
                onPress: () => router.replace("/screen/SignIn"),
              },
            ]
          );
        }
      } else {
        Alert.alert(
          "Verification Failed",
          data.error || "Invalid OTP code. Please try again."
        );
        // Clear OTP inputs on failure
        setOtp(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
      }
    } catch (error: any) {
      console.error("Error verifying OTP:", error);
      Alert.alert("Error", "Failed to verify OTP. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (countdown > 0) return;

    if (!email || !userId) {
      Alert.alert("Error", "Email or User ID is missing");
      return;
    }

    setResending(true);
    try {
      const endpoint =
        purpose === "resetPassword"
          ? "/api/auth/request-password-reset"
          : "/api/email/resend-otp";

      const response = await fetch(`${CHAT_SERVER_URL}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          userId,
          username: username || "User",
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        Alert.alert("✅ Code Sent", "A new verification code has been sent to your email.");
        setCountdown(60); // 60 second countdown
        setOtp(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();

        // If in test mode, show the OTP code
        if (data.testMode && data.otpCode) {
          Alert.alert(
            "Test Mode",
            `Your OTP code is: ${data.otpCode}`,
            [{ text: "OK" }]
          );
        }
      } else {
        Alert.alert("Error", data.error || "Failed to resend code. Please try again.");
      }
    } catch (error: any) {
      console.error("Error resending OTP:", error);
      Alert.alert("Error", "Failed to resend code. Please check your connection and try again.");
    } finally {
      setResending(false);
    }
  };

  return (
    <ImageBackground
      source={require("@/assets/images/bguser.png")}
      style={styles.background}
      resizeMode="cover"
    >
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
          <Text style={styles.title}>Verify Your Email</Text>
          <Text style={styles.subtitle}>
            We've sent a 6-digit verification code to
          </Text>

          {/* Email Display */}
          <View style={styles.emailContainer}>
            <MaterialCommunityIcons name="email" size={24} color="#355E1C" />
            <Text style={styles.email}>{email}</Text>
          </View>

          {/* OTP Label */}
          <Text style={styles.label}>Enter Verification Code</Text>

          {/* OTP Input */}
          <View style={styles.otpContainer}>
            {otp.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => (inputRefs.current[index] = ref)}
                style={[
                  styles.otpInput,
                  digit && styles.otpInputFilled,
                ]}
                value={digit}
                onChangeText={(value) => handleOtpChange(index, value)}
                onKeyPress={({ nativeEvent }) =>
                  handleKeyPress(index, nativeEvent.key)
                }
                keyboardType="number-pad"
                maxLength={1}
                selectTextOnFocus
              />
            ))}
          </View>

          {/* Verify Button */}
          <TouchableOpacity
            style={[
              styles.verifyButton,
              (loading || otp.join("").length !== 6) &&
                styles.verifyButtonDisabled,
            ]}
            onPress={() => handleVerify()}
            disabled={loading || otp.join("").length !== 6}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.verifyButtonText}>Verify</Text>
                <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
              </>
            )}
          </TouchableOpacity>

          {/* Resend */}
          <View style={styles.resendContainer}>
            <Text style={styles.resendText}>Didn't receive the code? </Text>
            <TouchableOpacity
              onPress={handleResendOTP}
              disabled={countdown > 0 || resending}
              activeOpacity={0.7}
            >
              {resending ? (
                <ActivityIndicator size="small" color="#355E1C" />
              ) : (
                <Text
                  style={[
                    styles.resendLink,
                    countdown > 0 && styles.resendLinkDisabled,
                  ]}
                >
                  {countdown > 0 ? `Resend in ${countdown}s` : "Resend Code"}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
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
    // shadow for iOS
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    // elevation for Android
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
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 20,
    fontWeight: "500",
  },
  emailContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  email: {
    fontSize: 16,
    fontWeight: "600",
    color: "#355E1C",
    marginLeft: 10,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: "#355E1C",
    marginBottom: 12,
    marginTop: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  otpContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 30,
    paddingHorizontal: 0,
    gap: 10,
  },
  otpInput: {
    flex: 1,
    height: 60,
    backgroundColor: "white",
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "gray",
    textAlign: "center",
    fontSize: 28,
    fontWeight: "700",
    color: "#355E1C",
  },
  otpInputFilled: {
    borderColor: "#355E1C",
    borderWidth: 2,
    backgroundColor: "#F0F9F4",
  },
  verifyButton: {
    backgroundColor: "#355E1C",
    borderRadius: 10,
    height: 50,
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 20,
    flexDirection: "row",
    gap: 10,
  },
  verifyButtonDisabled: {
    opacity: 0.5,
  },
  verifyButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  resendContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  resendText: {
    color: "black",
    fontSize: 14,
  },
  resendLink: {
    color: "#355E1C",
    fontWeight: "bold",
    fontSize: 14,
  },
  resendLinkDisabled: {
    color: "#9CA3AF",
  },
});

