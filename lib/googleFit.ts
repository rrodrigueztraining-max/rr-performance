export const GOOGLE_FIT_SCOPES = "https://www.googleapis.com/auth/fitness.activity.read";

// Note: You need to replace this with your actual Google Cloud Client ID
// and enable the Fitness API in your Google Cloud Console.
export const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "YOUR_CLIENT_ID_HERE";

export async function fetchTodaySteps(accessToken: string): Promise<number> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startTimeMillis = startOfDay.getTime();
    const endTimeMillis = Date.now();

    const url = "https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate";

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "aggregateBy": [{
                    "dataTypeName": "com.google.step_count.delta",
                    "dataSourceId": "derived:com.google.step_count.delta:com.google.android.gms:estimated_steps"
                }],
                "bucketByTime": { "durationMillis": 86400000 }, // 1 day in ms
                "startTimeMillis": startTimeMillis,
                "endTimeMillis": endTimeMillis
            })
        });

        if (!response.ok) {
            console.error("Google Fit Error:", await response.text());
            throw new Error("Failed to fetch steps");
        }

        const data = await response.json();
        const bucket = data.bucket?.[0];
        const dataset = bucket?.dataset?.[0];
        const point = dataset?.point?.[0];

        // Sum steps if multiple points exist (though daily bucket should be one, technically)
        // For simplicity, we grab the intVal of the first point found in the daily bucket.
        const steps = point?.value?.[0]?.intVal || 0;

        return steps;

    } catch (error) {
        console.error("Error fetching steps:", error);
        return 0;
    }
}
