// components/BottomNav.js
import { FontAwesome } from "@expo/vector-icons";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useRouter } from "expo-router"; 
import React, { useRef, useState, useEffect } from "react";
import { StyleSheet, Text, TouchableOpacity, View, Image } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useOnboarding } from "../context/OnboardingContext";

const BottomNav = () => {
  const router = useRouter();
  const { isOnboardingActive, currentStep, nextStep, setHighlightPosition } = useOnboarding();
  
  const walletTabRef = useRef<React.ElementRef<typeof TouchableOpacity>>(null);
  const auriTabRef = useRef<React.ElementRef<typeof TouchableOpacity>>(null);
  const gamesTabRef = useRef<React.ElementRef<typeof TouchableOpacity>>(null);
  const [walletTabLayout, setWalletTabLayout] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [auriTabLayout, setAuriTabLayout] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [gamesTabLayout, setGamesTabLayout] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  // Update highlight position when step changes or layout changes
  useEffect(() => {
    if (isOnboardingActive && currentStep === 2 && walletTabLayout) {
      console.log("Setting Wallet tab highlight position:", walletTabLayout);
      // Make the highlight box wider for the Wallet tab
      setHighlightPosition({
        ...walletTabLayout,
        width: walletTabLayout.width + 30, // Increase width by 40px
        height: walletTabLayout.height + 30,
        x: walletTabLayout.x - 15, // Shift left by 20px to center the wider box
        y: walletTabLayout.y - 15,
      });
    } else if (isOnboardingActive && currentStep === 3 && auriTabLayout) {
      console.log("Setting Auri AI tab highlight position:", auriTabLayout);
      // Make the highlight box bigger for the Auri AI tab
      setHighlightPosition({
        ...auriTabLayout,
        height: auriTabLayout.height + 65, // Increase height by 65px
        width: auriTabLayout.width - 5, // Decrease width by 10px to make it smaller
        y: auriTabLayout.y - 20, // Shift up by 20px to center the taller box
        x: auriTabLayout.x + 3, // Shift right by 5px to center the narrower box
      });
    } else if (isOnboardingActive && currentStep === 6 && gamesTabLayout) {
      console.log("Setting Games tab highlight position:", gamesTabLayout);
      // Make the highlight box wider for the Games tab
      setHighlightPosition({
        ...gamesTabLayout,
        width: gamesTabLayout.width + 30, // Increase width by 30px
        height: gamesTabLayout.height + 30,
        x: gamesTabLayout.x - 15, // Shift left by 15px to center the wider box
        y: gamesTabLayout.y - 10,
      });
    } else if (!isOnboardingActive) {
      setHighlightPosition(null);
    }
  }, [isOnboardingActive, currentStep, walletTabLayout, auriTabLayout, gamesTabLayout, setHighlightPosition]);

  return (
    <View style={styles.container}>
      {/* Home */}
      <TouchableOpacity style={styles.tab} onPress={() => router.push("/screen/ExpensesDetail")}>
        <FontAwesome name="home" size={32} color="#fff" />
        <Text style={styles.label}>Home</Text>
      </TouchableOpacity>

      {/* History */}
      <TouchableOpacity
        ref={walletTabRef}
        style={[styles.tab, styles.historyTab]}
        onPress={() => {
          if (isOnboardingActive && currentStep === 2) {
            // Complete the step when user taps Wallet during onboarding (Step 3 = view_wallet, displayed as "3 / 6")
            nextStep();
          }
          router.push("/screen/WalletOverview");
        }}
        onLayout={(event) => {
          const { x, y, width, height } = event.nativeEvent.layout;
          walletTabRef.current?.measureInWindow((px, py, fwidth, fheight) => {
            console.log("Wallet tab layout:", { x: px, y: py, width: fwidth, height: fheight });
            setWalletTabLayout({ x: px, y: py, width: fwidth, height: fheight });
          });
        }}
      >
        <FontAwesome5 name="history" size={25} color="#fff" />
        <Text style={styles.label}>Wallet</Text>
      </TouchableOpacity>

      {/* Center Auri AI */}
      <TouchableOpacity
        ref={auriTabRef}
        style={styles.centerButton}
        onPress={() => {
          if (isOnboardingActive && currentStep === 3) {
            // Complete the step when user taps Auri AI during onboarding (Step 4 = auri_ai, displayed as "4 / 6")
            nextStep();
          }
          router.push("/screen/Avatar");
        }}
        onLayout={(event) => {
          const { x, y, width, height } = event.nativeEvent.layout;
          auriTabRef.current?.measureInWindow((px, py, fwidth, fheight) => {
            console.log("Auri AI tab layout:", { x: px, y: py, width: fwidth, height: fheight });
            setAuriTabLayout({ x: px, y: py, width: fwidth, height: fheight });
          });
        }}
      >
        <View style={styles.centerIcon}>
          <Image
            source={require("@/assets/images/Auriicon.png")}
            style={styles.centerIconImage}
            resizeMode="contain"
          />
        </View>
        <Text style={[styles.label, styles.centerLabel]}>Auri AI</Text>
      </TouchableOpacity>

      {/* Games */}
      <TouchableOpacity
        ref={gamesTabRef}
        style={styles.tab}
        onPress={() => {
          console.log("Games tab pressed, onboarding active:", isOnboardingActive, "step:", currentStep);
          if (isOnboardingActive && currentStep === 6) {
            // Mark that user is completing step 6 (games), will advance when they return
            AsyncStorage.setItem("onboardingStep6Completed", "true");
          }
          router.push("/screen/Game/titlePage/TitlePage");
        }}
        onLayout={(event) => {
          const { x, y, width, height } = event.nativeEvent.layout;
          // Get absolute position relative to window
          gamesTabRef.current?.measureInWindow((px: number, py: number, fwidth: number, fheight: number) => {
            console.log("Games tab layout:", { x: px, y: py, width: fwidth, height: fheight });
            setGamesTabLayout({ 
              x: px, 
              y: py, 
              width: fwidth, 
              height: fheight 
            });
          });
        }}
      >
        <Ionicons name="game-controller" size={32} color="#fff" />
        <Text style={styles.label}>Games</Text>
      </TouchableOpacity>

      {/* Account */}
      <TouchableOpacity style={styles.tab} onPress={() => router.push("/screen/Profile")}>
        <MaterialCommunityIcons name="account-box" size={33} color="#fff" />
        <Text style={styles.label}>Account</Text>
      </TouchableOpacity>
    </View>
  );
};

export default BottomNav;

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#115D59",
    height: 80,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    position: "absolute",
    bottom: 0,
    width: "100%",
    paddingHorizontal: 25,
    paddingBottom: 6,
  },
  tab: {
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 12,
    marginTop: 4,
    color: "#fff",
  },
  historyTab: {
    marginTop: 6,
  },
  centerLabel: {
    fontSize: 17,
    fontWeight: "bold",
    color: "#fff",
    marginTop: -3,
  },
  centerButton: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  centerIcon: {
    width: 85,
    height: 85,
    borderRadius: 42.5,
    backgroundColor: "#C7E59E",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 8,
    borderColor: "#115D59",
    overflow: "hidden",        // 🔑 clip image to the circle
  },
  centerIconImage: {
    width: "160%",               // make it big but with a tiny margin
    height: "160%",
    resizeMode: "contain",
  },
});
