// app/screen/Register.tsx
import { Ionicons } from "@expo/vector-icons";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Modal,
  Platform,
  ImageBackground,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "../../firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { CHAT_SERVER_URL } from "../services/api";

const GENDERS = ["Male", "Female", "Other", "Prefer not to say"];

export default function Register() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [gender, setGender] = useState("");
  const [dob, setDob] = useState<Date | null>(null); // no default DOB

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // UI controls
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Modals
  const [showGenderModal, setShowGenderModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Derived: age text / validation
  const ageText = useMemo(() => {
    if (!dob) return "";
    const now = new Date();
    let age = now.getFullYear() - dob.getFullYear();
    const m = now.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
    return `${age} years old`;
  }, [dob]);

  const isUnder13 = useMemo(() => {
    if (!dob) return false;
    const now = new Date();
    const th13 = new Date(now.getFullYear() - 13, now.getMonth(), now.getDate());
    return dob > th13;
  }, [dob]);

  // user_id generator
  const generateUserId = () => {
    const randomNum = Math.floor(1 + Math.random() * 999)
      .toString()
      .padStart(3, "0");
    return `AA${randomNum}`;
  };

  const validateEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  // Basic strong password check: at least 8 chars, one uppercase, one lowercase, one digit
  const validatePassword = (p: string) =>
    p.length >= 8 && /[A-Z]/.test(p) && /[a-z]/.test(p) && /\d/.test(p);

  const handleRegister = async () => {
    // Validation
    if (!username || !email || !password || !confirmPassword || !gender || !dob) {
      Alert.alert("Missing Information", "Please fill in all required fields");
      return;
    }
    if (!validateEmail(email)) {
      Alert.alert("Invalid Email", "Please enter a valid email address");
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
    if (isUnder13) {
      Alert.alert("Age Restriction", "You must be at least 13 years old to create an account.");
      return;
    }

    setIsLoading(true);
    try {
      // 1) Auth
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const user = cred.user;

      // 2) Doc payload
      const userId = generateUserId();
      const userDoc = {
        user_id: userId,
        username,
        user_email: email,
        user_password: password,
        user_gender: gender,
        user_dob: dob ? dob.toISOString() : null,
        // Mark brand new accounts; can be flipped to 'Active' after onboarding
        accountStatus: "Active",
        onboardingCompleted: false,
        avatarUrl: "",
        emailVerified: false, // Email verification status
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      };

      // 3) Save Firestore
      await setDoc(doc(db, "USERS", user.uid), userDoc);

      // 4) Send verification email (optional - only if backend is configured)
      try {
        // Use the same backend URL as other screens (from api.ts)
        // CHAT_SERVER_URL is already configured for your environment
        const response = await fetch(`${CHAT_SERVER_URL}/api/email/send-verification`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            userId: user.uid,
            username,
          }),
        });
        
        if (response.ok) {
          console.log("✅ Verification email sent successfully");
        } else {
          console.warn("⚠️ Verification email endpoint returned error:", response.status);
        }
      } catch (emailError) {
        console.warn("⚠️ Could not send verification email:", emailError);
        // Don't fail registration if email fails - email verification is optional
      }

      setIsLoading(false);
      
      // Navigate to OTP verification screen
      router.push({
        pathname: "/screen/OTPVerification",
        params: {
          email: email,
          userId: user.uid,
          username: username,
        },
      });
    } catch (error: any) {
      setIsLoading(false);
      console.error("Error during registration:", error);
      let errorMessage = "An error occurred during registration";
      if (error.code === "auth/email-already-in-use") {
        errorMessage = "This email is already registered. Please sign in or use a different email.";
      } else if (error.code === "auth/weak-password") {
        errorMessage = "Password is too weak. Please use a stronger password.";
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "Invalid email address format.";
      }
      Alert.alert("❌ Registration Failed", errorMessage);
    }
  };

  // Initial cursor for picker UI only (NOT saved unless user confirms)
  const pickerStartDate = dob ?? new Date(2000, 0, 1);

  return (
    <View style={styles.safe}>
      <ImageBackground
        source={require("@/assets/images/bguser.png")}
        style={styles.background}
        resizeMode="cover"
      >
        {/* Top back arrow (outside the white sheet) */}
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={8}
        >
          <Ionicons name="arrow-back-sharp" size={28} color="white" />
        </TouchableOpacity>

        {/* Bottom sheet fixed, only inner content scrolls */}
        <View style={styles.sheetContainer}>
          <View style={styles.formCard}>
            {/* Handle bar */}
            <View style={styles.handleBar} />

            {/* Title + subtitle (fixed) */}
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>
              Join us to start managing your finances
            </Text>

            {/* Scrollable form content */}
            <ScrollView
              contentContainerStyle={styles.formScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Username */}
              <View style={styles.inputWrapper}>
                <Text style={styles.label}>Username *</Text>
                <View style={styles.inputContainer}>
                  <FontAwesome name="user" size={28} color="#355E1C" />
                  <TextInput
                    placeholder="Enter your username"
                    placeholderTextColor="#9CA3AF"
                    style={styles.input}
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                  />
                </View>
              </View>

              {/* Email */}
              <View style={styles.inputWrapper}>
                <Text style={styles.label}>Email Address *</Text>
                <View style={styles.inputContainer}>
                  <MaterialCommunityIcons
                    name="email"
                    size={30}
                    color="#355E1C"
                  />
                  <TextInput
                    placeholder="Enter your email"
                    placeholderTextColor="#9CA3AF"
                    style={styles.input}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
              </View>

              {/* Gender */}
              <View style={styles.inputWrapper}>
                <Text style={styles.label}>Gender *</Text>
                <TouchableOpacity
                  style={styles.inputContainer}
                  onPress={() => setShowGenderModal(true)}
                >
                  <Ionicons name="person-outline" size={30} color="#355E1C" />
                  <Text
                    style={[
                      styles.input,
                      !gender && { color: "#9CA3AF" },
                    ]}
                  >
                    {gender || "Select your gender"}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color="gray" />
                </TouchableOpacity>
              </View>

              {/* Date of Birth */}
              <View style={styles.inputWrapper}>
                <Text style={styles.label}>Date of Birth *</Text>
                <TouchableOpacity
                  style={styles.inputContainer}
                  onPress={() => setShowDatePicker(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="calendar-outline"
                    size={30}
                    color="#355E1C"
                  />

                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.input,
                        !dob && { color: "#9CA3AF" },
                      ]}
                    >
                      {dob
                        ? dob.toLocaleDateString("en-US", {
                            month: "long",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "Select your date of birth"}
                    </Text>

                    {!!dob && (
                      <Text
                        style={{
                          color: isUnder13 ? "#DC2626" : "#6B7280",
                          fontSize: 12,
                          fontWeight: "600",
                          marginLeft: 10,
                        }}
                      >
                        {ageText} {isUnder13 ? "(Minimum age is 13)" : ""}
                      </Text>
                    )}
                  </View>

                  <Ionicons name="chevron-down" size={20} color="gray" />
                </TouchableOpacity>

                {!!dob && (
                  <TouchableOpacity
                    onPress={() => setDob(null)}
                    style={{ alignSelf: "flex-end", marginTop: 6 }}
                  >
                    <Text style={{ color: "#355E1C", fontWeight: "bold" }}>
                      Clear DOB
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Password */}
              <View style={styles.inputWrapper}>
                <Text style={styles.label}>Password *</Text>
                <View style={styles.inputContainer}>
                  <FontAwesome name="lock" size={32} color="#355E1C" />
                  <TextInput
                    placeholder="Create a password (min. 8 characters)"
                    placeholderTextColor="#9CA3AF"
                    secureTextEntry={!showPassword}
                    style={styles.input}
                    value={password}
                    onChangeText={setPassword}
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
                {password.length > 0 && password.length < 6 && (
                  <Text style={styles.errorText}>
                    Password must be at least 8 characters
                  </Text>
                )}
              </View>

              {/* Confirm Password */}
              <View style={styles.inputWrapper}>
                <Text style={styles.label}>Confirm Password *</Text>
                <View style={styles.inputContainer}>
                  <FontAwesome name="lock" size={32} color="#355E1C" />
                  <TextInput
                    placeholder="Re-enter your password"
                    placeholderTextColor="#9CA3AF"
                    secureTextEntry={!showConfirmPassword}
                    style={styles.input}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    onPress={() =>
                      setShowConfirmPassword(!showConfirmPassword)
                    }
                  >
                    <Ionicons
                      name={
                        showConfirmPassword
                          ? "eye-off-outline"
                          : "eye-outline"
                      }
                      size={25}
                      color="gray"
                    />
                  </TouchableOpacity>
                </View>
                {confirmPassword.length > 0 && password !== confirmPassword && (
                  <Text style={styles.errorText}>Passwords do not match</Text>
                )}
              </View>

              {/* Register */}
              <TouchableOpacity
                style={[
                  styles.registerButton,
                  isLoading && styles.registerButtonDisabled,
                ]}
                onPress={handleRegister}
                disabled={isLoading}
              >
                <Text style={styles.registerButtonText}>
                  {isLoading ? "Creating Account..." : "Create Account"}
                </Text>
                {!isLoading && (
                  <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
                )}
              </TouchableOpacity>

              {/* Sign in link */}
              <View style={styles.footer}>
                <Text style={styles.footerText}>Already have an account? </Text>
                <TouchableOpacity onPress={() => router.push("/screen/SignIn")}>
                  <Text style={styles.link}>Sign In</Text>
                </TouchableOpacity>
              </View>

              {/* Info box INSIDE the sheet */}
              <View style={styles.infoBox}>
                <Ionicons
                  name="information-circle-outline"
                  size={18}
                  color="#6B7280"
                />
                <Text style={styles.infoText}>
                  Your account will be created with status{" "}
                  <Text style={{ fontWeight: "700" }}>Active</Text>. You can
                  complete your profile after signing in.
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </ImageBackground>

      {/* Gender Modal */}
      <Modal
        visible={showGenderModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowGenderModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Gender</Text>
              <TouchableOpacity onPress={() => setShowGenderModal(false)}>
                <Ionicons name="close-circle" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            {GENDERS.map((g) => (
              <TouchableOpacity
                key={g}
                style={[
                  styles.modalOption,
                  gender === g && styles.modalOptionSelected,
                ]}
                onPress={() => {
                  setGender(g);
                  setShowGenderModal(false);
                }}
              >
                <Text
                  style={[
                    styles.modalOptionText,
                    gender === g && styles.modalOptionTextSelected,
                  ]}
                >
                  {g}
                </Text>
                {gender === g && (
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color="#355E1C"
                  />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* Date Picker Modal */}
      {showDatePicker && (
        <Modal
          visible={showDatePicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowDatePicker(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.datePickerCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Date of Birth</Text>
                <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                  <Ionicons name="close-circle" size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <DateTimePicker
                value={pickerStartDate}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "calendar"}
                maximumDate={new Date()}
                onChange={(event, selectedDate) => {
                  if (selectedDate) {
                    setDob(selectedDate);
                  }
                  if (Platform.OS === "android") {
                    setShowDatePicker(false);
                  }
                }}
                style={Platform.OS === "ios" ? styles.datePicker : undefined}
                textColor="#355E1C"
              />

              {Platform.OS === "ios" && (
                <TouchableOpacity
                  style={styles.doneButton}
                  onPress={() => setShowDatePicker(false)}
                >
                  <Text style={styles.doneButtonText}>Done</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#000" },
  background: { flex: 1 },

  // container that pins the sheet to the bottom
  sheetContainer: {
    flex: 1,
    justifyContent: "flex-end",
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

  // Bottom sheet card
  formCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 25,
    paddingTop: 20,
    paddingBottom: 30,
    width: "100%",
    height: "70%", 
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },

  // inner scroll content inside sheet
  formScrollContent: {
    paddingBottom: 32,
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
    color: "#355E1C",
    textAlign: "center",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 16,
    fontWeight: "500",
  },

  // Inputs
  inputWrapper: { marginBottom: 15 },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: "#355E1C",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 5,
    paddingHorizontal: 15,
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
    marginLeft: 15,
    fontWeight: "500",
  },

  // Register button
  registerButton: {
    backgroundColor: "#355E1C",
    borderRadius: 10,
    height: 50,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    columnGap: 8,
    marginTop: 8,
    marginBottom: 20,
  },
  registerButtonDisabled: { opacity: 0.6 },
  registerButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "bold",
  },

  // Footer
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  footerText: { color: "black", fontSize: 14, fontWeight: "500" },
  link: { color: "#355E1C", fontWeight: "bold", fontSize: 16 },

  // Info box inside sheet
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#F9FAFB",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: "#6B7280",
    lineHeight: 18,
    fontWeight: "500",
  },

  // Modals
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === "ios" ? 40 : 20,
    maxHeight: "70%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#355E1C",
  },
  modalOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: "#F9FAFB",
  },
  modalOptionSelected: {
    backgroundColor: "#D1FAE5",
    borderWidth: 1.5,
    borderColor: "#355E1C",
  },
  modalOptionText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#374151",
  },
  modalOptionTextSelected: { color: "#355E1C", fontWeight: "700" },

  // Date Picker Modal
  datePickerCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === "ios" ? 40 : 20,
  },
  datePicker: {
    width: "100%",
    height: 200,
    backgroundColor: "#FFFFFF",
  },
  doneButton: {
    backgroundColor: "#355E1C",
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 16,
    alignItems: "center",
  },
  doneButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});