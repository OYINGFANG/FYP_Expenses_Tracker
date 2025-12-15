// app/component/TutorialOverlay.tsx
import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
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

type TutorialOverlayProps = {
  visible: boolean;
  currentStep: number;
  steps: TutorialStep[];
  onNext: () => void;
  onSkip: () => void;
  onComplete: () => void;
  highlightPosition?: { x: number; y: number; width: number; height: number };
};

export default function TutorialOverlay({
  visible,
  currentStep,
  steps,
  onNext,
  onSkip,
  onComplete,
  highlightPosition,
}: TutorialOverlayProps) {
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
  }, [visible, currentStep]);

  if (!visible || currentStep >= steps.length) return null;

  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;
  const isFirstStep = currentStep === 0;

  // Calculate tooltip position based on highlight position
  const getTooltipStyle = () => {
    if (!highlightPosition) {
      return { top: SCREEN_HEIGHT * 0.3, left: 20, right: 20 };
    }

    const { x, y, width, height } = highlightPosition;
    const tooltipWidth = SCREEN_WIDTH - 40;
    const tooltipHeight = 200;
    const spacing = 20;

    // Position tooltip above or below the highlight
    if (y > SCREEN_HEIGHT / 2) {
      // Show above
      return {
        top: y - tooltipHeight - spacing,
        left: 20,
        right: 20,
      };
    } else {
      // Show below
      return {
        top: y + height + spacing,
        left: 20,
        right: 20,
      };
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
    >
      <View style={styles.container}>
        {/* Dark overlay with cutout */}
        <View style={styles.overlay}>
          {highlightPosition && (
            <View
              style={[
                styles.cutout,
                {
                  top: highlightPosition.y,
                  left: highlightPosition.x,
                  width: highlightPosition.width,
                  height: highlightPosition.height,
                },
              ]}
            />
          )}
        </View>

        {/* Tooltip */}
        <Animated.View
          style={[
            styles.tooltip,
            getTooltipStyle(),
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <LinearGradient
            colors={["#1E5449", "#154C42"]}
            style={styles.tooltipGradient}
          >
            {/* Step indicator */}
            <View style={styles.stepIndicator}>
              <Text style={styles.stepText}>
                {currentStep + 1} / {steps.length}
              </Text>
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

              <TouchableOpacity
                style={styles.nextButton}
                onPress={isLastStep ? onComplete : onNext}
              >
                <Text style={styles.nextButtonText}>
                  {isLastStep ? "Get Started" : step.buttonText || "Next"}
                </Text>
                {!isLastStep && (
                  <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
                )}
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Progress dots */}
        <View style={styles.progressContainer}>
          {steps.map((_, index) => (
            <View
              key={index}
              style={[
                styles.progressDot,
                index === currentStep && styles.progressDotActive,
                index < currentStep && styles.progressDotCompleted,
              ]}
            />
          ))}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
  },
  cutout: {
    position: "absolute",
    backgroundColor: "transparent",
    borderRadius: 12,
    borderWidth: 3,
    borderColor: "#22C55E",
    shadowColor: "#22C55E",
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
    overflow: "hidden",
  },
  tooltipGradient: {
    padding: 24,
  },
  stepIndicator: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 12,
  },
  stepText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: "#E5E7EB",
    lineHeight: 24,
    marginBottom: 24,
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
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    opacity: 0.7,
  },
  nextButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#22C55E",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  nextButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  progressContainer: {
    position: "absolute",
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
  },
  progressDotActive: {
    width: 24,
    backgroundColor: "#22C55E",
  },
  progressDotCompleted: {
    backgroundColor: "#22C55E",
  },
});

