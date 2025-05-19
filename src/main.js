import { db } from "./firebase.js";
import {
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

// DOM Elements
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const webcamButton = document.getElementById("webcamButton");
const createCallButton = document.getElementById("createCallButton");
const answerButton = document.getElementById("answerButton");
const callInput = document.getElementById("callInput");
const hangupButton = document.getElementById("hangupButton");
const roomIdDisplay = document.getElementById("roomId");
const roomIdContainer = document.getElementById("roomIdContainer");
const copyButton = document.getElementById("copyButton");
const statusIndicator = document.querySelector(".status-indicator");
const statusText = document.querySelector(".status-text");
const callActions = document.querySelector(".call-actions");
const toggleMicButton = document.getElementById("toggleMicButton");
const toggleVideoButton = document.getElementById("toggleVideoButton");
const toggleFullscreenButton = document.getElementById(
  "toggleFullscreenButton"
);
const shareScreenButton = document.getElementById("shareScreenButton");
const noRemoteStream = document.querySelector(".no-remote-stream");
const toastContainer = document.getElementById("toastContainer");
const resetVideoButton = document.getElementById("resetVideoButton");


// Global state
const servers = {
  iceServers: [
    {
      urls: [
        "stun:stun1.l.google.com:19302",
        "stun:stun2.l.google.com:19302",
        "stun:stun.l.google.com:19302",
        "stun:stun3.l.google.com:19302",
        "stun:stun4.l.google.com:19302",
      ],
    },
  ],
  iceCandidatePoolSize: 10,
};

let pc = new RTCPeerConnection(servers);
let localStream = null;
let remoteStream = null;
let screenStream = null;
let currentRoomId = null;
let localStreamTracks = { audio: null, video: null };
let callDocRef = null;
let offerCandidatesCollection = null;
let answerCandidatesCollection = null;
let unsubscribeCallDoc = null;
let unsubscribeOfferCandidates = null;
let unsubscribeAnswerCandidates = null;
let callStartTime = null;

// Toast notification system
const createToast = (type, title, message, duration = 5000) => {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;

  let iconClass = "";
  switch (type) {
    case "info":
      iconClass = "fa-info-circle";
      break;
    case "success":
      iconClass = "fa-check-circle";
      break;
    case "error":
      iconClass = "fa-exclamation-circle";
      break;
    case "warning":
      iconClass = "fa-exclamation-triangle";
      break;
  }

  toast.innerHTML = `
    <div class="toast-icon">
      <i class="fas ${iconClass}"></i>
    </div>
    <div class="toast-content">
      <h4 class="toast-title">${title}</h4>
      <p class="toast-message">${message}</p>
    </div>
    <button class="toast-close">
      <i class="fas fa-times"></i>
    </button>
  `;

  toastContainer.appendChild(toast);

  const closeButton = toast.querySelector(".toast-close");
  closeButton.addEventListener("click", () => {
    toast.style.animation = "slide-out 0.3s ease forwards";
    setTimeout(() => {
      toast.remove();
    }, 300);
  });

  if (duration > 0) {
    setTimeout(() => {
      if (toast.parentElement) {
        toast.style.animation = "slide-out 0.3s ease forwards";
        setTimeout(() => {
          if (toast.parentElement) {
            toast.remove();
          }
        }, 300);
      }
    }, duration);
  }

  return toast;
};

// Update status indicator
const updateStatus = (state, text) => {
  statusIndicator.className = `status-indicator ${state}`;
  statusText.textContent = text;
};

// Generate unique room ID
const generateRoomId = () => {
  return Math.random().toString(36).substring(2, 12).toUpperCase();
};

// Setup media streams
// Update the setupMedia streams function to make sure the remote stream is recognized
webcamButton.addEventListener("click", async () => {
  try {
    createToast("info", "מתחבר...", "מבקש גישה למצלמה ולמיקרופון");
    console.log("Requesting media devices...");

    // אפשרויות ספציפיות יותר להגדלת הסיכוי להצלחה
    localStream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: "user",
      },
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
      },
    });

    console.log("Got media stream:", localStream);

    // שמירת מסלולי האודיו והוידאו לפעולות השתק/הפעל
    const videoTracks = localStream.getVideoTracks();
    const audioTracks = localStream.getAudioTracks();
    
    localStreamTracks.audio = audioTracks[0] || null;
    localStreamTracks.video = videoTracks[0] || null;

    // איפוס חיבור הקשר - חשוב לעשות זאת לפני השמת הזרמים
    initializePeerConnection();

    // וידוא הצגת הזרם המקומי
    if (localVideo) {
      console.log("Setting local video source with active stream");
      localVideo.srcObject = localStream;
      localVideo.play().catch(e => console.error("Error playing local video:", e));
    }

    // יצירת זרם מרוחק ריק
    remoteStream = new MediaStream();
    
    // חשוב! - עדכון ברור של אלמנט הווידאו המרוחק
    if (remoteVideo) {
      console.log("✅ Setting initial remote video source");
      remoteVideo.srcObject = remoteStream;
      
      // הוספת מאזין לטעינת מטא-דאטה
      remoteVideo.onloadedmetadata = () => {
        console.log("✅ Remote video metadata loaded - playing");
        remoteVideo.play()
          .then(() => console.log("✅ Remote video playing"))
          .catch(e => {
            console.error("❌ Error playing remote video:", e);
            // נסיון חוזר
            setTimeout(() => {
              remoteVideo.play().catch(err => console.error("❌ Retry failed:", err));
            }, 1000);
          });
      };
    }

    // עדכון ממשק משתמש
    webcamButton.disabled = true;
    createCallButton.disabled = false;
    callInput.disabled = false;
    answerButton.disabled = false;
    callActions.classList.remove("hidden");
    
    updateStatus("online", "מחובר");
    createToast("success", "מצלמה מופעלת", "המצלמה והמיקרופון מופעלים");
    
  } catch (error) {
    console.error("Error accessing media devices:", error);
    createToast("error", "שגיאה", `לא ניתן לגשת למצלמה או למיקרופון: ${error.message}`, 10000);
  }
});

