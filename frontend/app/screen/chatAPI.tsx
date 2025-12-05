import axios from "axios";
import { Platform } from "react-native";

const YOUR_COMPUTER_IP = "172.20.10.9";
// For Android emulator, use 10.0.2.2. For real device or iOS, use your computer's IP
const BASE_URL = Platform.OS === "android"
  ? `http://${YOUR_COMPUTER_IP}:3000`  // Use actual IP for real Android device
  : `http://${YOUR_COMPUTER_IP}:3000`;

export const sendMessageToBot = async (message: string) => {
  try {
    const response = await axios.post(`${BASE_URL}/chat`, { message });
    return response.data.reply || "Sorry, I cannot respond right now.";
  } catch (err) {
    console.error("Bot API error:", err);
    return "Sorry, I cannot respond right now.";
  }
};
