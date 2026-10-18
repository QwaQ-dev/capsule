import { useState } from "react";
import Icon from "../components/Icon";
import { PageShell } from "../components/ActionLayout";
import { analyzeToken } from "../lib/verificate";
import { elysiumTestnet } from "../lib/wagmi";

const EXPLORER = elysiumTestnet.blockExplorers.default.url;
const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—");

function StatusIcon({ status }) {
  if (status === "pass") {
    return (
      <span className="scan-icon scan-icon--pass" title="Passed" aria-label="Passed">
        <Icon name="check" size={14} />
      </span>
    );
  }
  if (status === "fail") {
    return (
      <span className="scan-icon scan-icon--fail" title="Alert" aria-label="Alert">
        <span className="scan-icon__dot" />
      </span>
    );
  }
  // attention / unknown
  return (
    <span className="scan-icon scan-icon--attention" title="Attention" aria-label="Attention">
      !
    </span>
  );
}

function ScoreRing({ score }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const value = score == null ? 0 : score;
  const offset = ((100 - value) / 100) * c;
  return (
    <div className="score-ring">
      <svg width="110" height="110" viewBox="0 0 110 110" aria-hidden="true">
        <circle className="score-ring__track" cx="55" cy="55" r={r} />
        <circle
          className="score-ring__value"
          cx="55"
          cy="55"
          r={r}
          strokeDasharray={`${c}`}
          strokeDashoffset={offset}
          transform="rotate(-90 55 55)"
        />
      </svg>
      <span className="score-ring__num">{score ?? "—"}</span>
    </div>
  );
}

function CopyBtn({ value }) {
  const [ok, setOk] = useState(false);
  if (!value) return null;
  return (
    <button
      type="button"
      className="copy-btn"
      title="Copy"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setOk(true);
          setTimeout(() => setOk(false), 1200);
        } catch { /* ignore */ }
      }}
    >
      {ok ? "✓" : "⧉"}
    </button>
  );
}

export default function Verificate() {
  const [ca, setCa] = useState("");
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const search = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      setReport(await analyzeToken(ca.trim()));
    } catch (err) {
      setReport(null);
      setError(err.message || "Scan failed");
    }
    setLoading(false);
  };

  const items = report?.items ?? [];
  const alerts = items.filter((i) => i.status === "fail").length;
  const attention = items.filter((i) => i.status === "attention").length;
  const passed = items.filter((i) => i.status === "pass").length;

  const deployLabel =
    report?.deployedDaysAgo == null
      ? "—"
      : report.deployedDaysAgo === 0
        ? "today"
        : `${report.deployedDaysAgo} days ago`;

  return (
    <PageShell label="Verificate" icon="coin" title="Verificate token">
      <form className="search" onSubmit={search}>
        <label htmlFor="ca">Enter CA:</label>
        <input
          id="ca"
          value={ca}
          onChange={(e) => setCa(e.target.value)}
          placeholder="0x… token address"
          spellCheck={false}
        />
        <button type="submit" className="btn btn--outline" disabled={loading || !ca.trim()}>
          <Icon name="search" size={14} /> {loading ? "Checking…" : "Search"}
        </button>
      </form>
      {error && (
        <small className="error verify__error" role="alert">
          {error}
        </small>
      )}

      <div className="verify__grid">
        <div className="verify__main" data-onchain="read">
          {report && (
            <div className="scan-table-wrap">
              <table className="scan-table">
                <thead>
                  <tr>
                    <th>Scan result</th>
                    <th>Category</th>
                    <th>Description</th>
                    <th aria-hidden="true" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <span className="scan-result">
                          <StatusIcon status={row.status} />
                          <span className={`scan-label scan-label--${row.status}`}>{row.label}</span>
                        </span>
                      </td>
                      <td className="muted">{row.category}</td>
                      <td className="scan-desc">{row.description}</td>
                      <td className="scan-info" title={row.description}>ⓘ</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!report && !loading && !error && (
            <p className="verify__placeholder muted">Enter a token contract address and press Search</p>
          )}
        </div>

        <aside className="panel summary verify-summary">
          <h3 className="summary__head">Summary</h3>
          <div className="summary__body verify-summary__body">
            <ScoreRing score={report?.score} />

            <div className="badges">
              <span className="badge badge--alert">{alerts} Alerts</span>
              <span className="badge badge--attention">{attention} Attention</span>
              <span className="badge badge--pass">{passed} Passed</span>
            </div>

            <p className="score-line">
              <strong>{report?.score ?? "—"}</strong>
              <span className="muted">/100</span> Reputation score
            </p>

            <div className="overview">
              <p className="overview__title">Token Overview:</p>
              <div className="overview__row">
                <span className="muted">Deploy Time:</span>
                <span>{deployLabel}</span>
              </div>
              <div className="overview__row">
                <span className="muted">Token Address:</span>
                <span className="overview__addr">
                  {short(report?.address)}
                  <CopyBtn value={report?.address} />
                  {report?.address && (
                    <a
                      className="overview__ext"
                      href={`${EXPLORER}/address/${report.address}`}
                      target="_blank"
                      rel="noreferrer"
                      title="Open in explorer"
                    >
                      ↗
                    </a>
                  )}
                </span>
              </div>
              <div className="overview__row">
                <span className="muted">Deployer Address:</span>
                <span className="overview__addr">
                  {short(report?.deployer)}
                  <CopyBtn value={report?.deployer} />
                  {report?.deployer && (
                    <a
                      className="overview__ext"
                      href={`${EXPLORER}/address/${report.deployer}`}
                      target="_blank"
                      rel="noreferrer"
                      title="Open in explorer"
                    >
                      ↗
                    </a>
                  )}
                </span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </PageShell>
  );
}