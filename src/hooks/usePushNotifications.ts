import { useState, useCallback } from "react";
import { getFirebaseMessaging } from "@/lib/firebase";
import { getToken } from "firebase/messaging";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/AuthContext";
import toast from "react-hot-toast";

export function usePushNotifications() {
  const { user } = useAuth();
  const [isSubscribing, setIsSubscribing] = useState(false);

  const subscribeToNotifications = useCallback(async () => {
    if (!user) {
      toast.error("You must be logged in to enable notifications");
      return;
    }

    if (!('serviceWorker' in navigator)) {
      toast.error("Notifications are not supported in this browser");
      return;
    }

    setIsSubscribing(true);
    try {
      const permission = await Notification.requestPermission();
      
      if (permission === "granted") {
        const messaging = await getFirebaseMessaging();
        if (!messaging) throw new Error("Messaging not supported");

        // Get FCM Token
        const token = await getToken(messaging, {
          vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
        });

        if (token) {
          const supabase = createClient();
          
          // 1. Fetch current tokens
          const { data: profile } = await supabase
            .from("profiles")
            .select("fcm_tokens")
            .eq("id", user.id)
            .single();

          const existingTokens = profile?.fcm_tokens || [];
          
          // 2. Add new token if it doesn't exist
          if (!existingTokens.includes(token)) {
            const { error: updateError } = await supabase
              .from("profiles")
              .update({
                fcm_tokens: [...existingTokens, token],
                updated_at: new Date().toISOString()
              })
              .eq("id", user.id);

            if (updateError) throw updateError;
          }

          toast.success("Notifications enabled successfully!");
          return true;
        } else {
          toast.error("Failed to generate device token");
        }
      } else {
        toast.error("Permission denied for notifications");
      }
    } catch (error: any) {
      console.error("Push notification error:", error);
      toast.error(error.message || "Failed to enable notifications");
    } finally {
      setIsSubscribing(false);
    }
    return false;
  }, [user]);

  const unsubscribeFromNotifications = useCallback(async () => {
    if (!user) return;
    setIsSubscribing(true);
    try {
      const messaging = await getFirebaseMessaging();
      if (!messaging) throw new Error("Messaging not supported");

      const token = await getToken(messaging, {
        vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
      });

      if (token) {
        const supabase = createClient();
        const { data: profile } = await supabase
          .from("profiles")
          .select("fcm_tokens")
          .eq("id", user.id)
          .single();

        const existingTokens = profile?.fcm_tokens || [];
        const newTokens = existingTokens.filter((t: string) => t !== token);

        const { error: updateError } = await supabase
          .from("profiles")
          .update({
            fcm_tokens: newTokens,
            updated_at: new Date().toISOString()
          })
          .eq("id", user.id);

        if (updateError) throw updateError;
        toast.success("Notifications disabled");
      }
    } catch (error: any) {
      console.error("Unsubscribe error:", error);
      toast.error(error.message || "Failed to disable notifications");
    } finally {
      setIsSubscribing(false);
    }
  }, [user]);

  return {
    subscribeToNotifications,
    unsubscribeFromNotifications,
    isSubscribing
  };
}
