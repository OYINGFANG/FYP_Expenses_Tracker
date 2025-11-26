import React from "react";
import {
  View,
  Text,
  SafeAreaView,
  StyleSheet,
  ImageBackground,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";

// ⬇️ add these so we initialize the store before navigating
import { useGameSliceDispatch } from "../store/reduxHooks";
import { startNewGame } from "../store/gameSlice";

type Props = {
  onStartNewGame?: () => void;
  onOpenSavedGameModal?: () => void;
  onOpenAbout?: () => void;
};

const TitlePage: React.FC<Props> = ({
  onStartNewGame,
  onOpenSavedGameModal,
  onOpenAbout,
}) => {
  const router = useRouter();
  const dispatch = useGameSliceDispatch();

  const handleStart = () => {
    if (onStartNewGame) {
      // If a parent provides a custom handler, let it run (it should dispatch+navigate)
      onStartNewGame();
    } else {
      // Default behavior: initialize game state, then go to the game page
      dispatch(startNewGame());
      router.replace("/screen/Game/GamePage");
    }
  };

  const handleHowToPlay = () => {
    if (onOpenAbout) onOpenAbout();
    else router.push("/screen/Game/aboutPage/AboutPage");
  };

  return (
    <SafeAreaView style={styles.container}>
      <ImageBackground
        source={require("@/assets/images/about.png")}
        style={styles.background}
        resizeMode="cover"
      >
        <View />

        <View>
          {/* Header Section */}
          <View style={styles.headerContainer}>
            <View style={styles.titleGlow} />
            <Text style={styles.title}>Roti & Ringgit</Text>
            <View style={styles.subtitle}>
              <View style={styles.decorativeLine} />
              <Text style={styles.subtitleText}>ADVENTURE AWAITS</Text>
              <View style={styles.decorativeLine} />
            </View>
          </View>

          {/* Button Group */}
          <View style={styles.buttonGroup}>
            <TouchableOpacity
              style={styles.buttonPrimary}
              onPress={handleStart}
              activeOpacity={0.8}
            >
              <View style={styles.buttonContent}>
                <Text style={styles.buttonTextPrimary}>Start New Game</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.buttonSecondary}
              onPress={() => onOpenSavedGameModal?.()}
              activeOpacity={0.8}
            >
              <View style={styles.buttonContent}>
                <Text style={styles.buttonTextSecondary}>Load Saved Game</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.buttonSecondary}
              onPress={handleHowToPlay}
              activeOpacity={0.8}
            >
              <View style={styles.buttonContent}>
                <Text style={styles.buttonTextSecondary}>How to Play</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </ImageBackground>
    </SafeAreaView>
  );
};

export default TitlePage;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  background: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  contentContainer: {
    alignItems: "center",
    justifyContent: "flex-start",
    paddingVertical: 60,
    paddingHorizontal: 24,
    minHeight: "100%",
    zIndex: 2,
  },

  // Header Styles
  headerContainer: {
    marginTop: 80,
    alignItems: "center",
    marginBottom: 40,
    position: "relative",
  },
  titleGlow: {
    position: "absolute",
    width: 340,
    height: 145,
    backgroundColor: "#fbbf24",
    opacity: 0.2,
    borderRadius: 100,
    top: 5,
    shadowColor: "#fbbf24",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 50,
    elevation: 10,
  },
  title: {
    fontSize: 55,
    fontWeight: "800",
    color: "#fbbf24",
    textAlign: "center",
    marginBottom: 16,
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 8,
    letterSpacing: 1,
    lineHeight: 55,
    marginTop: 20,
  },
  subtitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  subtitleText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fbbf24",
    letterSpacing: 4,
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  decorativeLine: {
    width: 40,
    height: 2,
    backgroundColor: "#f59e0b",
    opacity: 0.8,
  },

  // Button Styles
  buttonGroup: {
    width: "90%",
    maxWidth: 400,
    alignItems: "center",
    gap: 12,
    marginTop: 220,
    marginLeft: 20,
  },
  buttonContent: {
    width: "100%",
    alignItems: "center",
  },
  buttonPrimary: {
    width: "100%",
    backgroundColor: "#fbbf24",
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 20,
    shadowColor: "#fbbf24",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 10,
    borderWidth: 0,
  },
  buttonTextPrimary: {
    color: "#451a03",
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  buttonSecondary: {
    width: "100%",
    backgroundColor: "rgba(20, 20, 20, 0.7)",
    borderWidth: 3,
    borderColor: "#fbbf24",
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 6,
  },
  buttonTextSecondary: {
    color: "#fbbf24",
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
});
