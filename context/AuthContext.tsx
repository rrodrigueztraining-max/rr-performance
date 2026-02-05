"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User, setPersistence, browserLocalPersistence } from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

type Role = "coach" | "client" | null;

interface AuthContextType {
    user: User | null;
    role: Role;
    loading: boolean;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    role: null,
    loading: true,
    logout: async () => { },
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [role, setRole] = useState<Role>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let unsubscribe: (() => void) | undefined;

        // 1. Configuramos persistencia PRIMERO
        setPersistence(auth, browserLocalPersistence).then(() => {
            console.log("✅ Persistence ensures LOCAL session.");

            // 2. Escuchamos cambios
            unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
                if (currentUser) {
                    // IMMEDIATELY set user to unblock UI, then fetch role
                    setUser(currentUser);

                    // UPDATE LAST ACTIVE
                    try {
                        const userRef = doc(db, "users", currentUser.uid);
                        // We use updateDoc to avoid overwriting other fields if doc exists
                        // If doc doesn't exist, the createProfile below handles it with setDoc
                        updateDoc(userRef, {
                            lastActive: serverTimestamp()
                        }).catch(e => console.log("Error updating lastActive:", e));
                    } catch (e) {
                        // Ignore error if doc doesn't exist yet
                    }

                    // Logic to fetch role specific to this app
                    const COACH_EMAIL = "rrodrigueztraining@gmail.com";
                    const isCoach = currentUser.email?.toLowerCase() === COACH_EMAIL;

                    // Optimistic update
                    if (isCoach) setRole("coach");

                    const createProfile = async () => {
                        const assignedRole = isCoach ? "coach" : "client";
                        try {
                            await setDoc(doc(db, "users", currentUser.uid), {
                                uid: currentUser.uid,
                                email: currentUser.email,
                                displayName: currentUser.displayName || "Usuario Nuevo",
                                role: assignedRole,
                                isActive: true, // DEFAULT ACTIVE
                                createdAt: serverTimestamp(),
                                lastActive: serverTimestamp(),
                                workoutStatus: "pending",
                                stepsGoal: 10000,
                                currentSteps: 0
                            }, { merge: true });

                            if (!isCoach) {
                                const today = new Date().toISOString().split('T')[0];
                                await setDoc(doc(db, "users", currentUser.uid, "daily_stats", today), {
                                    date: today,
                                    steps: 0,
                                    sleep_hours: 0,
                                    sleep_start: "23:30",
                                    sleep_end: "07:00",
                                    created_at: serverTimestamp()
                                }, { merge: true });
                            }
                            if (!isCoach) setRole(assignedRole);
                        } catch (e) {
                            console.error("Profile creation error:", e);
                            if (!isCoach) setRole("client");
                        }
                    };

                    try {
                        const userDocRef = doc(db, "users", currentUser.uid);
                        const userDocSnap = await getDoc(userDocRef);

                        if (userDocSnap.exists()) {
                            const userData = userDocSnap.data();
                            if (isCoach && userData.role !== "coach") {
                                await setDoc(userDocRef, { role: "coach" }, { merge: true });
                            } else if (!isCoach) {
                                setRole((userData.role as Role) || "client");
                            }
                        } else {
                            await createProfile();
                        }
                    } catch (error: any) {
                        console.error("Error fetching user role:", error);
                        if (error.code === 'permission-denied' || error.message.includes("Missing")) {
                            await createProfile();
                        } else if (!isCoach) {
                            setRole("client");
                        }
                    }
                } else {
                    setUser(null);
                    setRole(null);
                }

                // SOLO AQUÍ se quita el loading
                setLoading(false);
            });
        }).catch((error) => {
            console.error("Error setting persistence:", error);
            // Even if persistence fails, we should try to listen or at least stop loading
            setLoading(false);
        });

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, []);

    const logout = async () => {
        try {
            await auth.signOut();
            localStorage.clear();
            setUser(null);
            setRole(null);
            window.location.href = "/login";
        } catch (error) {
            console.error("Logout error:", error);
        }
    };

    return (
        <AuthContext.Provider value={{ user, role, loading, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
