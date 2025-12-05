import FontAwesome from "@expo/vector-icons/FontAwesome";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Video } from "expo-av";
import React, { useState, useRef, useEffect } from "react";
import {
  Image,
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
  Dimensions,
} from "react-native";
import { Audio } from "expo-av";
import axios from "axios";

const { width, height } = Dimensions.get("window");

const recordingOptions: Audio.RecordingOptions = Platform.select({
  ios: Audio.RecordingOptionsPresets.HIGH_QUALITY,
  android: Audio.RecordingOptionsPresets.HIGH_QUALITY,
}) as Audio.RecordingOptions;

type Message = {
  id: number;
  text: string;
  type: "user" | "bot";
  time?: string;
  delivered?: boolean;
};

const YOUR_COMPUTER_IP = "172.20.10.9";

const BASE_URL =
  Platform.OS === "android"
    ? "http://172.20.10.9:3000"
    : `http://${YOUR_COMPUTER_IP}:3000`;

const sendMessageToBot = async (message: string) => {
  try {
    const response = await axios.post(`${BASE_URL}/chat`, { message });
    return response.data.reply || "Sorry, I cannot respond right now.";
  } catch (err) {
    console.error("Bot API error:", err);
    return "Sorry, I cannot respond right now.";
  }
};

interface AvatarScreenProps {
  onClose?: () => void;
}

export default function VideoChat({ onClose }: AvatarScreenProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [textInputValue, setTextInputValue] = useState("");
  const [textInputHeight, setTextInputHeight] = useState(45);
  const [botTyping, setBotTyping] = useState(false);
  const [typingDots, setTypingDots] = useState("");
  const recordingRef = useRef<Audio.Recording | null>(null);
  const scrollViewRef = useRef<ScrollView | null>(null);

  // Bot typing dots animation
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    if (botTyping) {
      interval = setInterval(() => {
        setTypingDots((prev) => (prev.length < 3 ? prev + "." : ""));
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
      if (Platform.OS === "android") await new Promise((res) => setTimeout(res, 500));

      const uri = recordingRef.current.getURI();
      const oldRecording = recordingRef.current;
      recordingRef.current = null;

      oldRecording
        .createNewLoadedSoundAsync()
        .then(({ sound }) => sound.playAsync())
        .catch((err) => console.warn("Playback failed:", err));

      if (!uri) throw new Error("Recording URI is invalid");

      const formData = new FormData();
      formData.append("file", {
        uri,
        name: "recording.m4a",
        type: "audio/m4a",
      } as any);

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
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          text: `Error: ${errorMsg}`,
          type: "bot",
          time: formatTime(),
        },
      ]);
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
      delivered: false,
    };
    setMessages((prev) => [...prev, userMessage]);
    setTextInputValue("");
    setTextInputHeight(40);
    Keyboard.dismiss();
    simulateBotReply(userMessage.text);

    setTimeout(() => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === userMessage.id ? { ...msg, delivered: true } : msg
        )
      );
    }, 500);
  };

  const simulateBotReply = async (userText: string) => {
    setBotTyping(true);
    const botReply = await sendMessageToBot(userText);

    const botMessage: Message = {
      id: Date.now() + 1,
      text: botReply,
      type: "bot",
      time: formatTime(),
    };

    setMessages((prev) => [...prev, botMessage]);
    setBotTyping(false);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.backgroundContainer}>
        <Video
          source={require("@/assets/images/vid6.mp4")}
          style={styles.background}
          shouldPlay
          isLooping
          isMuted={false}
        />
        <View style={styles.overlayContainer}>
          <View style={styles.overlay} />


          {/* Chat messages */}
          <ScrollView
            ref={scrollViewRef}
            style={styles.chatContainer}
            contentContainerStyle={{ paddingBottom: 20 }}
          >
            {messages.map((msg) => (
              <View
                key={msg.id}
                style={[
                  styles.bubble,
                  msg.type === "user" ? styles.bubbleGreen : styles.bubbleBlue,
                ]}
              >
                {msg.type === "bot" && <Text style={styles.botLabel}>🤖</Text>}
                <Text
                  style={[
                    styles.bubbleText,
                    msg.type === "user" && { color: "#fff" },
                  ]}
                >
                  {msg.text}
                </Text>
                <View style={styles.messageFooter}>
                  {msg.time && (
                    <Text
                      style={[
                        styles.timeText,
                        msg.type === "user" && { color: "#CDECC9" },
                      ]}
                    >
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
            ))}
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
                  size={25}
                  color={isRecording ? "#FF4B4B" : "#fff"}
                />
              </TouchableOpacity>

              <TextInput
                style={[
                  styles.textInput,
                  { height: Math.min(120, textInputHeight) },
                ]}
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
                disabled={
                  isProcessing || isRecording || !textInputValue.trim()
                }
                style={{ marginLeft: 10 }}
              >
                <FontAwesome
                  name="send"
                  size={25}
                  color={
                    !isProcessing && !isRecording && textInputValue.trim()
                      ? "#fff"
                      : "#999"
                  }
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  backgroundContainer: { flex: 1, position: "relative" },
  background: {
    position: "absolute",
    top: "-10%",
    left: "-5%",
    width: "110%",
    height: "110%",
  }, 
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  chatContainer: { paddingHorizontal: 20, flex: 1, marginTop: 20 },
  bubble: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginTop: 8,
    marginBottom: 8,
    maxWidth: "75%",
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
    position: "absolute",
    bottom: 40,
    alignSelf: "center",
    left: -50,
  },
  inputWrapper: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === "ios" ? 35 : 20,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#115D59",
    paddingHorizontal: 20,
    paddingVertical: 5,
    borderRadius: 25,
  },
  textInput: {
    flex: 1,
    marginHorizontal: 7,
    color: "#fff",
    fontSize: 18,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 25,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
});
