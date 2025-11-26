import axios from "axios";
import { Platform } from "react-native";

const YOUR_COMPUTER_IP = "192.168.100.100";
const BASE_URL = Platform.OS === "android"
  ? "http://10.0.2.2:3000"
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
