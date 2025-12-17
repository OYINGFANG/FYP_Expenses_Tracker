// app/utils/notificationStore.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../firebase";

const NOTIFICATIONS_COLLECTION = "NOTIFICATIONS";

export type AppNotification = {
  id: string; 
  type: "debtReminder" | "savingsReminder" | "budgetReminder" | "badgeAchievement";
  header?: string;
  title: string;
  body: string;
  createdAt: string; 
  read: boolean;
  debtId?: string; 
  goalId?: string;
  monthKey?: string;
  category?: string;
  badgeId?: string; // For badge achievement notifications
};

/**
 * Normalize user path to /USERS/{uid} format
 */
function normalizeUserPath(userId: string | null): string | null {
  if (!userId) return null;
  return userId.startsWith("/USERS/") ? userId : `/USERS/${userId}`;
}

/**
 * Get userId from AsyncStorage
 */
async function getUserId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem("userId");
  } catch (error) {
    console.error("Error getting userId:", error);
    return null;
  }
}

/**
 * Convert Firestore document to AppNotification
 */
function docToNotification(docSnap: any): AppNotification {
  const data = docSnap.data();
  const createdAt = data.created_at?.toDate 
    ? data.created_at.toDate().toISOString() 
    : (data.created_at || new Date().toISOString());
  
  // Use notification_id if available, otherwise use document ID
  const notificationId = data.notification_id || docSnap.id;
  
  return {
    id: notificationId,
    type: data.type,
    header: data.header,
    title: data.title,
    body: data.body,
    createdAt,
    read: data.read || false,
    debtId: data.debtId,
    goalId: data.goalId,
    monthKey: data.monthKey,
    category: data.category,
    badgeId: data.badgeId,
  };
}

/**
 * Get all notifications from Firestore for the current user
 */
export async function getNotifications(userId?: string | null): Promise<AppNotification[]> {
  try {
    const uid = userId ?? await getUserId();
    const userPath = normalizeUserPath(uid);
    
    if (!userPath) {
      console.warn("No userId available for getting notifications");
      return [];
    }

    // Try query with orderBy first (requires index)
    try {
      const q = query(
        collection(db, NOTIFICATIONS_COLLECTION),
        where("user_id", "==", userPath),
        orderBy("created_at", "desc")
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(docToNotification);
    } catch (indexError: any) {
      // If index doesn't exist yet, fall back to query without orderBy
      if (indexError.code === "failed-precondition" || indexError.message?.includes("index")) {
        console.warn("Firestore index not found, using fallback query. Please create the index:", indexError.message);
        const q = query(
          collection(db, NOTIFICATIONS_COLLECTION),
          where("user_id", "==", userPath)
        );

        const snapshot = await getDocs(q);
        const notifications = snapshot.docs.map(docToNotification);
        // Sort in memory by createdAt descending
        return notifications.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      }
      throw indexError;
    }
  } catch (error) {
    console.error("Error getting notifications:", error);
    return [];
  }
}

/**
 * Subscribe to notifications for real-time updates
 */
export function subscribeToNotifications(
  userId: string | null,
  callback: (notifications: AppNotification[]) => void
): () => void {
  const userPath = normalizeUserPath(userId);
  
  if (!userPath) {
    console.warn("No userId available for subscribing to notifications");
    callback([]);
    return () => {}; // Return empty unsubscribe function
  }

  // Try query with orderBy first (requires index)
  const q = query(
    collection(db, NOTIFICATIONS_COLLECTION),
    where("user_id", "==", userPath),
    orderBy("created_at", "desc")
  );

  let unsubscribe: (() => void) | null = null;
  let useFallback = false;

  unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const notifications = snapshot.docs.map(docToNotification);
      callback(notifications);
    },
    (error: any) => {
      // If index error, use fallback query without orderBy
      if ((error.code === "failed-precondition" || error.message?.includes("index")) && !useFallback) {
        console.warn("Firestore index not found, using fallback subscription. Please create the index.");
        useFallback = true;
        
        const fallbackQ = query(
          collection(db, NOTIFICATIONS_COLLECTION),
          where("user_id", "==", userPath)
        );
        
        if (unsubscribe) unsubscribe(); // Unsubscribe from the failed query
        
        unsubscribe = onSnapshot(
          fallbackQ,
          (snapshot) => {
            const notifications = snapshot.docs.map(docToNotification);
            // Sort in memory by createdAt descending
            const sorted = notifications.sort((a, b) => 
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
            callback(sorted);
          },
          (fallbackError) => {
            console.error("Error in fallback notification subscription:", fallbackError);
            callback([]);
          }
        );
      } else {
        console.error("Error in notification subscription:", error);
        callback([]);
      }
    }
  );

  return () => {
    if (unsubscribe) unsubscribe();
  };
}

