import FontAwesome from "@expo/vector-icons/FontAwesome";
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Video, Audio, ResizeMode } from "expo-av";
import React, { useState, useRef, useEffect } from "react";
import { 
  StyleSheet, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  View,
  Alert,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  Keyboard,
  TextStyle,
} from "react-native";
import Markdown, { MarkdownIt } from "react-native-markdown-display";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getUsernameFromFirestore } from "../utils/UserUtils";
import { sendMessageToServer, type ChatResponse } from "../services/api";

const recordingOptions: Audio.RecordingOptions = Platform.select({
  ios: Audio.RecordingOptionsPresets.HIGH_QUALITY,
  android: Audio.RecordingOptionsPresets.HIGH_QUALITY,
}) as Audio.RecordingOptions;

const isDevClient = process.env.EXPO_PUBLIC_ENV !== "production";

// Initialize markdown parser
const markdownIt = MarkdownIt({ typographer: true });

type Message = 
  | { 
      id: number; 
      text: string; 
      type: "user" | "bot"; 
      time?: string; 
      delivered?: boolean;
    }
  | {
      id: number;
      type: "pending_transaction";
      chatResponse: Extract<ChatResponse, { type: "pending_transaction_confirmation" }>;
      time?: string;
    };

// const YOUR_COMPUTER_IP = "172.20.10.9";
const YOUR_COMPUTER_IP = "192.168.0.96";

// For Android emulator, use 10.0.2.2. For real device or iOS, use your computer's IP
const BASE_URL = Platform.OS === "android"
  ? "http://192.168.0.96:3000"
  : `http://${YOUR_COMPUTER_IP}:3000`;


interface AvatarScreenProps {
  onClose?: () => void;
}

