// database.ts
import { doc, getDoc, setDoc } from "firebase/firestore";
import { firestore } from "./firebase";

export const saveUser = async (userId: string, username: string, email: string) => {
  await setDoc(doc(firestore, "users", userId), { username, email });
};

export const readUser = async (userId: string) => {
  const docRef = doc(firestore, "users", userId);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? docSnap.data() : null;
};
