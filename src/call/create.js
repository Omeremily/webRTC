// call/create.js
// Fixed version to handle connection state properly

import { doc, collection, addDoc, setDoc, onSnapshot, serverTimestamp } from '../firebase.js';
import { db } from '../firebase.js';
import { createCallButton, answerButton, hangupButton, roomIdDisplay, roomIdContainer } from '../dom-elements.js';
import { updateStatus } from '../utils/helpers.js';
import { createToast } from '../utils/toast.js';
import appState, { setCallInfo, setCallStartTime, setUnsubscribeFunctions } from '../state.js';
import { generateRoomId } from '../utils/helpers.js';
import { initializePeerConnection } from './peer.js';

/**
 * Creates a new call (initiator)
 * @returns {Promise<void>}
 */
export const createCall = async () => {
  try {
    // Make sure we have a fresh peer connection
    initializePeerConnection();
    const { pc } = appState;
    
    updateStatus("connecting", "יוצר שיחה...");

    // Generate random room ID
    const roomId = generateRoomId();
    roomIdDisplay.textContent = roomId;
    roomIdContainer.classList.remove("hidden");

    // Reference Firestore collections for signaling
    const callDocRef = doc(db, "calls", roomId);
    const offerCandidatesCollection = collection(callDocRef, "offerCandidates");
    const answerCandidatesCollection = collection(callDocRef, "answerCandidates");

    // Update state with call information
    setCallInfo(roomId, callDocRef, offerCandidatesCollection, answerCandidatesCollection);

    // Get candidates for caller, save to db
    pc.onicecandidate = (event) => {
      if (event.candidate && pc.signalingState !== 'closed') {
        console.log("Adding offer ICE candidate:", event.candidate);
        addDoc(offerCandidatesCollection, event.candidate.toJSON())
          .catch(err => console.error("Error adding ICE candidate:", err));
      }
    };

    // Create offer
    const offerDescription = await pc.createOffer();
    await pc.setLocalDescription(offerDescription);

    const offer = {
      sdp: offerDescription.sdp,
      type: offerDescription.type,
      created: serverTimestamp(),
      answered: false,
    };

    await setDoc(callDocRef, { offer });
    console.log("Created offer:", offer);

    // Listen for remote answer
    const unsubscribeCallDoc = onSnapshot(callDocRef, (snapshot) => {
      const data = snapshot.data();

      // Only process answer if connection is still valid
      if (!pc.currentRemoteDescription && data?.answer && pc.signalingState !== 'closed') {
        console.log("Got remote answer:", data.answer);
        const answerDescription = new RTCSessionDescription(data.answer);
        pc.setRemoteDescription(answerDescription)
          .then(() => {
            updateStatus("online", "מחובר לשיחה");
            hangupButton.disabled = false;
            setCallStartTime();
            createToast("success", "מחובר!", "השיחה התחילה", 3000);
          })
          .catch((error) => {
            console.error("שגיאה בהגדרת תיאור מרוחק:", error);
          });
      }
    });

    // Listen for remote ICE candidates
    const unsubscribeAnswerCandidates = onSnapshot(
      answerCandidatesCollection,
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === "added") {
            const data = change.doc.data();
            console.log("Got remote ICE candidate:", data);
            // Only add candidates if connection is still valid
            if (pc.signalingState !== 'closed') {
              pc.addIceCandidate(new RTCIceCandidate(data)).catch((error) => {
                console.error("שגיאה בהוספת ICE candidate:", error);
              });
            }
          }
        });
      }
    );

    // Update unsubscribe functions in state
    setUnsubscribeFunctions(unsubscribeCallDoc, null, unsubscribeAnswerCandidates);

    // Update UI
    createCallButton.disabled = true;
    // Keep answer button enabled to allow the same user to answer other calls
    hangupButton.disabled = false;

    createToast("success", "שיחה נוצרה", "שלח את קוד השיחה למשתתף השני", 7000);
  } catch (error) {
    console.error(error);
    updateStatus("offline", "מנותק");
    createToast("error", "שגיאה", "לא ניתן ליצור שיחה", 5000);
  }
};