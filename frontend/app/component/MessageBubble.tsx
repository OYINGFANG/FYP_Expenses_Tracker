import React from "react";
import { View, StyleSheet, useWindowDimensions, TextStyle } from "react-native";
import Markdown, { MarkdownIt } from "react-native-markdown-display";

interface MessageBubbleProps {
  text: string;
  isUser: boolean;
}

const markdownIt = MarkdownIt({ typographer: true });

const MessageBubble: React.FC<MessageBubbleProps> = ({ text, isUser }) => {
  const { width } = useWindowDimensions();

  // 🧠 Optional: replace Markdown checkboxes with emojis
  const formattedText = text
    .replace(/\[x\]/g, "✅")
    .replace(/\[ \]/g, "⬜");

  return (
    <View
      style={[
        styles.container,
        isUser ? { alignItems: "flex-end" } : { alignItems: "flex-start" },
      ]}
    >
      <View
        style={[
          styles.bubble,
          isUser ? styles.userBubble : styles.botBubble,
          { maxWidth: width * 0.9 },
        ]}
      >
        <Markdown
          markdownit={markdownIt}
          style={isUser ? markdownUserStyles : markdownBotStyles}
        >
          {formattedText}
        </Markdown>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
    paddingHorizontal: 10,
    marginVertical: 6,
  },
  bubble: {
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  userBubble: {
    backgroundColor: "#007AFF",
    borderTopRightRadius: 4,
  },
  botBubble: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 4,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
});

const markdownBotStyles: Record<string, TextStyle> = {
  body: {
    color: "#111",
    fontSize: 15.5,
    lineHeight: 23,
  },
  paragraph: {
    marginBottom: 8,
  },
  strong: {
    fontWeight: "700",
    color: "#000",
  },
  em: {
    fontStyle: "italic",
    color: "#333",
  },
  heading1: {
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 10,
    color: "#111",
  },
  heading2: {
    fontSize: 18,
    fontWeight: "700",
    marginVertical: 8,
    color: "#222",
  },
  heading3: {
    fontSize: 16,
    fontWeight: "600",
    marginVertical: 6,
    color: "#333",
  },
  bullet_list: {
    marginVertical: 6,
  },
  list_item: {
    marginVertical: 3,
  },
  code_inline: {
    backgroundColor: "#ECECEC",
    borderRadius: 6,
    paddingHorizontal: 5,
    fontFamily: "monospace",
  },
  code_block: {
    backgroundColor: "#282C34",
    color: "#F8F8F2",
    borderRadius: 10,
    padding: 10,
    fontFamily: "monospace",
  },
  table: {
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 8,
    marginVertical: 8,
  },
  thead: {
    backgroundColor: "#F3F4F6",
  },
  th: {
    fontWeight: "700",
    padding: 6,
    borderRightWidth: 1,
    borderColor: "#DDD",
  },
  tr: {
    borderBottomWidth: 1,
    borderColor: "#EEE",
  },
  td: {
    padding: 6,
    borderRightWidth: 1,
    borderColor: "#EEE",
  },
};

const markdownUserStyles: Record<string, TextStyle> = {
  body: {
    color: "#fff",
    fontSize: 15.5,
    lineHeight: 22,
  },
  strong: {
    fontWeight: "700",
    color: "#fff",
  },
  code_inline: {
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: 6,
    paddingHorizontal: 5,
  },
};

export default MessageBubble;
