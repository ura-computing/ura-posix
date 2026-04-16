import "./app.css";
import { CANCEL_UPLOAD_KEY, DASHBOARD_URL } from "../constants";
import { useToken, useClearToken } from "../hooks/useToken";
import { useNotifications } from "../hooks/useNotifications";
import { useUploadStatus } from "../hooks/useUploadStatus";

// ── Logo icon ────────────────────────────────────────────────────────────────

function PharmaIcon() {
  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm6 4v4H8v2h4v4h2v-4h4v-2h-4V6h-2z" />
    </svg>
  );
}

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return "À l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  return `il y a ${Math.floor(diff / 86400)} j`;
}

// ── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const { auth, authLoading } = useToken();
  const { clearToken } = useClearToken();
  const token = auth?.token ?? null;
  const isAdmin = auth?.role === "admin";
  const canImport = !isAdmin && auth?.permissions?.import !== false;
  const { notifications, clearAll } = useNotifications();
  const { activeJob, hasActive } = useUploadStatus();

  const handleCancelUpload = () => {
    chrome.storage.local.set({ [CANCEL_UPLOAD_KEY]: true });
  };

  const handleLoginRedirect = () => {
    chrome.tabs.create({ url: `${DASHBOARD_URL}/login` });
  };

  const handleOpenDashboard = (path = "/") => {
    chrome.tabs.create({ url: `${DASHBOARD_URL}${path}` });
  };

  // ── Loading ───────────────────────────────────────────────────────────────

  if (authLoading) {
    return (
      <div className="popup">
        <div className="popup-header">
          <div className="popup-logo">
            <div className="popup-logo-icon"><PharmaIcon /></div>
            <div>
              <div className="popup-logo-name">APCM Pharma</div>
              <div className="popup-logo-sub">Import auto</div>
            </div>
          </div>
        </div>
        <div className="popup-body" style={{ alignItems: "center", justifyContent: "center", padding: "32px" }}>
          <div className="spinner" style={{ borderColor: "rgba(20,184,166,0.3)", borderTopColor: "var(--primary)" }} />
        </div>
      </div>
    );
  }

  return (
    <div className="popup">
      {/* Header */}
      <div className="popup-header">
        <div className="popup-logo">
          <div className="popup-logo-icon"><PharmaIcon /></div>
          <div>
            <div className="popup-logo-name">APCM Pharma</div>
            <div className="popup-logo-sub">Import auto</div>
          </div>
        </div>
        {token && (
          <button className="popup-logout-btn" onClick={() => clearToken()}>
            Déconnexion
          </button>
        )}
      </div>

      {/* Body */}
      <div className="popup-body">
        {!token ? (
          /* ── Not logged in ── */
          <div className="auth-card">
            <div className="auth-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <div className="auth-title">Non connecté</div>
            <div className="auth-desc">
              Connectez-vous au tableau de bord APCM Pharma pour activer l'import automatique.
            </div>
            <button className="login-btn" onClick={handleLoginRedirect}>
              Ouvrir le tableau de bord →
            </button>
          </div>
        ) : isAdmin ? (
          /* ── Admin — not supported ── */
          <div className="auth-card">
            <div className="auth-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            <div className="auth-title">Accès non disponible</div>
            <div className="auth-desc">
              L'extension est réservée aux propriétaires et employés de pharmacie. Les administrateurs gèrent la plateforme depuis le tableau de bord.
            </div>
            <button className="login-btn" onClick={() => handleOpenDashboard()}>
              Ouvrir le tableau de bord →
            </button>
          </div>
        ) : !canImport ? (
          /* ── Import blocked ── */
          <div className="auth-card">
            <div className="auth-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
                <circle cx="12" cy="12" r="10"/>
                <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
              </svg>
            </div>
            <div className="auth-title">Import non disponible</div>
            <div className="auth-desc">
              L'accès à l'import a été désactivé par le propriétaire de la pharmacie.
            </div>
            <button className="login-btn" onClick={() => handleOpenDashboard()}>
              Ouvrir le tableau de bord →
            </button>
          </div>
        ) : (
          /* ── Logged in ── */
          <>
            {/* Active status */}
            <div className="status-card">
              <div className="status-dot" />
              <div>
                <div className="status-title">Import automatique actif</div>
                <div className="status-desc">
                  Sur Sobrus, cliquez <strong>Télécharger en CSV</strong> pour importer vos données directement.
                </div>
              </div>
            </div>

            {/* Upload progress */}
            {activeJob && (
              <div className="upload-progress-card">
                <div className="upload-progress-header">
                  <div className="upload-progress-spinner" />
                  <span className="upload-progress-label">
                    {activeJob.fileType === "achat" ? "Achats" : activeJob.fileType === "vente" ? "Ventes" : "Stock"} — import en cours
                  </span>
                </div>
                {(activeJob.total ?? 0) > 1 && (
                  <>
                    <div className="upload-progress-bar-track">
                      <div
                        className="upload-progress-bar-fill"
                        style={{ width: `${Math.round(((activeJob.current ?? 0) / (activeJob.total ?? 1)) * 100)}%` }}
                      />
                    </div>
                    <div className="upload-progress-meta">
                      <span>Lot {activeJob.current}/{activeJob.total}</span>
                      <span>{Math.round(((activeJob.current ?? 0) / (activeJob.total ?? 1)) * 100)}%</span>
                    </div>
                  </>
                )}
                <button className="upload-cancel-btn" onClick={handleCancelUpload}>
                  {hasActive ? "Annuler tout" : "Annuler"}
                </button>
              </div>
            )}

            {/* Recent imports */}
            <div className="section-header">
              <span>Imports récents</span>
              {notifications.length > 0 && (
                <button className="clear-btn" onClick={() => clearAll()}>Effacer</button>
              )}
            </div>

            {notifications.length === 0 ? (
              <div className="empty-state">Aucun import pour l'instant.</div>
            ) : (
              <div className="notif-list">
                {notifications.slice(0, 8).map((n) => (
                  <div key={n.id} className={`notif-item ${!n.read ? "unread" : ""}`}>
                    <div className="notif-icon">
                      {n.fileType === "achat" ? "📦" : n.fileType === "vente" ? "🧾" : "📊"}
                    </div>
                    <div className="notif-content">
                      <div className="notif-title">
                        <strong>{n.inserted}</strong> lignes importées
                        {n.skipped > 0 && <span className="notif-skipped"> · {n.skipped} ignorées</span>}
                      </div>
                      <div className="notif-meta">
                        {n.fileType === "achat" ? "Achats" : n.fileType === "vente" ? "Ventes" : "Stock"} · {timeAgo(n.timestamp)}
                      </div>
                    </div>
                    <button
                      className="notif-view-btn"
                      onClick={() => handleOpenDashboard(n.fileType === "achat" ? "/achat" : n.fileType === "vente" ? "/ventes" : "/stock")}
                    >
                      Voir →
                    </button>
                  </div>
                ))}
              </div>
            )}

          </>
        )}
      </div>

      {token && !isAdmin && canImport && (
        <div className="popup-footer">
          <button className="dashboard-btn" onClick={() => handleOpenDashboard()}>
            Ouvrir le tableau de bord
          </button>
        </div>
      )}
    </div>
  );
}
