// frontend/services/api.ts
// export const SERVER_URL = "http://10.0.2.2:3000"; 
// home ip: export const SERVER_URL = "http://192.168.0.96:3000"; 
// parkhill ip: export const SERVER_URL = "http://192.168.100.100:3000"; 
// For Android emulator
// For iOS simulator, use "http://localhost:3000"
// For real device: use your PC’s IP, e.g. "http://192.168.x.x:3000"

// app/services/api.ts
// Two bases: keep your existing chat server (3000) AND add Spring API (8080 or ngrok HTTPS)

// export const CHAT_SERVER_URL = "http://172.20.10.9:3000";   // your current Node/Express for /chat
// export const API_SERVER_URL  = "http://172.20.10.9:8080";   // your Spring Boot for /api/expenses

export const CHAT_SERVER_URL = "http://192.168.0.96:3000"; 
export const API_SERVER_URL  = "http://192.168.0.96:8080";


// Android emulator? use http://10.0.2.2:<port>
// iOS simulator? use http://localhost:<port>
// Real device? use your PC’s LAN IP like above, or an HTTPS ngrok URL

async function http<T>(base: string, path: string, init?: RequestInit): Promise<T> {
  const startTime = Date.now();
  const fullUrl = `${base}${path}`;
  const method = init?.method || "GET";
  
  console.log(`🌐 [API] Starting ${method} request to: ${fullUrl}`);
  if (init?.body) {
    try {
      const bodyPreview = JSON.parse(init.body as string);
      console.log(`📤 [API] Request body:`, {
        ...bodyPreview,
        message: bodyPreview.message ? `${bodyPreview.message.substring(0, 50)}...` : undefined,
      });
    } catch (e) {
      console.log(`📤 [API] Request body:`, init.body);
    }
  }
  
  // Add timeout to all requests
  const controller = new AbortController();
  // Increased timeout to 25 seconds to handle large datasets (snapshot building may take up to 5s, OpenAI API ~5-15s)
  const timeoutId = setTimeout(() => {
    const elapsed = Date.now() - startTime;
    console.warn(`⏱️ [API] Request timeout after ${elapsed}ms: ${fullUrl}`);
    controller.abort();
  }, 25000); // 25 second timeout
  
  try {
    console.log(`⏳ [API] Fetching: ${fullUrl}`);
    const res = await fetch(fullUrl, {
      headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
      ...init,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    
    const elapsed = Date.now() - startTime;
    console.log(`✅ [API] Response received in ${elapsed}ms: ${res.status} ${res.statusText}`);
    
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`❌ [API] Error response (${res.status}):`, text.substring(0, 200));
      throw new Error(`${res.status} ${res.statusText} ${text}`);
    }
    
    // some endpoints (DELETE) may return no body
    try {
      const data = await res.json() as T;
      console.log(`✅ [API] Response parsed successfully (total time: ${Date.now() - startTime}ms)`);
      return data;
    } catch (parseError) {
      console.log(`ℹ️ [API] No JSON body in response (total time: ${Date.now() - startTime}ms)`);
      return undefined as T;
    }
  } catch (error: any) {
    clearTimeout(timeoutId);
    const elapsed = Date.now() - startTime;
    console.error(`❌ [API] Request failed after ${elapsed}ms:`, {
      url: fullUrl,
      method,
      errorName: error.name,
      errorMessage: error.message,
      errorStack: error.stack?.substring(0, 300),
    });
    
    if (error.name === 'AbortError') {
      console.error(`⏱️ [API] Request aborted (timeout after ${elapsed}ms)`);
      throw new Error("Request timed out. Please check your connection and try again.");
    }
    if (error.message?.includes("Network request failed") || error.message?.includes("Failed to fetch")) {
      console.error(`🌐 [API] Network error - cannot connect to server`);
      throw new Error("Cannot connect to server. Please check:\n1. Backend server is running\n2. Your network connection\n3. Server IP address is correct");
    }
    throw error;
  }
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
  console.log(`💬 [Chat] sendMessageToServer called:`, {
    hasMessage: !!message,
    messageLength: message?.length || 0,
    messagePreview: message ? message.substring(0, 50) : undefined,
    hasUserId: !!userId,
    userId: userId ? userId.substring(0, 20) + "..." : undefined,
    hasAction: !!action,
    action,
  });
  
  const body: { message?: string; userId?: string; action?: string } = {};
  
  if (action) {
    body.action = action;
    if (userId) body.userId = userId;
    console.log(`🔘 [Chat] Sending action: ${action}`);
  } else {
    body.message = message;
    if (userId) body.userId = userId;
    console.log(`💬 [Chat] Sending message: "${message.substring(0, 100)}${message.length > 100 ? '...' : ''}"`);
  }
  
  try {
    const response = await http<ChatResponse>(CHAT_SERVER_URL, "/chat", {
      method: "POST",
      body: JSON.stringify(body),
    });
    
    console.log(`✅ [Chat] Response received:`, {
      type: response.type,
      hasMessage: !!response.message,
      messageLength: response.message?.length || 0,
      messagePreview: response.message ? response.message.substring(0, 100) : undefined,
      hasTransaction: response.type === "pending_transaction_confirmation",
    });
    
    return response;
  } catch (error: any) {
    console.error(`❌ [Chat] Error in sendMessageToServer:`, {
      errorName: error.name,
      errorMessage: error.message,
      errorStack: error.stack?.substring(0, 500),
    });
    throw error;
  }
}

/** ---------- SPRING: expense API ---------- */
export type Expense = {
  id?: number | string;
  amount: number;
  category?: string;       // optional; backend will auto-categorize if missing/Others
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
