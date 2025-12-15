// app/utils/onboardingUtils.ts
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../firebase";

/**
 * Check if user has completed onboarding
 * @param userId - User ID from Firebase Auth
 * @returns Promise<boolean> - true if onboarding is completed, false otherwise
 */
export async function checkOnboardingStatus(userId: string): Promise<boolean> {
  try {
    if (!userId) return false;

    const userDocRef = doc(db, "USERS", userId);
    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists()) {
      // If user document doesn't exist, assume onboarding not completed
      return false;
    }

    const userData = userDoc.data();
    // Return true if onboardingCompleted is explicitly true, otherwise false
    return userData.onboardingCompleted === true;
  } catch (error) {
    console.error("Error checking onboarding status:", error);
    // On error, assume onboarding not completed to be safe
    return false;
  }
}

/**
 * Mark onboarding as completed for a user
 * @param userId - User ID from Firebase Auth
 */
export async function markOnboardingCompleted(userId: string): Promise<void> {
  try {
    if (!userId) return;

    const userDocRef = doc(db, "USERS", userId);
    const { updateDoc, serverTimestamp } = await import("firebase/firestore");
    await updateDoc(userDocRef, {
      onboardingCompleted: true,
      updated_at: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error marking onboarding as completed:", error);
    throw error;
  }
}

