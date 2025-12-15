import { Ionicons } from "@expo/vector-icons";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import React, { useEffect, useState } from "react";
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
import { auth } from "../../firebase";
import { useOnboarding } from "../context/OnboardingContext";

export default function SignIn() {
  const router = useRouter();
  const { checkOnboardingStatus } = useOnboarding();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  useEffect(() => {
    const loadSavedCredentials = async () => {
      try {
        const storedEmail = await AsyncStorage.getItem("email");
        const storedPassword = await AsyncStorage.getItem("password");

        if (storedEmail) {
          setEmail(storedEmail);
          setRememberMe(true);
        }
        if (storedPassword) {
          setPassword(storedPassword);
        }
      } catch (error) {
        console.error("Error loading saved credentials:", error);
      }
    };

    loadSavedCredentials();
  }, []);

  useEffect(() => {
    const checkLoginStatus = async () => {
      const loggedIn = await AsyncStorage.getItem("loggedIn");
      if (loggedIn === "true") {
        // Navigate to Home - onboarding will be handled by OnboardingContext
        router.replace("/screen/Home");
      }
    };
    checkLoginStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please enter email and password");
      return;
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      const userId = user.uid;

      if (rememberMe) {
        await AsyncStorage.setItem("email", email);
        await AsyncStorage.setItem("password", password);
      } else {
        await AsyncStorage.removeItem("email");
        await AsyncStorage.removeItem("password");
      }

      await AsyncStorage.setItem("loggedIn", "true");
      await AsyncStorage.setItem("userId", userId);
      await AsyncStorage.setItem("userEmail", email);

      Alert.alert("✅ Success", "Logged in successfully!");
      
      // Check onboarding status after login (with a small delay to ensure state is set)
      setTimeout(async () => {
        await checkOnboardingStatus();
      }, 300);
      
      // Navigate to Home - onboarding will be handled by OnboardingContext
      router.replace("/screen/Home");
    } catch (error) {
      console.log("❌ Login Error:", error);
      Alert.alert("Login Failed");
    }
  };

  return (
    <ImageBackground
      source={require("@/assets/images/bguser.png")}
      style={styles.background}
      resizeMode="cover"
    >
      <TouchableOpacity
        onPress={() => router.push("/screen/Welcome")}
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
          <Text style={styles.title}>Welcome back</Text>

          {/* Email */}
          <View style={styles.inputContainer}>
            <MaterialCommunityIcons name="email" size={30} color="#355E1C" />
            <TextInput
              placeholder="Enter email"
              placeholderTextColor="#9AA29A"
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          {/* Password */}
          <View style={styles.inputContainer}>
            <FontAwesome name="lock" size={30} color="#355E1C" />
            <TextInput
              placeholder="Enter password"
              placeholderTextColor="#9AA29A"
              secureTextEntry={!showPassword}
              style={styles.input}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Ionicons
                name={showPassword ? "eye-off-outline" : "eye-outline"}
                size={25}
                color="gray"
              />
            </TouchableOpacity>
          </View>

          {/* Remember Me + Forgot Password */}
          <View style={styles.rowBetween}>
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setRememberMe(!rememberMe)}
            >
              <Ionicons
                name={rememberMe ? "checkbox" : "square-outline"}
                size={25}
                color="#345d1c"
              />
              <Text style={styles.rememberText}>Remember me</Text>
            </TouchableOpacity>

            <Text
              style={styles.link}
              onPress={() => router.push("/screen/ForgetPassword")}
            >
              Forgot Password?
            </Text>
          </View>

          {/* Sign In Button */}
          <TouchableOpacity style={styles.signInButton} onPress={handleLogin}>
            <Text style={styles.signInText}>Sign In</Text>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.line} />
            <Text style={styles.dividerText}>Or sign in with</Text>
            <View style={styles.line} />
          </View>

          {/* Social Icons */}
          <View style={styles.socialRow}>
            <FontAwesome name="facebook" size={35} color="#345d1c" />
            <FontAwesome name="twitter" size={35} color="#345d1c" />
            <FontAwesome name="google" size={35} color="#345d1c" />
            <FontAwesome name="apple" size={35} color="#345d1c" />
          </View>

          {/* Sign Up link */}
          <Text style={styles.footerText}>
            Don’t have an account?{" "}
            <Text
              style={styles.link}
              onPress={() => router.push("/screen/SignUp")}
            >
              Sign Up
            </Text>
          </Text>
        </View>
      </ScrollView>
    </ImageBackground>
  );
}

// ✅ Styles
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
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 5,
    paddingHorizontal: 15,
    marginBottom: 15,
    marginTop: 15,
    height: 50,
    borderWidth: 1,
    borderColor: "gray",
  },
  input: {
    flex: 1,
    fontSize: 16,
    marginLeft: 10,
    fontWeight: "bold",
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 10,
  },
  signInButton: {
    backgroundColor: "#355E1C",
    borderRadius: 10,
    height: 50,
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 20,
  },
  signInText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  socialRow: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    marginVertical: 20,
  },
  footerText: { textAlign: "center", color: "black" },
  link: {
    color: "#355E1C",
    fontWeight: "bold",
    fontSize: 16,
  },
  checkboxRow: { flexDirection: "row", alignItems: "center", marginVertical: 10 },
  rememberText: {
    marginLeft: 8,
    color: "black",
    fontSize: 16,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 10,
  },
  line: { flex: 1, height: 1, backgroundColor: "gray" },
  dividerText: {
    marginHorizontal: 15,
    color: "gray",
    fontSize: 14,
  },
});
