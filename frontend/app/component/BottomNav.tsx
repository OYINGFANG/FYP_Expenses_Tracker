// components/BottomNav.js
import { FontAwesome } from "@expo/vector-icons";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useRouter } from "expo-router"; 
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View, Image } from "react-native";

const BottomNav = () => {
  const router = useRouter();

  return (
    <View style={styles.container}>
      {/* Home */}
      <TouchableOpacity style={styles.tab} onPress={() => router.push("/screen/ExpensesDetail")}>
        <FontAwesome name="home" size={32} color="#fff" />
        <Text style={styles.label}>Home</Text>
      </TouchableOpacity>

      {/* History */}
      <TouchableOpacity style={[styles.tab, styles.historyTab]} onPress={() => router.push("/screen/WalletOverview")}>
        <FontAwesome5 name="history" size={25} color="#fff" />
        <Text style={styles.label}>Wallet</Text>
      </TouchableOpacity>

      {/* Center Auri AI */}
      <TouchableOpacity
        style={styles.centerButton}
        onPress={() => router.push("/screen/ChatScreen")}
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
      <TouchableOpacity style={styles.tab} onPress={() => router.push("/screen/Game/titlePage/TitlePage")}>
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
