// app/component/CurrencySelectionModal.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Currency } from "../utils/currencyUtils";

const CURRENCIES: { code: Currency; name: string; symbol: string }[] = [
  { code: "MYR", name: "Malaysian Ringgit", symbol: "RM" },
  { code: "USD", name: "US Dollar", symbol: "$" },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$" },
  { code: "EUR", name: "Euro", symbol: "€" },
  { code: "GBP", name: "British Pound", symbol: "£" },
  { code: "JPY", name: "Japanese Yen", symbol: "¥" },
  { code: "CNY", name: "Chinese Yuan", symbol: "¥" },
];

type CurrencySelectionModalProps = {
  visible: boolean;
  onSelect: (currency: Currency) => void;
};

export default function CurrencySelectionModal({
  visible,
  onSelect,
}: CurrencySelectionModalProps) {
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>("MYR");

  const handleSelect = () => {
    onSelect(selectedCurrency);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.container}>
        <View style={styles.modal}>
          <LinearGradient
            colors={["#FFFFFF", "#F9FAFB"]}
            style={styles.modalGradient}
          >
            <View style={styles.header}>
              <Ionicons name="cash-outline" size={32} color="#115D59" />
              <Text style={styles.title}>Choose Your Currency</Text>
              <Text style={styles.subtitle}>
                Select the currency you will use for tracking expenses and income
              </Text>
            </View>

            <ScrollView
              style={styles.currencyList}
              showsVerticalScrollIndicator={false}
            >
              {CURRENCIES.map((currency) => (
                <TouchableOpacity
                  key={currency.code}
                  style={[
                    styles.currencyItem,
                    selectedCurrency === currency.code && styles.currencyItemSelected,
                  ]}
                  onPress={() => setSelectedCurrency(currency.code)}
                >
                  <View style={styles.currencyLeft}>
                    <View
                      style={[
                        styles.currencyIcon,
                        selectedCurrency === currency.code && styles.currencyIconSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.currencySymbol,
                          selectedCurrency === currency.code && styles.currencySymbolSelected,
                        ]}
                      >
                        {currency.symbol}
                      </Text>
                    </View>
                    <View style={styles.currencyInfo}>
                      <Text
                        style={[
                          styles.currencyCode,
                          selectedCurrency === currency.code && styles.currencyCodeSelected,
                        ]}
                      >
                        {currency.code}
                      </Text>
                      <Text
                        style={[
                          styles.currencyName,
                          selectedCurrency === currency.code && styles.currencyNameSelected,
                        ]}
                      >
                        {currency.name}
                      </Text>
                    </View>
                  </View>
                  {selectedCurrency === currency.code && (
                    <Ionicons name="checkmark-circle" size={24} color="#115D59" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.confirmButton}
              onPress={handleSelect}
            >
              <LinearGradient
                colors={["#115D59", "#0C4743"]}
                style={styles.confirmButtonGradient}
              >
                <Text style={styles.confirmButtonText}>Continue</Text>
                <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
              </LinearGradient>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modal: {
    width: "100%",
    maxWidth: 400,
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 18,
    marginTop: 60, // position modal slightly lower on the screen
  },
  modalGradient: {
    padding: 24,
    maxHeight: "90%",
    borderRadius: 24,
  },
  header: {
    alignItems: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
    marginTop: 12,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#4B5563",
    textAlign: "center",
    lineHeight: 20,
  },
  currencyList: {
    maxHeight: 300,
  },
  currencyItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F9FAFB",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  currencyItemSelected: {
    backgroundColor: "#ECFDF3",
    borderWidth: 2,
    borderColor: "#115D59",
  },
  currencyLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  currencyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  currencyIconSelected: {
    backgroundColor: "#115D59",
    borderColor: "#115D59",
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: "700",
    color: "#166534",
  },
  currencySymbolSelected: {
    color: "#FFFFFF",
  },
  currencyInfo: {
    flex: 1,
  },
  currencyCode: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  currencyCodeSelected: {
    color: "#166534",
  },
  currencyName: {
    fontSize: 14,
    color: "#6B7280",
  },
  currencyNameSelected: {
    color: "#166534",
  },
  confirmButton: {
    marginTop: 24,
    borderRadius: 12,
    overflow: "hidden",
  },
  confirmButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 8,
  },
  confirmButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
});

