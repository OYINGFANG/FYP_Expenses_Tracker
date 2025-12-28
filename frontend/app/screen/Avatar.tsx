import FontAwesome from "@expo/vector-icons/FontAwesome";
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Video, Audio, ResizeMode } from "expo-av";
import React, { useState, useRef, useEffect, Fragment } from "react";
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
import { loadChatHistory, saveChatHistory, clearChatHistory } from "../utils/chatHistoryUtils";

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

// const YOUR_COMPUTER_IP = "172.20.10.9";
const YOUR_COMPUTER_IP = "192.168.0.96";

// For Android emulator, use 10.0.2.2. For real device or iOS, use your computer's IP
const BASE_URL = Platform.OS === "android"
  ? "http://192.168.0.96:3000"
  : `http://${YOUR_COMPUTER_IP}:3000`;


interface AvatarScreenProps {
  onClose?: () => void;
}

// Menu options for quick questions
const MENU_OPTIONS = [
  { id: 1, text: "Show my spending summary", question: "Show me my spending summary for this month", icon: "wallet-outline" },
  { id: 2, text: "What's my budget status?", question: "What's my current budget status?", icon: "bar-chart-outline" },
  { id: 3, text: "How can I save more money?", question: "How can I save more money?", icon: "cash-outline" },
  { id: 4, text: "Tell me about my debt", question: "Tell me about my debt", icon: "card-outline" },
  { id: 5, text: "Give me financial advice", question: "Give me some financial advice", icon: "bulb-outline" },
  { id: 6, text: "Show my financial overview", question: "Show me my financial overview", icon: "document-text-outline" },
];

