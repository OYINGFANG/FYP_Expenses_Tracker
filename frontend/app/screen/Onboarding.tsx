// app/screen/Onboarding.tsx
import React, { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useOnboarding } from "../context/OnboardingContext";

// Brand colors
const BRAND_GREEN = "#22C55E";
const BRAND_BG_GRADIENT = ["#1E5449", "#154C42", "#0F3D35"];

export default function Onboarding() {
  const router = useRouter();
  const { startOnboarding, completeOnboarding } = useOnboarding();

  useEffect(() => {
    // Start the interactive tutorial when this screen loads
    startOnboarding();
    // Navigate to Home where the tutorial will be shown
    router.replace("/screen/Home");
  }, [router, startOnboarding]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={BRAND_GREEN} />
        <Text style={styles.loadingText}>Preparing your tutorial...</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRAND_BG_GRADIENT[0],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 20,
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});

