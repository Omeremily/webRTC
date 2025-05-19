// state.js
// Global state management for the application

import { rtcConfig } from './config.js';

// Global state object
const state = {
  // RTCPeerConnection
  pc: new RTCPeerConnection(rtcConfig),
  
  // Media streams
  localStream: null,
  remoteStream: null,
  screenStream: null,
  
  // Local stream tracks for mute/unmute
  localStreamTracks: { 
    audio: null, 
    video: null 
  },
  
  // Call info
  currentRoomId: null,
  callStartTime: null,
  
  // Firestore references
  callDocRef: null,
  offerCandidatesCollection: null,
  answerCandidatesCollection: null,
  
  // Firestore unsubscribe functions
  unsubscribeCallDoc: null,
  unsubscribeOfferCandidates: null,
  unsubscribeAnswerCandidates: null,
};

// Directly export the state object
export default state;

// Reset state after call ends
export function resetState() {
  state.currentRoomId = null;
  state.callStartTime = null;
  state.callDocRef = null;
  state.offerCandidatesCollection = null;
  state.answerCandidatesCollection = null;
  state.unsubscribeCallDoc = null;
  state.unsubscribeOfferCandidates = null;
  state.unsubscribeAnswerCandidates = null;
}

// Update state with new peer connection
export function updatePeerConnection(newPc) {
  state.pc = newPc;
}

// Update media streams
export function updateLocalStream(stream) {
  state.localStream = stream;
  
  if (stream) {
    const videoTracks = stream.getVideoTracks();
    const audioTracks = stream.getAudioTracks();
    
    state.localStreamTracks.audio = audioTracks[0] || null;
    state.localStreamTracks.video = videoTracks[0] || null;
  }
}

export function updateRemoteStream(stream) {
  state.remoteStream = stream;
}

export function updateScreenStream(stream) {
  state.screenStream = stream;
}

// Set call information
export function setCallInfo(roomId, docRef, offerCandidates, answerCandidates) {
  state.currentRoomId = roomId;
  state.callDocRef = docRef;
  state.offerCandidatesCollection = offerCandidates;
  state.answerCandidatesCollection = answerCandidates;
}

// Set call start time
export function setCallStartTime() {
  state.callStartTime = new Date();
}

// Set unsubscribe functions
export function setUnsubscribeFunctions(callDoc, offerCandidates, answerCandidates) {
  state.unsubscribeCallDoc = callDoc;
  state.unsubscribeOfferCandidates = offerCandidates;
  state.unsubscribeAnswerCandidates = answerCandidates;
}