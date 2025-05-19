// utils/helpers.js
// Helper functions for the application

import { statusIndicator, statusText } from '../dom-elements.js';

/**
 * Updates the status indicator
 * @param {string} state - The status state (online, offline, connecting)
 * @param {string} text - The status text to display
 */
export const updateStatus = (state, text) => {
  statusIndicator.className = `status-indicator ${state}`;
  statusText.textContent = text;
};

/**
 * Generates a unique room ID
 * @returns {string} - A random room ID
 */
export const generateRoomId = () => {
  return Math.random().toString(36).substring(2, 12).toUpperCase();
};

/**
 * Checks the connection status of a peer connection
 * @param {RTCPeerConnection} pc - The peer connection to check
 */
export const checkConnectionStatus = (pc, remoteStream) => {
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
};

/**
 * Formats a duration in seconds to MM:SS format
 * @param {number} seconds - The duration in seconds
 * @returns {string} - Formatted duration string
 */
export const formatDuration = (seconds) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds < 10 ? '0' + remainingSeconds : remainingSeconds}`;
};