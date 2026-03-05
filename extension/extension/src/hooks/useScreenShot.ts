import { useMutation } from "@tanstack/react-query";

interface ScreenshotResult {
  success: boolean;
  screenshot: string;
  excel: string;
  json: string;
  rows_count: number;
  data: Record<string, string>[];
}

export const useScreenshot = () => {
  return useMutation({
    mutationFn: async (): Promise<ScreenshotResult> => {
      console.log("[Hook] Starting screenshot process");

      return new Promise((resolve, reject) => {
        console.log("[Hook] Sending message to background");

        chrome.runtime.sendMessage({ action: "CAPTURE_FULL_PAGE" }, async (response) => {
          console.log("[Hook] Got response from background:", response);

          if (chrome.runtime.lastError) {
            console.error("[Hook] Background error:", chrome.runtime.lastError.message);
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }

          if (!response?.success) {
            console.error("[Hook] Background response failed:", response);
            reject(new Error(response?.error || "Capture failed"));
            return;
          }

          console.log("[Hook] Background succeeded, processing image");

          try {
            const blob = await fetch(response.dataUri).then((r) => r.blob());
            console.log("[Hook] Blob created, size:", blob.size);

            const formData = new FormData();
            formData.append("screenshot", blob, `screenshot-${Date.now()}.png`);

            console.log("[Hook] Sending to backend");

            const backendResponse = await fetch("http://localhost:3001/api/process-screenshot", {
              method: "POST",
              body: formData,
            });

            console.log("[Hook] Backend response status:", backendResponse.status);

            if (!backendResponse.ok) {
              const err = await backendResponse.json().catch(() => ({}));
              reject(new Error(err.error || "Backend failed"));
              return;
            }

            const result = await backendResponse.json();
            console.log("[Hook] Backend success:", result);
            resolve(result);
          } catch (err: unknown) {
            console.error("[Hook] Upload error:", err);
            const errorMessage = err instanceof Error ? err.message : "Unknown error";
            reject(new Error(errorMessage));
          }
        });
      });
    },
  });
};
