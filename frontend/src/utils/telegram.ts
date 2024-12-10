// src/utils/telegram.ts
declare global {
    interface Window {
      Telegram: {
        WebApp: any;
      }
    }
  }
  
  export const telegram = window.Telegram?.WebApp;