// הוסף פונקציה חדשה לבדיקת מצב החיבור
function checkConnectionStatus() {
  console.log("Checking connection status:");
  console.log("ICE connection state:", pc.iceConnectionState);
  console.log("Connection state:", pc.connectionState);
  console.log("Signaling state:", pc.signalingState);
  
  if (pc.connectionState === "connected" && remoteStream && remoteStream.getTracks().length > 0) {
    console.log("Connection is established with tracks:");
    remoteStream.getTracks().forEach(track => {
      console.log(`- ${track.kind} track, enabled: ${track.enabled}, state: ${track.readyState}`);
    });
  } else {
    console.warn("Connection may have issues or no remote tracks available");
  }
}

// קרא לפונקציה זו לאחר שהחיבור אמור להיות מוקם
setTimeout(checkConnectionStatus, 5000);
// Handle video/audio options
toggleMicButton.addEventListener("click", () => {
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
});

toggleVideoButton.addEventListener("click", () => {
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
});

toggleFullscreenButton.addEventListener("click", () => {
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
});

shareScreenButton.addEventListener("click", async () => {
  if (screenStream) {
    // Stop screen sharing
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

    screenStream = null;
    shareScreenButton.innerHTML = '<i class="fas fa-desktop"></i>';
    createToast("info", "שיתוף מסך הופסק", "חזרת למצלמה רגילה", 2000);
    return;
  }

  try {
    // Start screen sharing
    screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        cursor: "always",
      },
      audio: false,
    });

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

    // Handle when user stops screen share
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

      screenStream = null;
      shareScreenButton.innerHTML = '<i class="fas fa-desktop"></i>';
      createToast("info", "שיתוף מסך הופסק", "חזרת למצלמה רגילה", 2000);
    };

    shareScreenButton.innerHTML = '<i class="fas fa-stop"></i>';
    createToast("success", "שיתוף מסך מופעל", "המסך שלך משותף כעת", 2000);
  } catch (error) {
    console.error("שגיאה בשיתוף מסך:", error);
    createToast("error", "שגיאה", "לא ניתן לשתף את המסך", 3000);
  }
});

