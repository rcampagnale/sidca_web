import { configureStore } from "@reduxjs/toolkit";
import logger from "redux-logger";
import rootReducer from "./rootReducer";

const isDev =
  process.env.REACT_APP_STATUS === "development" ||
  process.env.NODE_ENV === "development";

const store = configureStore({
  reducer: rootReducer,
  devTools: isDev,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      // Firestore mete objetos no serializables y circulares (DocumentSnapshot, Timestamp)
      serializableCheck: false,
      immutableCheck: false, // 👈 evita el recorrido profundo que te explota la pila
    }).concat(isDev ? [logger] : []),
});

export default store;

