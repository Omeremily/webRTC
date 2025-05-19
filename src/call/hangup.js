// call/hangup.js
// Fixed to properly clean up connections

import { deleteDoc } from '../firebase.js';
import { createCallButton, answerButton, hangupButton, roomIdContainer, 
         callInput, noRemoteStream } from '../dom-elements.js';
import { updateStatus, formatDuration } from '../utils/helpers.js';
import { createToast } from '../utils/toast.js';
import appState, { resetState } from '../state.js';
import { initializePeerConnection } from './peer.js';

/**
 * Ends the current call
 * @param {boolean} deleteDocument - Whether to delete the Firestore call document
 * @returns {Promise<void>}
 */
export const hangupCall = async (deleteDocument = true) => {
  try {
    const { 
      pc, 
      localStream, 
      screenStream, 
      callDocRef, 
      callStartTime,
      unsubscribeCallDoc,
      unsubscribeOfferCandidates,
      unsubscribeAnswerCandidates
    } = appState;
    
    // Close connections - but don't recreate yet
    if (pc) {
      // First remove all event handlers to prevent errors
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.oniceconnectionstatechange = null;
      pc.onconnectionstatechange = null;
      pc.onsignalingstatechange = null;
      
      // Then close the connection
      pc.close();
    }

    // Unsubscribe from Firestore listeners
    if (unsubscribeCallDoc) {
      unsubscribeCallDoc();
    }

    if (unsubscribeOfferCandidates) {
      unsubscribeOfferCandidates();
    }

    if (unsubscribeAnswerCandidates) {
      unsubscribeAnswerCandidates();
    }

    // Delete the call document if requested
    if (deleteDocument && callDocRef) {
      try {
        await deleteDoc(callDocRef);
      } catch (deleteError) {
        console.warn("לא ניתן למחוק את מסמך השיחה:", deleteError);
      }
    }

    // Stop all screen sharing tracks
    if (screenStream) {
      screenStream.getTracks().forEach((track) => {
        track.stop();
      });
    }

    // Calculate call duration if applicable
    if (callStartTime) {
      const duration = Math.floor((new Date() - callStartTime) / 1000);
      createToast(
        "info",
        "שיחה הסתיימה",
        `משך השיחה: ${formatDuration(duration)}`,
        5000
      );
    } else {
      createToast("info", "שיחה הסתיימה", "השיחה נותקה", 3000);
    }

    // Reset UI
    updateStatus("online", "מחובר");
    roomIdContainer.classList.add("hidden");
    callInput.value = "";
    
    if (noRemoteStream) {
      noRemoteStream.classList.remove("hidden");
    }
    
    // Clear any has-stream class from the remote video container
    const remoteVideoContainer = document.querySelector('.video-container.remote');
    if (remoteVideoContainer) {
      remoteVideoContainer.classList.remove('has-stream');
    }

    // Reset buttons
    createCallButton.disabled = false;
    answerButton.disabled = false;
    hangupButton.disabled = true;

    // Reset state
    resetState();

    // Initialize new peer connection AFTER state is reset
    setTimeout(() => {
      initializePeerConnection();
    }, 500);
  } catch (error) {
    console.error(error);
    createToast("error", "שגיאה", "התרחשה שגיאה בסיום השיחה", 5000);
  }
};