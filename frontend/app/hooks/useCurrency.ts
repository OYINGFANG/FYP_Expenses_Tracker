/**
 * React hook to get user's currency preference
 * Subscribes to Firestore and provides currency state
 */

import { useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { subscribeUserCurrency, getCachedCurrency, type Currency } from "../utils/currencyUtils";

export const useCurrency = (userId: string | null): Currency => {
  const [currency, setCurrency] = useState<Currency>("MYR");

  useEffect(() => {
    if (!userId) {
      // Try to get from cache if no userId
      getCachedCurrency().then(setCurrency);
      return;
    }

    // Subscribe to real-time currency updates
    const unsubscribe = subscribeUserCurrency(userId, (curr) => {
      setCurrency(curr);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [userId]);

  return currency;
};

