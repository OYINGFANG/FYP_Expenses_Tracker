import React from "react";
import { View, StyleSheet, SafeAreaView } from "react-native";
import GameHeader from "./GameHeader";
import GamePanelDisplay from "./GamePanelDisplay";

const GamePage = () => {
  return (
    <SafeAreaView style={styles.container}>
      <GameHeader />
      <View style={styles.main}>
        <GamePanelDisplay />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1c1917" ,
  },
  main: {
    flex: 1,
    paddingVertical: 16,
  },
});

export default GamePage;
