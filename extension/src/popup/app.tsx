import { useState } from "react";
import "./app.css";
import { DASHBOARD_URL } from "../constants";
import { useToken, useClearToken } from "../hooks/use-token";
import { useCaptureAndUpload } from "../hooks/use-capture";

type TableType = "achat" | "ventes";

// ── Logo icon ────────────────────────────────────────────────────────────────

function PharmaIcon() {
  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm6 4v4H8v2h4v4h2v-4h4v-2h-4V6h-2z" />
    </svg>
  );
}

// ── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [tableType, setTableType] = useState<TableType>("achat");

  const { data: token, isLoading: authLoading } = useToken();
  const { mutate: clearToken } = useClearToken();
  const {
    mutate: startCapture,
    isPending: isCapturing,
    isSuccess: captureSuccess,
    isError: captureError,
    error: captureErr,
    data: captureData,
    reset: resetCapture,
  } = useCaptureAndUpload();

  const handleLoginRedirect = () => {
    chrome.tabs.create({ url: `${DASHBOARD_URL}/login` });
  };

  const handleLogout = () => {
    clearToken();
    resetCapture();
  };

  const handleCapture = () => {
    if (!token) return;
    resetCapture();
    startCapture({ tableType, token });
  };

  const changeType = (type: TableType) => {
    setTableType(type);
    resetCapture();
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (authLoading) {
    return (
      <div className="popup">
        <div className="popup-header">
          <div className="popup-logo">
            <div className="popup-logo-icon"><PharmaIcon /></div>
            <div>
              <div className="popup-logo-name">APCM Pharma</div>
              <div className="popup-logo-sub">Capture</div>
            </div>
          </div>
        </div>
        <div className="popup-body" style={{ alignItems: "center", justifyContent: "center", padding: "32px" }}>
          <div className="spinner" style={{ borderColor: "rgba(20,184,166,0.3)", borderTopColor: "var(--primary)" }} />
        </div>
      </div>
    );
  }

  const preview = captureData?.preview ?? null;

  const sessionExpired =
    captureError && (captureErr as Error).message === "SESSION_EXPIRED";

  const userCancelled =
    captureError && (captureErr as Error).message === "Annulé par l'utilisateur";

  return (
    <div className="popup">
      {/* Header */}
      <div className="popup-header">
        <div className="popup-logo">
          <div className="popup-logo-icon"><PharmaIcon /></div>
          <div>
            <div className="popup-logo-name">APCM Pharma</div>
            <div className="popup-logo-sub">Capture</div>
          </div>
        </div>
        {token && (
          <button className="popup-logout-btn" onClick={handleLogout}>
            Déconnexion
          </button>
        )}
      </div>

      {/* Body */}
      <div className="popup-body">
        {!token || sessionExpired ? (
          /* ── Not logged in / session expired ── */
          <div className="auth-card">
            <div className="auth-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <div className="auth-title">
              {sessionExpired ? "Session expirée" : "Vous n'êtes pas connecté"}
            </div>
            <div className="auth-desc">
              {sessionExpired
                ? "Veuillez vous reconnecter au tableau de bord APCM Pharma."
                : "Connectez-vous au tableau de bord APCM Pharma pour utiliser la capture de tableaux."}
            </div>
            <button className="login-btn" onClick={handleLoginRedirect}>
              Ouvrir le tableau de bord →
            </button>
          </div>
        ) : (
          /* ── Logged in ── */
          <>
            {/* Table type selector */}
            <div className="type-tabs">
              <button
                className={`type-tab ${tableType === "achat" ? "active" : ""}`}
                onClick={() => changeType("achat")}
              >
                <div className="type-tab-label">Achats</div>
                <div className="type-tab-desc">Bons de livraison</div>
              </button>
              <button
                className={`type-tab ${tableType === "ventes" ? "active" : ""}`}
                onClick={() => changeType("ventes")}
              >
                <div className="type-tab-label">Ventes</div>
                <div className="type-tab-desc">Transactions de vente</div>
              </button>
            </div>

            {/* Capture button */}
            <button
              className="capture-btn"
              onClick={handleCapture}
              disabled={isCapturing}
            >
              {isCapturing ? (
                <><div className="spinner" /> Sélectionnez la zone...</>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <path d="M3 9h18M9 21V9" />
                  </svg>
                  Capturer une zone
                </>
              )}
            </button>

            {/* Status */}
            {captureSuccess && (
              <div className="status success">
                {captureData.inserted} ligne(s) importée(s) dans{" "}
                <strong>{captureData.tableType === "achat" ? "les achats" : "les ventes"}</strong>.
              </div>
            )}
            {captureError && !userCancelled && !sessionExpired && (
              <div className="status error">{(captureErr as Error).message}</div>
            )}

            {/* Preview table */}
            {preview && preview.rows.length > 0 && (
              <>
                <div className="preview-label">
                  Aperçu — {preview.rows.length} ligne(s) détectée(s)
                </div>
                <div className="preview-table-wrap">
                  <table className="preview-table">
                    <thead>
                      <tr>
                        {preview.headers.map((h, i) => <th key={i}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.slice(0, 5).map((row, i) => (
                        <tr key={i}>
                          {preview.headers.map((h, j) => <td key={j}>{row[h]}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
