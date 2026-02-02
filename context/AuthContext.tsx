"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
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
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                // IMMEDIATELY set user to unblock UI, then fetch role
                setUser(currentUser);

                const COACH_EMAIL = "rrodrigueztraining@gmail.com";
                const isCoach = currentUser.email?.toLowerCase() === COACH_EMAIL;

                // 1. OPTIMISTIC UPDATE: Grant access immediately if email matches
                if (isCoach) {
                    console.log("Optimistically granting Coach access");
                    setRole("coach");
                }

                // Set user to state immediately
                setUser(currentUser);

                const createProfile = async () => {
                    console.log("Creating default profile...");
                    const assignedRole = isCoach ? "coach" : "client";

                    try {
                        // Create user document
                        await setDoc(doc(db, "users", currentUser.uid), {
                            uid: currentUser.uid,
                            email: currentUser.email,
                            displayName: currentUser.displayName || "Usuario Nuevo",
                            role: assignedRole,
                            createdAt: serverTimestamp(),
                            lastActive: serverTimestamp(),
                            workoutStatus: "pending",
                            stepsGoal: 10000,
                            currentSteps: 0
                        }, { merge: true });

                        // Initialize today's daily_stats for clients
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
                        console.log(`✅ Profile created for ${assignedRole}`);
                    } catch (e) {
                        console.error("Failed to create/update profile:", e);
                        if (!isCoach) setRole("client");
                    }
                };

                try {
                    const userDocRef = doc(db, "users", currentUser.uid);
                    const userDocSnap = await getDoc(userDocRef);

                    if (userDocSnap.exists()) {
                        const userData = userDocSnap.data();

                        // Security/Consistency Check: Enforce Coach Role if email matches
                        if (isCoach && userData.role !== "coach") {
                            console.log("Upgrading user to Coach in DB...");
                            await setDoc(userDocRef, { role: "coach" }, { merge: true });
                            // Role already set optimistically
                        } else if (!isCoach) {
                            // Normal logic for clients
                            setRole((userData.role as Role) || "client");
                        }
                    } else {
                        await createProfile();
                    }
                } catch (error: any) {
                    console.error("Error fetching user role:", error);
                    // Handle "Missing permissions" by attempting creation (typical for first login with strict rules)
                    if (error.code === 'permission-denied' || error.message.includes("Missing or insufficient permissions")) {
                        await createProfile();
                    } else if (!isCoach) {
                        // Fallback for non-coach users
                        setRole("client");
                    }
                }
            } else {
                setUser(null);
                setRole(null);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const logout = async () => {
        try {
            await auth.signOut();
            localStorage.clear(); // Clear local state
            setUser(null);
            setRole(null);
            // Force redirect to login
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
