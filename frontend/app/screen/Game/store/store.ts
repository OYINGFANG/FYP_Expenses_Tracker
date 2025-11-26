// store.ts
import { configureStore } from '@reduxjs/toolkit';
import gameReducer from './gameSlice'; // adjust path if needed

export const store = configureStore({
  reducer: {
    game: gameReducer,
  },
});

// Infer the `RootState` and `Dispatch` types
export type RootState = ReturnType<typeof store.getState>;
export type GameDispatch = typeof store.dispatch;
