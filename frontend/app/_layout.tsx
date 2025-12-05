import React, { useEffect } from "react";
import { Stack } from "expo-router";
import { IntlProvider } from "react-intl";
import { Provider as ReduxProvider } from "react-redux";
import * as Notifications from "expo-notifications";
import enMessages from "./screen/Game/locales/en.json";
import { store } from "./screen/Game/store/store";

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function RootLayout() {
  useEffect(() => {
    // Set up notification channel for Android (optional but recommended)
    if (Notifications.setNotificationChannelAsync) {
      Notifications.setNotificationChannelAsync("default", {
        name: "Default",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF231F7C",
      });
    }
  }, []);

  return (
    <ReduxProvider store={store}>
      <IntlProvider locale="en" messages={enMessages}>
        <Stack screenOptions={{ headerShown: false }}>
          {/* Main Screens */}
          <Stack.Screen name="screen/Home" />

          {/* Notifications Screen */}
          <Stack.Screen name="screen/Notifications" />

          {/* Title Page (make sure this file exists: app/screen/Game/titlePage/TitlePage.tsx) */}
          <Stack.Screen name="screen/Game/titlePage/TitlePage" />

          {/* Avatar Modal */}
          <Stack.Screen
            name="screen/Avatar"
            options={{
              presentation: "modal",
              animation: "slide_from_bottom",
              headerShown: false,
            }}
          />

          {/* AboutPage */}
          <Stack.Screen
            name="screen/Game/aboutPage/AboutPage"
            options={{ headerShown: false, animation: "fade" }}
          />
        </Stack>
      </IntlProvider>
    </ReduxProvider>
  );
}
