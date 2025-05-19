// utils/toast.js
// Toast notification system

import { toastContainer } from '../dom-elements.js';

/**
 * Creates a toast notification
 * @param {string} type - The type of toast (info, success, error, warning)
 * @param {string} title - The toast title
 * @param {string} message - The toast message
 * @param {number} duration - How long to display the toast (in ms), 0 for no auto-close
 * @returns {HTMLElement} - The created toast element
 */
export const createToast = (type, title, message, duration = 5000) => {
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