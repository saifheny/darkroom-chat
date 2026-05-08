import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyAjE-2q6PONBkCin9ZN22gDp9Q8pAH9ZW8",
  authDomain: "story-97cf7.firebaseapp.com",
  databaseURL: "https://story-97cf7-default-rtdb.firebaseio.com",
  projectId: "story-97cf7",
  storageBucket: "story-97cf7.firebasestorage.app",
  messagingSenderId: "742801388214",
  appId: "1:742801388214:web:32a305a8057b0582c5ec17",
  measurementId: "G-9DPPWX7CF0"
};

export const app = initializeApp(firebaseConfig);
export const rtdb = getDatabase(app);

