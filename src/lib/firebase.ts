import { initializeApp, getApps, getApp } from "firebase/app";
import { getDatabase, ref, onValue, get, set, update, push, child } from "firebase/database";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "revive-fasel-hd",
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || "https://revive-fasel-hd-default-rtdb.firebaseio.com",
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyAm8dfGJNtnGZoTfG3OFGIze7axhEyz0WU",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "revive-fasel-hd.firebaseapp.com",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "revive-fasel-hd.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "767427934995",
};

// Initialize Firebase
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

export { db, auth, ref, onValue, get, set, update, push, child };