// Copy room ID to clipboard
copyButton.addEventListener("click", () => {
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

// Create a call (offer)
// Fix for the createCallButton event listener
createCallButton.addEventListener("click", async () => {
  try {
    updateStatus("connecting", "יוצר שיחה...");

    // Generate random room ID
    currentRoomId = generateRoomId();
    roomIdDisplay.textContent = currentRoomId;
    roomIdContainer.classList.remove("hidden");

    // Reference Firestore collections for signaling
    callDocRef = doc(db, "calls", currentRoomId);
    offerCandidatesCollection = collection(callDocRef, "offerCandidates");
    answerCandidatesCollection = collection(callDocRef, "answerCandidates");

    // Get candidates for caller, save to db
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log("Adding offer ICE candidate:", event.candidate);
        addDoc(offerCandidatesCollection, event.candidate.toJSON());
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
    unsubscribeCallDoc = onSnapshot(callDocRef, (snapshot) => {
      const data = snapshot.data();

      if (!pc.currentRemoteDescription && data?.answer) {
        console.log("Got remote answer:", data.answer);
        const answerDescription = new RTCSessionDescription(data.answer);
        pc.setRemoteDescription(answerDescription)
          .then(() => {
            updateStatus("online", "מחובר לשיחה");
            hangupButton.disabled = false;
            callStartTime = new Date();
            createToast("success", "מחובר!", "השיחה התחילה", 3000);
          })
          .catch((error) => {
            console.error("שגיאה בהגדרת תיאור מרוחק:", error);
          });
      }

    });

    // Listen for remote ICE candidates
    unsubscribeAnswerCandidates = onSnapshot(
      answerCandidatesCollection,
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === "added") {
            const data = change.doc.data();
            console.log("Got remote ICE candidate:", data);
            pc.addIceCandidate(new RTCIceCandidate(data)).catch((error) => {
              console.error("שגיאה בהוספת ICE candidate:", error);
            });
          }
        });
      }
    );

    // THIS IS THE CRITICAL FIX - Only disable the create button, NOT the answer button
    createCallButton.disabled = true;
    // answerButton.disabled = true; - REMOVE THIS LINE
    hangupButton.disabled = false;

    createToast("success", "שיחה נוצרה", "שלח את קוד השיחה למשתתף השני", 7000);
  } catch (error) {
    console.error(error);
    updateStatus("offline", "מנותק");
    createToast("error", "שגיאה", "לא ניתן ליצור שיחה", 5000);
  }
});

