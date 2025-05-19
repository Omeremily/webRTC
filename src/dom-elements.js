// dom-elements.js
// References to all DOM elements used in the application

// Video elements
export const localVideo = document.getElementById("localVideo");
export const remoteVideo = document.getElementById("remoteVideo");
export const noRemoteStream = document.querySelector(".no-remote-stream");

// Call control buttons
export const webcamButton = document.getElementById("webcamButton");
export const createCallButton = document.getElementById("createCallButton");
export const answerButton = document.getElementById("answerButton");
export const callInput = document.getElementById("callInput");
export const hangupButton = document.getElementById("hangupButton");
export const resetVideoButton = document.getElementById("resetVideoButton");

// Room ID related elements
export const roomIdDisplay = document.getElementById("roomId");
export const roomIdContainer = document.getElementById("roomIdContainer");
export const copyButton = document.getElementById("copyButton");

// Status indicators
export const statusIndicator = document.querySelector(".status-indicator");
export const statusText = document.querySelector(".status-text");
export const callActions = document.querySelector(".call-actions");

// Media control buttons
export const toggleMicButton = document.getElementById("toggleMicButton");
export const toggleVideoButton = document.getElementById("toggleVideoButton");
export const toggleFullscreenButton = document.getElementById("toggleFullscreenButton");
export const shareScreenButton = document.getElementById("shareScreenButton");

// Toast container
export const toastContainer = document.getElementById("toastContainer");