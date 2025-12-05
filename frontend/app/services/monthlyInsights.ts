// app/services/monthlyInsights.ts
import axios from "axios";
import { Platform } from "react-native";
import type { MonthlySnapshot } from "../utils/financeTypes";

// const YOUR_COMPUTER_IP = "192.168.100.100";
const YOUR_COMPUTER_IP = "192.168.0.97";
const BASE_URL = Platform.OS === "android"
  ? "http://192.168.0.97:3000"
  : `http://${YOUR_COMPUTER_IP}:3000`;

export interface MonthlyInsightsResponse {
  insights: string;
}

export async function fetchMonthlySnapshot(
  userId: string,
  monthKey?: string
): Promise<MonthlySnapshot | null> {
  try {
    const response = await axios.get<{ snapshot: MonthlySnapshot | null }>(
      `${BASE_URL}/monthly-snapshot`,
      {
        params: {
          userId,
          ...(monthKey ? { monthKey } : {}),
        },
        timeout: 15000,
      }
    );
    return response.data.snapshot ?? null;
  } catch (err: any) {
    console.error("Monthly snapshot API error:", err);
    throw new Error(
      err.response?.data?.error || err.message || "Failed to load monthly snapshot"
    );
  }
}

export async function getMonthlyInsights(
  userId: string,
  monthKey: string,
  snapshot?: MonthlySnapshot | null
): Promise<MonthlyInsightsResponse> {
  try {
    const payload: Record<string, unknown> = { userId, monthKey };
    if (snapshot) {
      // Backend builds its own snapshot but we keep sending this for debugging parity.
      payload.snapshot = snapshot;
    }

    const response = await axios.post<MonthlyInsightsResponse>(
      `${BASE_URL}/api/monthly-insights`,
      payload,
      {
        timeout: 30000, // 30 second timeout
      }
    );
    return response.data;
  } catch (err: any) {
    console.error("Monthly insights API error:", err);
    throw new Error(
      err.response?.data?.error || err.message || "Failed to generate insights"
    );
  }
}

