// frontend/services/api.ts
// export const SERVER_URL = "http://10.0.2.2:3000"; 
// home ip: export const SERVER_URL = "http://192.168.0.96:3000"; 
// parkhill ip: export const SERVER_URL = "http://192.168.100.100:3000"; 
// For Android emulator
// For iOS simulator, use "http://localhost:3000"
// For real device: use your PC’s IP, e.g. "http://192.168.x.x:3000"

// app/services/api.ts
// Two bases: keep your existing chat server (3000) AND add Spring API (8080 or ngrok HTTPS)

export const CHAT_SERVER_URL = "http://172.20.10.9:3000";   // your current Node/Express for /chat
export const API_SERVER_URL  = "http://172.20.10.9:8080";   // your Spring Boot for /api/expenses

// Android emulator? use http://10.0.2.2:<port>
// iOS simulator? use http://localhost:<port>
// Real device? use your PC’s LAN IP like above, or an HTTPS ngrok URL

async function http<T>(base: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} ${text}`);
  }
  // some endpoints (DELETE) may return no body
  try { return (await res.json()) as T; } catch { return undefined as T; }
}

/** ---------- Chat API Types ---------- */
export type ChatResponse =
  | {
      type: "normal";
      message: string;
    }
  | {
      type: "pending_transaction_confirmation";
      message: string;
      transaction: {
        type: "expense" | "income";
        amount: number;
        currency: string;
        categoryName: string;
        date: string | null;
        description: string;
        paymentMethod: string;
      };
      actions: {
        id: "confirm_pending_transaction" | "cancel_pending_transaction";
        label: string;
        style: "primary" | "secondary";
      }[];
    };

/** ---------- existing chat endpoint ---------- */
export async function sendMessageToServer(
  message: string,
  userId?: string,
  action?: "confirm_pending_transaction" | "cancel_pending_transaction"
): Promise<ChatResponse> {
  const body: { message?: string; userId?: string; action?: string } = {};
  
  if (action) {
    body.action = action;
    if (userId) body.userId = userId;
  } else {
    body.message = message;
    if (userId) body.userId = userId;
  }
  
  return http<ChatResponse>(CHAT_SERVER_URL, "/chat", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** ---------- SPRING: expense API ---------- */
export type Expense = {
  id?: number | string;
  amount: number;
  category?: string;       // optional; backend will auto-categorize if missing/Miscellaneous
  description?: string;    // your note or merchant/metadata
  date?: string;           // ISO string
};

export type Analysis = {
  totalSpending: number;
  remainingBudget: number;
  categoryBreakdown: Record<string, number>;
  insights: string[];
  budgetRecommendations: Record<string, number>;
};

export const expensesApi = {
  getAll: () => http<Expense[]>(API_SERVER_URL, "/api/expenses"),
  add:   (expense: Expense) =>
    http<Expense>(API_SERVER_URL, "/api/expenses", {
      method: "POST",
      body: JSON.stringify(expense),
    }),
  analyze: (budget: number) =>
    http<Analysis>(API_SERVER_URL, `/api/expenses/analyze?budget=${encodeURIComponent(budget)}`),
  predictCategory: (description: string) =>
    http<{ category: string }>(API_SERVER_URL, `/api/expenses/predict-category?description=${encodeURIComponent(description)}`),
  clear: () => http<void>(API_SERVER_URL, "/api/expenses/clear", { method: "DELETE" }),
};
