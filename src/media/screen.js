// media/screen.js
// Screen sharing functionality

import { localVideo } from '../dom-elements.js';
import { screenSharingConstraints } from '../config.js';
import { createToast } from '../utils/toast.js';
import appState, { updateScreenStream } from '../state.js';

/**
 * Toggles screen sharing
 * @param {HTMLElement} shareScreenButton - The screen sharing button element
 */
export const toggleScreenSharing = async (shareScreenButton) => {
  const { pc, localStream, screenStream } = appState;
  
  // If already sharing screen, stop it
  if (screenStream) {
    // Stop all screen sharing tracks
    screenStream.getTracks().forEach((track) => {
      track.stop();
    });

    // Restore camera as local stream
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        const sender = pc
          .getSenders()
          .find((s) => s.track && s.track.kind === "video");
        if (sender) {
          sender.replaceTrack(track);
        }
      });

      localVideo.srcObject = localStream;
    }

    // Update state and UI
    updateScreenStream(null);
    shareScreenButton.innerHTML = '<i class="fas fa-desktop"></i>';
    createToast("info", "שיתוף מסך הופסק", "חזרת למצלמה רגילה", 2000);
    return;
  }

  // Start screen sharing
  try {
    const screenStream = await navigator.mediaDevices.getDisplayMedia(screenSharingConstraints);

    // Replace video track with screen track
    const videoTrack = screenStream.getVideoTracks()[0];
    const sender = pc
      .getSenders()
      .find((s) => s.track && s.track.kind === "video");

    if (sender) {
      sender.replaceTrack(videoTrack);
    }

    // Display screen stream in local video
    localVideo.srcObject = screenStream;

    // Update state and UI
    updateScreenStream(screenStream);
    shareScreenButton.innerHTML = '<i class="fas fa-stop"></i>';
    createToast("success", "שיתוף מסך מופעל", "המסך שלך משותף כעת", 2000);

    // Handle when user stops screen share using the browser controls
    videoTrack.onended = () => {
      if (localStream) {
        localStream.getVideoTracks().forEach((track) => {
          const sender = pc
            .getSenders()
            .find((s) => s.track && s.track.kind === "video");
          if (sender) {
            sender.replaceTrack(track);
          }
        });

        localVideo.srcObject = localStream;
      }

      updateScreenStream(null);
      shareScreenButton.innerHTML = '<i class="fas fa-desktop"></i>';
      createToast("info", "שיתוף מסך הופסק", "חזרת למצלמה רגילה", 2000);
    };

  } catch (error) {
    console.error("שגיאה בשיתוף מסך:", error);
    createToast("error", "שגיאה", "לא ניתן לשתף את המסך", 3000);
  }
};

/**
 * Toggles fullscreen mode
 * @param {HTMLElement} toggleFullscreenButton - The fullscreen button element
 */
export const toggleFullscreen = (toggleFullscreenButton) => {
  if (document.fullscreenElement) {
    document
      .exitFullscreen()
      .then(() => {
        toggleFullscreenButton.innerHTML = '<i class="fas fa-expand"></i>';
        createToast("info", "מסך רגיל", "חזרת למצב רגיל", 2000);
      })
      .catch((err) => {
        console.error("שגיאה בעת יציאה ממסך מלא:", err);
      });
  } else {
    const videoGrid = document.querySelector(".video-grid");
    videoGrid
      .requestFullscreen()
      .then(() => {
        toggleFullscreenButton.innerHTML = '<i class="fas fa-compress"></i>';
        createToast("info", "מסך מלא", "מצב מסך מלא הופעל", 2000);
      })
      .catch((err) => {
        console.error("שגיאה בעת מעבר למסך מלא:", err);
        createToast("error", "שגיאה", "לא ניתן לעבור למסך מלא", 3000);
      });
  }
};