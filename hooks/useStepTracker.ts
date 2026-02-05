
import { useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { Health } from '@capgo/capacitor-health';

export const useStepTracker = () => {
    const [dailySteps, setDailySteps] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [hasPermission, setHasPermission] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const requestPermissions = useCallback(async () => {
        if (!Capacitor.isNativePlatform()) {
            console.log("Not native, skipping HealthKit permissions");
            return false;
        }

        try {
            setIsLoading(true);
            // Request read access for steps and sleep
            const result = await Health.requestAuthorization({
                read: ['steps', 'sleep'],
                write: []
            });

            // Verificamos si realmente nos dieron permiso
            const stepsAuthorized = result.readAuthorized.includes('steps');

            setHasPermission(stepsAuthorized);
            setIsLoading(false);
            return stepsAuthorized;
        } catch (err: any) {
            console.error("Permission request failed", err);
            setError(err.message || "Error solicitando permisos");
            setHasPermission(false);
            setIsLoading(false);
            return false;
        }
    }, []);

    const fetchTodaySteps = useCallback(async () => {
        if (!Capacitor.isNativePlatform()) return 0;

        try {
            const now = new Date();
            const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

            // Use queryAggregated for efficiency
            const result = await Health.queryAggregated({
                dataType: 'steps',
                startDate: startOfDay.toISOString(),
                endDate: now.toISOString(),
                bucket: 'day',
                aggregation: 'sum'
            });

            let total = 0;
            if (result.samples && result.samples.length > 0) {
                // Sum up samples just in case multiple buckets returned (unlikely with 'day' and same day range but safe)
                total = result.samples.reduce((acc, sample) => acc + sample.value, 0);
            }

            setDailySteps(total);
            return total;

        } catch (err: any) {
            console.error("Error fetching steps", err);
            setError(err.message);
            return 0;
        }
    }, []);

    return {
        dailySteps,
        requestPermissions,
        fetchTodaySteps,
        isLoading,
        hasPermission,
        error
    };
};
