import { initializeApp, getApps, getApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const env = import.meta.env
const config = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
}

export const isConfigured = Boolean(config.apiKey && config.projectId && config.appId)

// Initialize with safe fallback project so Firestore and Storage SDK objects never throw synchronous undefined reference crashes
const app = getApps().length
  ? getApp()
  : initializeApp(
      isConfigured
        ? config
        : {
            apiKey: 'dummy-api-key',
            projectId: 'demo-zebella-studio',
            storageBucket: 'demo-zebella.appspot.com',
            messagingSenderId: '123456789012',
            appId: '1:123456789012:web:demo',
          }
    )

export const db = getFirestore(app)
export const storage = getStorage(app)
