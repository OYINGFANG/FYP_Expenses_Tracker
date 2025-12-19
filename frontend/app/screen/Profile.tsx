// app/screen/Profile.tsx
import React, { useEffect, useMemo, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  doc,
  onSnapshot,
  updateDoc,
  setDoc,
  getDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
} from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { db, auth } from "../../firebase";
import {
  reauthenticateWithCredential,
  updatePassword,
  EmailAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from "firebase/auth";
import { formatCurrency } from "../utils/currencyUtils";

/** ---------- Types ---------- */
type UserProfile = {
  username?: string;
  user_email?: string;
  user_gender?: string;
  user_dob?: any; // Firestore Timestamp
  user_password?: string;
  phone?: string;
  currency?: "MYR" | "USD" | "SGD" | string;
  avatarUrl?: string;
  defaultPaymentMethod?: "Cash" | "Bank" | "Credit Card" | "E-Wallet";
  emailVerified?: boolean;
  created_at?: any; // Firestore Timestamp
  updated_at?: any; // Firestore Timestamp
};

type ExpenseDoc = {
  exp_id: string;
  user_id: string;
  exp_category: string;
  exp_payment_method: string;
  exp_total: number;
  exp_notes: string;
  exp_date: string;
  created_at: string;
  updated_at: string;
};

type FinancialStats = {
  monthSpend: number;
  lastTxAmount: number;
  lastTxDate: string;
  avgDailySpend: number;
  totalTransactions: number;
  topCategory: string;
  weekSpend: number;
};

/** ---------- Helpers ---------- */
function getUidAndPath(userIdFromStorage: string | null): {
  uid: string | null;
  userPath: string | null;
} {
  if (!userIdFromStorage) return { uid: null, userPath: null };
  const parts = userIdFromStorage.split("/");
  const looksLikePath = parts.length >= 3 && parts[1] === "USERS";
  const uid = looksLikePath ? parts[2] : userIdFromStorage;
  const userPath = `/USERS/${uid}`;
  return { uid, userPath };
}

function formatTimestamp(timestamp: any): string {
  if (!timestamp) return "—";
  try {
    // Handle Firestore Timestamp
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function calculateAge(dob: any): number | null {
  if (!dob) return null;
  try {
    const birthDate = dob.toDate ? dob.toDate() : new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  } catch {
    return null;
  }
}

/** ---------- Edit Modal ---------- */
function useEditModal() {
  const [visible, setVisible] = useState(false);
  const [title, setTitle] = useState("");
  const [initial, setInitial] = useState("");
  const [value, setValue] = useState("");
  const [onSave, setOnSave] = useState<((v: string) => void) | null>(null);

  const open = (t: string, init: string, save: (v: string) => void) => {
    setTitle(t);
    setInitial(init);
    setValue(init);
    setOnSave(() => save);
    setVisible(true);
  };

  const close = () => setVisible(false);

  const ModalUI = (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.modalBackdrop}
      >
        <TouchableOpacity 
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={close}
        >
          <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{title}</Text>
                <TouchableOpacity onPress={close} hitSlop={8}>
                  <Ionicons name="close-circle" size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>
              <TextInput
                value={value}
                onChangeText={setValue}
                placeholder={initial || "Enter value"}
                placeholderTextColor="#9CA3AF"
                style={styles.modalInput}
                autoFocus
              />
              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={() => {
                  onSave?.(value.trim());
                  close();
                }}
              >
                <Text style={styles.modalSaveBtnText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );

  return { open, ModalUI };
}

/** ---------- Password Security Helpers ---------- */
const validatePasswordStrength = (password: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push("At least 8 characters");
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("One uppercase letter");
  }
  if (!/[a-z]/.test(password)) {
    errors.push("One lowercase letter");
  }
  if (!/\d/.test(password)) {
    errors.push("One number");
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push("One special character (!@#$%^&*)");
  }
  
  return { isValid: errors.length === 0, errors };
};

const getPasswordStrength = (password: string): "weak" | "medium" | "strong" => {
  if (password.length === 0) return "weak";
  
  let strength = 0;
  if (password.length >= 8) strength++;
  if (password.length >= 12) strength++;
  if (/[A-Z]/.test(password)) strength++;
  if (/[a-z]/.test(password)) strength++;
  if (/\d/.test(password)) strength++;
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) strength++;
  
  if (strength <= 2) return "weak";
  if (strength <= 4) return "medium";
  return "strong";
};

/** ---------- Change Password Modal ---------- */
function ChangePasswordModal({
  visible,
  onClose,
  onSignOut,
  userId,
}: {
  visible: boolean;
  onClose: () => void;
  onSignOut?: () => void;
  userId?: string | null;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [lockUntil, setLockUntil] = useState<Date | null>(null);
  const onCloseRef = useRef(onClose);
  
  // Update ref when onClose changes
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Monitor auth state changes only when modal is visible
  // Track if user was logged in when modal opened
  const wasLoggedInRef = useRef(auth.currentUser !== null);
  
  useEffect(() => {
    if (!visible) {
      // Reset the ref when modal closes
      wasLoggedInRef.current = auth.currentUser !== null;
      return;
    }
    
    // Update ref when modal opens
    wasLoggedInRef.current = auth.currentUser !== null;
    
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      // Only close if user was logged in when modal opened AND now signed out
      // This prevents closing on initial auth state check
      if (!user && wasLoggedInRef.current) {
        // User signed out while modal is open - close it
        onCloseRef.current();
      }
      // Update ref for next check
      wasLoggedInRef.current = user !== null;
    });
    return () => unsubscribe();
  }, [visible]); // Only depend on visible, use ref for onClose

  // Check if account is locked
  useEffect(() => {
    if (lockUntil) {
      const checkLock = setInterval(() => {
        if (new Date() >= lockUntil) {
          setIsLocked(false);
          setLockUntil(null);
          setFailedAttempts(0);
        }
      }, 1000);
      return () => clearInterval(checkLock);
    }
  }, [lockUntil]);

  const handleChangePassword = async () => {
    setError("");

    // Check if account is locked
    if (isLocked && lockUntil && new Date() < lockUntil) {
      const minutesLeft = Math.ceil((lockUntil.getTime() - new Date().getTime()) / 60000);
      setError(`Account temporarily locked. Try again in ${minutesLeft} minute(s).`);
      return;
    }

    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("Please fill in all fields");
      return;
    }

    // Strong password validation
    const passwordValidation = validatePasswordStrength(newPassword);
    if (!passwordValidation.isValid) {
      setError(`Password must contain: ${passwordValidation.errors.join(", ")}`);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match");
      return;
    }

    if (currentPassword === newPassword) {
      setError("New password must be different from current password");
      return;
    }

    // Check for common weak passwords
    const commonPasswords = ["password", "12345678", "qwerty", "abc123", "password123"];
    if (commonPasswords.some(weak => newPassword.toLowerCase().includes(weak))) {
      setError("Password is too common. Please choose a stronger password.");
      return;
    }

    setLoading(true);
    try {
      // Wait for auth state to be ready - check multiple times if needed
      let user = auth.currentUser;
      let attempts = 0;
      while (!user && attempts < 10) {
        await new Promise(resolve => setTimeout(resolve, 200));
        user = auth.currentUser;
        attempts++;
      }

      // If still no user, try to get email from Firestore
      let emailToUse: string | null = null;
      if (!user) {
        if (!userId) {
          setError("You are not logged in. Please sign in and try again.");
          setLoading(false);
          setTimeout(() => {
            onClose();
            onSignOut?.();
          }, 2000);
          return;
        }
        
        // Try to get email from Firestore
        try {
          const userDoc = await getDoc(doc(db, "USERS", userId));
          if (userDoc.exists()) {
            const data = userDoc.data();
            emailToUse = data.user_email || null;
          }
        } catch (e) {
          console.warn("Failed to get user email from Firestore:", e);
        }
        
        if (!emailToUse) {
          setError("Authentication session expired. Please sign in again to change your password.");
          setLoading(false);
          return;
        }
      } else {
        emailToUse = user.email || null;
      }

      if (!emailToUse) {
        setError("Your account email is not available. Please contact support.");
        setLoading(false);
        return;
      }

      // If we have a user from auth, use it for reauthentication and password update
      if (user) {
        // Reauthenticate user
        const credential = EmailAuthProvider.credential(emailToUse, currentPassword);
        await reauthenticateWithCredential(user, credential);

        // Update password in Firebase Auth
        await updatePassword(user, newPassword);
      } else {
        // If no auth user but we have userId and email, we can only update Firestore
        // We can't update Firebase Auth without an active session
        // Verify current password by trying to sign in
        try {
          const { signInWithEmailAndPassword } = await import("firebase/auth");
          await signInWithEmailAndPassword(auth, emailToUse, currentPassword);
          // If sign in succeeds, we now have auth.currentUser
          user = auth.currentUser;
          if (user) {
            await updatePassword(user, newPassword);
          } else {
            throw new Error("Failed to get user after sign in");
          }
        } catch (signInError: any) {
          if (signInError.code === "auth/wrong-password" || signInError.code === "auth/invalid-credential") {
            setError("Current password is incorrect.");
            setLoading(false);
            setFailedAttempts((prev) => {
              const newAttempts = prev + 1;
              if (newAttempts >= 5) {
                setIsLocked(true);
                const lockTime = new Date();
                lockTime.setMinutes(lockTime.getMinutes() + 15);
                setLockUntil(lockTime);
              }
              return newAttempts;
            });
            return;
          }
          throw signInError;
        }
      }

      // Also update password in Firestore
      // Use userId from props (from AsyncStorage) if available, otherwise use auth.currentUser.uid
      // After password update, user should be available
      const firestoreUserId = userId || (user ? user.uid : null);
      
      if (!firestoreUserId) {
        console.error("No user ID available for Firestore update");
        Alert.alert(
          "Warning",
          "Password updated in Firebase Auth, but could not update database. Please contact support."
        );
        setLoading(false);
        return;
      }
      try {
        const userDocRef = doc(db, "USERS", firestoreUserId);
        // Use setDoc with merge to ensure it works even if document structure differs
        await setDoc(
          userDocRef,
          {
            user_password: newPassword,
            updated_at: new Date(),
          },
          { merge: true }
        );
        console.log("✅ Password updated in Firestore successfully");
        console.log("   User ID used:", firestoreUserId);
        console.log("   Auth UID:", user ? user.uid : "N/A");
        console.log("   UserId prop:", userId);
      } catch (firestoreError: any) {
        // Log detailed error for debugging
        console.error("❌ Failed to update password in Firestore:");
        console.error("   Error code:", firestoreError.code);
        console.error("   Error message:", firestoreError.message);
        console.error("   Attempted user ID:", firestoreUserId);
        console.error("   Auth UID:", user ? user.uid : "N/A");
        console.error("   UserId prop:", userId);
        // Show error to user but don't fail the password change
        // Firebase Auth password is already updated, which is the primary source
        Alert.alert(
          "Password Updated",
          "Your password has been changed in Firebase Auth, but there was an issue updating it in the database. Please contact support if this persists."
        );
      }

      // Reset failed attempts on success
      setFailedAttempts(0);
      setIsLocked(false);
      setLockUntil(null);

      // Sign out user for security - require re-login with new password
      Alert.alert(
        "Password Changed",
        "Your password has been changed successfully. For security, please sign in again with your new password.",
        [
          {
            text: "OK",
            onPress: async () => {
              // Clear all stored credentials
              await AsyncStorage.multiRemove([
                "loggedIn",
                "userId",
                "userEmail",
                "email",
                "password",
                "token",
              ]);
              // Sign out from Firebase
              await firebaseSignOut(auth);
              // Close modal
              onClose();
              // Trigger sign out navigation in parent
              onSignOut?.();
              // Note: Router navigation should be handled by parent component
            },
          },
        ]
      );

      // Reset form
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      console.error("Password change error:", err);
      
      // Handle failed attempts and rate limiting
      if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        const newFailedAttempts = failedAttempts + 1;
        setFailedAttempts(newFailedAttempts);
        
        if (newFailedAttempts >= 5) {
          // Lock account for 15 minutes after 5 failed attempts
          const lockTime = new Date();
          lockTime.setMinutes(lockTime.getMinutes() + 15);
          setIsLocked(true);
          setLockUntil(lockTime);
          setError("Too many failed attempts. Account locked for 15 minutes.");
        } else {
          setError(`Current password is incorrect. ${5 - newFailedAttempts} attempt(s) remaining.`);
        }
      } else if (err.code === "auth/weak-password") {
        setError("New password is too weak. Please use a stronger password.");
      } else if (err.code === "auth/requires-recent-login") {
        setError("For security, please sign out and sign in again before changing your password.");
      } else {
        setError(err.message || "Failed to change password. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const passwordStrength = getPasswordStrength(newPassword);
  const passwordValidation = validatePasswordStrength(newPassword);

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Change Password</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Ionicons name="close-circle" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Security Notice */}
          <View style={styles.securityNotice}>
            <Ionicons name="information-circle" size={18} color="#3B82F6" />
            <Text style={styles.securityNoticeText}>
              For security, you will be automatically logged out after changing your password. Please sign in again with your new password.
            </Text>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color="#EF4444" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.passwordInputContainer}>
            <Text style={styles.inputLabel}>Current Password</Text>
            <View style={styles.passwordInputWrapper}>
              <TextInput
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Enter current password"
                placeholderTextColor="#9CA3AF"
                style={styles.passwordInput}
                secureTextEntry={!showCurrentPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                onPress={() => setShowCurrentPassword(!showCurrentPassword)}
                style={styles.passwordToggle}
              >
                <Ionicons
                  name={showCurrentPassword ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color="#6B7280"
                />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.passwordInputContainer}>
            <Text style={styles.inputLabel}>New Password</Text>
            <View style={styles.passwordInputWrapper}>
              <TextInput
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Enter new password"
                placeholderTextColor="#9CA3AF"
                style={styles.passwordInput}
                secureTextEntry={!showNewPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                onPress={() => setShowNewPassword(!showNewPassword)}
                style={styles.passwordToggle}
              >
                <Ionicons
                  name={showNewPassword ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color="#6B7280"
                />
              </TouchableOpacity>
            </View>
            
            {/* Password Strength Indicator */}
            {newPassword.length > 0 && (
              <View style={styles.passwordStrengthContainer}>
                <View style={styles.passwordStrengthBar}>
                  <View
                    style={[
                      styles.passwordStrengthFill,
                      {
                        width: `${passwordStrength === "weak" ? 33 : passwordStrength === "medium" ? 66 : 100}%`,
                        backgroundColor:
                          passwordStrength === "weak"
                            ? "#EF4444"
                            : passwordStrength === "medium"
                            ? "#F59E0B"
                            : "#22C55E",
                      },
                    ]}
                  />
                </View>
                <Text
                  style={[
                    styles.passwordStrengthText,
                    {
                      color:
                        passwordStrength === "weak"
                          ? "#EF4444"
                          : passwordStrength === "medium"
                          ? "#F59E0B"
                          : "#22C55E",
                    },
                  ]}
                >
                  {passwordStrength === "weak"
                    ? "Weak"
                    : passwordStrength === "medium"
                    ? "Medium"
                    : "Strong"}
                </Text>
              </View>
            )}

            {/* Password Requirements */}
            {newPassword.length > 0 && (
              <View style={styles.passwordRequirements}>
                <Text style={styles.passwordRequirementsTitle}>Password must contain:</Text>
                {passwordValidation.errors.map((req, index) => (
                  <View key={index} style={styles.passwordRequirementItem}>
                    <Ionicons
                      name="close-circle"
                      size={14}
                      color="#EF4444"
                      style={styles.requirementIcon}
                    />
                    <Text style={styles.passwordRequirementText}>{req}</Text>
                  </View>
                ))}
                {passwordValidation.isValid && (
                  <View style={styles.passwordRequirementItem}>
                    <Ionicons
                      name="checkmark-circle"
                      size={14}
                      color="#22C55E"
                      style={styles.requirementIcon}
                    />
                    <Text style={[styles.passwordRequirementText, { color: "#22C55E" }]}>
                      All requirements met
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>

          <View style={styles.passwordInputContainer}>
            <Text style={styles.inputLabel}>Confirm New Password</Text>
            <View style={styles.passwordInputWrapper}>
              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm new password"
                placeholderTextColor="#9CA3AF"
                style={styles.passwordInput}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                style={styles.passwordToggle}
              >
                <Ionicons
                  name={showConfirmPassword ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color="#6B7280"
                />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.modalSaveBtn, loading && styles.modalSaveBtnDisabled]}
            onPress={handleChangePassword}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.modalSaveBtnText}>Change Password</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

/** ---------- Change Currency Modal ---------- */
function ChangeCurrencyModal({
  visible,
  onClose,
  currentCurrency,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  currentCurrency: string;
  onSave: (currency: string) => void;
}) {
  const currencies = ["MYR", "USD", "SGD", "EUR", "GBP", "JPY", "CNY"];
  const [selectedCurrency, setSelectedCurrency] = useState(currentCurrency);

  const handleSave = () => {
    onSave(selectedCurrency);
    onClose();
  };

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Change Currency</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Ionicons name="close-circle" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <Text style={styles.modalSubtitle}>Select your preferred currency</Text>

          <ScrollView style={styles.currencyList}>
            {currencies.map((currency) => (
              <TouchableOpacity
                key={currency}
                style={[
                  styles.currencyItem,
                  selectedCurrency === currency && styles.currencyItemSelected,
                ]}
                onPress={() => setSelectedCurrency(currency)}
              >
                <Text
                  style={[
                    styles.currencyText,
                    selectedCurrency === currency && styles.currencyTextSelected,
                  ]}
                >
                  {currency}
                </Text>
                {selectedCurrency === currency && (
                  <Ionicons name="checkmark-circle" size={20} color="#1E3932" />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSave}>
            <Text style={styles.modalSaveBtnText}>Save Changes</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

/** ---------- Screen ---------- */
export default function ProfileScreen() {
  const router = useRouter();

  const [uid, setUid] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState<FinancialStats>({
    monthSpend: 0,
    lastTxAmount: 0,
    lastTxDate: "",
    avgDailySpend: 0,
    totalTransactions: 0,
    topCategory: "—",
    weekSpend: 0,
  });

  const editModal = useEditModal();
  const [changePasswordModalVisible, setChangePasswordModalVisible] = useState(false);
  const [changeCurrencyModalVisible, setChangeCurrencyModalVisible] = useState(false);

  const monthBounds = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return { startISO: start.toISOString(), nextISO: next.toISOString() };
  }, []);

  const weekBounds = useMemo(() => {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
    weekStart.setHours(0, 0, 0, 0);
    return { startISO: weekStart.toISOString() };
  }, []);

  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem("userId");
      const { uid: extractedUid, userPath } = getUidAndPath(stored);

      if (!extractedUid || !userPath) {
        Alert.alert("Error", "User not found");
        setLoading(false);
        return;
      }
      setUid(extractedUid);

      // Subscribe: profile
      const unsubProfile = onSnapshot(doc(db, "USERS", extractedUid), (snap) => {
        setProfile((snap.data() as UserProfile) ?? null);
        setLoading(false);
      });

      // Subscribe: month expenses
      const monthQ = query(
        collection(db, "EXPENSES"),
        where("user_id", "==", userPath),
        where("exp_date", ">=", monthBounds.startISO),
        where("exp_date", "<", monthBounds.nextISO)
      );
      
      const unsubMonth = onSnapshot(monthQ, (snap) => {
        const expenses = snap.docs.map((d) => d.data() as ExpenseDoc);
        
        const sum = expenses.reduce((acc, dt) => {
          const v = typeof dt.exp_total === "number" ? dt.exp_total : Number(dt.exp_total);
          return acc + (Number.isFinite(v) ? v : 0);
        }, 0);

        // Calculate category frequency
        const categoryCount: Record<string, number> = {};
        expenses.forEach((exp) => {
          categoryCount[exp.exp_category] = (categoryCount[exp.exp_category] || 0) + 1;
        });
        
        const topCat = Object.keys(categoryCount).length > 0
          ? Object.entries(categoryCount).sort((a, b) => b[1] - a[1])[0][0]
          : "—";

        // Days in month so far
        const now = new Date();
        const daysInMonth = now.getDate();
        const avgDaily = daysInMonth > 0 ? sum / daysInMonth : 0;

        setStats((prev) => ({
          ...prev,
          monthSpend: sum,
          avgDailySpend: avgDaily,
          totalTransactions: expenses.length,
          topCategory: topCat,
        }));
      });

      // Subscribe: week expenses
      const weekQ = query(
        collection(db, "EXPENSES"),
        where("user_id", "==", userPath),
        where("exp_date", ">=", weekBounds.startISO)
      );
      
      const unsubWeek = onSnapshot(weekQ, (snap) => {
        const weekSum = snap.docs.reduce((acc, d) => {
          const dt = d.data() as ExpenseDoc;
          const v = typeof dt.exp_total === "number" ? dt.exp_total : Number(dt.exp_total);
          return acc + (Number.isFinite(v) ? v : 0);
        }, 0);
        
        setStats((prev) => ({ ...prev, weekSpend: weekSum }));
      });

      // Subscribe: last transaction
      const lastTxQ = query(
        collection(db, "EXPENSES"),
        where("user_id", "==", userPath),
        orderBy("exp_date", "desc"),
        limit(1)
      );
      
      const unsubLast = onSnapshot(lastTxQ, (snap) => {
        if (snap.docs[0]) {
          const lastDoc = snap.docs[0].data() as ExpenseDoc;
          setStats((prev) => ({
            ...prev,
            lastTxAmount: Number(lastDoc.exp_total),
            lastTxDate: lastDoc.exp_date,
          }));
        }
      });

      return () => {
        unsubProfile();
        unsubMonth();
        unsubWeek();
        unsubLast();
      };
    })();
  }, [monthBounds.nextISO, monthBounds.startISO, weekBounds.startISO]);

  const updateProfile = async (patch: Partial<UserProfile>) => {
    if (!uid) return;
    setSaving(true);
    try {
      const refDoc = doc(db, "USERS", uid);
      await updateDoc(refDoc, {
        ...patch,
        updated_at: new Date(),
      });
    } catch (e) {
      console.error(e);
      Alert.alert("Update failed", "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1E3932" />
          <Text style={styles.loadingText}>Loading profile…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const currency = profile?.currency || "MYR";
  const joined = formatTimestamp(profile?.created_at);
  const age = calculateAge(profile?.user_dob);
  const memberDays = profile?.created_at 
    ? Math.floor((new Date().getTime() - (profile.created_at.toDate ? profile.created_at.toDate().getTime() : new Date(profile.created_at).getTime())) / (1000 * 60 * 60 * 24))
    : 0;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>My Profile</Text>
            <Text style={styles.headerSubtitle}>Manage your account</Text>
          </View>
          <TouchableOpacity 
            onPress={() => router.push("/screen/Home")} 
            style={styles.closeBtn}
            hitSlop={8}
          >
            <Ionicons name="close" size={24} color="#1E3932" />
          </TouchableOpacity>
        </View>

        {/* Profile Hero Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroGradient}>
            <View style={styles.avatarSection}>
              <View style={styles.avatarContainer}>
                <Image
                  source={{
                    uri:
                      profile?.avatarUrl ||
                      `https://ui-avatars.com/api/?background=C9EAD6&color=1E3932&name=${encodeURIComponent(
                        profile?.username || "User"
                      )}&size=120&bold=true`,
                  }}
                  style={styles.avatar}
                />
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark-circle" size={28} color="#10B981" />
                </View>
              </View>
              
              <View style={styles.profileInfo}>
                <View style={styles.nameRow}>
                  <Text style={styles.profileName}>{profile?.username || "Your Name"}</Text>
                  <View style={[
                    styles.verifiedTextBadge,
                    profile?.emailVerified ? styles.verifiedBadgeActive : styles.verifiedBadgeInactive
                  ]}>
                    <Ionicons 
                      name={profile?.emailVerified ? "checkmark-circle" : "close-circle"} 
                      size={14} 
                      color={profile?.emailVerified ? "#10B981" : "#EF4444"} 
                    />
                    <Text style={[
                      styles.verifiedText,
                      profile?.emailVerified ? styles.verifiedTextActive : styles.verifiedTextInactive
                    ]}>
                      {profile?.emailVerified ? "Verified" : "Not Verified"}
                    </Text>
                  </View>
                </View>
                <View style={styles.emailRow}>
                  <Text style={styles.profileEmail}>{profile?.user_email || "you@example.com"}</Text>
                </View>
                
                <View style={styles.badgesRow}>
                  {age && (
                    <View style={styles.infoBadge}>
                      <Ionicons name="calendar-outline" size={12} color="#1E3932" />
                      <Text style={styles.badgeText}>{age} years old</Text>
                    </View>
                  )}
                  {profile?.user_gender && (
                    <View style={styles.infoBadge}>
                      <Ionicons name="person-outline" size={12} color="#1E3932" />
                      <Text style={styles.badgeText}>{profile.user_gender}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.joinedBadge}>
                  <Ionicons name="star" size={14} color="#F59E0B" />
                  <View style={styles.joinedTextContainer}>
                    <Text style={styles.joinedText}>Member for {memberDays} days</Text>
                    <Text style={styles.joinedText}>• Since {joined}</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Financial Stats */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Financial Overview</Text>
          
          {/* Primary Stats */}
          <View style={styles.primaryStatsGrid}>
            <View style={styles.primaryStatCard}>
              <View style={styles.statIconBox}>
                <Ionicons name="trending-up" size={20} color="#1E3932" />
              </View>
              <Text style={styles.statLabel}>This Month</Text>
              <Text style={styles.statValue}>{formatCurrency(stats.monthSpend, currency)}</Text>
              <Text style={styles.statSubtext}>
                ~{formatCurrency(stats.avgDailySpend, currency)}/day
              </Text>
            </View>

            <View style={styles.primaryStatCard}>
              <View style={[styles.statIconBox, { backgroundColor: "#FEF3C7" }]}>
                <Ionicons name="calendar-outline" size={20} color="#D97706" />
              </View>
              <Text style={styles.statLabel}>This Week</Text>
              <Text style={styles.statValue}>{formatCurrency(stats.weekSpend, currency)}</Text>
              <Text style={styles.statSubtext}>{stats.totalTransactions} transactions</Text>
            </View>
          </View>

          {/* Secondary Stats */}
          <View style={styles.secondaryStatsRow}>
            <View style={styles.secondaryStatCard}>
              <View style={[styles.statIconBox, { backgroundColor: "#EDE9FE" }]}>
                <Ionicons name="receipt" size={20} color="#8B5CF6" />
              </View>
              <Text style={styles.statLabel}>Last Transaction</Text>
              <Text style={styles.statValue}>
                {stats.lastTxAmount > 0 ? formatCurrency(stats.lastTxAmount, currency) : "—"}
              </Text>
            </View>

            <View style={styles.secondaryStatCard}>
              <View style={[styles.statIconBox, { backgroundColor: "#D1FAE5" }]}>
                <Ionicons name="bar-chart" size={20} color="#059669" />
              </View>
              <Text style={styles.statLabel}>Top Category</Text>
              <Text style={styles.statValue}>{stats.topCategory}</Text>
            </View>
          </View>
        </View>

        {/* Account Settings */}
        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>Account Settings</Text>
          
          <View style={styles.settingsCard}>
            <SettingItem
              icon="person-outline"
              iconBg="#D1FAE5"
              iconColor="#1E3932"
              label="Username"
              value={profile?.username || "Not set"}
              onPress={() =>
                editModal.open("Username", profile?.username || "", (v) =>
                  updateProfile({ username: v })
                )
              }
            />
            <Divider />
            <SettingItem
              icon="mail-outline"
              iconBg="#E0E7FF"
              iconColor="#6366F1"
              label="Email Address"
              value={profile?.user_email || "—"}
              disabled
            />
            <Divider />
            <SettingItem
              icon="lock-closed-outline"
              iconBg="#FEE2E2"
              iconColor="#DC2626"
              label="Password"
              value="••••••••"
              onPress={() => setChangePasswordModalVisible(true)}
            />
            <Divider />
            <SettingItem
              icon="cash-outline"
              iconBg="#FEF3C7"
              iconColor="#D97706"
              label="Currency"
              value={currency}
              onPress={() => setChangeCurrencyModalVisible(true)}
            />
          </View>
        </View>

        {/* Sign Out */}
        <View style={styles.logoutSection}>
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={async () => {
              Alert.alert(
                "Sign Out",
                "Are you sure you want to sign out?",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Sign Out",
                    style: "destructive",
                    onPress: async () => {
                      await AsyncStorage.multiRemove([
                        "loggedIn",
                        "userId",
                        "userEmail",
                        "token",
                      ]);
                      router.replace("/screen/SignIn");
                    },
                  },
                ],
                { cancelable: true }
              );
            }}
          >
            <Ionicons name="log-out-outline" size={20} color="#EF4444" />
            <Text style={styles.logoutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        {saving && (
          <View style={styles.savingIndicator}>
            <ActivityIndicator size="small" color="#1E3932" />
            <Text style={styles.savingText}>Saving changes…</Text>
          </View>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>

      {editModal.ModalUI}
      
      <ChangePasswordModal
        visible={changePasswordModalVisible}
        onClose={() => setChangePasswordModalVisible(false)}
        onSignOut={() => {
          router.replace("/screen/SignIn");
        }}
        userId={uid}
      />
      
      <ChangeCurrencyModal
        visible={changeCurrencyModalVisible}
        onClose={() => setChangeCurrencyModalVisible(false)}
        currentCurrency={currency}
        onSave={(newCurrency) => updateProfile({ currency: newCurrency })}
      />
    </SafeAreaView>
  );
}

/** ---------- Components ---------- */
function SettingItem({
  icon,
  iconBg,
  iconColor,
  label,
  value,
  onPress,
  disabled,
}: {
  icon: any;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
  onPress?: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={styles.settingItem}
      onPress={disabled ? undefined : onPress}
      activeOpacity={disabled ? 1 : 0.7}
      disabled={disabled}
    >
      <View style={styles.settingLeft}>
        <View style={[styles.settingIcon, { backgroundColor: iconBg }]}>
          <Ionicons name={icon} size={18} color={iconColor} />
        </View>
        <View style={styles.settingTextContainer}>
          <Text style={styles.settingLabel}>{label}</Text>
          <Text style={[styles.settingValue, disabled && { opacity: 0.5 }]} numberOfLines={1}>
            {value}
          </Text>
        </View>
      </View>
      {!disabled && <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />}
    </TouchableOpacity>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

/** ---------- Styles ---------- */
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#E4F2ED" },
  scroll: { paddingBottom: 40 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { 
    color: "#1E3932", 
    marginTop: 12, 
    fontWeight: "600",
    fontSize: 16 
  },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1E3932",
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 2,
    fontWeight: "500",
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },

  // Hero Card
  heroCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 18,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  heroGradient: {
    backgroundColor: "#1E3932",
    padding: 16,
  },
  avatarSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  avatarContainer: {
    position: "relative",
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#C9EAD6",
    borderWidth: 3,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  verifiedBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    width: 28,
    height: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  profileInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
    flexWrap: "wrap",
  },
  profileName: {
    fontSize: 20,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  emailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  profileEmail: {
    fontSize: 13,
    color: "#C9EAD6",
    fontWeight: "500",
  },
  verifiedTextBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  verifiedBadgeActive: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
  },
  verifiedBadgeInactive: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
  },
  verifiedText: {
    fontSize: 11,
    fontWeight: "700",
  },
  verifiedTextActive: {
    color: "#10B981",
  },
  verifiedTextInactive: {
    color: "#EF4444",
  },
  badgesRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  infoBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#C9EAD6",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 11,
    color: "#1E3932",
    fontWeight: "700",
  },
  joinedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  joinedTextContainer: {
    flexDirection: "column",
    gap: 2,
  },
  joinedText: {
    fontSize: 11,
    color: "#FFFFFF",
    fontWeight: "600",
  },

  // Stats Section
  statsSection: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1E3932",
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  primaryStatsGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },
  primaryStatCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  statIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#D1FAE5",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "600",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 16,
    fontWeight: "900",
    color: "#1E3932",
    marginBottom: 2,
  },
  statSubtext: {
    fontSize: 11,
    color: "#9CA3AF",
    fontWeight: "500",
  },
  secondaryStatsRow: {
    flexDirection: "row",
    gap: 10,
  },
  secondaryStatCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  miniIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  statContent: {
    flex: 1,
  },
  miniStatLabel: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "600",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  miniStatValue: {
    fontSize: 16,
    fontWeight: "900",
    color: "#1E3932",
  },

  // Settings Section
  settingsSection: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  settingsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
  },
  settingLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  settingTextContainer: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "600",
    marginBottom: 3,
  },
  settingValue: {
    fontSize: 15,
    color: "#1E3932",
    fontWeight: "700",
  },
  divider: {
    height: 1,
    backgroundColor: "#F3F4F6",
    marginLeft: 62,
  },

  // Actions
  actionsSection: {
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 10,
  },
  actionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 14,
    ...Platform.select({
      android: {
        elevation: 2,
      },
    }),
  },
  actionIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1E3932",
    marginBottom: 2,
  },
  actionSubtext: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "500",
  },

  // Logout
  logoutSection: {
    paddingHorizontal: 16,
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#FEF2F2",
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FEE2E2",
  },
  logoutText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#EF4444",
  },

  // Saving Indicator
  savingIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 16,
  },
  savingText: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "600",
  },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1E3932",
  },
  modalInput: {
    borderWidth: 2,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontWeight: "600",
    color: "#1E3932",
    backgroundColor: "#F9FAFB",
    marginBottom: 16,
  },
  modalSaveBtn: {
    backgroundColor: "#1E3932",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  modalSaveBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  modalSaveBtnDisabled: {
    opacity: 0.6,
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 16,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEE2E2",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: "#DC2626",
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
  },
  passwordInputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1E3932",
    marginBottom: 8,
  },
  passwordInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 12,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: "#1E3932",
  },
  passwordToggle: {
    padding: 4,
  },
  currencyList: {
    maxHeight: 300,
    marginBottom: 16,
  },
  currencyItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#F9FAFB",
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  currencyItemSelected: {
    backgroundColor: "#ECFDF3",
    borderColor: "#86EFAC",
    borderWidth: 2,
  },
  currencyText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1E3932",
  },
  currencyTextSelected: {
    color: "#1E3932",
    fontWeight: "800",
  },
  passwordStrengthContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  passwordStrengthBar: {
    flex: 1,
    height: 4,
    backgroundColor: "#E5E7EB",
    borderRadius: 2,
    overflow: "hidden",
  },
  passwordStrengthFill: {
    height: "100%",
    borderRadius: 2,
  },
  passwordStrengthText: {
    fontSize: 12,
    fontWeight: "700",
    minWidth: 50,
  },
  passwordRequirements: {
    marginTop: 12,
    padding: 12,
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  passwordRequirementsTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1E3932",
    marginBottom: 8,
  },
  passwordRequirementItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  requirementIcon: {
    marginRight: 6,
  },
  passwordRequirementText: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "600",
  },
  securityNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#EFF6FF",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    marginBottom: 16,
  },
  securityNoticeText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    color: "#1E40AF",
    lineHeight: 18,
  },
});