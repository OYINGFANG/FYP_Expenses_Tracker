import React from "react";
import { Stack } from "expo-router";
import { IntlProvider } from "react-intl";
import { Provider as ReduxProvider } from "react-redux";
import enMessages from "./screen/Game/locales/en.json";
import { store } from "./screen/Game/store/store";

export default function RootLayout() {
  return (
    <ReduxProvider store={store}>
      <IntlProvider locale="en" messages={enMessages}>
        <Stack screenOptions={{ headerShown: false }}>
          {/* Main Screens */}
          <Stack.Screen name="screen/Home" />

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
