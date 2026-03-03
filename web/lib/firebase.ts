import { initializeApp, getApps } from 'firebase/app';
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';

const firebaseConfig = {
    apiKey: 'AIzaSyDuQPTuFbjRHndTmjP0vyw-1OkDW5iQ8UM',
    authDomain: 'appasd-488822.firebaseapp.com',
    projectId: 'appasd-488822',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);

export { auth, RecaptchaVerifier, signInWithPhoneNumber };