// Join a call (answer)
// Join a call (answer) - Fixed version
// Modified answer button event handler with enhanced error handling
answerButton.addEventListener("click", async () => {
  const callId = callInput.value.trim().toUpperCase();

  if (!callId) {
    createToast("warning", "נדרש קוד שיחה", "אנא הכנס קוד שיחה תקין", 3000);
    return;
  }

  try {
    updateStatus("connecting", "מצטרף לשיחה...");
    currentRoomId = callId;

    // בדיקה שיש זרם מקומי פעיל
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

    // איפוס חיבור הקשר להבטחת מצב נקי
    initializePeerConnection();

    // הפניה לאוספי Firestore לאיתות
    callDocRef = doc(db, "calls", callId);
    offerCandidatesCollection = collection(callDocRef, "offerCandidates");
    answerCandidatesCollection = collection(callDocRef, "answerCandidates");

    // קבלת מסמך השיחה
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

    // הגדרת טיפול במועמדי ICE - שמירה למסד הנתונים
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log("Adding answer ICE candidate:", event.candidate);
        addDoc(answerCandidatesCollection, event.candidate.toJSON()).catch(
          (error) => {
            console.error("שגיאה בשמירת ICE candidate:", error);
          }
        );
      }
    };

    try {
      // הגדרת התיאור המרוחק (הצעה)
      const offerDescription = new RTCSessionDescription(callData.offer);
      await pc.setRemoteDescription(offerDescription);
      console.log("Successfully set remote description (offer)");

      // יצירת תשובה
      const answerDescription = await pc.createAnswer();
      console.log("Created answer:", answerDescription);
      await pc.setLocalDescription(answerDescription);

      const answer = {
        sdp: answerDescription.sdp,
        type: answerDescription.type,
        timestamp: serverTimestamp(),
      };

      // עדכון מסמך השיחה עם התשובה
      await updateDoc(callDocRef, {
        answer,
        answered: true,
        answeredAt: serverTimestamp(),
      });

      // האזנה למועמדי ICE מרוחקים והוספתם
      unsubscribeOfferCandidates = onSnapshot(
        offerCandidatesCollection,
        (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
              const data = change.doc.data();
              console.log("Got remote ICE candidate:", data);

              // הוספת המועמד רק אם יש לנו תיאור מרוחק
              if (pc.remoteDescription) {
                pc.addIceCandidate(new RTCIceCandidate(data)).catch((error) => {
                  console.error("שגיאה בהוספת ICE candidate:", error);
                });
              } else {
                console.warn("דילוג על ICE candidate - אין תיאור מרוחק עדיין");
              }
            }
          });
        }
      );

      // האזנה לשינויים בהצעה (לחיבור מחדש)
      unsubscribeCallDoc = onSnapshot(callDocRef, (snapshot) => {
        const data = snapshot.data();

        // אם ההצעה עודכנה (לחיבור מחדש)
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

      // וידוא שהחיבור מעביר את הזרם המקומי
      function logActiveTracks() {
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

      logActiveTracks();

      function resetVideoElements() {
        console.log("Resetting video elements");

        if (localStream && localVideo) {
          localVideo.srcObject = null;
          setTimeout(() => {
            localVideo.srcObject = localStream;
            localVideo
              .play()
              .catch((e) => console.error("Error playing local video:", e));
          }, 500);
        }

        if (remoteStream && remoteVideo) {
          remoteVideo.srcObject = null;
          setTimeout(() => {
            remoteVideo.srcObject = remoteStream;
            remoteVideo
              .play()
              .catch((e) => console.error("Error playing remote video:", e));
          }, 500);
        }
      }

      document.addEventListener("DOMContentLoaded", () => {
        const resetVideoButton = document.getElementById("resetVideoButton");
        if (resetVideoButton) {
          resetVideoButton.addEventListener("click", () => {
            console.log("Manually resetting video connections");
            
            // בדוק את מצב החיבור הנוכחי
            checkConnectionStatus();
            
            // נסה לאפס את זרמי המדיה
            if (remoteStream && remoteVideo) {
              console.log("Resetting remote video element");
              
              // שמור העתק של הזרם
              const currentStream = remoteStream;
              
              // נקה ואז שחזר את הזרם
              remoteVideo.srcObject = null;
              
              setTimeout(() => {
                remoteVideo.srcObject = currentStream;
                remoteVideo.play()
                  .then(() => console.log("Remote video reset successful"))
                  .catch(e => console.error("Error playing remote video after reset:", e));
              }, 500);
            }
            
            createToast("info", "איפוס וידאו", "ניסיון לתקן את תצוגת הווידאו", 2000);
          });
        }
      });
      // עדכון מצב כפתורים
      answerButton.disabled = true;
      createCallButton.disabled = true;
      hangupButton.disabled = false;

      callStartTime = new Date();
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
});

// Hangup call
hangupButton.addEventListener("click", async () => {
  try {
    // Close connections and clean up
    pc.close();

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

    // Delete the call document if it exists
    if (callDocRef) {
      await deleteDoc(callDocRef);
    }

    // Stop all tracks
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        track.stop();
      });
    }

    if (screenStream) {
      screenStream.getTracks().forEach((track) => {
        track.stop();
      });
      screenStream = null;
    }

    // Calculate call duration if applicable
    if (callStartTime) {
      const duration = Math.floor((new Date() - callStartTime) / 1000);
      const minutes = Math.floor(duration / 60);
      const seconds = duration % 60;
      createToast(
        "info",
        "שיחה הסתיימה",
        `משך השיחה: ${minutes}:${seconds < 10 ? "0" + seconds : seconds}`,
        5000
      );
      callStartTime = null;
    } else {
      createToast("info", "שיחה הסתיימה", "השיחה נותקה", 3000);
    }

    // Reset UI
    updateStatus("online", "מחובר");
    roomIdContainer.classList.add("hidden");
    callInput.value = "";
    noRemoteStream.classList.remove("hidden");

    // Reset buttons
    createCallButton.disabled = false;
    answerButton.disabled = false;
    hangupButton.disabled = true;

    // Create a new peer connection
    pc = new RTCPeerConnection(servers);

    // Recreate media streams if webcam is still active
    if (localStream) {
      // Push tracks from local stream to peer connection
      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
      });

      // Create remote stream placeholder
      remoteStream = new MediaStream();

      // Pull tracks from remote stream, add to video stream
      pc.ontrack = (event) => {
        console.log("✅ Remote track received:", event.streams[0]);
        
        // הסר את ההודעה "אין זרם מרוחק"
        noRemoteStream.classList.add("hidden");
        
        // ודא שיש לנו זרם מרוחק
        if (!remoteStream) {
          remoteStream = new MediaStream();
        }
        
        // הוסף את המסלולים לזרם המרוחק
        event.streams[0].getTracks().forEach((track) => {
          console.log(`✅ Adding ${track.kind} track to remote stream`);
          remoteStream.addTrack(track);
        });
        
        // הצג את הזרם המרוחק
        if (remoteVideo) {
          console.log("✅ Setting remote video source");
          remoteVideo.srcObject = remoteStream;
          
          // נסה להפעיל את הווידאו
          remoteVideo.play().catch(e => {
            console.error("❌ Error playing remote video:", e);
          });
        }
      };
         

        // Display local stream
      localVideo.srcObject = localStream;
      remoteVideo.srcObject = remoteStream;
    }

    // Reset global variables
    currentRoomId = null;
    callDocRef = null;
    offerCandidatesCollection = null;
    answerCandidatesCollection = null;
    unsubscribeCallDoc = null;
    unsubscribeOfferCandidates = null;
    unsubscribeAnswerCandidates = null;
  } catch (error) {
    console.error(error);
    createToast("error", "שגיאה", "התרחשה שגיאה בסיום השיחה", 5000);
  }
});

