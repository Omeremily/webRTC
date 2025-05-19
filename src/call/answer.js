// call/answer.js
// Fixed version to handle connection state properly

import { doc, collection, addDoc, getDoc, updateDoc, onSnapshot, serverTimestamp } from '../firebase.js';
import { db } from '../firebase.js';
import { createCallButton, answerButton, hangupButton } from '../dom-elements.js';
import { updateStatus } from '../utils/helpers.js';
import { createToast } from '../utils/toast.js';
import appState, { setCallInfo, setCallStartTime, setUnsubscribeFunctions } from '../state.js';
import { initializePeerConnection } from './peer.js';

/**
 * Joins an existing call (responder)
 * @param {string} callId - The call ID to join
 * @returns {Promise<void>}
 */
export const answerCall = async (callId) => {
  if (!callId) {
    createToast("warning", "נדרש קוד שיחה", "אנא הכנס קוד שיחה תקין", 3000);
    return;
  }

  try {
    const { localStream } = appState;
    updateStatus("connecting", "מצטרף לשיחה...");

    // Check for active local stream
    if (!localStream || !localStream.active) {
      createToast(
        "error",
        "אין זרם מקומי",
        "הפעל את המצלמה לפני הצטרפות לשיחה",
        5000
      );
      updateStatus("offline", "מנותק");
      return;
    }

    // Reset peer connection to ensure clean state
    initializePeerConnection();
    const { pc } = appState;

    // Reference Firestore collections for signaling
    const callDocRef = doc(db, "calls", callId);
    const offerCandidatesCollection = collection(callDocRef, "offerCandidates");
    const answerCandidatesCollection = collection(callDocRef, "answerCandidates");

    // Update state with call information
    setCallInfo(callId, callDocRef, offerCandidatesCollection, answerCandidatesCollection);

    // Get call document
    const callDoc = await getDoc(callDocRef);

    if (!callDoc.exists()) {
      updateStatus("offline", "מנותק");
      createToast(
        "error",
        "שיחה לא נמצאה",
        "קוד השיחה אינו תקין או שהשיחה כבר הסתיימה",
        5000
      );
      return;
    }

    const callData = callDoc.data();

    if (!callData.offer) {
      updateStatus("offline", "מנותק");
      createToast("error", "שיחה לא תקינה", "נתוני השיחה חסרים", 5000);
      return;
    }

    // Set up ICE candidate handling - saving to database
    pc.onicecandidate = (event) => {
      if (event.candidate && pc.signalingState !== 'closed') {
        console.log("Adding answer ICE candidate:", event.candidate);
        addDoc(answerCandidatesCollection, event.candidate.toJSON()).catch(
          (error) => {
            console.error("שגיאה בשמירת ICE candidate:", error);
          }
        );
      }
    };

    try {
      // Set remote description (offer)
      const offerDescription = new RTCSessionDescription(callData.offer);
      await pc.setRemoteDescription(offerDescription);
      console.log("Successfully set remote description (offer)");

      // Create answer
      const answerDescription = await pc.createAnswer();
      console.log("Created answer:", answerDescription);
      await pc.setLocalDescription(answerDescription);

      const answer = {
        sdp: answerDescription.sdp,
        type: answerDescription.type,
        timestamp: serverTimestamp(),
      };

      // Update call document with answer
      await updateDoc(callDocRef, {
        answer,
        answered: true,
        answeredAt: serverTimestamp(),
      });

      // Listen for remote ICE candidates and add them
      const unsubscribeOfferCandidates = onSnapshot(
        offerCandidatesCollection,
        (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
              const data = change.doc.data();
              console.log("Got remote ICE candidate:", data);

              // Only add candidate if we have a remote description and connection is still valid
              if (pc.remoteDescription && pc.signalingState !== 'closed') {
                pc.addIceCandidate(new RTCIceCandidate(data)).catch((error) => {
                  console.error("שגיאה בהוספת ICE candidate:", error);
                });
              } else {
                console.warn("דילוג על ICE candidate - אין תיאור מרוחק עדיין או החיבור סגור");
              }
            }
          });
        }
      );

      // Listen for changes in the offer (for reconnection)
      const unsubscribeCallDoc = onSnapshot(callDocRef, (snapshot) => {
        const data = snapshot.data();

        // If offer updated (for reconnection)
        if (data?.offer?.updated && pc.signalingState === "stable") {
          console.log("Received updated offer for reconnection");

          const newOfferDescription = new RTCSessionDescription(data.offer);
          pc.setRemoteDescription(newOfferDescription)
            .then(() => pc.createAnswer())
            .then((newAnswerDescription) =>
              pc.setLocalDescription(newAnswerDescription)
            )
            .then(() => {
              const newAnswer = {
                sdp: pc.localDescription.sdp,
                type: pc.localDescription.type,
                timestamp: serverTimestamp(),
              };

              return updateDoc(callDocRef, {
                answer: newAnswer,
                answerUpdated: serverTimestamp(),
              });
            })
            .then(() => {
              createToast("info", "החיבור חודש", "הצלחנו להתחבר מחדש", 3000);
            })
            .catch((error) => {
              console.error("שגיאה בחידוש חיבור:", error);
            });
        }
      });

      // Update unsubscribe functions in state
      setUnsubscribeFunctions(unsubscribeCallDoc, unsubscribeOfferCandidates, null);

      // Log active tracks for debugging
      logActiveTracks();

      // Update UI
      answerButton.disabled = true;
      createCallButton.disabled = true;
      hangupButton.disabled = false;

      setCallStartTime();
      updateStatus("online", "מחובר לשיחה");
      createToast("success", "מחובר!", "התחברת לשיחה בהצלחה", 3000);
    } catch (rtcError) {
      console.error("שגיאת WebRTC:", rtcError);
      updateStatus("offline", "שגיאת התחברות");
      createToast("error", "שגיאת WebRTC", rtcError.message, 5000);
    }
  } catch (error) {
    console.error(error);
    updateStatus("offline", "מנותק");
    createToast(
      "error",
      "שגיאה",
      "לא ניתן להצטרף לשיחה: " + error.message,
      5000
    );
  }
};

/**
 * Log active tracks for debugging
 */
function logActiveTracks() {
  const { localStream, remoteStream, pc } = appState;
  
  if (localStream) {
    console.log("Local stream active tracks:");
    localStream.getTracks().forEach((track) => {
      console.log(
        `- ${track.kind} track: id=${track.id}, enabled=${track.enabled}, readyState=${track.readyState}`
      );
    });
  } else {
    console.warn("No local stream available");
  }

  if (remoteStream) {
    console.log("Remote stream active tracks:");
    remoteStream.getTracks().forEach((track) => {
      console.log(
        `- ${track.kind} track: id=${track.id}, enabled=${track.enabled}, readyState=${track.readyState}`
      );
    });
  } else {
    console.warn("No remote stream available");
  }

  console.log("RTCPeerConnection senders:");
  pc.getSenders().forEach((sender) => {
    console.log(
      `- Sender: ${sender.track ? sender.track.kind : "no track"}`
    );
  });

  console.log("RTCPeerConnection receivers:");
  pc.getReceivers().forEach((receiver) => {
    console.log(
      `- Receiver: ${receiver.track ? receiver.track.kind : "no track"}`
    );
  });
}