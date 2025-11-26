import React, { useState } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { sendMessageToServer } from "../services/api";
import MessageBubble from "../component/MessageBubble";

// 💡 Define a Message type
interface Message {
  id: string;
  from: "user" | "bot";
  text: string;
}

export default function ChatScreen() {
  // ✅ Tell useState what type it stores
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);

  const send = async () => {
    const txt = input.trim();
    if (!txt) return;

    const userMsg: Message = { id: Date.now().toString(), from: "user", text: txt };
    setMessages((m) => [...m, userMsg]);
    setInput("");

    try {
      const reply = await sendMessageToServer(txt);
      const botMsg: Message = { id: (Date.now() + 1).toString(), from: "bot", text: reply || "No reply" };
      setMessages((m) => [...m, botMsg]);
    } catch (err: any) {
      const errMsg: Message = { id: (Date.now() + 2).toString(), from: "bot", text: "Error: " + err.message };
      setMessages((m) => [...m, errMsg]);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MessageBubble
              text={item.text}
              isUser={item.from === "user"} // ✅ match your MessageBubble props
            />
          )}
          contentContainerStyle={{ padding: 12 }}
        />
        <View style={styles.inputRow}>
          <TextInput
            value={input}
            onChangeText={setInput}
            style={styles.input}
            placeholder="Type a message..."
          />
          <TouchableOpacity onPress={send} style={styles.sendBtn}>
            <Text style={{ color: "white" }}>Send</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1 },
  inputRow: { flexDirection: "row", padding: 8, alignItems: "center" },
  input: { flex: 1, borderWidth: 1, borderRadius: 8, padding: 10, marginRight: 8 },
  sendBtn: { backgroundColor: "#007AFF", padding: 12, borderRadius: 8 },
});