// Connection state changes
// Enhanced Connection State Handler
pc.onconnectionstatechange = () => {
  console.log("Connection state change:", pc.connectionState);

  switch (pc.connectionState) {
    case "connected":
      if (noRemoteStream) {
        noRemoteStream.classList.add("hidden");
      }
      updateStatus("online", "מחובר לשיחה");
      break;
    case "disconnected":
      setTimeout(() => {
        if (pc.connectionState === "disconnected") {
          if (noRemoteStream) {
            noRemoteStream.classList.remove("hidden");
          }
          updateStatus("offline", "החיבור נותק");
          createToast("warning", "החיבור נותק", "מנסה להתחבר מחדש...", 5000);
          tryReconnect();
        }
      }, 3000);
      break;
    case "failed":
      if (noRemoteStream) {
        noRemoteStream.classList.remove("hidden");
      }
      updateStatus("offline", "החיבור נכשל");
      createToast("error", "החיבור נכשל", "נסה להתחבר מחדש", 5000);
      tryReconnect();
      break;
    case "closed":
      if (noRemoteStream) {
        noRemoteStream.classList.remove("hidden");
      }
      updateStatus("offline", "השיחה הסתיימה");
      break;
  }
};

const initializePeerConnection = () => {
  // סגירת החיבור הקיים אם יש כזה
  if (pc) {
    pc.close();
  }

  // יצירת אובייקט חדש
  pc = new RTCPeerConnection(servers);
  console.log("✅ Created new RTCPeerConnection with servers:", servers);

  // חשוב מאוד - הגדרת האזנה למסלולים מרוחקים
  pc.ontrack = (event) => {
    console.log("🎯🎯🎯 ontrack event fired!", event);
    console.log("Stream details:", {
      id: event.streams[0]?.id,
      active: event.streams[0]?.active,
      trackCount: event.streams[0]?.getTracks().length
    });
    
    // הסתר את הודעת "אין זרם מרוחק"
    if (noRemoteStream) {
      console.log("Hiding no-remote-stream message");
      noRemoteStream.classList.add("hidden");
    } else {
      console.warn("noRemoteStream element not found!");
    }
    
    // וודא שיש לנו זרם מרוחק
    if (!remoteStream) {
      console.log("Creating new remote stream");
      remoteStream = new MediaStream();
    }
    
    // הוסף את המסלול לזרם המרוחק
    event.streams[0].getTracks().forEach((track) => {
      console.log(`➕ Adding ${track.kind} track to remote stream`);
      remoteStream.addTrack(track);
    });
    
    // עדכן את אלמנט הווידאו המרוחק
    if (remoteVideo) {
      console.log("✅✅✅ Setting remote video source:", remoteVideo);
      console.log("Remote stream tracks:", remoteStream.getTracks().map(t => t.kind));
      remoteVideo.srcObject = remoteStream;
      

      
      // נסה להפעיל את הווידאו
      remoteVideo.play()
        .then(() => console.log("✅ Remote video playing successfully"))
        .catch(err => {
          console.error("❌ Failed to play remote video:", err);
          remoteVideo.muted = true; // השתק תחילה כדי לעקוף את מדיניות autoplay
          remoteVideo.play()
            .then(() => {
              console.log("✅ Remote video playing successfully (muted)");
              // נסה להפעיל שוב עם אודיו אחרי שהמשתמש אינטראקט עם הדף
              document.addEventListener('click', () => {
                remoteVideo.muted = false;
                console.log("Unmuted remote video after user interaction");
              }, { once: true });
            })
            .catch(e => console.error("❌ Second attempt failed:", e));
          setTimeout(() => {
            console.log("Trying to play remote video again...");
            remoteVideo.play()
              .then(() => console.log("✅ Second attempt succeeded"))
              .catch(e => console.error("❌ Second attempt failed:", e));
          }, 1000);
        });
    } else {
      console.error("❌❌❌ Remote video element not found!");
    }
  };
  // אירועי שינוי מצב לניטור
  pc.oniceconnectionstatechange = () => {
    console.log(`🧊 ICE connection state: ${pc.iceConnectionState}`);
  };
  
  pc.onconnectionstatechange = () => {
    console.log(`🌐 Connection state: ${pc.connectionState}`);
  };
  
  pc.onsignalingstatechange = () => {
    console.log(`📣 Signaling state: ${pc.signalingState}`);
  };

  // אם קיים זרם מקומי, הוסף אותו לחיבור החדש
  if (localStream && localStream.active) {
    console.log("Adding local stream tracks to peer connection");
    localStream.getTracks().forEach((track) => {
      console.log(`➕ Adding local ${track.kind} track to peer connection`);
      pc.addTrack(track, localStream);
    });
  }

  return pc;
}
// Check browser compatibility at startup
document.addEventListener("DOMContentLoaded", () => {
  // Check for WebRTC support
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    createToast(
      "error",
      "דפדפן לא נתמך",
      "הדפדפן שלך לא תומך ב-WebRTC. נסה להשתמש בדפדפן מודרני יותר כמו Chrome, Firefox, או Edge.",
      0
    );
    webcamButton.disabled = true;
    return;
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
    return;
  }

  console.log("Browser compatibility check passed. Ready to start!");
  createToast("info", "ברוכים הבאים", 'לחץ על "הפעל מצלמה" כדי להתחיל', 5000);
});

