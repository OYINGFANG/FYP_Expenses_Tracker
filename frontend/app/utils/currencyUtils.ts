/**
 * Currency utility functions
 * Provides centralized currency formatting based on user preference
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";

export type Currency = "MYR" | "USD" | "SGD" | "EUR" | "GBP" | "JPY" | "CNY";

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  MYR: "RM",
  USD: "$",
  SGD: "S$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  CNY: "¥",
};

/**
 * Get currency symbol for a currency code
 */
export const getCurrencySymbol = (currency: Currency | string = "MYR"): string => {
  return CURRENCY_SYMBOLS[currency as Currency] || currency;
};

/**
 * Format amount with currency symbol
 */
export const formatCurrency = (
  amount: number,
  currency: Currency | string = "MYR",
  options?: {
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
    showSymbol?: boolean;
  }
): string => {
  const {
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
    showSymbol = true,
  } = options || {};

  const isNegative = amount < 0;
  const formatted = Math.abs(amount).toLocaleString("en-US", {
    minimumFractionDigits,
    maximumFractionDigits,
  });

  const symbol = showSymbol ? getCurrencySymbol(currency) : "";
  const sign = isNegative ? "-" : "";
  return symbol ? `${sign}${symbol} ${formatted}` : `${sign}${formatted}`;
};

/**
 * Get user's currency preference from Firestore
 * Returns a function to unsubscribe
 */
export const subscribeUserCurrency = (
  userId: string,
  callback: (currency: Currency) => void
): (() => void) => {
  const userDocRef = doc(db, "USERS", userId);
  
  const unsubscribe = onSnapshot(
    userDocRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        const currency = (data.currency as Currency) || "MYR";
        callback(currency);
        // Also cache in AsyncStorage for quick access
        AsyncStorage.setItem("userCurrency", currency).catch(() => {});
      } else {
        callback("MYR");
      }
    },
    (error) => {
      console.error("Error subscribing to user currency:", error);
      callback("MYR");
    }
  );

  return unsubscribe;
};

/**
 * Get cached currency from AsyncStorage (fallback)
 */
export const getCachedCurrency = async (): Promise<Currency> => {
  try {
    const cached = await AsyncStorage.getItem("userCurrency");
    return (cached as Currency) || "MYR";
  } catch {
    return "MYR";
  }
};

/**
 * Update user's currency preference in Firestore
 */
export const updateUserCurrency = async (
  userId: string,
  currency: Currency
): Promise<void> => {
  try {
    const userDocRef = doc(db, "USERS", userId);
    await updateDoc(userDocRef, {
      currency,
      updated_at: new Date(),
    });
    // Also cache in AsyncStorage
    await AsyncStorage.setItem("userCurrency", currency);
  } catch (error) {
    console.error("Error updating user currency:", error);
    throw error;
  }
};

/**
 * Legacy fmtRM function - now uses dynamic currency
 * Kept for backward compatibility
 */
export const fmtRM = (
  n: number,
  currency: Currency | string = "MYR",
  options?: {
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
  }
): string => {
  return formatCurrency(n, currency, options);
};

