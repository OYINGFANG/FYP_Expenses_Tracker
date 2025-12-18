import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Animated,
  SafeAreaView,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";

type ReceiptItem = {
  description: string;
  amount: string;
  qty?: number;
  selected?: boolean;
  baseAmount?: number;
  // Optional flag to mark discounts / subsidies so they
  // subtract from the total instead of adding to it.
  isDiscount?: boolean;
};

export default function SelectReceiptItems() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const items: ReceiptItem[] = params.items
    ? JSON.parse(params.items as string)
    : [];

  const receiptSubtotalParam = parseFloat((params.subtotal as string) || "0") || 0;
  const receiptServiceChargeParam = parseFloat((params.serviceCharge as string) || "0") || 0;
  const receiptTaxParam = parseFloat((params.tax as string) || "0") || 0;

  const merchant = (params.merchant as string) || "Unknown Merchant";
  const date =
    (params.date as string) || new Date().toISOString().split("T")[0];
  const inferredCategory = (params.category as string) || "Food";
  const inferredPaymentMethod = (params.paymentMethod as string) || "Cash";

  const [cartItems, setCartItems] = useState<ReceiptItem[]>(
    items.map((item) => {
      // OCR provides: amount (line total), unit_price, quantity
      const rawAmount: any = (item as any).amount; // This is the LINE TOTAL
      const rawUnitPrice: any = (item as any).unit_price; // This is the UNIT PRICE
      const ocrQuantity = (item as any).quantity;

      const qty = typeof ocrQuantity === "number" && ocrQuantity > 0 ? ocrQuantity : 1;

      // Determine unit price:
      // 1. If OCR provided unit_price, use it
      // 2. Otherwise, if amount is line total and qty > 1, divide amount by qty
      // 3. Otherwise, amount is already the unit price
      let unitPrice: number;
      if (typeof rawUnitPrice === "number" && rawUnitPrice > 0) {
        unitPrice = rawUnitPrice;
      } else {
        const lineTotal = parseFloat(rawAmount != null ? String(rawAmount) : "0") || 0;
        unitPrice = qty > 1 && lineTotal > 0 ? lineTotal / qty : lineTotal;
      }

      // Heuristic: treat common discount/subsidy keywords as negative lines
      const desc = (item as any).description || "";
      const isDiscount = /subsidy|discount|rebate|voucher|coupon|promo|promotion/i.test(
        desc
      );
      const signedUnitPrice = isDiscount ? -unitPrice : unitPrice;

      return {
        ...item,
        amount: String(signedUnitPrice.toFixed(2)), // Store (possibly signed) unit price in amount field
        baseAmount: signedUnitPrice, // Store (possibly signed) unit price in baseAmount
        qty: qty, // Use detected quantity from OCR
        selected: true,
        isDiscount,
      };
    })
  );

  // Calculate original total using line totals (amount * quantity) from OCR
  const originalItemsBaseTotal = items.reduce((sum, item: any) => {
    const rawAmount = item?.amount; // This is line total from OCR
    const rawUnitPrice = item?.unit_price;
    const qty = typeof item?.quantity === "number" && item.quantity > 0 ? item.quantity : 1;
    
    // Use line total if available, otherwise calculate from unit_price * quantity
    let lineTotal: number;
    if (typeof rawAmount === "number" && rawAmount > 0) {
      lineTotal = rawAmount;
    } else if (typeof rawUnitPrice === "number" && rawUnitPrice > 0) {
      lineTotal = rawUnitPrice * qty;
    } else {
      lineTotal = 0;
    }
    
    return sum + lineTotal;
  }, 0);

  const [itemsSubtotal, setItemsSubtotal] = useState<number>(0);
  const [allocatedServiceCharge, setAllocatedServiceCharge] = useState<number>(0);
  const [allocatedTax, setAllocatedTax] = useState<number>(0);
  const [total, setTotal] = useState<number>(0);
  const [selectedCount, setSelectedCount] = useState<number>(items.length);

  useEffect(() => {
    const baseSelected = cartItems.reduce((sum: number, item: ReceiptItem) => {
      if (item.selected) {
        const base = (item.baseAmount ?? parseFloat(item.amount || "0")) || 0;
        return sum + base * (item.qty || 1);
      }
      return sum;
    }, 0);

    const roundedBaseSelected = parseFloat(baseSelected.toFixed(2));
    setItemsSubtotal(roundedBaseSelected);

    const receiptBaseTotal =
      receiptSubtotalParam > 0 ? receiptSubtotalParam : originalItemsBaseTotal;

    let svcAlloc = 0;
    let taxAlloc = 0;

    if (receiptBaseTotal > 0 && roundedBaseSelected > 0) {
      const fraction = roundedBaseSelected / receiptBaseTotal;
      svcAlloc = receiptServiceChargeParam * fraction;
      taxAlloc = receiptTaxParam * fraction;
    }

    const roundedSvc = parseFloat(svcAlloc.toFixed(2));
    const roundedTax = parseFloat(taxAlloc.toFixed(2));

    setAllocatedServiceCharge(roundedSvc);
    setAllocatedTax(roundedTax);

    const newTotal = roundedBaseSelected + roundedSvc + roundedTax;
    setTotal(parseFloat(newTotal.toFixed(2)));

    setSelectedCount(cartItems.filter((i) => i.selected).length);
  }, [cartItems, originalItemsBaseTotal, receiptSubtotalParam, receiptServiceChargeParam, receiptTaxParam]);

  const toggleSelect = (index: number) => {
    const newCart = [...cartItems];
    newCart[index].selected = !newCart[index].selected;
    setCartItems(newCart);
  };

  const increaseQty = (index: number) => {
    const newCart = [...cartItems];
    newCart[index].qty = (newCart[index].qty || 1) + 1;
    setCartItems(newCart);
  };

  const decreaseQty = (index: number) => {
    const newCart = [...cartItems];
    if ((newCart[index].qty || 1) > 1) {
      newCart[index].qty = (newCart[index].qty || 1) - 1;
      setCartItems(newCart);
    } else {
      Alert.alert("Minimum quantity reached", "You must have at least 1 item.");
    }
  };

  const handleConfirm = () => {
    const selectedItems = cartItems.filter((item) => item.selected);
    if (selectedItems.length === 0) {
      Alert.alert("No items selected", "Please select at least one item.");
      return;
    }

    router.push({
      pathname: "/screen/AddRecord",
      params: {
        amount: total.toString(),
        date: date as string,
        note: merchant as string,
        category: inferredCategory,
        paymentMethod: inferredPaymentMethod,
      },
    });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const options: Intl.DateTimeFormatOptions = {
      weekday: "short",
      month: "short",
      day: "numeric",
    };
    return date.toLocaleDateString("en-US", options);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.headerContainer}>
          <View>
            <Text style={styles.headerTitle}>🧾 {merchant}</Text>
            <Text style={styles.headerSubtitle}>📅 {formatDate(date)}</Text>
          </View>
        </View>

        {/* Items List */}
        <FlatList
          data={cartItems}
          keyExtractor={(_, index) => `${index}`}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          renderItem={({ item, index }) => (
            <Animated.View style={styles.itemContainer}>
              <TouchableOpacity
                style={[
                  styles.item,
                  item.selected && styles.itemSelected,
                  !item.selected && styles.itemDeselected,
                ]}
                onPress={() => toggleSelect(index)}
                activeOpacity={0.7}
              >
                <View style={styles.itemLeft}>
                  <View
                    style={[
                      styles.checkbox,
                      item.selected && styles.checkboxActive,
                    ]}
                  >
                    {item.selected && (
                      <MaterialIcons
                        name="check"
                        size={16}
                        color="#fff"
                        style={styles.checkIcon}
                      />
                    )}
                  </View>
                  <View style={styles.itemInfo}>
                    <Text
                      style={[
                        styles.itemText,
                        !item.selected && styles.itemTextDeselected,
                      ]}
                      numberOfLines={1}
                    >
                      {item.description}
                    </Text>
                    <Text style={styles.itemPrice}>
                      RM {parseFloat(item.amount).toFixed(2)}
                    </Text>
                  </View>
                </View>

                {item.selected && (
                  <View style={styles.qtyRow}>
                    <TouchableOpacity
                      style={styles.qtyBtn}
                      onPress={() => decreaseQty(index)}
                    >
                      <MaterialIcons name="remove" size={18} color="#1F7B6B" />
                    </TouchableOpacity>
                    <Text style={styles.qtyNum}>{item.qty}</Text>
                    <TouchableOpacity
                      style={styles.qtyBtn}
                      onPress={() => increaseQty(index)}
                    >
                      <MaterialIcons name="add" size={18} color="#1F7B6B" />
                    </TouchableOpacity>
                  </View>
                )}
              </TouchableOpacity>
            </Animated.View>
          )}
        />

        {/* Bottom Summary */}
        <View style={styles.bottomSection}>
          <View style={styles.summaryBox}>
            <View style={styles.summaryRow}>
              <View>
                <Text style={styles.summaryLabel}>Items Subtotal</Text>
                <Text style={styles.subtotalValue}>RM {itemsSubtotal.toFixed(2)}</Text>
                {(allocatedServiceCharge > 0 || allocatedTax > 0) && (
                  <View style={styles.breakdownBlock}>
                    {allocatedServiceCharge > 0 && (
                      <Text style={styles.breakdownLine}>
                        + Service charge: RM {allocatedServiceCharge.toFixed(2)}
                      </Text>
                    )}
                    {allocatedTax > 0 && (
                      <Text style={styles.breakdownLine}>
                        + SST / Tax: RM {allocatedTax.toFixed(2)}
                      </Text>
                    )}
                  </View>
                )}
                <Text style={styles.summaryLabelTotal}>Total (incl. charges)</Text>
                <Text style={styles.totalValue}>RM {total.toFixed(2)}</Text>
              </View>
              <View style={styles.itemsInfo}>
                <Text style={styles.itemsLabel}>Items Selected</Text>
                <Text style={styles.itemsValue}>{selectedCount}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.confirmBtn}
              onPress={handleConfirm}
              activeOpacity={0.85}
            >
              <MaterialIcons name="check-circle" size={20} color="#fff" />
              <Text style={styles.confirmText}>Confirm Selection</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F0F5F3",
  },
  container: {
    flex: 1,
    backgroundColor: "#F0F5F3",
  },
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#1F7B6B",
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  itemCountBadge: {
    backgroundColor: "#FFD93D",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  itemCountText: {
    fontWeight: "700",
    fontSize: 14,
    color: "#1F7B6B",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  itemContainer: {
    marginBottom: 12,
  },
  item: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 2,
    borderColor: "transparent",
  },
  itemSelected: {
    borderColor: "#1F7B6B",
    backgroundColor: "#F0F9F7",
  },
  itemDeselected: {
    opacity: 0.6,
  },
  itemLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#ddd",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  checkboxActive: {
    backgroundColor: "#1F7B6B",
    borderColor: "#1F7B6B",
  },
  checkIcon: {
    fontWeight: "bold",
  },
  itemInfo: {
    marginLeft: 14,
    flex: 1,
  },
  itemText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#222",
    marginBottom: 4,
  },
  itemTextDeselected: {
    color: "#999",
  },
  itemPrice: {
    fontSize: 13,
    color: "#1F7B6B",
    fontWeight: "700",
  },
  qtyRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F3F1",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 8,
  },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  qtyText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
  },
  qtyNum: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1F7B6B",
    minWidth: 24,
    textAlign: "center",
  },
  bottomSection: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 25,
    paddingBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  summaryBox: {
    gap: 16,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  summaryLabel: {
    fontSize: 13,
    color: "#888",
    fontWeight: "600",
    marginBottom: 6,
  },
  totalValue: {
    fontSize: 32,
    fontWeight: "800",
    color: "#1F7B6B",
  },
  subtotalValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F7B6B",
    marginBottom: 4,
  },
  summaryLabelTotal: {
    marginTop: 8,
    fontSize: 13,
    color: "#888",
    fontWeight: "600",
  },
  breakdownBlock: {
    marginTop: 4,
  },
  breakdownLine: {
    fontSize: 12,
    color: "#555",
  },
  itemsInfo: {
    alignItems: "flex-end",
  },
  itemsLabel: {
    fontSize: 13,
    color: "#888",
    fontWeight: "600",
    marginBottom: 6,
  },
  itemsValue: {
    fontSize: 28,
    fontWeight: "800",
    color: "#1F7B6B",
  },
  confirmBtn: {
    backgroundColor: "#1F7B6B",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 14,
    gap: 10,
    shadowColor: "#1F7B6B",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  confirmText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
});