// Improved hangup function
const hangupCall = async (deleteDoc = true) => {
  try {
    // Close connections
    if (pc) {
      pc.close();
    }

    // Unsubscribe from Firestore listeners
    if (unsubscribeCallDoc) {
      unsubscribeCallDoc();
      unsubscribeCallDoc = null;
    }

    if (unsubscribeOfferCandidates) {
      unsubscribeOfferCandidates();
      unsubscribeOfferCandidates = null;
    }

    if (unsubscribeAnswerCandidates) {
      unsubscribeAnswerCandidates();
      unsubscribeAnswerCandidates = null;
    }

    // Delete the call document if requested
    if (deleteDoc && callDocRef) {
      try {
        await deleteDoc(callDocRef);
      } catch (deleteError) {
        console.warn("לא ניתן למחוק את מסמך השיחה:", deleteError);
      }
    }

    // Calculate call duration if applicable
    if (callStartTime) {
      const duration = Math.floor((new Date() - callStartTime) / 1000);
      const minutes = Math.floor(duration / 60);
      const seconds = duration % 60;
      createToast(
        "info",
        "שיחה הסתיימה",
        `משך השיחה: ${minutes}:${seconds < 10 ? "0" + seconds : seconds}`,
        5000
      );
      callStartTime = null;
    } else {
      createToast("info", "שיחה הסתיימה", "השיחה נותקה", 3000);
    }

    // Reset UI
    updateStatus("online", "מחובר");
    roomIdContainer.classList.add("hidden");
    callInput.value = "";
    noRemoteStream.classList.remove("hidden");

    // Reset buttons
    createCallButton.disabled = false;
    answerButton.disabled = false;
    hangupButton.disabled = true;

    // Reset variables
    currentRoomId = null;
    callDocRef = null;
    offerCandidatesCollection = null;
    answerCandidatesCollection = null;

    // Initialize new peer connection
    initializePeerConnection();
  } catch (error) {
    console.error(error);
    createToast("error", "שגיאה", "התרחשה שגיאה בסיום השיחה", 5000);
  }
};

// Update the hangupButton event listener
hangupButton.addEventListener("click", () => hangupCall(true));
// Initial status
updateStatus("offline", "מנותק");

resetVideoButton.addEventListener("click", () => {
  console.log("🔄 Manually resetting video elements");
  
  // איפוס הזרם המקומי
  if (localStream && localVideo) {
    localVideo.srcObject = null;
    setTimeout(() => {
      localVideo.srcObject = localStream;
      localVideo.play().catch(e => console.error("Error resetting local video:", e));
    }, 200);
  }
  
  // איפוס הזרם המרוחק
  if (remoteStream && remoteVideo) {
    remoteVideo.srcObject = null;
    setTimeout(() => {
      remoteVideo.srcObject = remoteStream;
      remoteVideo.play().catch(e => console.error("Error resetting remote video:", e));
      
      // הצגת מידע על המסלולים
      console.log("Current remote tracks after reset:");
      remoteStream.getTracks().forEach(track => {
        console.log(`- ${track.kind} track, enabled: ${track.enabled}, state: ${track.readyState}`);
      });
    }, 500);
  }
  
  createToast("info", "איפוס וידאו", "אתחול מחדש של הזרמים", 2000);
});