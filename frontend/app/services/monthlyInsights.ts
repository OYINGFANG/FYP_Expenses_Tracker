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
        timeout: 10000, // Reduced timeout to 10 seconds
      }
    );
    return response.data.snapshot ?? null;
  } catch (err: any) {
    // Handle timeout and network errors gracefully
    if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
      console.warn("Monthly snapshot API timeout - backend may be unavailable. Continuing without snapshot.");
      return null;
    }
    
    // Handle network errors (server not reachable)
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === 'ERR_NETWORK') {
      console.warn("Monthly snapshot API unavailable - backend server not reachable. Continuing without snapshot.");
      return null;
    }
    
    // Log other errors but don't throw - return null gracefully
    console.warn("Monthly snapshot API error:", err.response?.data?.error || err.message || "Unknown error");
    return null;
  }
}

export async function getMonthlyInsights(
  userId: string,
  monthKey: string,
  snapshot?: MonthlySnapshot | null
): Promise<MonthlyInsightsResponse | null> {
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
        timeout: 20000, // Reduced timeout to 20 seconds
      }
    );
    return response.data;
  } catch (err: any) {
    // Handle timeout and network errors gracefully
    if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
      console.warn("Monthly insights API timeout - backend may be unavailable.");
      return null;
    }
    
    // Handle network errors (server not reachable)
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === 'ERR_NETWORK') {
      console.warn("Monthly insights API unavailable - backend server not reachable.");
      return null;
    }
    
    // Log other errors but return null gracefully
    console.warn("Monthly insights API error:", err.response?.data?.error || err.message || "Unknown error");
    return null;
  }
}

