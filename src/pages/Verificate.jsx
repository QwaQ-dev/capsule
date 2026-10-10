import { useState } from "react";
import Icon from "../components/Icon";
import { PageShell, SummaryCard } from "../components/ActionLayout";
import { analyzeToken } from "../lib/verificate";

const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—");
const STATUS_LABEL = { pass: "No risk found", fail: "Risk found", unknown: "Unknown" };

function ScoreRing({ score }) {
  const r = 26, c = 2 * Math.PI * r;
  const missing = score == null ? 0 : ((100 - score) / 100) * c;
  return (
    <svg className="ring" width="60" height="60" viewBox="0 0 64 64" aria-hidden="true">
      <circle className="ring__track" cx="32" cy="32" r={r} />
      <circle className="ring__miss" cx="32" cy="32" r={r} strokeDasharray={`${missing} ${c}`} transform="rotate(-90 32 32)" />
    </svg>
  );
}

function Mark({ status }) {
  return (
    <span className={`mark mark--${status}`} role="img" aria-label={STATUS_LABEL[status]}>
      {status === "pass" ? <Icon name="check" size={12} /> : status === "unknown" ? "?" : null}
    </span>
  );
}

function CheckList({ title, items }) {
  return (
    <section>
      <h3 className="checks__title">{title}</h3>
      <ul className="checks">
        {items.map((i) => (
          <li key={i.id} title={i.detail}>
            <span>{i.label}</span>
            <Mark status={i.status} />
          </li>
        ))}
      </ul>
    </section>
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
      setReport(await analyzeToken(ca.trim())); // [CONTRACT READ] RPC + Blockscout
    } catch (err) {
      setReport(null);
      setError(err.message);
    }
    setLoading(false);
  };

  const rows = report
    ? [
        ["Score factors:", ""],
        ...(report.failed.length ? report.failed.map((f) => [f.label, `−${f.weight}`]) : [["No risks found", ""]]),
        ["Checks completed:", `${report.conclusive}/${report.items.length}`],
        ["Fee:", "free"],
      ]
    : [["Score factors:", ""], ["Fee:", "free"]];

  return (
    <PageShell label="Verificate" icon="coin" title="Verificate token">
      <form className="search" onSubmit={search}>
        <label htmlFor="ca">Enter CA:</label>
        <input id="ca" value={ca} onChange={(e) => setCa(e.target.value)} placeholder="0x…" />
        <button className="btn btn--outline" disabled={loading || !ca.trim()}>
          <Icon name="search" size={14} /> {loading ? "Checking…" : "Search"}
        </button>
      </form>
      {error && <small className="error verify__error" role="alert">{error}</small>}

      <div className="verify__grid">
        <div className="verify__main" data-onchain="read">
          {report && (
            <>
              <dl className="info">
                <div><dt>Token standart:</dt><dd>{report.standard}</dd></div>
                <div><dt>Deployed:</dt><dd>{report.deployedDaysAgo == null ? "—" : report.deployedDaysAgo === 0 ? "today" : `${report.deployedDaysAgo} days ago`}</dd></div>
              </dl>
              <div className="lists">
                <CheckList title="Centralization" items={report.items.filter((i) => i.group === "Centralization")} />
                <CheckList title="Transparency" items={report.items.filter((i) => i.group === "Transparency")} />
              </div>
            </>
          )}
        </div>
        <SummaryCard
          visual={<ScoreRing score={report?.score} />}
          headline={<>{report?.score ?? "—"}/<small>100</small> Reputation score</>}
          rows={rows} />
      </div>
    </PageShell>
  );
}