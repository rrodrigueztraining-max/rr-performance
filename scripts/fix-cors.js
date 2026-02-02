const { Storage } = require('@google-cloud/storage');
const path = require('path');

// Configuration
const BUCKET_NAME = 'rr-performance-usa.firebasestorage.app';
const KEY_FILE_PATH = path.join(__dirname, '../service-account-key.json'); // Optional: If user has a key file

async function setCors() {
    try {
        console.log(`Configuring CORS for bucket: ${BUCKET_NAME}...`);

        // Initialize storage
        // Note: If running locally with gcloud auth, no keyFile is needed.
        // If using a service account key, uncomment the keyFilename line.
        const storage = new Storage({
            // keyFilename: KEY_FILE_PATH 
        });

        const bucket = storage.bucket(BUCKET_NAME);

        const corsConfiguration = [
            {
                origin: ["*"],
                method: ["GET"],
                maxAgeSeconds: 3600
            }
        ];

        await bucket.setCorsConfiguration(corsConfiguration);

        console.log('✅ CORS configuration updated successfully!');
        console.log('Use "gsutil cors get gs://' + BUCKET_NAME + '" to verify if you have gsutil installed.');

    } catch (error) {
        console.error('❌ Error setting CORS:', error.message);
        if (error.message.includes('Could not load the default credentials')) {
            console.log('\n💡 Tip: You need to authenticate first. Run:');
            console.log('  gcloud auth application-default login');
            console.log('OR export GOOGLE_APPLICATION_CREDENTIALS="path/to/key.json"');
        }
    }
}

setCors();
