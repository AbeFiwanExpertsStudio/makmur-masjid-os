import { NextRequest, NextResponse } from "next/server";
import * as admin from "firebase-admin";

// Initialize Firebase Admin SDK
const initializeFirebaseAdmin = () => {
  if (admin.apps.length > 0) return admin.app();

  // We expect the private key to be structured as a JSON string in environment variable
  const serviceAccountStr = process.env.FIREBASE_ADMIN_SDK_JSON;
  
  if (!serviceAccountStr) {
    console.error("FIREBASE_ADMIN_SDK_JSON is missing");
    return null;
  }

  try {
    const serviceAccount = JSON.parse(serviceAccountStr);
    return admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } catch (error) {
    console.error("Error parsing FIREBASE_ADMIN_SDK_JSON:", error);
    return null;
  }
};

export async function POST(req: NextRequest) {
  try {
    const app = initializeFirebaseAdmin();
    if (!app) {
      return NextResponse.json({ error: "Push service not configured" }, { status: 500 });
    }

    const { tokens, title, body, data } = await req.json();

    if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
      return NextResponse.json({ error: "At least one token is required" }, { status: 400 });
    }

    // FCM Multicast allows sending to multiple tokens at once (max 500)
    const message = {
      notification: {
        title,
        body,
      },
      data: data || {},
      tokens: tokens,
    };

    const response = await admin.messaging().sendEachForMulticast(message);

    return NextResponse.json({
      success: true,
      successCount: response.successCount,
      failureCount: response.failureCount,
    });

  } catch (error: any) {
    console.error("Error sending push notification:", error);
    return NextResponse.json({ error: error.message || "Failed to send notification" }, { status: 500 });
  }
}
