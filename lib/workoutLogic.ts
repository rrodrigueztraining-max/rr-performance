
import { db } from "@/lib/firebase";
import { doc, runTransaction, serverTimestamp, collection, addDoc, query, where, orderBy, limit, getDocs } from "firebase/firestore";

/**
 * Finaliza un entrenamiento ENTERO (Legacy o Single-Day logic).
 */
export async function finishWorkout(
    userId: string,
    workoutId: string,
    workoutTitle: string,
    sessionData: any, // Contains actual results
    feedback: { sessionRPE: number; notes: string; painLevels?: any }
) {
    if (!userId || !workoutId) {
        throw new Error("Missing userId or workoutId");
    }

    const completedAt = new Date();
    const historyRef = collection(db, "users", userId, "workout_history");
    const workoutRef = doc(db, "users", userId, "workouts", workoutId);

    try {
        await runTransaction(db, async (transaction) => {
            const workoutDoc = await transaction.get(workoutRef);
            if (!workoutDoc.exists()) {
                throw new Error("Workout does not exist!");
            }

            const workoutData = workoutDoc.data();
            const blocks = workoutData.blocks || [];

            // --- CONSTRUCT FULL SNAPSHOT ---
            // Iterate all blocks and exercises to build a complete picture
            const exercisesSnapshot: any[] = [];

            blocks.forEach((block: any) => {
                // If block has exercises
                if (block.exercises && Array.isArray(block.exercises)) {
                    // Add a section header for the block if desired, or just flatten
                    // Let's add block section header to keep structure clear in report
                    exercisesSnapshot.push({
                        isSection: true,
                        name: block.title
                    });

                    block.exercises.forEach((exercise: any) => {
                        if (exercise.isSection) {
                            exercisesSnapshot.push(exercise);
                            return;
                        }

                        const results = sessionData[exercise.id] || {}; // user's data for this exercise

                        // Map over series to combine targets with actuals
                        const seriesSnapshot = (exercise.series || []).map((serie: any, idx: number) => {
                            const seriesResult = results[idx] || {};
                            return {
                                setNumber: idx + 1,
                                targetReps: serie.targetReps || null,
                                targetRPE: serie.targetRPE || null,
                                actualReps: seriesResult.reps || null,
                                actualLoad: seriesResult.load || null,
                                actualRPE: seriesResult.rpe || null,
                                completed: seriesResult.completed || false,
                                intensityType: serie.intensityType || 'RPE' // Preserve intensity type
                            };
                        });

                        exercisesSnapshot.push({
                            id: exercise.id,
                            name: exercise.name,
                            notes: exercise.notes,
                            videoUrl: exercise.videoUrl,
                            rest: exercise.rest,
                            painLevel: feedback.painLevels?.[exercise.id] || 0,
                            userNotes: feedback.notes?.[exercise.id] || "",
                            series: seriesSnapshot
                        });
                    });
                }
            });

            const historyData = {
                originalWorkoutId: workoutId,
                title: workoutTitle,
                completedAt: serverTimestamp(),
                completedDate: completedAt.toISOString().split('T')[0],
                exercises: exercisesSnapshot, // FULL DETAIL SAVED
                generalFeedback: {
                    sessionRPE: feedback.sessionRPE,
                    generalNotes: feedback.notes
                },
                status: 'completed'
            };

            const newHistoryRef = doc(historyRef);
            transaction.set(newHistoryRef, historyData);

            transaction.update(workoutRef, {
                status: 'completed',
                completedAt: serverTimestamp(),
                completedBlocks: [], // Optional: Clear blocks progress if re-assigning? Or keep. 
                // Usually we just mark status completed.
            });
        });

        console.log("✅ Workout finished successfully!");
        return true;

    } catch (error) {
        console.error("❌ Error finishing workout:", error);
        throw error;
    }
}

/**
 * Finaliza un BLOQUE específico (Día) dentro de un entrenamiento.
 * MODIFICADO: YA NO CREA HISTORIAL, SOLO ACTUALIZA PROGRESO.
 */
