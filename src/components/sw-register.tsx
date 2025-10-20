"use client";

import { useEffect, useState } from "react";

export default function SwRegister() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    // Early returns for unsupported environments
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) {
      console.warn("[sw] Service workers are not supported in this browser");
      return;
    }

    const register = async () => {
      try {
        // Check if we're in production (service worker should only run in production)
        const isProduction = process.env.NODE_ENV === "production";
        const isLocalhost = window.location.hostname === "localhost" || 
                           window.location.hostname === "127.0.0.1";

        // Don't register service worker in development on localhost
        if (!isProduction && isLocalhost) {
          console.log("[sw] Skipping service worker registration in development");
          return;
        }

        // Register the service worker from the public folder
        const reg = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none" as ServiceWorkerUpdateViaCache // Force updates
        });

        setRegistration(reg);
        console.log("[sw] Service worker registered successfully:", reg);

        // Handle updates
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (!newWorker) return;

          console.log("[sw] New service worker found and installing...");

          newWorker.addEventListener("statechange", () => {
            console.log(`[sw] Service worker state changed to: ${newWorker.state}`);
            
            switch (newWorker.state) {
              case "installed":
                // This is called when the new worker is installed but waiting to activate
                if (navigator.serviceWorker.controller) {
                  // There's a previous worker, so this is an update
                  console.log("[sw] New content is available; please refresh.");
                  
                  // You can dispatch an event here to show an update notification
                  window.dispatchEvent(new CustomEvent("swUpdateAvailable"));
                } else {
                  // First installation
                  console.log("[sw] Content is cached for offline use.");
                }
                break;
              
              case "activated":
                console.log("[sw] Service worker activated successfully");
                // New service worker is now controlling the page
                break;
              
              case "redundant":
                console.log("[sw] Service worker became redundant");
                break;
            }
          });
        });

        // Listen for controller changes (when a new service worker takes control)
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          console.log("[sw] Service worker controller changed");
          window.location.reload();
        });

        // Check for updates periodically (every hour)
        const updateInterval = setInterval(() => {
          reg.update().catch(err => {
            console.warn("[sw] Background update check failed:", err);
          });
        }, 60 * 60 * 1000); // 1 hour

        return () => clearInterval(updateInterval);

      } catch (err) {
        console.error("[sw] Service worker registration failed:", err);
        
        // Don't show errors in development
        if (process.env.NODE_ENV === "production") {
          // You could report this to your error tracking service
          console.error("[sw] Production registration error details:", err);
        }
      }
    };

    // Ensure service worker is supported and ready
    if (navigator.serviceWorker.controller) {
      // Service worker already controlling the page
      console.log("[sw] Service worker already controlling the page");
    } else {
      // Register with a small delay to avoid blocking main thread during initial load
      const timeoutId = setTimeout(register, 1000);
      
      return () => {
        clearTimeout(timeoutId);
        // Cleanup any intervals if component unmounts
      };
    }
  }, []);

  // Optional: Manual update trigger (useful for debugging)
  const checkForUpdates = async () => {
    if (registration) {
      try {
        await registration.update();
        console.log("[sw] Manual update check completed");
      } catch (err) {
        console.error("[sw] Manual update check failed:", err);
      }
    }
  };

  // This component doesn't render anything visible
  return null;
}