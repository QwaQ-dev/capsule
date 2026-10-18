
import { Link, NavLink } from "react-router-dom";
import Icon from "./Icon";
import { PAGES_NFT, PAGES } from "../lib/constants";
import { elysiumTestnet } from "../lib/wagmi";

const EXPLORER = elysiumTestnet.blockExplorers.default.url;

export function SummaryCard({
  icon,
  visual,
  headline,
  rows = [],
  cta,
  disabled,
  onClick,
  onchain,
  success,
}) {
  return (
    <aside className={`panel_sum summary ${icon || visual ? "" : "summary--bare"}`}>
      <h3 className="summary__head">Summary</h3>

      <div className="summary__body">
        {visual}
        {icon && (
          <span className="summary__icon">
            <Icon name={icon} size={32} />
          </span>
        )}

        {headline && <p className="summary__amount">{headline}</p>}

        <dl className="rows">
          {rows.map(([k, v, chain]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd data-onchain={chain}>{v}</dd>
            </div>
          ))}
        </dl>

        {success && (
          <div className="tx-success" role="status">
            <span className="tx-success__title">
              ✓ {success.text}
            </span>
            <a
              className="explorer"
              href={`${EXPLORER}/tx/${success.hash}`}
              target="_blank"
              rel="noreferrer"
            >
              Check in Explorer ›
            </a>
          </div>
        )}

        {cta && (
          <button
            type="button"
            className="btn btn--outline"
            disabled={disabled}
            onClick={onClick}
            data-onchain={onchain}
          >
            {cta}
          </button>
        )}
      </div>
    </aside>
  );
}

export function PageShell({ label, icon, title, tabs, children }) {
  return (
    <main className="container lock">
      <nav className="subnav">
        <span className="subnav__title">
          <Icon name={icon} size={16} /> {label}
        </span>
        {tabs}
      </nav>

      <Link to="/" className="back">
        <span aria-hidden="true">‹</span> {title}
      </Link>

      {children}
    </main>
  );
}

export default function ActionLayout({
  label,
  icon,
  tab,
  base,
  short,
  form,
  summary,
  type = "token",
}) {
  const pages = type === "nft" ? PAGES_NFT : PAGES;
  const currentPage = pages[tab];

  const tabs = (
    <div className="tabs">
      {Object.keys(pages).map((t) => (
        <NavLink
          key={t}
          to={`${base}/${t.toLowerCase()}`}
          replace
          className={`tab ${tab === t ? "is-active" : ""}`}
        >
          {t}
        </NavLink>
      ))}
    </div>
  );

  return (
    <PageShell
      label={label}
      icon={icon}
      title={currentPage?.title ?? tab}
      tabs={tabs}
    >
      <div className="lock__grid">
        <form
          className={`panel form ${short ? "form--short" : ""}`}
          onSubmit={(e) => e.preventDefault()}
        >
          {form}
        </form>

        {summary}
      </div>
    </PageShell>
  );
}
