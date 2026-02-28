/**
 * Utility to send push notifications from the server side.
 * This should only be imported in Server Components or API routes.
 */
export async function sendPushNotification({
    tokens,
    title,
    body,
    data,
  }: {
    tokens: string[];
    title: string;
    body: string;
    data?: Record<string, string>;
  }) {
    if (!tokens || tokens.length === 0) return { success: false, error: "No tokens provided" };
  
    try {
      // We call our own API internal route to reuse the Firebase Admin initialization logic
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      
      const response = await fetch(`${baseUrl}/api/notifications/push`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tokens,
          title,
          body,
          data,
        }),
      });
  
      return await response.json();
    } catch (error) {
      console.error("sendPushNotification error:", error);
      return { success: false, error };
    }
  }
