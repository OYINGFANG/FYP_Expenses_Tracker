import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ImageBackground,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function SignIn() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);

  return (
    <ImageBackground
      source={require("@/assets/images/aurilanding.png")}
      style={styles.background}
      resizeMode="cover"
    >
      {/* Bottom Buttons */}
      <View style={styles.bottomButtons}>
        <TouchableOpacity
          style={styles.loginButton}
          onPress={() => router.push("/screen/SignIn")}
        >
          <Text style={styles.loginText}>Login</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.registerButton}
          onPress={() => router.push("/screen/SignUp")}
        >
          <Text style={styles.registerText}>Register</Text>
        </TouchableOpacity>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: "#000" },

  bottomButtons: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  loginButton: {
    flex: 1,
    backgroundColor: "transparent",
    height: 60,
    marginLeft: -20,
    justifyContent: "center",
    alignItems: "center",
  },
  registerButton: {
    flex: 1,
    backgroundColor: "transparent",
    borderRadius: 25,
    height: 50,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 30,
    marginTop: 5,
  },
  loginText: {
    color: "white",   
    fontSize: 25,
    fontWeight: "bold",
  },
  registerText: {
    color: "#264d18",   
    fontSize: 25,
    fontWeight: "bold",
  },
});
