// app/utils/chatHistoryUtils.ts
import { collection, doc, getDocs, orderBy, query, setDoc, deleteDoc, where, limit } from "firebase/firestore";
import { db } from "../../firebase";
import { type ChatResponse } from "../services/api";

const CHAT_HISTORY_COLLECTION = "CHAT_HISTORY";
const MAX_MESSAGES_TO_LOAD = 100; // Limit to prevent loading too much data

export type ChatMessage = 
  | { 
      id: number; 
      text: string; 
      type: "user" | "bot"; 
      time?: string;
      date?: string; // ISO date string (YYYY-MM-DD)
      timestamp?: string; // Full timestamp for sorting
      delivered?: boolean;
    }
  | {
      id: number;
      type: "pending_transaction";
      chatResponse: Extract<ChatResponse, { type: "pending_transaction_confirmation" }>;
      time?: string;
      date?: string; // ISO date string (YYYY-MM-DD)
      timestamp?: string; // Full timestamp for sorting
    };

const normalizeUserPath = (userId: string): string => {
  return userId.startsWith("/USERS/") ? userId : `/USERS/${userId}`;
};

/**
 * Save chat history for a user
 */
export const saveChatHistory = async (
  userId: string,
  messages: ChatMessage[]
): Promise<void> => {
  try {
    if (!userId) {
      console.warn("Cannot save chat history: no userId");
      return;
    }

    const userPath = normalizeUserPath(userId);
    const chatDocRef = doc(collection(db, CHAT_HISTORY_COLLECTION), userId);
    
    // Convert messages to a format suitable for Firestore
    const messagesData = messages.map(msg => {
      if (msg.type === "pending_transaction") {
        return {
          id: msg.id,
          type: "pending_transaction",
          chatResponse: msg.chatResponse,
          time: msg.time || null,
          date: msg.date || null,
          timestamp: msg.timestamp || null,
        };
      }
      return {
        id: msg.id,
        text: msg.text,
        type: msg.type,
        time: msg.time || null,
        date: msg.date || null,
        timestamp: msg.timestamp || null,
        delivered: msg.delivered || false,
      };
    });

    await setDoc(chatDocRef, {
      user_id: userPath,
      messages: messagesData,
      updated_at: new Date().toISOString(),
    }, { merge: false }); // Overwrite existing data

    console.log(`✅ Saved ${messages.length} messages to chat history for user ${userId}`);
  } catch (error) {
    console.error("❌ Error saving chat history:", error);
    // Don't throw - chat should still work even if saving fails
  }
};

/**
 * Load chat history for a user
 */
export const loadChatHistory = async (
  userId: string
): Promise<ChatMessage[]> => {
  try {
    if (!userId) {
      console.warn("Cannot load chat history: no userId");
      return [];
    }

    const userPath = normalizeUserPath(userId);
    const q = query(
      collection(db, CHAT_HISTORY_COLLECTION),
      where("user_id", "==", userPath),
      limit(1)
    );

    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      console.log("No chat history found for user");
      return [];
    }

    const docData = querySnapshot.docs[0].data();
    const messagesData = docData.messages || [];

    // Convert Firestore data back to ChatMessage format
    const messages: ChatMessage[] = messagesData.map((msg: any) => {
      if (msg.type === "pending_transaction") {
        return {
          id: msg.id,
          type: "pending_transaction" as const,
          chatResponse: msg.chatResponse as Extract<ChatResponse, { type: "pending_transaction_confirmation" }>,
          time: msg.time || undefined,
          date: msg.date || undefined,
          timestamp: msg.timestamp || undefined,
        };
      }
      return {
        id: msg.id,
        text: msg.text,
        type: msg.type as "user" | "bot",
        time: msg.time || undefined,
        date: msg.date || undefined,
        timestamp: msg.timestamp || undefined,
        delivered: msg.delivered || false,
      };
    });

    console.log(`✅ Loaded ${messages.length} messages from chat history for user ${userId}`);
    return messages;
  } catch (error) {
    console.error("❌ Error loading chat history:", error);
    return [];
  }
};

/**
 * Clear chat history for a user (useful for logout or manual clear)
 */
export const clearChatHistory = async (userId: string): Promise<void> => {
  try {
    if (!userId) return;

    const chatDocRef = doc(collection(db, CHAT_HISTORY_COLLECTION), userId);
    // Delete the entire document to completely remove chat history
    await deleteDoc(chatDocRef);

    console.log(`✅ Cleared chat history for user ${userId}`);
  } catch (error) {
    console.error("❌ Error clearing chat history:", error);
    throw error; // Re-throw to allow error handling in UI
  }
};

