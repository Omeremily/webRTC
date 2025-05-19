// index.js
// Main entry point that initializes the application and attaches event listeners

import { createToast } from './utils/toast.js';
import { updateStatus } from './utils/helpers.js';
import { db } from './firebase.js';
import { setupWebcam, toggleMicrophone, toggleVideo, resetVideoElements } from './media/webcam.js';
import { toggleScreenSharing, toggleFullscreen } from './media/screen.js';
import { createCall } from './call/create.js';
import { answerCall } from './call/answer.js';
import { hangupCall } from './call/hangup.js';
import { 
  webcamButton, 
  createCallButton, 
  answerButton, 
  hangupButton,
  callInput,
  toggleMicButton,
  toggleVideoButton,
  toggleFullscreenButton,
  shareScreenButton,
  copyButton,
  roomIdDisplay,
  resetVideoButton
} from './dom-elements.js';

// Initialize event listeners
function initializeEventListeners() {
  // Webcam setup
  webcamButton.addEventListener('click', setupWebcam);
  
  // Call controls
  createCallButton.addEventListener('click', createCall);
  
  answerButton.addEventListener('click', () => {
    const callId = callInput.value.trim().toUpperCase();
    answerCall(callId);
  });
  
  hangupButton.addEventListener('click', () => hangupCall(true));
  
  // Media controls
  toggleMicButton.addEventListener('click', toggleMicrophone);
  toggleVideoButton.addEventListener('click', toggleVideo);
  toggleFullscreenButton.addEventListener('click', () => toggleFullscreen(toggleFullscreenButton));
  shareScreenButton.addEventListener('click', () => toggleScreenSharing(shareScreenButton));
  resetVideoButton.addEventListener('click', resetVideoElements);
  
  // Room ID management
  copyButton.addEventListener('click', () => {
    const roomId = roomIdDisplay.textContent;
    
    navigator.clipboard
      .writeText(roomId)
      .then(() => {
        createToast("success", "הועתק!", "קוד השיחה הועתק ללוח", 2000);
      })
      .catch((err) => {
        console.error("שגיאה בהעתקה ללוח:", err);
        createToast("error", "שגיאה", "לא ניתן להעתיק את הקוד ללוח", 3000);
      });
  });
}

// Check browser compatibility
function checkBrowserCompatibility() {
  // Check for WebRTC support
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    createToast(
      "error",
      "דפדפן לא נתמך",
      "הדפדפן שלך לא תומך ב-WebRTC. נסה להשתמש בדפדפן מודרני יותר כמו Chrome, Firefox, או Edge.",
      0
    );
    webcamButton.disabled = true;
    return false;
  }

  // Check for Firestore
  if (!db) {
    createToast(
      "error",
      "שגיאה בהתחברות ל-Firebase",
      "לא ניתן להתחבר למסד הנתונים. בדוק את הגדרות Firebase.",
      0
    );
    webcamButton.disabled = true;
    return false;
  }

  return true;
}

// Initialize the application
function initializeApp() {
  // Set initial status
  updateStatus("offline", "מנותק");
  
  // Check browser compatibility
  if (checkBrowserCompatibility()) {
    console.log("Browser compatibility check passed. Ready to start!");
    createToast("info", "ברוכים הבאים", 'לחץ על "הפעל מצלמה" כדי להתחיל', 5000);
    
    // Set up event listeners
    initializeEventListeners();
  }
}

// Run initialization when DOM content is loaded
document.addEventListener('DOMContentLoaded', initializeApp);