export async function finishBlock(
    userId: string,
    workoutId: string,
    blockId: string,
    blockTitle: string,
    sessionData: any,
    blockExercises: any[], // NEEDED: Receives the full exercise definitions for this block
    feedback: { sessionRPE: number; notes: string; painLevels?: any }
) {
    if (!userId || !workoutId || !blockId) throw new Error("Missing required IDs");

    // const historyRef = collection(db, "users", userId, "workout_history"); // REMOVED
    const workoutRef = doc(db, "users", userId, "workouts", workoutId);

    try {
        let isWorkoutCompleted = false;

        await runTransaction(db, async (transaction) => {
            const workoutDoc = await transaction.get(workoutRef);
            if (!workoutDoc.exists()) throw new Error("Workout not found");

            const workoutData = workoutDoc.data();

            // --- REMOVED HISTORY CREATION ---
            // We do NOT create a history entry for single blocks anymore 
            // to avoid spamming reports.
            // We ONLY update the "completedBlocks" array on the active workout.

            // Update Main Doc: Add blockId to 'completedBlocks'
            const currentCompleted = workoutData.completedBlocks || [];
            let newCompletedBlocks = currentCompleted;

            if (!currentCompleted.includes(blockId)) {
                newCompletedBlocks = [...currentCompleted, blockId];
                transaction.update(workoutRef, {
                    completedBlocks: newCompletedBlocks,
                    lastActiveDate: serverTimestamp()
                });
            }

            // Check if ALL blocks are completed
            const totalBlocks = workoutData.blocks?.length || 0;
            if (newCompletedBlocks.length >= totalBlocks && totalBlocks > 0) {
                // OPTIONAL: Auto-finish workout? 
                // NO, let user click "Finish Workout" explicitly to add feedback/RPE for the whole week/session.
                // However, the UI might show "All done".
                // We return true so UI can show confetti.
                isWorkoutCompleted = true;
            }
        });

        return { success: true, workoutCompleted: isWorkoutCompleted };
    } catch (error) {
        console.error("❌ Error finishing block:", error);
        throw error;
    }
}

/**
 * Obtiene el último historial completado para un workout específico.
 * Se usa para "Ghost History" y "Micro-PR".
 */
export async function getLastWorkoutHistory(userId: string, workoutId: string) {
    if (!userId || !workoutId) return null;

    try {
        const historyRef = collection(db, "users", userId, "workout_history");
        // Query: Same originalWorkoutId, Status completed, Order by completedAt desc, Limit 1
        const q = query(
            historyRef,
            where("originalWorkoutId", "==", workoutId),
            where("status", "==", "completed"),
            orderBy("completedAt", "desc"), // Requires index? Hopefully singular index on originalWorkoutId + client side sort if complex.
            // Composite index might be needed: originalWorkoutId ASC, completedAt DESC.
            // Let's try simple query first. If index error, we'll log it.
            limit(1)
        );

        const snapshot = await getDocs(q);
        if (snapshot.empty) return null;

        const doc = snapshot.docs[0];
        return { id: doc.id, ...doc.data() };

    } catch (error: any) {
        // Fallback for missing index error to keep app running without index creation immediately
        if (error.code === 'failed-precondition') {
            console.warn("Missing index for Ghost History query. Creating simplified query...");
            // Simplified: Just match ID and filter in client (not efficient for huge history but safe for MVP)
            const historyRef = collection(db, "users", userId, "workout_history");
            const q = query(historyRef, where("originalWorkoutId", "==", workoutId), where("status", "==", "completed"));
            const snapshot = await getDocs(q);
            if (snapshot.empty) return null;

            const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
            // Sort desc
            data.sort((a, b) => (b.completedAt?.toMillis() || 0) - (a.completedAt?.toMillis() || 0));
            return data[0];
        }
        console.error("Error fetching last workout history:", error);
        return null;
    }
}
