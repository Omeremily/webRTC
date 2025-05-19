// call/peer.js
// RTCPeerConnection management
// ONLY the ontrack handler is changed to match the working example

import { rtcConfig } from '../config.js';
import { remoteVideo, noRemoteStream } from '../dom-elements.js';
import { updateStatus } from '../utils/helpers.js';
import { createToast } from '../utils/toast.js';
import appState, { updatePeerConnection, updateRemoteStream } from '../state.js';

/**
 * Initializes a new RTCPeerConnection
 * @returns {RTCPeerConnection} - The new RTCPeerConnection
 */
export const initializePeerConnection = () => {
  const { pc: oldPc, localStream, remoteStream } = appState;
  
  // Close existing connection if it exists
  if (oldPc) {
    oldPc.close();
  }

  // Create new RTCPeerConnection
  const pc = new RTCPeerConnection(rtcConfig);
  console.log("✅ Created new RTCPeerConnection with servers:", rtcConfig);

  // Create new remote stream if needed
  let currentRemoteStream = remoteStream;
  if (!currentRemoteStream) {
    currentRemoteStream = new MediaStream();
    updateRemoteStream(currentRemoteStream);
  }
  
  // Set remote video source (important: do this before adding tracks)
  if (remoteVideo) {
    remoteVideo.srcObject = currentRemoteStream;
  }

  // Set up track event handling to receive remote media
  // THIS IS THE KEY FIX - simplified to match the working example
  pc.ontrack = (event) => {
    console.log("🎯🎯🎯 ontrack event fired!", event);
    
    // Hide "no remote stream" message
    if (noRemoteStream) {
      noRemoteStream.classList.add("hidden");
    }
    
    // Simply iterate through all tracks from the incoming stream and add them to our remote stream
    // This direct approach matches the working example you shared
    event.streams[0].getTracks().forEach((track) => {
      console.log(`➕ Adding ${track.kind} track to remote stream`);
      currentRemoteStream.addTrack(track);
    });
    
    // Add connection-has-stream visual indicator
    const remoteVideoContainer = remoteVideo.closest('.video-container');
    if (remoteVideoContainer) {
      remoteVideoContainer.classList.add('has-stream');
    }
  };
  
  // Setup state change event handlers for logging/debugging
  pc.oniceconnectionstatechange = () => {
    console.log(`🧊 ICE connection state: ${pc.iceConnectionState}`);
  };
  
  pc.onconnectionstatechange = () => {
    console.log(`🌐 Connection state: ${pc.connectionState}`);
  };
  
  pc.onsignalingstatechange = () => {
    console.log(`📣 Signaling state: ${pc.signalingState}`);
  };

  // Add local tracks to the peer connection if available
  if (localStream && localStream.active) {
    console.log("Adding local stream tracks to peer connection");
    localStream.getTracks().forEach((track) => {
      console.log(`➕ Adding local ${track.kind} track to peer connection`);
      pc.addTrack(track, localStream);
    });
  }

  // Update the global state with new peer connection
  updatePeerConnection(pc);
  
  return pc;
};

/**
 * Handle connection state changes
 * @param {RTCPeerConnection} pc - The peer connection
 */
export const handleConnectionStateChange = () => {
  const { pc } = appState;
  
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
};

/**
 * Attempt to reconnect a failed call
 */
export const tryReconnect = async () => {
  const { pc, callDocRef } = appState;
  
  if (!callDocRef || pc.connectionState === "closed") {
    return;
  }
  
  console.log("Attempting to reconnect...");
  try {
    pc.restartIce();
    console.log("ICE restart initiated");
  } catch (e) {
    console.error("Failed to restart ICE:", e);
  }
};