export default function AvatarScreen({ onClose }: AvatarScreenProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [textInputValue, setTextInputValue] = useState(""); 
  const [textInputHeight, setTextInputHeight] = useState(45);
  const [botTyping, setBotTyping] = useState(false);
  const [typingDots, setTypingDots] = useState("");
  const [isVideoReady, setIsVideoReady] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const scrollViewRef = useRef<ScrollView | null>(null);
  const videoRef = useRef<Video>(null);

  // Initialize video status and handle playback
  useEffect(() => {
    return () => {
      // Cleanup on unmount
      videoRef.current?.unloadAsync();
    };
  }, []);

  // Fetch username from Firestore and send greeting
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        let name = "there";
        const profile = await getUsernameFromFirestore(); 

        if (profile) {
          name = profile.username; 
        }

        setMessages([{
          id: Date.now(),
          text: `Hello ${name}! 👋 How can I help you today?`,
          type: "bot",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        }]);
      } catch {
        // Fallback handled by default name
      }
    };
    fetchUserData();
  }, []);

  // Load finance snapshot for current user and current month
  useEffect(() => {
    const loadSnapshot = async () => {
      try {
        // Get userId from AsyncStorage (same pattern as rest of the app)
        const stored = await AsyncStorage.getItem("userId");
        if (!stored) {
          console.warn("No user ID found in AsyncStorage, skipping snapshot load");
          return;
        }

        // Extract uid from stored value (might be "/USERS/<uid>" or just "<uid>")
        const parts = stored.split("/");
        const looksLikePath = parts.length >= 3 && parts[1] === "USERS";
        const userId = looksLikePath ? parts[2] : stored;

        if (!userId) {
          console.warn("Could not extract user ID from stored value:", stored);
          return;
        }

        const res = await axios.get(`${BASE_URL}/monthly-snapshot`, {
          params: { userId },
        });

        const snapshot = res.data.snapshot ?? null;
        console.log("✅ Finance snapshot loaded:", snapshot ? "Yes" : "No");
        if (snapshot) {
          if (isDevClient) {
            console.log("📦 Frontend MonthlySnapshot from backend:", JSON.stringify(snapshot, null, 2));
          } else {
            console.log("📦 Snapshot stats:", {
              income: snapshot.totalIncome,
              spending: snapshot.spendingTotals?.spending,
              savings: snapshot.savingsSummary?.savingsContrib,
              dti: snapshot.debtSummary?.debtToIncomeRatio,
            });
          }
        }
      } catch (err: any) {
        console.error("Failed to load finance snapshot:", err.message);
      }
    };

    loadSnapshot();
  }, []);

  // Bot typing dots animation
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    if (botTyping) {
      interval = setInterval(() => {
        setTypingDots(prev => (prev.length < 3 ? prev + "." : ""));
      }, 500);
    } else {
      setTypingDots("");
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [botTyping]);

  useEffect(() => {
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages, botTyping]);

  const formatTime = () => {
    const d = new Date();
    return `${d.getHours()}:${d.getMinutes().toString().padStart(2, "0")}`;
  };

  const startRecording = async () => {
    try {
      if (isRecording) return;
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission Required", "Microphone permission is required!");
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        interruptionModeAndroid: 1,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(recordingOptions);
      await recording.startAsync();
      recordingRef.current = recording;
      setIsRecording(true);
      setTextInputValue("Translating...");
    } catch (err) {
      console.error("Start recording error:", err);
      Alert.alert("Error", "Failed to start recording");
    }
  };

  const stopRecording = async () => {
    try {
      if (!recordingRef.current) return;
      setIsRecording(false);
      setIsProcessing(true);

      await recordingRef.current.stopAndUnloadAsync();
      if (Platform.OS === "android") await new Promise(res => setTimeout(res, 500));

      const uri = recordingRef.current.getURI();
      const oldRecording = recordingRef.current;
      recordingRef.current = null;

      oldRecording.createNewLoadedSoundAsync()
        .then(({ sound }) => sound.playAsync())
        .catch(err => console.warn("Playback failed:", err));

      if (!uri) throw new Error("Recording URI is invalid");

      const formData = new FormData();
      formData.append("file", { uri, name: "recording.m4a", type: "audio/m4a" } as any);

      const response = await axios.post(`${BASE_URL}/transcribe`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 30000, 
      });

      const transcript = response.data.text || "Could not transcribe.";
      setTextInputValue(transcript);
    } catch (err: any) {
      console.error("Stop recording error:", err);
      const errorMsg = err.message || "Transcription failed";
      Alert.alert("Error", errorMsg);
      setMessages(prev => [...prev, { 
        id: Date.now(), 
        text: `Error: ${errorMsg}`, 
        type: "bot", 
        time: formatTime() 
      }]);
      setTextInputValue("");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSend = () => {
    if (!textInputValue.trim()) return;
    const userMessage: Message = { 
      id: Date.now(), 
      text: textInputValue, 
      type: "user", 
      time: formatTime(), 
      delivered: false 
    };
    setMessages(prev => [...prev, userMessage]);
    setTextInputValue("");
    setTextInputHeight(40);
    Keyboard.dismiss();
    simulateBotReply(userMessage.text);
    
    setTimeout(() => {
      setMessages(prev => prev.map(msg => 
        msg.id === userMessage.id ? { ...msg, delivered: true } : msg
      ));
    }, 500);
  };

  const getUserId = async (): Promise<string | undefined> => {
    try {
      const stored = await AsyncStorage.getItem("userId");
      if (!stored) return undefined;
      
      // Extract uid from stored value (might be "/USERS/<uid>" or just "<uid>")
      const parts = stored.split("/");
      const looksLikePath = parts.length >= 3 && parts[1] === "USERS";
      return looksLikePath ? parts[2] : stored;
    } catch {
      return undefined;
    }
  };

  const sendMessageToBot = async (
    message?: string,
    action?: "confirm_pending_transaction" | "cancel_pending_transaction"
  ): Promise<ChatResponse> => {
    try {
      const userId = await getUserId();
      const response = await sendMessageToServer(message || "", userId, action);
      return response;
    } catch (err: any) {
      console.error("Bot API error:", err);
      // Return a valid ChatResponse structure even on errors
      return {
        type: "normal",
        message: err.message?.includes("Network") 
          ? "Sorry, I cannot respond right now. Please check your connection."
          : "Sorry, I encountered an error. Please try again.",
      };
    }
  };

  const handleTransactionAction = async (
    action: "confirm_pending_transaction" | "cancel_pending_transaction"
  ) => {
    setBotTyping(true);
    try {
      const response = await sendMessageToBot(undefined, action);
      
      if (response.type === "normal") {
        // Remove the pending transaction message and add the confirmation
        setMessages(prev => {
          const filtered = prev.filter(msg => msg.type !== "pending_transaction");
          return [
            ...filtered,
            {
              id: Date.now(),
              text: response.message,
              type: "bot",
              time: formatTime(),
            },
          ];
        });
      } else if (response.type === "pending_transaction_confirmation") {
        // Still pending (shouldn't happen, but handle gracefully)
        setMessages(prev => {
          const filtered = prev.filter(msg => msg.type !== "pending_transaction");
          return [
            ...filtered,
            {
              id: Date.now(),
              type: "pending_transaction",
              chatResponse: response,
              time: formatTime(),
            },
          ];
        });
      }
    } catch (err) {
      console.error("Error handling transaction action:", err);
    } finally {
      setBotTyping(false);
    }
  };

  const simulateBotReply = async (userText: string) => {
    setBotTyping(true);
    try {
      const response = await sendMessageToBot(userText);

      if (response.type === "normal") {
        const botMessage: Message = {
          id: Date.now() + 1,
          text: response.message,
          type: "bot",
          time: formatTime(),
        };
        setMessages(prev => [...prev, botMessage]);
      } else if (response.type === "pending_transaction_confirmation") {
        const pendingMessage: Message = {
          id: Date.now() + 1,
          type: "pending_transaction",
          chatResponse: response,
          time: formatTime(),
        };
        setMessages(prev => [...prev, pendingMessage]);
      }
    } catch (err) {
      console.error("Error in simulateBotReply:", err);
      const errorMessage: Message = {
        id: Date.now() + 1,
        text: "Sorry, I encountered an error. Please try again.",
        type: "bot",
        time: formatTime(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setBotTyping(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* 🔹 Fixed background video - starts loading immediately on mount */}
      <Video
        ref={videoRef}
        source={require("@/assets/images/angry.mp4")}
        style={styles.background}
        shouldPlay
        isLooping
        isMuted={false}
        resizeMode={ResizeMode.COVER}
        onLoadStart={() => {
          console.log("Video loading started");
        }}
        onLoad={() => {
          console.log("Video loaded and ready");
          setIsVideoReady(true);
          // Ensure video starts playing
          videoRef.current?.setIsLoopingAsync(true).catch(() => {});
          videoRef.current?.playAsync().catch((err) => {
            console.error("Error playing video:", err);
          });
        }}
        onPlaybackStatusUpdate={(status) => {
          // Handle looping - replay when video finishes
          if (status.isLoaded && status.didJustFinish) {
            videoRef.current?.replayAsync().catch(() => {});
          }
        }}
        onError={(error) => {
          console.error("Video loading error:", error);
          setIsVideoReady(true);
        }}
      />
      <View style={styles.overlay} />

      {/* 🔹 Foreground that moves with keyboard */}
      <KeyboardAvoidingView
        style={styles.foreground}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 40 : 0} 
      >

        {/* Chat messages */}
        <ScrollView 
          ref={scrollViewRef} 
          style={styles.chatContainer} 
          contentContainerStyle={{ paddingBottom: 20 }}
        >
          {messages.map(msg => {
            if (msg.type === "pending_transaction") {
              const { transaction, message: transactionMessage, actions } = msg.chatResponse;
              const dateStr = transaction.date 
                ? new Date(transaction.date).toLocaleDateString("en-US", { 
                    year: "numeric", 
                    month: "short", 
                    day: "numeric" 
                  })
                : "today";
              
              return (
                <View key={msg.id} style={[styles.bubble, styles.bubbleBlue, styles.transactionCard]}>
                  <Text style={styles.botLabel}>🤖</Text>
                  <Markdown
                    markdownit={markdownIt}
                    style={markdownBotStyles}
                  >
                    {transactionMessage}
                  </Markdown>
                  
                  <View style={styles.transactionDetails}>
                    <View style={styles.transactionRow}>
                      <Text style={styles.transactionLabel}>Type:</Text>
                      <Text style={styles.transactionValue}>
                        {transaction.type === "expense" ? "Expense" : "Income"}
                      </Text>
                    </View>
                    <View style={styles.transactionRow}>
                      <Text style={styles.transactionLabel}>Amount:</Text>
                      <Text style={styles.transactionValue}>
                        {transaction.currency} {transaction.amount}
                      </Text>
                    </View>
                    <View style={styles.transactionRow}>
                      <Text style={styles.transactionLabel}>Category:</Text>
                      <Text style={styles.transactionValue}>{transaction.categoryName}</Text>
                    </View>
                    {transaction.description && (
                      <View style={styles.transactionRow}>
                        <Text style={styles.transactionLabel}>Description:</Text>
                        <Text style={styles.transactionValue}>{transaction.description}</Text>
                      </View>
                    )}
                    <View style={styles.transactionRow}>
                      <Text style={styles.transactionLabel}>Date:</Text>
                      <Text style={styles.transactionValue}>{dateStr}</Text>
                    </View>
                    {transaction.paymentMethod && (
                      <View style={styles.transactionRow}>
                        <Text style={styles.transactionLabel}>Payment:</Text>
                        <Text style={styles.transactionValue}>{transaction.paymentMethod}</Text>
                      </View>
                    )}
                  </View>
                  
                  <View style={styles.actionButtons}>
                    {actions.map(action => (
                      <TouchableOpacity
                        key={action.id}
                        onPress={() => handleTransactionAction(action.id)}
                        style={[
                          styles.actionButton,
                          action.style === "primary" ? styles.actionButtonPrimary : styles.actionButtonSecondary
                        ]}
                      >
                        <Text
                          style={[
                            styles.actionButtonText,
                            action.style === "primary" ? styles.actionButtonTextPrimary : styles.actionButtonTextSecondary
                          ]}
                        >
                          {action.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  
                  {msg.time && (
                    <Text style={[styles.timeText, { marginTop: 8 }]}>
                      {msg.time}
                    </Text>
                  )}
                </View>
              );
            }
            
            return (
              <View 
                key={msg.id} 
                style={[
                  styles.bubble, 
                  msg.type === "user" ? styles.bubbleGreen : styles.bubbleBlue
                ]}
              >
                {msg.type === "bot" && <Text style={styles.botLabel}>🤖</Text>}
                {msg.type === "bot" ? (
                  <Markdown
                    markdownit={markdownIt}
                    style={markdownBotStyles}
                  >
                    {msg.text}
                  </Markdown>
                ) : (
                  <Text 
                    style={[
                      styles.bubbleText, 
                      { color: "#fff" }
                    ]}
                  >
                    {msg.text}
                  </Text>
                )}
                <View style={styles.messageFooter}>
                  {msg.time && (
                    <Text style={[
                      styles.timeText, 
                      msg.type === "user" && { color: "#CDECC9" }
                    ]}>
                      {msg.time}
                    </Text>
                  )}
                  {msg.type === "user" && (
                    <MaterialIcons
                      name={msg.delivered ? "done-all" : "done"} 
                      size={14} 
                      color="#CDECC9"
                      style={{ marginLeft: 4 }}
                    />
                  )}
                </View>
              </View>
            );
          })}
          {botTyping && (
            <View style={[styles.bubble, styles.bubbleBlue]}>
              <Text style={styles.bubbleText}>Typing{typingDots}</Text>
            </View>
          )}
        </ScrollView>

        {/* Input bar */}
        <View style={styles.inputWrapper}>
          <View style={styles.inputBar}>
            <TouchableOpacity 
              onPressIn={startRecording} 
              onPressOut={stopRecording} 
              disabled={isProcessing || isRecording} 
              style={{ marginRight: 10 }}
            >
              <FontAwesome 
                name="microphone" 
                size={24} 
                color={isRecording ? "#FF4B4B" : "#fff"} 
              />
            </TouchableOpacity>

            <TextInput
              style={[styles.textInput, { height: Math.min(120, textInputHeight) }]}
              placeholder={isRecording ? "Translating..." : "Type a message..."}
              placeholderTextColor="#fff"
              editable={!isProcessing && !isRecording}
              value={textInputValue}
              onChangeText={setTextInputValue}
              multiline
              onContentSizeChange={(e) => 
                setTextInputHeight(e.nativeEvent.contentSize.height)
              }
            />

            <TouchableOpacity 
              onPress={handleSend} 
              disabled={isProcessing || isRecording || !textInputValue.trim()} 
              style={{ marginLeft: 10 }}
            >
              <FontAwesome 
                name="send" 
                size={24} 
                color={
                  (!isProcessing && !isRecording && textInputValue.trim()) 
                    ? "#fff" 
                    : "#999"
                } 
              />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  // root for stuff that should move with keyboard
  foreground: {
    flex: 1,
  },
  background: {
    ...StyleSheet.absoluteFillObject, 
    width: "100%",
    height: "100%",
  },
  chatContainer: { paddingHorizontal: 20, flex: 1, marginTop: 20 },
  bubble: { 
    paddingVertical: 10, 
    paddingHorizontal: 16, 
    borderRadius: 20, 
    marginTop: 8, 
    marginBottom: 8, 
    maxWidth: "75%" 
  },
  bubbleBlue: { backgroundColor: "#B3DCD6", alignSelf: "flex-start" },
  bubbleGreen: { backgroundColor: "#115D59", alignSelf: "flex-end" },
  bubbleText: { color: "#000", fontSize: 16 },
  botLabel: { fontSize: 14, marginBottom: 4 },
  messageFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 4,
    alignItems: "center",
  },
  timeText: { fontSize: 10, color: "#666" },
  avatarImage: { 
    width: 500, 
    height: 550, 
    resizeMode: "contain", 
    position: "absolute", 
    bottom: 40, 
    alignSelf: "center", 
    left: -50 
  },
  overlay: { 
    ...StyleSheet.absoluteFillObject, 
  },
  inputWrapper: { 
    paddingHorizontal: 20, 
    paddingBottom: Platform.OS === "ios" ? 30 : 20, 
    backgroundColor: "transparent" 
  },
  inputBar: { 
    flexDirection: "row", 
    alignItems: "center", 
    backgroundColor: "#115D59", 
    paddingHorizontal: 20, 
    paddingVertical: 8, 
    borderRadius: 25 
  },
  textInput: { 
    flex: 1, 
    marginHorizontal: 5, 
    color: "#fff", 
    fontSize: 18, 
    paddingVertical: 9, 
    paddingHorizontal: 12, 
    borderRadius: 25, 
    backgroundColor: "rgba(255,255,255,0.1)" 
  },
  transactionCard: {
    maxWidth: "85%",
    padding: 16,
  },
  transactionDetails: {
    marginTop: 12,
    marginBottom: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  transactionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  transactionLabel: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  transactionValue: {
    fontSize: 14,
    color: "#000",
    fontWeight: "600",
    flex: 1,
    textAlign: "right",
  },
  actionButtons: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  actionButtonPrimary: {
    backgroundColor: "#115D59",
  },
  actionButtonSecondary: {
    backgroundColor: "rgba(0,0,0,0.1)",
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  actionButtonTextPrimary: {
    color: "#fff",
  },
  actionButtonTextSecondary: {
    color: "#000",
  },
});

// Markdown styles for bot messages
const markdownBotStyles: Record<string, TextStyle> = {
  body: {
    color: "#000",
    fontSize: 16,
    lineHeight: 22,
  },
  paragraph: {
    marginBottom: 6,
    marginTop: 0,
  },
  strong: {
    fontWeight: "700",
    color: "#000",
  },
  em: {
    fontStyle: "italic",
    color: "#000",
  },
  heading1: {
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 8,
    marginTop: 4,
    color: "#000",
  },
  heading2: {
    fontSize: 18,
    fontWeight: "700",
    marginVertical: 6,
    color: "#000",
  },
  heading3: {
    fontSize: 16,
    fontWeight: "600",
    marginVertical: 4,
    color: "#000",
  },
  bullet_list: {
    marginVertical: 4,
  },
  ordered_list: {
    marginVertical: 4,
  },
  list_item: {
    marginVertical: 2,
  },
  code_inline: {
    backgroundColor: "rgba(0,0,0,0.1)",
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 14,
  },
  code_block: {
    backgroundColor: "rgba(0,0,0,0.1)",
    borderRadius: 8,
    padding: 10,
    marginVertical: 6,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 14,
  },
  link: {
    color: "#115D59",
    textDecorationLine: "underline",
  },
  blockquote: {
    borderLeftWidth: 3,
    borderLeftColor: "#115D59",
    paddingLeft: 10,
    marginVertical: 6,
    fontStyle: "italic",
  },
};