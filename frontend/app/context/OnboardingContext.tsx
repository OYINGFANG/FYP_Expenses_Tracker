// app/context/OnboardingContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, updateDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { TutorialStep } from "../component/TutorialOverlay";
import { checkOnboardingStatus as checkOnboardingStatusUtil } from "../utils/onboardingUtils";
import { Currency, updateUserCurrency } from "../utils/currencyUtils";
import CurrencySelectionModal from "../component/CurrencySelectionModal";

type OnboardingContextType = {
  isOnboardingActive: boolean;
  currentStep: number;
  steps: TutorialStep[];
  startOnboarding: () => void;
  nextStep: () => void;
  skipOnboarding: () => void;
  completeOnboarding: () => Promise<void>;
  setHighlightPosition: (position: { x: number; y: number; width: number; height: number } | null) => void;
  highlightPosition: { x: number; y: number; width: number; height: number } | null;
  showCurrencyModal: boolean;
  handleCurrencySelected: (currency: Currency) => Promise<void>;
  checkOnboardingStatus: () => Promise<void>;
};

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

const ONBOARDING_STEPS: TutorialStep[] = [
  {
    id: "welcome",
    title: "Welcome to Auri! 👋",
    description: "Let's take a quick tour to help you get started. We'll walk you through the main features step by step.",
    position: "center",
    buttonText: "Let's Go",
    allowInteraction: false,
  },
  {
    id: "add_expense",
    title: "Add Your First Expense",
    description: "Tap the green 'Add' button below to add an expense. You can enter it manually or scan a receipt!",
    position: "bottom",
    buttonText: "I'll try it",
    allowInteraction: true, // Allow user to tap the Add button
  },
  {
    id: "view_wallet",
    title: "Explore Your Wallet",
    description: "Tap the 'Wallet' tab at the bottom to see your financial overview, spending patterns, and insights.",
    position: "bottom",
    buttonText: "Got it",
    allowInteraction: true, // Allow user to tap Wallet tab
  },
  {
    id: "auri_ai",
    title: "Meet Auri AI 🤖",
    description: "Tap the Auri AI button in the center to chat with your financial assistant. Ask questions about your spending!",
    position: "center",
    buttonText: "Next",
    allowInteraction: true, // Allow user to tap AI button
  },
  {
    id: "savings_goals",
    title: "Set Savings Goals",
    description: "Create savings goals to track your progress. Tap the 'Savings' button to get started!",
    position: "center",
    buttonText: "I'll try it",
    allowInteraction: true, // Allow user to tap the Savings button
  },
  {
    id: "manage_debt",
    title: "Manage Your Debts",
    description: "Track and manage your debts efficiently. Tap the 'Debt' button to add your debts and monitor your debt health score!",
    position: "center",
    buttonText: "I'll try it",
    allowInteraction: true, // Allow user to tap the Debt button
  },
  {
    id: "play_games",
    title: "Play Financial Games 🎮",
    description: "Learn financial management through fun games! Tap the 'Games' tab at the bottom to explore interactive financial games.",
    position: "bottom",
    buttonText: "Let's play",
    allowInteraction: true, // Allow user to tap Games tab
  },
  {
    id: "complete",
    title: "You're All Set! 🎉",
    description: "You've learned the basics! Start tracking your expenses and let Auri help you achieve your financial goals.",
    position: "center",
    buttonText: "Start Using Auri",
    allowInteraction: false,
  },
];

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [isOnboardingActive, setIsOnboardingActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  const [highlightPosition, setHighlightPosition] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  // Function to check onboarding status (can be called externally)
  const checkOnboardingStatus = React.useCallback(async () => {
    try {
      const userId = await AsyncStorage.getItem("userId");
      console.log("🔍 Checking onboarding status for userId:", userId);
      
      if (!userId) {
        console.log("⚠️ No userId found, skipping onboarding check");
        return;
      }

      // Check from Firestore if onboarding is completed
      const onboardingCompleted = await checkOnboardingStatusUtil(userId);
      console.log("📋 Onboarding completed status:", onboardingCompleted);
      
      // Start onboarding if not completed
      if (!onboardingCompleted) {
        console.log("✅ Starting onboarding tutorial");
        setIsOnboardingActive(true);
        setCurrentStep(0);
      } else {
        // Ensure onboarding is not active if completed
        console.log("❌ Onboarding already completed, skipping tutorial");
        setIsOnboardingActive(false);
      }
    } catch (error) {
      console.error("❌ Error checking onboarding:", error);
      // On error, assume onboarding not completed to be safe
      setIsOnboardingActive(true);
      setCurrentStep(0);
    }
  }, []);

  useEffect(() => {
    // Check onboarding status on mount with a small delay to ensure userId is available
    const timer = setTimeout(() => {
      checkOnboardingStatus();
    }, 500);
    
    return () => clearTimeout(timer);
  }, [checkOnboardingStatus]);

  const startOnboarding = () => {
    setIsOnboardingActive(true);
    setCurrentStep(0);
  };

  const nextStep = () => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      // After welcome step (step 0), show currency modal directly
      if (currentStep === 0) {
        setShowCurrencyModal(true);
        // Don't increment step yet, wait for currency selection
      } else {
        const nextStepIndex = currentStep + 1;
        setCurrentStep(nextStepIndex);
        setHighlightPosition(null); // Reset highlight when moving to next step
      }
    }
  };

  const handleCurrencySelected = async (currency: Currency) => {
    // Close modal and advance immediately for better UX
    setShowCurrencyModal(false);
    setCurrentStep(1); // Move to step 2 (add_expense)
    setHighlightPosition(null);
    
    // Update currency in the background (non-blocking)
    AsyncStorage.getItem("userId").then((userId) => {
      if (userId) {
        // Fire and forget - update in background without blocking UI
        updateUserCurrency(userId, currency).catch((error) => {
          console.error("Error saving currency:", error);
          // Error is logged but doesn't block the onboarding flow
        });
      }
    }).catch((error) => {
      console.error("Error getting userId:", error);
    });
  };

  const skipOnboarding = async () => {
    setIsOnboardingActive(false);
    setCurrentStep(0);
    setHighlightPosition(null);
    try {
      const userId = await AsyncStorage.getItem("userId");
      if (userId) {
        await AsyncStorage.setItem("onboardingCompleted", "true");
        const userDocRef = doc(db, "USERS", userId);
        await updateDoc(userDocRef, {
          onboardingCompleted: true,
          updated_at: serverTimestamp(),
        });
      }
    } catch (error) {
      console.error("Error skipping onboarding:", error);
    }
  };

  const completeOnboarding = async () => {
    setIsOnboardingActive(false);
    setCurrentStep(0);
    setHighlightPosition(null);
    try {
      const userId = await AsyncStorage.getItem("userId");
      if (userId) {
        await AsyncStorage.setItem("onboardingCompleted", "true");
        const userDocRef = doc(db, "USERS", userId);
        await updateDoc(userDocRef, {
          onboardingCompleted: true,
          updated_at: serverTimestamp(),
        });
      }
    } catch (error) {
      console.error("Error completing onboarding:", error);
    }
  };

  return (
    <OnboardingContext.Provider
      value={{
        isOnboardingActive,
        currentStep,
        steps: ONBOARDING_STEPS,
        startOnboarding,
        nextStep,
        skipOnboarding,
        completeOnboarding,
        setHighlightPosition,
        highlightPosition,
        showCurrencyModal,
        handleCurrencySelected,
        checkOnboardingStatus,
      }}
    >
      {children}
      {/* Currency Selection Modal - rendered at root level */}
      {showCurrencyModal && (
        <CurrencySelectionModal
          visible={showCurrencyModal}
          onSelect={handleCurrencySelected}
        />
      )}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (context === undefined) {
    throw new Error("useOnboarding must be used within an OnboardingProvider");
  }
  return context;
}