export default function AvatarScreen({ onClose }: AvatarScreenProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isMicPressed, setIsMicPressed] = useState(false);
  const [textInputValue, setTextInputValue] = useState(""); 
  const [textInputHeight, setTextInputHeight] = useState(45);
  const [botTyping, setBotTyping] = useState(false);
  const [typingDots, setTypingDots] = useState("");
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [currentVideo, setCurrentVideo] = useState<"avatar1" | "avatar2">("avatar1");
  const [avatar2Ready, setAvatar2Ready] = useState(false);
  const [avatar2Failed, setAvatar2Failed] = useState(false);
  const [showMenu, setShowMenu] = useState(true);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const scrollViewRef = useRef<ScrollView | null>(null);
  const video1Ref = useRef<Video>(null);
  const video2Ref = useRef<Video>(null);

  // Initialize video status and handle playback
  useEffect(() => {
    return () => {
      // Cleanup on unmount
      const video1 = video1Ref.current;
      const video2 = video2Ref.current;
      if (video1) {
        video1.unloadAsync().catch(() => {});
      }
      if (video2) {
        video2.unloadAsync().catch(() => {});
      }
    };
  }, []);

  // Handle seamless transition from avatar1 to avatar2
  useEffect(() => {
    if (currentVideo === "avatar2" && avatar2Ready && !avatar2Failed && video2Ref.current) {
      // When switching to avatar2, ensure it's set to loop and play
      video2Ref.current.setIsLoopingAsync(true).catch(() => {});
      video2Ref.current.playAsync().catch((err) => {
        console.error("Error playing avatar2:", err);
      });
      // Pause avatar1
      video1Ref.current?.pauseAsync().catch(() => {});
    } else if (currentVideo === "avatar2" && avatar2Failed) {
      // If avatar2 failed and we tried to switch to it, fallback to looping avatar1
      console.log("Avatar2 failed, falling back to looping avatar1");
      setCurrentVideo("avatar1");
      video1Ref.current?.setIsLoopingAsync(true).catch(() => {});
      video1Ref.current?.replayAsync().catch(() => {});
    }
  }, [currentVideo, avatar2Ready, avatar2Failed]);

  // Load chat history and show greeting as the newest (last) message every time user enters the page
  useEffect(() => {
    let isMounted = true;
    
    const fetchUserDataAndLoadHistory = async () => {
      try {
        const userId = await getUserId();
        
        // Get user's name for greeting
        let name = "there";
        const profile = await getUsernameFromFirestore(); 
        if (profile) {
          name = profile.username; 
        }

        // Always create a fresh greeting message when entering the page
        const greetingMessage: Message = {
          id: Date.now(),
          text: `Hello ${name}! 👋 How can I help you today?`,
          type: "bot" as const,
          time: formatTime(),
          date: getCurrentDateString(),
          timestamp: getCurrentTimestamp(),
        };
        
        // Load chat history first
        if (userId) {
          const savedMessages = await loadChatHistory(userId);

          if (savedMessages && savedMessages.length > 0) {
            // Filter out old greeting messages from history (we always show fresh greeting)
            const conversationMessages = savedMessages.filter(msg => 
              !("type" in msg && msg.type === "bot" && 
                "text" in msg && 
                msg.text.includes("Hello") && 
                msg.text.includes("👋"))
            );
            
            // Append greeting as the newest (last) message
            const allMessages = [...conversationMessages, greetingMessage];
            
            if (isMounted) {
              setMessages(allMessages as Message[]);
              setShowMenu(true); // Always show menu when entering the page
            }
          } else {
            // No history, show only greeting
            if (isMounted) {
              setMessages([greetingMessage]);
              setShowMenu(true); // Always show menu when entering the page
            }
          }
        } else {
          // No userId, just show greeting
          if (isMounted) {
            setMessages([greetingMessage]);
            setShowMenu(true); // Always show menu when entering the page
          }
        }
      } catch (error) {
        console.error("Error loading chat history:", error);
        // Fallback to greeting if loading fails
        if (isMounted) {
          setMessages([{
            id: Date.now(),
            text: "Hello there! 👋 How can I help you today?",
            type: "bot" as const,
            time: formatTime(),
            date: getCurrentDateString(),
            timestamp: getCurrentTimestamp(),
          }]);
          setShowMenu(true); // Show menu on fallback
        }
      }
    };
    
    fetchUserDataAndLoadHistory();
    
    return () => {
      isMounted = false;
    };
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

        // Add timeout to prevent hanging requests
        const res = await axios.get(`${BASE_URL}/monthly-snapshot`, {
          params: { userId },
          timeout: 15000, // 15 second timeout
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
        // Handle timeout and network errors gracefully
        if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
          console.warn("Finance snapshot request timed out. This may happen with large datasets.");
        } else if (err.message?.includes('Network Error') || err.code === 'ENOTFOUND') {
          console.warn("Network error loading finance snapshot. Check your connection.");
        } else {
          console.error("Failed to load finance snapshot:", err.message || err);
        }
        // Don't throw - this is non-critical, chatbot can work without snapshot
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

  const formatDate = (dateStr?: string): string => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Check if same day
    if (date.toDateString() === today.toDateString()) {
      return "Today";
    }
    // Check if yesterday
    if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    }
    // Check if within last 7 days
    const daysDiff = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff < 7) {
      return date.toLocaleDateString("en-US", { weekday: "long" });
    }
    // Otherwise show full date
    return date.toLocaleDateString("en-US", { 
      month: "short", 
      day: "numeric",
      year: date.getFullYear() !== today.getFullYear() ? "numeric" : undefined
    });
  };

  const getCurrentDateString = (): string => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`; // YYYY-MM-DD in local timezone
  };

  const getCurrentTimestamp = (): string => {
    return new Date().toISOString();
  };

  const formatDateTime = (dateStr?: string, timeStr?: string, timestampStr?: string): string => {
    if (!dateStr) return timeStr || "";
    
    // Use timestamp if available to get accurate date, otherwise use dateStr
    let messageDate: Date;
    if (timestampStr) {
      messageDate = new Date(timestampStr);
    } else {
      // Parse date string (YYYY-MM-DD) in local timezone
      const [year, month, day] = dateStr.split("-").map(Number);
      messageDate = new Date(year, month - 1, day);
    }
    
    // Get today's date in local timezone
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Get message date at start of day in local timezone
    const msgDate = new Date(messageDate.getFullYear(), messageDate.getMonth(), messageDate.getDate());
    
    let datePart = "";
    if (msgDate.getTime() === today.getTime()) {
      datePart = "Today";
    } else if (msgDate.getTime() === yesterday.getTime()) {
      datePart = "Yesterday";
    } else {
      const currentYear = new Date().getFullYear();
      datePart = messageDate.toLocaleDateString("en-US", { 
        month: "short", 
        day: "numeric",
        year: messageDate.getFullYear() !== currentYear ? "numeric" : undefined
      });
    }
    
    return timeStr ? `${datePart} at ${timeStr}` : datePart;
  };

  const shouldShowSessionSeparator = (currentMsg: Message, previousMsg: Message | undefined): boolean => {
    if (!previousMsg || !currentMsg.timestamp || !previousMsg.timestamp) return false;
    
    // Always show separator before a greeting message (new session)
    const isGreeting = currentMsg.type === "bot" && 
      currentMsg.text.includes("Hello") && 
      currentMsg.text.includes("👋");
    
    if (isGreeting) {
      // Check if previous message is also a greeting from a different time/date
      const prevIsGreeting = previousMsg.type === "bot" && 
        previousMsg.text.includes("Hello") && 
        previousMsg.text.includes("👋");
      
      // Always show separator before new greeting (different session)
      if (prevIsGreeting) return true;
    }
    
    const currentTime = new Date(currentMsg.timestamp).getTime();
    const previousTime = new Date(previousMsg.timestamp).getTime();
    const timeDiff = currentTime - previousTime;
    
    // Show separator if more than 30 minutes have passed (1800000 ms)
    return timeDiff > 30 * 60 * 1000;
  };

  const handleClearChat = async () => {
    Alert.alert(
      "Clear Chat History",
      "Are you sure you want to delete all chat messages? This action cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            try {
              const userId = await getUserId();
              
              // Clear from database
            if (userId) {
              await clearChatHistory(userId);
            }
            
            // Clear local state and show new greeting
            let name = "there";
            const profile = await getUsernameFromFirestore(); 
            if (profile) {
              name = profile.username; 
            }

            const greetingMessage: Message = {
              id: Date.now(),
              text: `Hello ${name}! 👋 How can I help you today?`,
              type: "bot" as const,
              time: formatTime(),
              date: getCurrentDateString(),
              timestamp: getCurrentTimestamp(),
            };
            
            setMessages([greetingMessage]);
            setShowMenu(true); // Show menu after clearing chat
            
            // Save the new greeting
            if (userId) {
              await saveChatHistory(userId, [greetingMessage]);
            }
            } catch (error) {
              console.error("Error clearing chat:", error);
              Alert.alert("Error", "Failed to clear chat history. Please try again.");
            }
          },
        },
      ]
    );
  };

  const startRecording = async () => {
    try {
      if (isRecording) return;
      setIsMicPressed(true);
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission Required", "Microphone permission is required!");
        setIsMicPressed(false);
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
    } catch (err) {
      console.error("Start recording error:", err);
      Alert.alert("Error", "Failed to start recording");
      setIsMicPressed(false);
    }
  };

  const stopRecording = async () => {
    try {
      if (!recordingRef.current) {
        setIsMicPressed(false);
        return;
      }
      setIsRecording(false);
      setIsMicPressed(false);
      setIsProcessing(true);
      setTextInputValue("Translating..."); // Show "Translating..." text while processing

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
          time: formatTime(),
          date: getCurrentDateString(),
          timestamp: getCurrentTimestamp(),
        }]);
      setTextInputValue("");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSend = async (messageText?: string) => {
    const textToSend = messageText || textInputValue.trim();
    if (!textToSend) {
      console.log(`⚠️ [Avatar] handleSend called with empty message`);
      return;
    }
    
    console.log(`📤 [Avatar] handleSend: "${textToSend.substring(0, 50)}${textToSend.length > 50 ? '...' : ''}"`);
    
    const userMessage: Message = { 
      id: Date.now(), 
      text: textToSend, 
      type: "user", 
      time: formatTime(),
      date: getCurrentDateString(), 
      timestamp: getCurrentTimestamp(),
      delivered: false 
    };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setTextInputValue("");
    setTextInputHeight(40);
    Keyboard.dismiss();
    
    console.log(`💾 [Avatar] Saving ${newMessages.length} messages to chat history`);
    
    // Save chat history after adding user message
    const userId = await getUserId();
    if (userId) {
      saveChatHistory(userId, newMessages).catch(err => 
        console.error("❌ [Avatar] Failed to save chat history:", err)
      );
    } else {
      console.warn("⚠️ [Avatar] No userId available to save chat history");
    }
    
    console.log(`🤖 [Avatar] Calling simulateBotReply...`);
    simulateBotReply(userMessage.text);
    
    setTimeout(() => {
      setMessages(prev => prev.map(msg => 
        msg.id === userMessage.id ? { ...msg, delivered: true } : msg
      ));
    }, 500);
  };

  const handleMenuClick = (question: string) => {
    handleSend(question);
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
    const startTime = Date.now();
    console.log(`🤖 [Avatar] sendMessageToBot called:`, {
      hasMessage: !!message,
      messagePreview: message ? message.substring(0, 50) : undefined,
      hasAction: !!action,
      action,
    });
    
    try {
      const userId = await getUserId();
      console.log(`👤 [Avatar] UserId retrieved:`, userId ? `${userId.substring(0, 20)}...` : "null");
      
      let response: ChatResponse;
      try {
        console.log(`📡 [Avatar] Calling sendMessageToServer...`);
        response = await sendMessageToServer(message || "", userId, action);
        const elapsed = Date.now() - startTime;
        console.log(`✅ [Avatar] Response received in ${elapsed}ms:`, {
          type: response.type,
          messageLength: response.message?.length || 0,
        });
      } catch (err: any) {
        const elapsed = Date.now() - startTime;
        console.error(`❌ [Avatar] Error in sendMessageToServer (after ${elapsed}ms):`, {
          errorName: err.name,
          errorMessage: err.message,
          errorStack: err.stack?.substring(0, 300),
        });
        
        // Handle network errors gracefully
        if (err.message?.includes("Cannot connect") || err.message?.includes("Network request failed")) {
          throw new Error("Cannot connect to chatbot server. Please ensure the backend server is running at http://192.168.0.96:3000");
        }
        throw err;
      }
      return response;
    } catch (err: any) {
      const elapsed = Date.now() - startTime;
      console.error(`❌ [Avatar] Error in sendMessageToBot (after ${elapsed}ms):`, {
        errorName: err.name,
        errorMessage: err.message,
        errorStack: err.stack?.substring(0, 300),
      });
      
      // Provide helpful error messages
      let errorMessage = "Sorry, I encountered an error. Please try again.";
      if (err.message?.includes("Cannot connect") || err.message?.includes("Network request failed")) {
        errorMessage = "⚠️ Cannot connect to chatbot server.\n\nPlease check:\n1. Backend server is running (node server.js)\n2. Server IP is correct: 192.168.0.96:3000\n3. Your device and computer are on the same network\n4. Firewall is not blocking port 3000";
      } else if (err.message?.includes("timeout")) {
        errorMessage = "Request timed out. The server is taking too long to respond. Please try again.";
      }
      
      // Return a valid ChatResponse structure even on errors
      return {
        type: "normal",
        message: errorMessage,
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
          const updated: Message[] = [
            ...filtered,
            {
              id: Date.now(),
              text: response.message,
              type: "bot" as const,
              time: formatTime(),
              date: getCurrentDateString(),
              timestamp: getCurrentTimestamp(),
            },
          ];
          // Save chat history after transaction action
          getUserId().then(userId => {
            if (userId) {
              saveChatHistory(userId, updated).catch(err => 
                console.error("Failed to save chat history:", err)
              );
            }
          });
          return updated;
        });
      } else if (response.type === "pending_transaction_confirmation") {
        // Still pending (shouldn't happen, but handle gracefully)
        setMessages(prev => {
          const filtered = prev.filter(msg => msg.type !== "pending_transaction");
          const updated: Message[] = [
            ...filtered,
            {
              id: Date.now(),
              type: "pending_transaction" as const,
              chatResponse: response,
              time: formatTime(),
              date: getCurrentDateString(),
              timestamp: getCurrentTimestamp(),
            },
          ];
          // Save chat history after transaction action
          getUserId().then(userId => {
            if (userId) {
              saveChatHistory(userId, updated).catch(err => 
                console.error("Failed to save chat history:", err)
              );
            }
          });
          return updated;
        });
      }
    } catch (err) {
      console.error("Error handling transaction action:", err);
    } finally {
      setBotTyping(false);
    }
  };

  const simulateBotReply = async (userText: string) => {
    const startTime = Date.now();
    console.log(`🤖 [Avatar] simulateBotReply started for: "${userText.substring(0, 50)}${userText.length > 50 ? '...' : ''}"`);
    setBotTyping(true);
    try {
      console.log(`⏳ [Avatar] Calling sendMessageToBot...`);
      const response = await sendMessageToBot(userText);
      const elapsed = Date.now() - startTime;
      console.log(`✅ [Avatar] Response received in ${elapsed}ms:`, {
        type: response.type,
        messageLength: response.message?.length || 0,
        hasTransaction: response.type === "pending_transaction_confirmation",
      });

      if (response.type === "normal") {
        const botMessage: Message = {
          id: Date.now() + 1,
          text: response.message,
          type: "bot",
          time: formatTime(),
          date: getCurrentDateString(),
          timestamp: getCurrentTimestamp(),
        };
        console.log(`💬 [Avatar] Adding bot message to UI (length: ${botMessage.text.length})`);
        setMessages(prev => {
          const updated = [...prev, botMessage];
          console.log(`💾 [Avatar] Saving ${updated.length} messages to chat history after bot reply`);
          // Save chat history after bot reply
          getUserId().then(userId => {
            if (userId) {
              saveChatHistory(userId, updated).catch(err => 
                console.error("❌ [Avatar] Failed to save chat history:", err)
              );
            } else {
              console.warn("⚠️ [Avatar] No userId to save chat history");
            }
          });
          return updated;
        });
      } else if (response.type === "pending_transaction_confirmation") {
        console.log(`💳 [Avatar] Received pending transaction confirmation:`, {
          type: response.transaction.type,
          amount: response.transaction.amount,
          category: response.transaction.categoryName,
        });
        const pendingMessage: Message = {
          id: Date.now() + 1,
          type: "pending_transaction",
          chatResponse: response,
          time: formatTime(),
          date: getCurrentDateString(),
          timestamp: getCurrentTimestamp(),
        };
        console.log(`💬 [Avatar] Adding pending transaction message to UI`);
        setMessages(prev => {
          const updated = [...prev, pendingMessage];
          console.log(`💾 [Avatar] Saving ${updated.length} messages to chat history after pending transaction`);
          // Save chat history after bot reply
          getUserId().then(userId => {
            if (userId) {
              saveChatHistory(userId, updated).catch(err => 
                console.error("❌ [Avatar] Failed to save chat history:", err)
              );
            } else {
              console.warn("⚠️ [Avatar] No userId to save chat history");
            }
          });
          return updated;
        });
      }
    } catch (err: any) {
      const elapsed = Date.now() - startTime;
      console.error(`❌ [Avatar] Error in simulateBotReply (after ${elapsed}ms):`, {
        errorName: err.name,
        errorMessage: err.message,
        errorStack: err.stack?.substring(0, 500),
      });
      
      // Provide helpful error message
      let errorText = "Sorry, I encountered an error. Please try again.";
      if (err.message?.includes("Cannot connect") || err.message?.includes("Network request failed")) {
        errorText = "⚠️ Cannot connect to chatbot server.\n\nPlease ensure:\n• Backend server is running (node server.js)\n• Server IP is correct: 192.168.0.96:3000\n• Device and computer are on same network";
      } else if (err.message?.includes("timeout")) {
        errorText = "Request timed out. Please try again.";
      }
      
      const errorMessage: Message = {
        id: Date.now() + 1,
        text: errorText,
        type: "bot",
        time: formatTime(),
        date: getCurrentDateString(),
        timestamp: getCurrentTimestamp(),
      };
      console.log(`💬 [Avatar] Adding error message to UI`);
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      const totalElapsed = Date.now() - startTime;
      console.log(`🏁 [Avatar] simulateBotReply completed in ${totalElapsed}ms`);
      setBotTyping(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* 🔹 Avatar1 Video - plays first */}
      <Video
        ref={video1Ref}
        source={require("@/assets/images/avatar1.mp4")}
        style={[
          styles.background,
          { opacity: currentVideo === "avatar1" ? 1 : 0 }
        ]}
        shouldPlay={currentVideo === "avatar1"}
        isLooping={false}
        isMuted={false}
        resizeMode={ResizeMode.COVER}
        onLoad={() => {
          console.log("Avatar1 loaded and ready");
          setIsVideoReady(true);
          if (currentVideo === "avatar1") {
            video1Ref.current?.playAsync().catch((err) => {
              console.error("Error playing avatar1:", err);
            });
          }
        }}
        onPlaybackStatusUpdate={(status) => {
          // When avatar1 finishes, seamlessly switch to avatar2 (only if avatar2 is ready)
          if (status.isLoaded && status.didJustFinish && currentVideo === "avatar1") {
            if (avatar2Ready && !avatar2Failed) {
              console.log("Avatar1 finished, switching to avatar2");
              setCurrentVideo("avatar2");
            } else if (avatar2Failed) {
              // If avatar2 failed, loop avatar1 instead
              console.log("Avatar2 failed to load, looping avatar1 instead");
              video1Ref.current?.setIsLoopingAsync(true).catch(() => {});
              video1Ref.current?.replayAsync().catch(() => {});
            }
          }
        }}
        onError={(error) => {
          console.error("Avatar1 loading error:", error);
          setIsVideoReady(true);
        }}
      />
      
      {/* 🔹 Avatar2 Video - preloaded and ready, loops continuously */}
      <Video
        ref={video2Ref}
        source={require("@/assets/images/avatar2.mp4")}
        style={[
          styles.background,
          { opacity: currentVideo === "avatar2" ? 1 : 0 }
        ]}
        shouldPlay={currentVideo === "avatar2"}
        isLooping={true}
        isMuted={false}
        resizeMode={ResizeMode.COVER}
        onLoad={() => {
          console.log("Avatar2 loaded and ready");
          setAvatar2Ready(true);
          // Preload but don't play until avatar1 finishes
          if (currentVideo === "avatar2") {
            video2Ref.current?.setIsLoopingAsync(true).catch(() => {});
            video2Ref.current?.playAsync().catch((err) => {
              console.error("Error playing avatar2:", err);
            });
          }
        }}
        onError={(error) => {
          const errorMessage = typeof error === 'object' && error !== null && 'message' in error 
            ? String((error as { message?: unknown }).message)
            : String(error);
          const isTimeoutError = errorMessage.includes("-1001") || errorMessage.includes("timeout") || errorMessage.includes("NSURLErrorTimedOut");
          
          console.error("Avatar2 loading error:", error);
          if (isTimeoutError) {
            console.warn("Avatar2 video timed out - will fallback to looping avatar1");
          }
          
          // Mark avatar2 as failed and ready (so UI can continue)
          setAvatar2Failed(true);
          setAvatar2Ready(true);
          
          // If we're currently on avatar1, make it loop instead as fallback
          if (currentVideo === "avatar1") {
            video1Ref.current?.setIsLoopingAsync(true).catch(() => {});
          }
        }}
      />
      <View style={styles.overlay} />

      {/* 🔹 Foreground that moves with keyboard */}
      <KeyboardAvoidingView
        style={styles.foreground}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 40 : 0} 
      >
        {/* Header with clear button */}
        <View style={styles.chatHeader}>
          <TouchableOpacity 
            onPress={handleClearChat}
            style={styles.clearButton}
          >
            <MaterialIcons name="delete-outline" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Chat messages */}
        <ScrollView 
          ref={scrollViewRef} 
          style={styles.chatContainer} 
          contentContainerStyle={{ paddingBottom: 20 }}
        >
          {messages.map((msg, index) => {
            const previousMsg = index > 0 ? messages[index - 1] : undefined;
            
            // Show date header if this is the first message, date changed, or significant time gap
            const showDateHeader = index === 0 || 
              (msg.date && previousMsg?.date && msg.date !== previousMsg.date) ||
              shouldShowSessionSeparator(msg, previousMsg);
            
            // Format date/time for separator (use timestamp for accurate date calculation)
            const separatorText = showDateHeader && msg.date 
              ? formatDateTime(msg.date, msg.time, msg.timestamp)
              : null;
            
            // Check if this is a greeting message
            const isGreeting = msg && "type" in msg && msg.type === "bot" && 
              "text" in msg && msg.text.includes("Hello") && 
              msg.text.includes("👋");
            
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
                <Fragment key={msg.id}>
                  {showDateHeader && separatorText && (
                    <View style={styles.dateHeader}>
                      <View style={styles.dateHeaderLine} />
                      <Text style={styles.dateHeaderText}>{separatorText}</Text>
                      <View style={styles.dateHeaderLine} />
                    </View>
                  )}
                  <View style={[styles.bubble, styles.bubbleBlue, styles.transactionCard]}>
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
                  
                  <View style={styles.messageFooter}>
                    {msg.time && (
                      <Text style={[styles.timeText, { marginTop: 8 }]}>
                        {msg.time}
                      </Text>
                    )}
                  </View>
                </View>
                </Fragment>
              );
            }
            
            return (
              <Fragment key={msg.id}>
                {showDateHeader && separatorText && (
                  <View style={styles.dateHeader}>
                    <View style={styles.dateHeaderLine} />
                    <Text style={styles.dateHeaderText}>{separatorText}</Text>
                    <View style={styles.dateHeaderLine} />
                  </View>
                )}
                <View 
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
              {/* Show menu right after greeting message */}
              {isGreeting && showMenu && (
                <View style={[styles.bubble, styles.bubbleBlue, styles.menuBubble]}>
                  <Text style={styles.botLabel}>🤖</Text>
                  <View style={styles.menuContainer}>
                    {MENU_OPTIONS.map((option) => (
                      <TouchableOpacity
                        key={option.id}
                        style={styles.menuButton}
                        onPress={() => handleMenuClick(option.question)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name={option.icon as any} size={20} color="#115D59" style={styles.menuIcon} />
                        <Text style={styles.menuButtonText}>{option.text}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
              </Fragment>
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
              placeholder={
                isProcessing
                  ? "Translating..."
                  : isRecording || isMicPressed
                  ? "Hold to talk, release to send" 
                  : "Type a message..."
              }
              placeholderTextColor="#fff"
              editable={!isProcessing && !isRecording && !isMicPressed}
              value={textInputValue}
              onChangeText={setTextInputValue}
              multiline
              onContentSizeChange={(e) => 
                setTextInputHeight(e.nativeEvent.contentSize.height)
              }
            />

            <TouchableOpacity 
              onPress={() => handleSend()} 
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
  chatHeader: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 5,
  },
  clearButton: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(220, 53, 69, 0.9)", // More visible red background
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.5)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5, // For Android
  },
  chatContainer: { paddingHorizontal: 20, flex: 1, marginTop: 10 },
  bubble: { 
    paddingVertical: 10, 
    paddingHorizontal: 16, 
    borderRadius: 20,  
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
  dateHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
    marginHorizontal: 20,
    paddingVertical: 8,
  },
  dateHeaderLine: {
    flex: 1,
    height: 1.5,
    backgroundColor: "rgba(255, 255, 255, 0.4)",
    borderTopWidth: 0.5,
    borderTopColor: "rgba(255, 255, 255, 0.2)",
  },
  dateHeaderText: {
    fontSize: 11,
    color: "rgba(255, 255, 255, 0.9)",
    fontWeight: "600",
    marginHorizontal: 12,
    letterSpacing: 0.5,
    backgroundColor: "rgba(0, 0, 0, 0.2)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
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
  menuBubble: {
    maxWidth: "90%",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  menuContainer: {
    marginTop: 5,
  },
  menuButton: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 7,
    borderWidth: 1,
    borderColor: "rgba(17, 93, 89, 0.2)",
    minWidth: 280,
    width: "100%",
  },
  menuIcon: {
    marginRight: 10,
    marginTop: 2,
  },
  menuButtonText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#115D59",
    flex: 1,
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