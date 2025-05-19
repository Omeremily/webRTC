// // Import the functions you need from the SDKs you need
// import { initializeApp } from "firebase/app";
// import { getFirestore } from "firebase/firestore";
// import { getAnalytics, isSupported } from "firebase/analytics"; 

// // Your web app's Firebase configuration
// const firebaseConfig = {
//   apiKey: "AIzaSyDj42KkYBWzLDyIys_d8kS_7sWgeIof0Io",
//   authDomain: "webrtc-b0c9b.firebaseapp.com",
//   projectId: "webrtc-b0c9b",
//   storageBucket: "webrtc-b0c9b.firebasestorage.app",
//   messagingSenderId: "149491842028",
//   appId: "1:149491842028:web:340725d081437f894f5ec9",
//   measurementId: "G-9WCKG01FTK",
// };

// // Initialize Firebase
// export const app = initializeApp(firebaseConfig);
// export const db = getFirestore(app);

// // Analytics - only if supported
// let analytics;
// isSupported().then((yes) => {
//   if (yes) {
//     analytics = getAnalytics(app);
//   }
// });

// export { analytics };


// firebase.js
// Firebase configuration and exports

import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Your Firebase configuration object should be placed here
const firebaseConfig = {
    apiKey: "AIzaSyDj42KkYBWzLDyIys_d8kS_7sWgeIof0Io",
    authDomain: "webrtc-b0c9b.firebaseapp.com",
    projectId: "webrtc-b0c9b",
    storageBucket: "webrtc-b0c9b.firebasestorage.app",
    messagingSenderId: "149491842028",
    appId: "1:149491842028:web:340725d081437f894f5ec9",
    measurementId: "G-9WCKG01FTK",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

export {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  onSnapshot,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";