// app/component/InteractiveTutorial.tsx
import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export type TutorialStep = {
  id: string;
  title: string;
  description: string;
  targetElement?: string; // ID or key to highlight
  position?: "top" | "bottom" | "left" | "right" | "center";
  action?: () => void; // Action to perform when step is shown
  skipable?: boolean;
  buttonText?: string;
  allowInteraction?: boolean; // Allow user to interact with highlighted element
  highlightPosition?: { x: number; y: number; width: number; height: number };
};

type InteractiveTutorialProps = {
  visible: boolean;
  currentStep: number;
  steps: TutorialStep[];
  onNext: () => void;
  onSkip: () => void;
  onComplete: () => void;
  highlightPosition?: { x: number; y: number; width: number; height: number };
};

export default function InteractiveTutorial({
  visible,
  currentStep,
  steps,
  onNext,
  onSkip,
  onComplete,
  highlightPosition,
}: InteractiveTutorialProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.8);
    }
  }, [visible, currentStep, fadeAnim, scaleAnim]);

  if (!visible || currentStep >= steps.length) return null;

  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;
  const allowInteraction = step.allowInteraction ?? false;

  // Use step's highlightPosition if provided, otherwise use prop
  // For welcome step (step 0), don't show highlight
  const actualHighlightPosition = 
    currentStep === 0 ? null : (step.highlightPosition || highlightPosition);

  // Calculate tooltip position based on highlight position
  const getTooltipStyle = () => {
    // For welcome step, center the tooltip
    if (currentStep === 0) {
      return { 
        // slightly higher on the screen for the welcome step
        top: SCREEN_HEIGHT * 0.33, 
        left: 20, 
        right: 20,
      };
    }
    
    // "Meet Auri AI" step (step 3)
    if (currentStep === 3 || step.id === "auri_ai") {
      return {
        top: SCREEN_HEIGHT * 0.40, // Center of screen
        left: 20,
        right: 20,
      };
    }
    
    // "You're All Set" step (step 7, displayed as "8 / 8")
    if (currentStep === 7 || step.id === "complete") {
      return {
        top: SCREEN_HEIGHT * 0.38, // Same position as play_games step
        left: 20,
        right: 20,
      };
    }
    
    if (!actualHighlightPosition) {
      return { top: SCREEN_HEIGHT * 0.3, left: 20, right: 20 };
    }

    const { y, height } = actualHighlightPosition;
    const tooltipHeight = 200;
    const spacing = 20;
    const bottomNavHeight = 100; 

    // If highlight is in bottom navigation area, always show tooltip well above
    const isInBottomNav = y > SCREEN_HEIGHT - bottomNavHeight;
    
    if (isInBottomNav) {
      // For bottom nav items, show tooltip in upper area to avoid blocking the tab
      // Step 3 (view_wallet, displayed as "3 / 6")
      if (currentStep === 2) {
        return {
          top: SCREEN_HEIGHT * 0.38,
          left: 20,
          right: 20,
        };
      }
      // Step 4 (auri_ai, displayed as "4 / 8")
      if (currentStep === 3) {
        return {
          top: 100,
          left: 20,
          right: 20,
        };
      }
      // Step 7 (play_games, displayed as "7 / 8")
      if (currentStep === 6 || step.id === "play_games") {
        return {
          top: SCREEN_HEIGHT * 0.38, 
          left: 20,
          right: 20,
        };
      }
      
      // For other bottom nav items, position at 25% from top
      const topPosition = SCREEN_HEIGHT * 0.25;
      return {
        top: topPosition,
        left: 20,
        right: 20,
      };
    } else if (currentStep === 1) {
      // Step 2 (add_expense, displayed as "2 / 8")
      // Position it at about 67% from top to be closer to the Add button
      return {
        top: SCREEN_HEIGHT * 0.67,
        left: 20,
        right: 20,
      };
    } else if (currentStep === 4 || step.id === "savings_goals") {
      // For "Set Savings Goals" step (step 4), position tooltip lower to see highlighted box
      return {
        top: SCREEN_HEIGHT * 0.68, // Lower on screen to see the highlighted box above
        left: 20,
        right: 20,
      };
    } else if (currentStep === 5 || step.id === "manage_debt") {
      // For "Manage Your Debts" step (step 5), position tooltip lower to see highlighted box
      return {
        top: SCREEN_HEIGHT * 0.68, // Lower on screen to see the highlighted box above
        left: 20,
        right: 20,
      };
    } else if (y > SCREEN_HEIGHT / 2) {
      // Show above for elements in lower half (but not bottom nav)
      return {
        top: Math.max(20, y - tooltipHeight - spacing),
        left: 20,
        right: 20,
      };
    } else {
      // Show below for elements in upper half
      return {
        top: Math.min(SCREEN_HEIGHT - tooltipHeight - 100, y + height + spacing),
        left: 20,
        right: 20,
      };
    }
  };

  if (!visible) return null;

  return (
    <View style={[StyleSheet.absoluteFill, styles.container]} pointerEvents={allowInteraction ? "box-none" : "auto"}>
        {/* Semi-transparent overlay with cutout for highlighted element */}
        {actualHighlightPosition ? (
          <>
            {/* Top overlay */}
            {actualHighlightPosition.y > 0 && (
              <View
                style={[
                  styles.overlaySection,
                  {
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: actualHighlightPosition.y,
                  },
                ]}
                pointerEvents={allowInteraction ? "none" : "auto"}
              />
            )}
            {/* Left overlay */}
            {actualHighlightPosition.x > 0 && (
              <View
                style={[
                  styles.overlaySection,
                  {
                    position: "absolute",
                    top: actualHighlightPosition.y,
                    left: 0,
                    width: actualHighlightPosition.x,
                    height: actualHighlightPosition.height,
                  },
                ]}
                pointerEvents={allowInteraction ? "none" : "auto"}
              />
            )}
            {/* Right overlay */}
            {actualHighlightPosition.x + actualHighlightPosition.width < SCREEN_WIDTH && (
              <View
                style={[
                  styles.overlaySection,
                  {
                    position: "absolute",
                    top: actualHighlightPosition.y,
                    left: actualHighlightPosition.x + actualHighlightPosition.width,
                    right: 0,
                    height: actualHighlightPosition.height,
                  },
                ]}
                pointerEvents={allowInteraction ? "none" : "auto"}
              />
            )}
            {/* Bottom overlay */}
            {actualHighlightPosition.y + actualHighlightPosition.height < SCREEN_HEIGHT && (
              <View
                style={[
                  styles.overlaySection,
                  {
                    position: "absolute",
                    top: actualHighlightPosition.y + actualHighlightPosition.height,
                    left: 0,
                    right: 0,
                    bottom: 0,
                  },
                ]}
                pointerEvents={allowInteraction ? "none" : "auto"}
              />
            )}
            {/* Invisible touch area for the highlighted button - allows touches to pass through */}
            {allowInteraction && (
              <View
                style={[
                  {
                    position: "absolute",
                    top: actualHighlightPosition.y,
                    left: actualHighlightPosition.x,
                    width: actualHighlightPosition.width,
                    height: actualHighlightPosition.height,
                  },
                ]}
                pointerEvents="none"
              />
            )}
          </>
        ) : (
          <Pressable
            style={styles.overlay}
            onPress={() => {}}
            pointerEvents={allowInteraction ? "none" : "auto"}
          />
        )}

        {/* Highlight border - visual indicator */}
        {actualHighlightPosition && currentStep !== 3 && (
          <View
            style={[
              styles.cutoutBorder,
              {
                top: actualHighlightPosition.y,
                left: actualHighlightPosition.x,
                width: actualHighlightPosition.width,
                height: actualHighlightPosition.height,
              },
            ]}
            pointerEvents="none"
          />
        )}

        {/* Tooltip - positioned based on highlight */}
        <Animated.View
          style={[
            styles.tooltip,
            getTooltipStyle(),
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
              zIndex: 10000,
              elevation: 10000,
            },
          ]}
          pointerEvents="box-none"
          collapsable={false}
        >
          <LinearGradient
            colors={["#FFFFFF", "#F9FAFB"]}
            style={styles.tooltipGradient}
            pointerEvents="auto"
          >
            {/* Step indicator */}
            <View style={styles.stepIndicator}>
              <Text style={styles.stepText}>
                {currentStep + 1} / {steps.length}
              </Text>
            </View>

            {/* Header pill with icon */}
            <View style={styles.headerRow}>
              <View style={styles.badge}>
                <Ionicons name="sparkles-outline" size={16} color="#115D59" />
                <Text style={styles.badgeText}>Quick tip</Text>
              </View>
            </View>

            {/* Title */}
            <Text style={styles.title}>{step.title}</Text>

            {/* Description */}
            <Text style={styles.description}>{step.description}</Text>

            {/* Action buttons */}
            <View style={styles.buttonRow}>
              {step.skipable && !isLastStep && (
                <TouchableOpacity
                  style={styles.skipButton}
                  onPress={onSkip}
                >
                  <Text style={styles.skipButtonText}>Skip</Text>
                </TouchableOpacity>
              )}

              {!allowInteraction && (
                <TouchableOpacity
                  style={styles.nextButton}
                  onPress={isLastStep ? onComplete : onNext}
                >
                  <Text style={styles.nextButtonText}>
                    {isLastStep ? "Got it" : step.buttonText || "Next"}
                  </Text>
                  {!isLastStep && (
                    <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
                  )}
                </TouchableOpacity>
              )}
            </View>
          </LinearGradient>
        </Animated.View>

      </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.85)",
  },
  overlayWithCutout: {
    ...StyleSheet.absoluteFillObject,
  },
  overlaySection: {
    backgroundColor: "rgba(0, 0, 0, 0.85)",
  },
  overlayRow: {
    flexDirection: "row",
  },
  cutout: {
    backgroundColor: "transparent",
  },
  cutoutBorder: {
    position: "absolute",
    backgroundColor: "transparent",
    borderRadius: 12,
    borderWidth: 3,
    borderColor: "#115D59",
    shadowColor: "#115D59",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 10,
  },
  tooltip: {
    position: "absolute",
    width: SCREEN_WIDTH - 40,
    alignSelf: "center",
    borderRadius: 20,
    overflow: "visible",
    zIndex: 1000,
  },
  tooltipGradient: {
    padding: 22,
    borderRadius: 20,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 16,
  },
  stepIndicator: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(148, 163, 184, 0.16)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 10,
  },
  stepText: {
    color: "#4B5563",
    fontSize: 12,
    fontWeight: "600",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#ECFDF3",
    gap: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#166534",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: "#4B5563",
    lineHeight: 22,
    marginBottom: 20,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 12,
  },
  skipButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  skipButtonText: {
    color: "#6B7280",
    fontSize: 16,
    fontWeight: "600",
    opacity: 0.9,
  },
  nextButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#115D59",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  nextButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    marginRight: 5,
  },
  interactionHint: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(34, 197, 94, 0.2)",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
  },
  interactionHintText: {
    color: "#115D59",
    fontSize: 14,
    fontWeight: "600",
  },
});

