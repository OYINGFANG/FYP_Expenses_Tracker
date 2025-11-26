import { useRouter } from "expo-router";
import React from "react";
import { ImageBackground, StyleSheet, View } from "react-native";
import BackButton from "../component/BackButton";
import BottomNav from "../component/BottomNav";

export default function ExpensesDetail() {
  const router = useRouter();
  
  return (
    <ImageBackground
      source={require("@/assets/images/expense.png")}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={{ flex: 1 }}>
        <BackButton onPress={() => router.push("/screen/ExpensesDetail")} />
      </View>

      {/* Bottom Navigation */}
      <BottomNav />
    </ImageBackground>
  );
};



const styles = StyleSheet.create({
  background: { flex: 1 },
  screenContent: { flex: 1, justifyContent: "center", alignItems: "center" },
});