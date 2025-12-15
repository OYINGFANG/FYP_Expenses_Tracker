import { useRouter, useLocalSearchParams } from "expo-router";
import React, { useState, useRef, useEffect } from "react";
import { Animated, SafeAreaView, StyleSheet, TouchableOpacity, Text, View, Alert, ScrollView, TextInput } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import Ionicons from "@expo/vector-icons/Ionicons";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { collection, addDoc } from "firebase/firestore";
import { db } from "../../firebase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { subscribeUserCurrency, getCachedCurrency, getCurrencySymbol, type Currency } from "../utils/currencyUtils";

const SAVINGS_CATEGORY_LABELS = ["Savings", "Saving", "Emergency Fund", "Emergency", "Investments", "Investment"];
const isSavingsCategory = (label: string) =>
  SAVINGS_CATEGORY_LABELS.some((blocked) => blocked.toLowerCase() === label.toLowerCase());

export default function AddRecord() {
  const router = useRouter();
  const [selected, setSelected] = useState("Expenses");
  const [inputValue, setInputValue] = useState("");
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedCategory, setSelectedCategory] = useState("");
  const [note, setNote] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cash"); // ✅ Added
  const [currency, setCurrency] = useState<Currency>("MYR");
  const slideAnim = useRef(new Animated.Value(0)).current;
  const params = useLocalSearchParams();
  const prevParamsRef = useRef<string>("");

  // Extract param values as strings for stable comparison
  const amountParam = Array.isArray(params.amount) ? params.amount[0] : params.amount;
  const dateParam = Array.isArray(params.date) ? params.date[0] : params.date;
  const noteParam = Array.isArray(params.note) ? params.note[0] : params.note;
  const categoryParam = Array.isArray(params.category) ? params.category[0] : params.category;
  const merchantParam = Array.isArray(params.merchantName) ? params.merchantName[0] : params.merchantName;
  const paymentMethodParam = Array.isArray(params.paymentMethod) ? params.paymentMethod[0] : params.paymentMethod;
  
  // Create a stable string key from params to detect changes
  const paramsKey = `${amountParam || ""}|${dateParam || ""}|${noteParam || ""}|${categoryParam || ""}|${merchantParam || ""}|${paymentMethodParam || ""}`;

  // Load user's currency preference
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const loadCurrency = async () => {
      try {
        // First try to get cached currency for immediate display
        const cachedCurrency = await getCachedCurrency();
        setCurrency(cachedCurrency);

        // Then subscribe to Firestore for real-time updates
        const userId = await AsyncStorage.getItem("userId");
        if (userId) {
          // Extract UID if it's a path (handle both "/USERS/uid" and "uid" formats)
          const parts = userId.split("/");
          const uid = userId.startsWith("/USERS/") && parts.length >= 3 ? parts[2] : userId;
          unsubscribe = subscribeUserCurrency(uid, (newCurrency) => {
            setCurrency(newCurrency);
          });
        }
      } catch (error) {
        console.error("Error loading currency:", error);
        // Default to MYR if there's an error
        setCurrency("MYR");
      }
    };

    loadCurrency();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  useEffect(() => {
    if (prevParamsRef.current === paramsKey) return;
    prevParamsRef.current = paramsKey;

    if (amountParam) setInputValue(amountParam);
    if (dateParam) setSelectedDate(new Date(dateParam));
    if (noteParam) setNote(noteParam);
    if (categoryParam) {
      if (isSavingsCategory(categoryParam)) {
        Alert.alert(
          "Use Savings Module",
          "To save money, use the Savings screen instead of adding a 'Savings' expense."
        );
      } else {
        setSelectedCategory(categoryParam);
      }
    }
    if (merchantParam && !noteParam) setNote(merchantParam);

    // Prefill payment method from params if it matches one of the known options
    if (paymentMethodParam) {
      const normalized = paymentMethodParam as string;
      if (["Cash", "Bank", "Credit Card"].includes(normalized)) {
        setPaymentMethod(normalized);
      }
    }
  }, [paramsKey, amountParam, dateParam, noteParam, categoryParam, merchantParam, paymentMethodParam]);

  type CategoryOption = { icon: string; label: string; type: "MaterialIcons" | "FontAwesome5"; disabled?: boolean };

  const categories: CategoryOption[] = [
    { icon: "restaurant", label: "Food", type: "MaterialIcons" },
    { icon: "directions-car", label: "Transport", type: "MaterialIcons" },
    { icon: "home", label: "Housing", type: "MaterialIcons" },
    { icon: "shopping-cart", label: "Shopping", type: "MaterialIcons" },
    { icon: "receipt", label: "Bills", type: "MaterialIcons" },
    { icon: "movie", label: "Entertainment", type: "MaterialIcons" },
    { icon: "local-hospital", label: "Healthcare", type: "MaterialIcons" },
    { icon: "school", label: "Education", type: "MaterialIcons" },
    { icon: "savings", label: "Savings", type: "MaterialIcons", disabled: true },
    { icon: "category", label: "Others", type: "MaterialIcons" },
  ];

  const incomeCategories: CategoryOption[] = [
    { icon: "attach-money", label: "Salary", type: "MaterialIcons" },
    { icon: "account-balance", label: "Investment", type: "MaterialIcons" },
    { icon: "card-giftcard", label: "Gift", type: "MaterialIcons" },
    { icon: "money", label: "Freelance", type: "FontAwesome5" },
    { icon: "trending-up", label: "Bonus", type: "MaterialIcons" },
  ];

  const paymentOptions = ["Cash", "Bank", "Credit Card"];

  const handlePress = (value: string) => {
    if (value === "delete") {
      setInputValue((prev) => prev.slice(0, -1));
    } else if (value === ".") {
      if (!inputValue.includes(".")) {
        setInputValue((prev) => (prev || "0") + value);
      }
    } else if (value === "save") {
      if (!inputValue || !selectedCategory) {
        Alert.alert("Missing Info", "Please enter amount and select category");
        return;
      }
      if (selected === "Expenses" && isSavingsCategory(selectedCategory)) {
        Alert.alert(
          "Use Savings Module",
          "To save money, use the Savings screen instead of adding a 'Savings' expense."
        );
        return;
      }
      if (selected === "Expenses") {
        saveExpenseRecord();
      } else {
        saveIncomeRecord();
      }
    } else {
      setInputValue((prev) => (prev === "0" ? value : prev + value));
    }
  };

  const saveExpenseRecord = async () => {
    try {
      const userId = await AsyncStorage.getItem("userId");
      if (!userId) {
        Alert.alert("Error", "User ID not found.");
        return;
      }

      const expId = "EXP" + new Date().getTime();

      const expenseData = {
        exp_id: expId,
        user_id: `/USERS/${userId}`,
        exp_category: selectedCategory,
        exp_payment_method: paymentMethod,
        exp_total: parseFloat(inputValue),
        exp_notes: note || "",
        exp_date: selectedDate.toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await addDoc(collection(db, "EXPENSES"), expenseData);

      router.push({
        pathname: "/screen/AddRecordSuccess",
        params: {
          type: "Expenses",
          category: selectedCategory,
          amount: inputValue,
          paymentMethod,                 
          date: selectedDate.toISOString(),
          note,                          
        },
      });

      setInputValue("");
      setSelectedCategory("");
      setNote("");
    } catch (error) {
      console.error("🔥 Error saving expense:", error);
      Alert.alert("Error", "Failed to save expense. Please try again.");
    }
  };

  const saveIncomeRecord = async () => {
    try {
      const userId = await AsyncStorage.getItem("userId");
      if (!userId) {
        Alert.alert("Error", "User ID not found.");
        return;
      }

      const incId = "INC" + new Date().getTime();

      const incomeData = {
        inc_id: incId,
        user_id: `/USERS/${userId}`,
        inc_category: selectedCategory,
        inc_payment_method: paymentMethod,
        inc_total: parseFloat(inputValue),
        inc_notes: note || "",
        inc_date: selectedDate.toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await addDoc(collection(db, "INCOME"), incomeData);

      router.push({
        pathname: "/screen/AddRecordSuccess",
        params: {
          type: "Income",
          category: selectedCategory,
          amount: inputValue,
          paymentMethod,
          date: selectedDate.toISOString(),
          note,
        },
      });

      setInputValue("");
      setSelectedCategory("");
      setNote("");
    } catch (error) {
      console.error("🔥 Error saving income:", error);
      Alert.alert("Error", "Failed to save income. Please try again.");
    }
  };

  const handleToggle = (type: string) => {
    setSelected(type);
    Animated.spring(slideAnim, {
      toValue: type === "Expenses" ? 0 : 1,
      friction: 8,
      tension: 100,
      useNativeDriver: true,
    }).start();
  };

  const slideInterpolate = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [3, 133],
  });

  const renderIcon = (icon: string, type: string, size: number, color: string) => {
    if (type === "FontAwesome5") {
      return <FontAwesome5 name={icon as any} size={size} color={color} />;
    }
    return <MaterialIcons name={icon as any} size={size} color={color} />;
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.push("/screen/Home")}
          style={styles.closeBtn}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color="#1E3932" />
        </TouchableOpacity>

        <View style={styles.toggleWrapper}>
          <View style={styles.toggleContainer}>
            <Animated.View
              style={[styles.slidingIndicator, { transform: [{ translateX: slideInterpolate }] }]}
            />
            <TouchableOpacity style={styles.toggleOption} onPress={() => handleToggle("Expenses")}>
              <Text style={[styles.toggleText, selected === "Expenses" && styles.activeText]}>
                Expenses
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.toggleOption} onPress={() => handleToggle("Income")}>
              <Text style={[styles.toggleText, selected === "Income" && styles.activeText]}>
                Income
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Amount Card */}
        <View style={styles.amountCard}>
          <Text style={styles.amountLabelAlt}>
            {selected === "Expenses" ? "How much did you spend?" : "How much did you earn?"}
          </Text>
          <View style={styles.amountDisplayAlt}>
            <Text style={styles.currencySymbolAlt}>{getCurrencySymbol(currency)}</Text>
            <Text style={styles.amountValueAlt}>{inputValue || "0"}</Text>
          </View>
        </View>

        {/* Payment Method */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Payment Method</Text>
          <View style={styles.paymentOptions}>
            {paymentOptions.map((method) => (
              <TouchableOpacity
                key={method}
                style={[
                  styles.chip,
                  paymentMethod === method && styles.chipActive,
                ]}
                onPress={() => setPaymentMethod(method)}
              >
                <Text
                  style={[
                    styles.chipText,
                    paymentMethod === method && styles.chipTextActive,
                  ]}
                >
                  {method}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Category Section */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Category</Text>
          {selected === "Expenses" && (
            <Text style={styles.categoryHint}>
              To build your savings, use the Savings module instead of adding a “Savings” expense.
            </Text>
          )}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryScroll}
          >
            {(selected === "Expenses" ? categories : incomeCategories).map((cat, index) => {
              const disabled = selected === "Expenses" && !!cat.disabled;
              const isActive = selectedCategory === cat.label;
              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.categoryCard,
                    isActive && styles.categoryCardActive,
                    disabled && styles.categoryCardDisabled,
                  ]}
                  onPress={() => {
                    if (disabled) {
                      Alert.alert(
                        "Use Savings Module",
                        "To save money, use the Savings screen instead of adding a 'Savings' expense."
                      );
                      return;
                    }
                    setSelectedCategory(cat.label);
                  }}
                  disabled={disabled}
                >
                  {renderIcon(
                    cat.icon,
                    cat.type,
                    28,
                    isActive ? "#fff" : "#1E3932"
                  )}
                  <Text
                    style={[
                      styles.categoryLabel,
                      isActive && styles.categoryLabelActive,
                      disabled && styles.categoryLabelDisabled,
                    ]}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Date & Note Section */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Details</Text>

          <TouchableOpacity style={styles.cell} onPress={() => setShowCalendar(true)}>
            <Ionicons name="calendar-outline" size={22} color="#1E3932" />
            <Text style={styles.cellText}>{selectedDate.toLocaleDateString()}</Text>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>

          <View style={styles.cell}>
            <Ionicons name="create-outline" size={22} color="#1E3932" />
            <TextInput
              style={styles.noteInput}
              placeholder="Add a note (optional)"
              placeholderTextColor="#9CA3AF"
              value={note}
              onChangeText={setNote}
              maxLength={50}
            />
          </View>
        </View>
      </ScrollView>

      {/* Calculator Bottom Sheet */}
      <View style={styles.calculator}>
        <View style={styles.calculatorHandle} />
        <Text style={styles.calculatorTitle}>Enter Amount</Text>
        <View style={styles.keypadContainer}>
          {[
            ["1", "2", "3"],
            ["4", "5", "6"],
            ["7", "8", "9"],
            [".", "0", "delete"],
          ].map((row, i) => (
            <View key={i} style={styles.keyRow}>
              {row.map((key) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.key, key === "delete" && styles.deleteKey]}
                  onPress={() => handlePress(key)}
                >
                  {key === "delete" ? (
                    <Ionicons name="backspace-outline" size={24} color="#1E3932" />
                  ) : (
                    <Text style={styles.keyText}>{key}</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[
            styles.saveButton,
            (!inputValue || !selectedCategory) && styles.saveButtonDisabled,
          ]}
          onPress={() => handlePress("save")}
          disabled={!inputValue || !selectedCategory}
        >
          <Text style={styles.saveButtonText}>Save {selected}</Text>
        </TouchableOpacity>
      </View>

      <DateTimePickerModal
        isVisible={showCalendar}
        mode="date"
        onConfirm={(date) => {
          setShowCalendar(false);
          setSelectedDate(date);
        }}
        onCancel={() => setShowCalendar(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#E4F2ED" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: "#E4F2ED",
  },
  closeBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 16, fontWeight: "700", color: "#1E3932", marginBottom: 8 },
  toggleWrapper: { flex: 1, alignItems: "center", marginHorizontal: 20 },
  toggleContainer: {
    flexDirection: "row",
    width: 270,
    height: 44,
    backgroundColor: "#C9EAD6",
    borderRadius: 22,
    padding: 3,
    position: "relative",
  },
  slidingIndicator: {
    position: "absolute",
    width: 132,
    height: 38,
    top: 3,
    left: 0,
    backgroundColor: "#1E3932",
    borderRadius: 19,
  },
  toggleOption: { flex: 1, justifyContent: "center", alignItems: "center", zIndex: 2 },
  toggleText: { fontSize: 15, fontWeight: "600", color: "#1E3932" },
  activeText: { color: "#fff" },
  content: { flex: 1 },

  // Amount card
  amountCard: {
    backgroundColor: "#1E3932",
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 5,
  },
  amountLabelAlt: { fontSize: 13, color: "#C9EAD6", fontWeight: "600", textAlign: "center" },
  amountDisplayAlt: { flexDirection: "row", alignItems: "flex-end", justifyContent: "center", marginTop: 6 },
  currencySymbolAlt: { fontSize: 20, color: "#fff", fontWeight: "600", marginRight: 8 },
  amountValueAlt: { fontSize: 44, color: "#fff", fontWeight: "700" },

  // Section card wrapper
  sectionCard: {
    backgroundColor: "#fff",
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 16,
    paddingVertical: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1E3932",
    paddingHorizontal: 16,
    marginBottom: 12,
  },

  // Chips (payment)
  paymentOptions: { flexDirection: "row", justifyContent: "space-around", marginTop: 2, paddingHorizontal: 6 },
  chip: { borderWidth: 1.5, borderColor: "#1E3932", paddingVertical: 10, paddingHorizontal: 22, borderRadius: 20, backgroundColor: "#fff" },
  chipActive: { backgroundColor: "#1E3932", borderColor: "#1E3932" },
  chipText: { color: "#1E3932", fontWeight: "600" },
  chipTextActive: { color: "#fff" },

  // Categories
  categoryScroll: { paddingHorizontal: 16, gap: 12 },
  categoryCard: {
    width: 90,
    height: 90,
    backgroundColor: "#F5F9F8",
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#E0EBE7",
  },
  categoryCardActive: { backgroundColor: "#1E3932", borderColor: "#1E3932" },
  categoryCardDisabled: { opacity: 0.45 },
  categoryLabel: { fontSize: 12, fontWeight: "600", color: "#1E3932", marginTop: 8, textAlign: "center" },
  categoryLabelActive: { color: "#fff" },
  categoryLabelDisabled: { color: "#6B7280" },
  categoryHint: {
    fontSize: 12,
    color: "#6B7280",
    paddingHorizontal: 16,
    marginBottom: 6,
  },

  // Details cells
  cell: { flexDirection: "row", alignItems: "center", backgroundColor: "#F5F9F8", padding: 16, borderRadius: 12, marginHorizontal: 16, marginBottom: 10 },
  cellText: { flex: 1, fontSize: 15, fontWeight: "600", color: "#1E3932", marginLeft: 12 },
  noteInput: { flex: 1, marginLeft: 12, color: "#1E3932", fontWeight: "500" },

  // Calculator
  calculator: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 20,
  },
  calculatorHandle: { width: 70, height: 4, backgroundColor: "#E0EBE7", borderRadius: 2, alignSelf: "center", marginBottom: 10 },
  calculatorTitle: { fontSize: 14, fontWeight: "600", color: "#6b7280", textAlign: "center", marginBottom: 12 },
  keypadContainer: { gap: 8 },
  keyRow: { flexDirection: "row", gap: 12 },
  key: { flex: 1, height: 40, backgroundColor: "#ecf3f0ff", borderRadius: 15, justifyContent: "center", alignItems: "center" },
  deleteKey: { backgroundColor: "#FFE4E6" },
  keyText: { fontSize: 22, fontWeight: "700", color: "#1E3932" },
  saveButton: { backgroundColor: "#1E3932", paddingVertical: 16, borderRadius: 14, alignItems: "center", marginTop: 14 },
  saveButtonDisabled: { backgroundColor: "#C8D9D7" },
  saveButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});