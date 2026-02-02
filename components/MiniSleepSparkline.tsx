"use client";

import { useEffect, useState } from "react";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface MiniSleepSparklineProps {
    userId: string;
}

export default function MiniSleepSparkline({ userId }: MiniSleepSparklineProps) {
    const [history, setHistory] = useState<number[]>([]);

    useEffect(() => {
        const fetchHistory = async () => {
            const q = query(
                collection(db, "users", userId, "daily_stats"),
                orderBy("date", "desc"),
                limit(3)
            );
            const snap = await getDocs(q); // One-time fetch is better for table rows than N real-time listeners to save bandwidth, unless strictly required.
            // User asked for "al instante" in charts, but for table "de un vistazo". 
            // I'll stick to getDocs for the sparkline to avoid N*3 active listeners in a list.
            const data = snap.docs.map(d => d.data().sleep_hours || 0).reverse();
            // Pad with 0 if less than 3
            while (data.length < 3) data.unshift(0);
            setHistory(data);
        };

        fetchHistory();
    }, [userId]);

    return (
        <div className="flex items-end gap-1 h-6 w-16">
            {history.map((val, i) => (
                <div
                    key={i}
                    title={`${val}h`}
                    className={`w-1/3 rounded-sm transition-all ${val >= 7 ? 'bg-green-500/50' : 'bg-red-500/50'}`}
                    style={{ height: `${Math.min((val / 10) * 100, 100)}%` }}
                ></div>
            ))}
        </div>
    );
}