/**
 * Add a new notification to Firestore for the current user
 */
export async function addNotification(n: AppNotification, userId?: string | null): Promise<void> {
  try {
    const uid = userId ?? await getUserId();
    const userPath = normalizeUserPath(uid);
    
    if (!userPath) {
      console.warn("No userId available for adding notification");
      return;
    }

    // Check if notification with same notification_id already exists
    const qCheck = query(
      collection(db, NOTIFICATIONS_COLLECTION),
      where("user_id", "==", userPath),
      where("notification_id", "==", n.id)
    );
    const existingSnapshot = await getDocs(qCheck);
    
    if (!existingSnapshot.empty) {
      // Update existing notification instead of creating duplicate
      const docRef = doc(db, NOTIFICATIONS_COLLECTION, existingSnapshot.docs[0].id);
      await updateDoc(docRef, {
        title: n.title,
        body: n.body,
        header: n.header || null,
        read: n.read,
        updated_at: serverTimestamp(),
      });
      return;
    }

    // Create new notification document
    const notificationData = {
      notification_id: n.id,
      user_id: userPath,
      type: n.type,
      header: n.header || null,
      title: n.title,
      body: n.body,
      read: n.read || false,
      debtId: n.debtId || null,
      goalId: n.goalId || null,
      monthKey: n.monthKey || null,
      category: n.category || null,
      badgeId: n.badgeId || null,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    };

    await addDoc(collection(db, NOTIFICATIONS_COLLECTION), notificationData);
  } catch (error) {
    console.error("Error adding notification:", error);
  }
}

/**
 * Mark all notifications as read for the current user
 */
export async function markAllNotificationsRead(userId?: string | null): Promise<void> {
  try {
    const uid = userId ?? await getUserId();
    const userPath = normalizeUserPath(uid);
    
    if (!userPath) {
      console.warn("No userId available for marking notifications as read");
      return;
    }

    const q = query(
      collection(db, NOTIFICATIONS_COLLECTION),
      where("user_id", "==", userPath),
      where("read", "==", false)
    );

    const snapshot = await getDocs(q);
    const updatePromises = snapshot.docs.map((docSnap) =>
      updateDoc(doc(db, NOTIFICATIONS_COLLECTION, docSnap.id), {
        read: true,
        updated_at: serverTimestamp(),
      })
    );

    await Promise.all(updatePromises);
  } catch (error) {
    console.error("Error marking notifications as read:", error);
  }
}

/**
 * Clear all notifications for the current user
 */
export async function clearAllNotifications(userId?: string | null): Promise<void> {
  try {
    const uid = userId ?? await getUserId();
    const userPath = normalizeUserPath(uid);
    
    if (!userPath) {
      console.warn("No userId available for clearing notifications");
      return;
    }

    const q = query(
      collection(db, NOTIFICATIONS_COLLECTION),
      where("user_id", "==", userPath)
    );

    const snapshot = await getDocs(q);
    const deletePromises = snapshot.docs.map((docSnap) =>
      deleteDoc(doc(db, NOTIFICATIONS_COLLECTION, docSnap.id))
    );

    await Promise.all(deletePromises);
  } catch (error) {
    console.error("Error clearing notifications:", error);
  }
}

/**
 * Mark a specific notification as read for the current user
 */
export async function markNotificationRead(id: string, userId?: string | null): Promise<void> {
  try {
    const uid = userId ?? await getUserId();
    const userPath = normalizeUserPath(uid);
    
    if (!userPath) {
      console.warn("No userId available for marking notification as read");
      return;
    }

    // Find the notification document
    const q = query(
      collection(db, NOTIFICATIONS_COLLECTION),
      where("user_id", "==", userPath),
      where("notification_id", "==", id)
    );

    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const docRef = doc(db, NOTIFICATIONS_COLLECTION, snapshot.docs[0].id);
      await updateDoc(docRef, {
        read: true,
        updated_at: serverTimestamp(),
      });
    }
  } catch (error) {
    console.error("Error marking notification as read:", error);
  }
}

/**
 * Delete a specific notification for the current user
 */
export async function deleteNotification(id: string, userId?: string | null): Promise<void> {
  try {
    const uid = userId ?? await getUserId();
    const userPath = normalizeUserPath(uid);
    
    if (!userPath) {
      console.warn("No userId available for deleting notification");
      return;
    }

    // Find the notification document
    const q = query(
      collection(db, NOTIFICATIONS_COLLECTION),
      where("user_id", "==", userPath),
      where("notification_id", "==", id)
    );

    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      await deleteDoc(doc(db, NOTIFICATIONS_COLLECTION, snapshot.docs[0].id));
    }
  } catch (error) {
    console.error("Error deleting notification:", error);
  }
}

