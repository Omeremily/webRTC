// media/webcam.js
// Complete file with all exports intact

import { localVideo, remoteVideo, webcamButton, createCallButton, 
    answerButton, callActions, toggleMicButton, toggleVideoButton, callInput } from '../dom-elements.js';
import { defaultMediaConstraints } from '../config.js';
import { updateStatus } from '../utils/helpers.js';
import { createToast } from '../utils/toast.js';
import appState, { updateLocalStream, updateRemoteStream } from '../state.js';
import { initializePeerConnection } from '../call/peer.js';

/**
* Sets up webcam and initializes media streams
*/
export const setupWebcam = async () => {
    try {
      createToast("info", "מתחבר...", "מבקש גישה למצלמה ולמיקרופון");
      console.log("Requesting media devices...");
  
      // Get user media with specific options for better success rate
      const localStream = await navigator.mediaDevices.getUserMedia(defaultMediaConstraints);
      console.log("Got media stream:", localStream);
  
      // Update state with the new stream
      updateLocalStream(localStream);
  
      // Reset peer connection before setting streams
      initializePeerConnection();
  
      // Set up local video display
      if (localVideo) {
        console.log("Setting local video source with active stream");
        localVideo.srcObject = localStream;
        localVideo.play().catch(e => console.error("Error playing local video:", e));
      }
  
      // Create remote stream if it doesn't exist
      if (!appState.remoteStream) {
        const remoteStream = new MediaStream();
        updateRemoteStream(remoteStream);
        
        // Set up remote video element with the empty stream right away
        if (remoteVideo) {
          console.log("✅ Setting initial remote video source");
          remoteVideo.srcObject = remoteStream;
        }
      }
  
      // Update UI - FIXED: Make sure callInput is enabled
      webcamButton.disabled = true;
      createCallButton.disabled = false;
      answerButton.disabled = false;
      callInput.disabled = false; // Critical fix for the input field
      callActions.classList.remove("hidden");
      
      updateStatus("online", "מחובר");
      createToast("success", "מצלמה מופעלת", "המצלמה והמיקרופון מופעלים");
      
    } catch (error) {
      console.error("Error accessing media devices:", error);
      createToast("error", "שגיאה", `לא ניתן לגשת למצלמה או למיקרופון: ${error.message}`, 10000);
    }
  };

/**
* Toggles microphone mute state
*/
export const toggleMicrophone = () => {
  const { localStreamTracks } = appState;

  if (localStreamTracks.audio) {
    const enabled = !localStreamTracks.audio.enabled;
    localStreamTracks.audio.enabled = enabled;
    toggleMicButton.classList.toggle("muted", !enabled);
    toggleMicButton.innerHTML = enabled
     ? '<i class="fas fa-microphone"></i>'
     : '<i class="fas fa-microphone-slash"></i>';

    createToast(
     "info",
     enabled ? "מיקרופון פועל" : "מיקרופון מושתק",
     enabled ? "המיקרופון הופעל" : "המיקרופון הושתק",
     2000
    );
  }
};

/**
* Toggles video enabled state
*/
export const toggleVideo = () => {
  const { localStreamTracks } = appState;

  if (localStreamTracks.video) {
    const enabled = !localStreamTracks.video.enabled;
    localStreamTracks.video.enabled = enabled;
    toggleVideoButton.classList.toggle("muted", !enabled);
    toggleVideoButton.innerHTML = enabled
     ? '<i class="fas fa-video"></i>'
     : '<i class="fas fa-video-slash"></i>';

    createToast(
     "info",
     enabled ? "מצלמה פעילה" : "מצלמה כבויה",
     enabled ? "המצלמה הופעלה" : "המצלמה כבויה",
     2000
    );
  }
};

/**
* Reset video elements to fix potential display issues
*/
export const resetVideoElements = () => {
  console.log("🔄 Manually resetting video elements");
  const { localStream, remoteStream } = appState;

  // Reset local stream
  if (localStream && localVideo) {
    localVideo.srcObject = null;
    setTimeout(() => {
     localVideo.srcObject = localStream;
     localVideo.play().catch(e => console.error("Error resetting local video:", e));
    }, 200);
  }

  // Reset remote stream
  if (remoteStream && remoteVideo) {
    const oldStream = remoteVideo.srcObject;
    remoteVideo.srcObject = null;
    
    setTimeout(() => {
     remoteVideo.srcObject = remoteStream;
     
     // Make sure all tracks from the old stream are in the new stream
     if (oldStream instanceof MediaStream) {
       oldStream.getTracks().forEach(track => {
         if (!remoteStream.getTracks().some(t => t.id === track.id)) {
           remoteStream.addTrack(track);
         }
       });
     }
     
     remoteVideo.play().catch(e => console.error("Error resetting remote video:", e));
     
     // Log track information
     console.log("Current remote tracks after reset:");
     remoteStream.getTracks().forEach(track => {
       console.log(`- ${track.kind} track, enabled: ${track.enabled}, state: ${track.readyState}`);
     });
     
     // Make remote video container visible
     const remoteVideoContainer = remoteVideo.closest('.video-container');
     if (remoteVideoContainer && remoteStream.getTracks().length > 0) {
       remoteVideoContainer.classList.add('has-stream');
     }
    }, 500);
  }

  createToast("info", "איפוס וידאו", "אתחול מחדש של הזרמים", 2000);
};