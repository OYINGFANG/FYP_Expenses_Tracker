// IncomeOverview.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Modal,
  ActivityIndicator,
  Animated,
  FlatList,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import BackButton from "../component/BackButton";
import BottomNav from "../component/BottomNav";
import { getUsernameFromFirestore } from "../utils/UserUtils";
import { subscribeUserIncomeRecords, type IncomeRecord } from "../utils/IncomeUtils";

// --- helpers ---
const fmtMYR = (n: number) => `+RM ${Number(n || 0).toFixed(2)}`;
const fmtDate = (iso?: string) => {
  if (!iso) return "N/A";
  try {
    return new Date(iso).toLocaleDateString("ms-MY", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
};

export default function IncomeOverview() {
  const router = useRouter();
  const [selectedTab, setSelectedTab] = useState<"Monthly" | "Yearly">("Monthly");
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));

  const [transactions, setTransactions] = useState<IncomeRecord[]>([]);
  const [selectedTransaction, setSelectedTransaction] = useState<IncomeRecord | null>(null);

  useEffect(() => {
    let unsub: undefined | (() => void);

    const boot = async () => {
      try {
        const data = await getUsernameFromFirestore();
        setUserData(data);
        unsub = await subscribeUserIncomeRecords(setTransactions);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
        Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
      }
    };

    boot();
    return () => {
      unsub?.();
    };
  }, []);

  const onRefresh = async () => {
    // Re-run the same boot sequence quickly (unsubscribe handled in useEffect cleanup on unmount)
    setRefreshing(true);
    try {
      const data = await getUsernameFromFirestore();
      setUserData(data);
      // subscribeUserIncomeRecords is realtime; no-op here
    } finally {
      setRefreshing(false);
    }
  };

  const totalIncome = transactions.reduce((s, r) => s + (r.amount || 0), 0);

  if (loading) {
    return (
      <View style={[styles.safeArea, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color="#22C55E" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
        {/* Header */}
        <View style={styles.header}>
          <BackButton onPress={() => router.back()} />
          <Text style={styles.title}>Income 💰</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Content */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22C55E" />}
        >
          {/* Toggle Buttons */}
          <View style={styles.toggleContainer}>
            {(["Monthly", "Yearly"] as const).map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[styles.toggleButton, selectedTab === tab && styles.activeToggle]}
                onPress={() => setSelectedTab(tab)}
              >
                <Text style={[styles.toggleText, selectedTab === tab && styles.activeToggleText]}>{tab}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Donut Summary */}
          <View style={styles.chartContainer}>
            <Text style={styles.statusText}>
              ✅ You are on the right track, {userData?.username || "there"}!
            </Text>

            <View style={styles.donutWrapper}>
              <View style={styles.donutOuter}>
                {/* purely visual slices */}
                <Animated.View style={[styles.slice, styles.greenSlice]} />
                <Animated.View style={[styles.slice, styles.blueSlice, { transform: [{ rotate: "60deg" }] }]} />
                <Animated.View style={[styles.slice, styles.purpleSlice, { transform: [{ rotate: "120deg" }] }]} />
                <Animated.View style={[styles.slice, styles.redSlice, { transform: [{ rotate: "180deg" }] }]} />
                <Animated.View style={[styles.slice, styles.yellowSlice, { transform: [{ rotate: "240deg" }] }]} />
              </View>

              <View style={styles.donutCenter}>
                <Text style={styles.centerTitle}>Income</Text>
                <Text style={styles.centerAmount}>RM {totalIncome.toFixed(2)}</Text>
              </View>
            </View>
          </View>

          {/* Recent Transactions */}
          <View style={styles.transactionSection}>
            <Text style={styles.recentTitle}>Recent Transactions</Text>

            {transactions.length === 0 ? (
              <Text style={{ color: "#CFE7D7" }}>No income yet. Add one to see it here.</Text>
            ) : (
              <FlatList
                data={transactions}
                keyExtractor={(item) => item.id}
                scrollEnabled={false} // list sits inside ScrollView
                renderItem={({ item }) => (
                  <TouchableOpacity onPress={() => setSelectedTransaction(item)}>
                    <View style={styles.transactionCard}>
                      <View style={styles.iconWrapper}>
                        <Text style={styles.iconText}>↩</Text>
                      </View>
                      <View style={styles.txDetails}>
                        <Text style={styles.txTitle}>{item.category}</Text>
                        <Text style={styles.txDate}>{fmtDate(item.dateISO)}</Text>
                      </View>
                      <Text style={styles.txAmount}>{fmtMYR(item.amount)}</Text>
                    </View>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </ScrollView>

        <BottomNav />
      </Animated.View>

      {/* Transaction Modal */}
      <Modal
        visible={!!selectedTransaction}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedTransaction(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{selectedTransaction?.category}</Text>
            <Text style={styles.modalDate}>{fmtDate(selectedTransaction?.dateISO)}</Text>
            <Text style={styles.modalDesc}>{selectedTransaction?.description || "—"}</Text>
            <Text style={styles.modalAmount}>{fmtMYR(selectedTransaction?.amount || 0)}</Text>
            <TouchableOpacity style={styles.modalButton} onPress={() => setSelectedTransaction(null)}>
              <Text style={styles.modalButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// --- styles ---
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#0D2F28" },
  container: { flex: 1, backgroundColor: "#0D2F28" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  title: { fontSize: 22, fontWeight: "700", color: "#fff" },
  toggleContainer: {
    backgroundColor: "#E6F3EB",
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 50,
    flexDirection: "row",
    padding: 6,
  },
  toggleButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: 40,
  },
  toggleText: { fontSize: 14, fontWeight: "600", color: "#1E4D2B" },
  activeToggle: { backgroundColor: "#1E4D2B" },
  activeToggleText: { color: "#fff" },
  chartContainer: {
    marginTop: 20,
    marginHorizontal: 20,
    backgroundColor: "#F2F7F3",
    borderRadius: 20,
    padding: 16,
    alignItems: "center",
  },
  statusText: { fontSize: 13, color: "#1E4D2B", fontWeight: "600", marginBottom: 12 },
  donutWrapper: { justifyContent: "center", alignItems: "center", marginBottom: 10 },
  donutOuter: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "#E8F4EC",
    justifyContent: "center",
    alignItems: "center",
  },
  slice: { position: "absolute", width: 160, height: 160, borderRadius: 80 },
  greenSlice: { borderWidth: 12, borderColor: "#6ECF93" },
  blueSlice: { borderWidth: 12, borderColor: "#7E9EF7" },
  purpleSlice: { borderWidth: 12, borderColor: "#D46BF2" },
  redSlice: { borderWidth: 12, borderColor: "#FCA5A5" },
  yellowSlice: { borderWidth: 12, borderColor: "#FACC15" },
  donutCenter: {
    position: "absolute",
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  centerTitle: { fontSize: 14, color: "#1E4D2B", fontWeight: "600" },
  centerAmount: { fontSize: 18, color: "#1E4D2B", fontWeight: "800" },
  labelContainer: { marginTop: 10, alignItems: "center", gap: 4 },
  labelText: { fontSize: 12, fontWeight: "600" },
  transactionSection: { marginTop: 20, marginHorizontal: 20, marginBottom: 100 },
  recentTitle: { fontSize: 16, fontWeight: "800", color: "#fff", marginBottom: 12 },
  transactionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E6F3EB",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#C9EAD1",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  iconText: { fontSize: 18, color: "#1E4D2B", fontWeight: "700" },
  txDetails: { flex: 1 },
  txTitle: { fontSize: 14, fontWeight: "700", color: "#1E4D2B" },
  txDate: { fontSize: 11, color: "#557E67" },
  txAmount: { fontSize: 14, fontWeight: "800", color: "#22C55E" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "80%",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#1E4D2B", marginBottom: 8 },
  modalDate: { fontSize: 12, color: "#888", marginBottom: 10 },
  modalDesc: { fontSize: 14, textAlign: "center", color: "#444", marginBottom: 10 },
  modalAmount: { fontSize: 16, fontWeight: "700", color: "#22C55E", marginBottom: 16 },
  modalButton: {
    backgroundColor: "#1E4D2B",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 30,
  },
  modalButtonText: { color: "#fff", fontWeight: "600" },
});
