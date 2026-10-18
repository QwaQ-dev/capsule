import { useState } from "react";
import capeTitle from "../assets/cape-token.png";
import Icon from "../components/Icon";

const CA = "0x92aE6dEE9aA92d5F315096EBb0E77e7F8527c70b";
const TOTAL_SUPPLY = "100,000,000";
const SYMBOL = "$CAPS";

const SEGMENTS = [
  {
    id: "stage1",
    label: "Stage 1",
    pct: 10,
    color: "#c45c5c",
    description: "Rewards for early users right after launch",
  },
  {
    id: "stage2",
    label: "Stage 2",
    pct: 20,
    color: "#b87a4a",
    description: "A more sophisticated, oracle-based reward system",
  },
  {
    id: "stage3",
    label: "Stage 3",
    pct: 40,
    color: "#6faf5a",
    description: `Rewards for holders who lock ${SYMBOL}`,
  },
  {
    id: "liquidity",
    label: "Liquidity",
    pct: 15,
    color: "#3db8b0",
    description: "DEX pools and a reserve for market makers",
  },
  {
    id: "team",
    label: "Team",
    pct: 10,
    color: "#5b5fc7",
    description: "No unlocks for 1 year, then linear over 3 years",
  },
  {
    id: "creators",
    label: "Creators",
    pct: 5,
    color: "#9b5bb5",
    description: "Rewards for content creators",
  },
];

function CopyBtn({ value }) {
  const [ok, setOk] = useState(false);
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
        } catch {  }
      }}
    >
      {ok ? "✓" : "⧉"}
    </button>
  );
}

export default function CapeToken() {
  const [active, setActive] = useState(null);
  const selected = SEGMENTS.find((s) => s.id === active);

  return (
    <main className="container cape">
      <div className="cape__top">
        <section className="cape__intro">
          <div className="cape__brand">
            <h1 className="cape__title">
              <img src={capeTitle} alt="CAPE TOKEN" />
              <span className="cape__badge" aria-hidden="true">
                <Icon name="coin" size={22} />
              </span>
            </h1>
            <p className="cape__name muted">name: Capsule Token</p>
          </div>

          <h2 className="cape__section-title">Key details</h2>
          <dl className="cape__details panel">
            <div>
              <dt>Network:</dt>
              <dd>Elysium</dd>
            </div>
            <div>
              <dt>CA:</dt>
              <dd className="cape__ca">
                <span title={CA}>{CA.slice(0, 10)}…{CA.slice(-4)}</span>
                <CopyBtn value={CA} />
              </dd>
            </div>
            <div>
              <dt>Total supply:</dt>
              <dd>
                {TOTAL_SUPPLY} {SYMBOL}
              </dd>
            </div>
          </dl>
        </section>

        <aside className="panel cape__chart">
          <p className="cape__supply">
            {TOTAL_SUPPLY} {SYMBOL}
          </p>
          <div className="cape__segments" role="list">
            {SEGMENTS.map((s) => {
              const dimmed = active && active !== s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  role="listitem"
                  className={`cape__seg ${active === s.id ? "is-active" : ""} ${dimmed ? "is-dim" : ""}`}
                  style={{ background: s.color, flex: s.pct }}
                  aria-pressed={active === s.id}
                  title={`${s.label} — ${s.pct}%`}
                  onClick={() => setActive((cur) => (cur === s.id ? null : s.id))}
                />
              );
            })}
          </div>

          <div className={`cape__pill ${selected ? "cape__pill--active" : ""}`}>
            {selected ? `${selected.label} - ${selected.pct}%` : "Click a segment to see details"}
          </div>

          {selected && <p className="cape__seg-desc muted">{selected.description}</p>}
        </aside>
      </div>

      <section className="cape__alloc">
        <h2 className="cape__section-title">Allocation</h2>
        <table className="cape__table">
          <tbody>
            {SEGMENTS.map((s) => (
              <tr
                key={s.id}
                className={active === s.id ? "is-active" : ""}
                onClick={() => setActive((cur) => (cur === s.id ? null : s.id))}
              >
                <td>{s.label}:</td>
                <td>{s.pct}%</td>
                <td>{s.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="cape__stages">
        <article>
          <h3>Stage 1: Free to Use</h3>
          <p className="muted">
            Every interaction with the project is free. Verify tokens and do whatever you need with them at 0% fees.
            You even earn {SYMBOL} for every action you take.
          </p>
        </article>
        <article>
          <h3>Stage 2: Utility and Liquidity</h3>
          <p className="muted">
            As the app gains traction, every request requires holding a small amount of {SYMBOL}. The token gets real,
            live liquidity, and active users simply hold it instead of buying and selling every time they use the app.
            Action rewards continue, but now they are connected to an oracle. {SYMBOL} is distributed in proportion to
            the real value you lock, burn, or send to vesting. Tying rewards to real value also strengthens anti-sybil
            protection: splitting activity across many wallets no longer pays off, because rewards depend on the actual
            amount committed, not on the number of accounts.
          </p>
        </article>
        <article>
          <h3>Stage 3: Ecosystem Growth</h3>
          <p className="muted">
            As the ecosystem grows, we introduce permanent token rankings by category, along with Sponsored Tokens and
            Sponsored Blog Posts. Any community can pay to tell everyone about its project, in a fully decentralized way.
            None of this revenue goes to the team. It is distributed to {SYMBOL} holders whose tokens have been locked
            for more than six months, in proportion to the amount locked.
          </p>
          <p className="muted">
            The result: communities get a convenient signaling tool that is effectively free, and they can also earn from
            the {SYMBOL} they originally received at no cost.
          </p>
        </article>
      </section>
    </main>
  );
}