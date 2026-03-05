import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useScreenshot } from "../hooks/useScreenShot";
import './app.css';

const queryClient = new QueryClient();

function ScreenshotApp() {
  const { mutate, isPending, isSuccess, isError, error } = useScreenshot();

  const testHealthCheck = async () => {
    console.log("[App] Testing health check...");
    try {
      const response = await fetch("http://localhost:3001/health");
      const data = await response.json();
      console.log("[App] Health check success:", data);
      alert("Health check success: " + JSON.stringify(data));
    } catch (err: unknown) {
      console.error("[App] Health check failed:", err);
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      alert("Health check failed: " + errorMessage);
    }
  };

  const testBackgroundScript = async () => {
    console.log("[App] Testing background script...");
    try {
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action: "TEST_MESSAGE" }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      });
      console.log("[App] Background script response:", response);
      alert("Background script success: " + JSON.stringify(response));
    } catch (err: unknown) {
      console.error("[App] Background script failed:", err);
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      alert("Background script failed: " + errorMessage);
    }
  };

  return (
    <div className="extension-container">
      <header>
        <h1>Capture Tool</h1>
        <p className="subtitle">Save current tab to local storage</p>
      </header>

      <main>
        <button
          className="capture-btn"
          onClick={() => {
            console.log("[App] Button clicked");
            mutate();
          }}
          disabled={isPending}
        >
          {isPending ? 'Capturing...' : 'Take Screenshot'}
        </button>

        <button
          className="capture-btn"
          onClick={testHealthCheck}
          style={{ marginTop: '10px', backgroundColor: '#28a745' }}
        >
          Test Health Check
        </button>

        <button
          className="capture-btn"
          onClick={testBackgroundScript}
          style={{ marginTop: '10px', backgroundColor: '#ffc107' }}
        >
          Test Background Script
        </button>

        {isSuccess && <div className="status success">✓ Success!</div>}
        {isError && (
          <div className="status error">
            {error instanceof Error ? error.message : 'Upload failed'}
          </div>
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ScreenshotApp />
    </QueryClientProvider>
  );
}
