// js/services/authService.js
import { 
    signInWithPopup, 
    signOut, 
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    sendPasswordResetEmail,
    updateProfile
} from "https://www.gstatic.com/firebasejs/10.4.0/firebase-auth.js";
import { auth, provider } from "./firebaseConfig.js";

class AuthService {
    constructor() {
        this.currentUser = null;
    }

    // Iniciar sesión con Google
    async login() {
        if (!auth) {
            // Modo demo si Firebase no está configurado
            this.currentUser = { uid: "demo123", displayName: "Usuario Demo", email: "demo@educaand.es" };
            return this.currentUser;
        }

        try {
            const result = await signInWithPopup(auth, provider);
            this.currentUser = result.user;
            return this.currentUser;
        } catch (error) {
            console.error("Error al iniciar sesión con Google:", error);
            throw error;
        }
    }

    // Iniciar sesión con Correo y Contraseña
    async loginWithEmail(email, password) {
        if (!auth) {
            this.currentUser = { uid: "demo123", displayName: "Usuario Demo", email: (email || '').trim().toLowerCase() };
            return this.currentUser;
        }
        const cleanEmail = (email || '').trim().toLowerCase();
        try {
            const result = await signInWithEmailAndPassword(auth, cleanEmail, password);
            this.currentUser = result.user;
            return this.currentUser;
        } catch (error) {
            console.error("Error al iniciar sesión con email:", error);
            throw error;
        }
    }

    // Registrar nueva cuenta con Correo y Contraseña (primer acceso de usuario invitado)
    async registerWithEmail(email, password, displayName = "") {
        if (!auth) {
            this.currentUser = { uid: "demo123", displayName: displayName || "Usuario Demo", email: (email || '').trim().toLowerCase() };
            return this.currentUser;
        }
        const cleanEmail = (email || '').trim().toLowerCase();
        try {
            const result = await createUserWithEmailAndPassword(auth, cleanEmail, password);
            this.currentUser = result.user;
            if (displayName && displayName.trim()) {
                try {
                    await updateProfile(result.user, { displayName: displayName.trim() });
                } catch (e) {
                    console.warn("No se pudo asignar displayName en Firebase Auth:", e);
                }
            }
            return this.currentUser;
        } catch (error) {
            console.error("Error al registrar usuario con email:", error);
            throw error;
        }
    }

    // Enviar correo de restablecimiento de contraseña
    async resetPassword(email) {
        if (!auth) return;
        const cleanEmail = (email || '').trim().toLowerCase();
        try {
            await sendPasswordResetEmail(auth, cleanEmail);
        } catch (error) {
            console.error("Error al enviar email de recuperación:", error);
            throw error;
        }
    }

    // Cerrar sesión
    async logout() {
        if (!auth) {
            this.currentUser = null;
            return;
        }
        await signOut(auth);
        this.currentUser = null;
    }

    // Observador del estado de autenticación
    onAuthStateChanged(callback) {
        if (!auth) {
            // Simulamos estado para demo
            const user = localStorage.getItem("demoUser") ? JSON.parse(localStorage.getItem("demoUser")) : null;
            callback(user);
            return;
        }

        onAuthStateChanged(auth, (user) => {
            this.currentUser = user;
            callback(user);
        });
    }

    getUser() {
        return this.currentUser;
    }
}

export const authService = new AuthService();
