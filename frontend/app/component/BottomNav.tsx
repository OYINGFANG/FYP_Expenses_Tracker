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
        width: walletTabLayout.width + 25, // Increase width by 30px
        height: walletTabLayout.height + 25,
        x: walletTabLayout.x - 12, // Shift left by 15px to center the wider box
        y: walletTabLayout.y - 15,
      });
    } else if (isOnboardingActive && currentStep === 3 && auriTabLayout) {
      console.log("Setting Auri AI tab highlight position:", auriTabLayout);
      // Make the highlight box bigger for the Auri AI tab
      setHighlightPosition({
        ...auriTabLayout,
        height: auriTabLayout.height + 32, // Increase height by 65px
        width: auriTabLayout.width - 5, // Decrease width by 5px to make it smaller
        y: auriTabLayout.y - 28, // Shift up by 20px to center the taller box
        x: auriTabLayout.x + 3, // Shift right by 3px to center the narrower box
      });
    } else if (isOnboardingActive && currentStep === 6 && gamesTabLayout) {
      console.log("Setting Games tab highlight position:", gamesTabLayout);
      // Make the highlight box wider for the Games tab
      setHighlightPosition({
        ...gamesTabLayout,
        width: gamesTabLayout.width + 25, // Increase width by 30px
        height: gamesTabLayout.height + 22,
        x: gamesTabLayout.x - 12, // Shift left by 15px to center the wider box
        y: gamesTabLayout.y - 12,
      });
    } else if (!isOnboardingActive) {
      setHighlightPosition(null);
    }
  }, [isOnboardingActive, currentStep, walletTabLayout, auriTabLayout, gamesTabLayout, setHighlightPosition]);

  return (
    <View style={styles.container}>
      {/* Home */}
      <TouchableOpacity style={styles.tab} onPress={() => router.push("/screen/Home")}>
        <View style={styles.iconWrapper}>
          <FontAwesome name="home" size={24} color="#fff" />
        </View>
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
        onLayout={() => {
          walletTabRef.current?.measureInWindow((px, py, fwidth, fheight) => {
            console.log("Wallet tab layout:", { x: px, y: py, width: fwidth, height: fheight });
            setWalletTabLayout({ x: px, y: py, width: fwidth, height: fheight });
          });
        }}
      >
        <View style={styles.iconWrapper}>
          <FontAwesome5 name="history" size={22} color="#fff" />
        </View>
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
        onLayout={() => {
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
        onLayout={() => {
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
        <View style={styles.iconWrapper}>
          <Ionicons name="game-controller" size={24} color="#fff" />
        </View>
        <Text style={styles.label}>Games</Text>
      </TouchableOpacity>

      {/* Account */}
      <TouchableOpacity style={styles.tab} onPress={() => router.push("/screen/Profile")}>
        <View style={styles.iconWrapper}>
          <MaterialCommunityIcons name="account-box" size={26} color="#fff" />
        </View>
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
    height: 70,
    borderRadius: 40,
    position: "absolute",
    bottom: 22,
    left: "2.5%",
    width: "95%",
    paddingHorizontal: 25,

    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 15,
  },
  tab: {
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapper: {
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  label: {
    fontSize: 13,
    marginTop: 4,
    color: "#fff",
    fontWeight: "500",
  },
  historyTab: {
    marginTop: 2,
  },
  centerLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 6,
  },
  centerButton: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  centerIcon: {
    width: 78,
    height: 78,
    borderRadius: 40,
    backgroundColor: "#C7E59E",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 6,
    borderColor: "#115D59",
    overflow: "hidden",
    shadowColor: "#C7E59E",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 10,
  },
  centerIconImage: {
    width: "155%",
    height: "155%",
    resizeMode: "contain",
  },
});
