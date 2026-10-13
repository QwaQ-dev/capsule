import { useEffect, useRef, useState } from "react";
import { useChains, useConnect, useConnection, useConnectors, useDisconnect, useSwitchChain } from "wagmi";

const short = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export default function WalletButton() {
  const { address, isConnected, chain } = useConnection();
  const { mutate: connect, isPending, error, variables } = useConnect();
  const connectors = useConnectors();
  const { mutate: disconnect } = useDisconnect();
  const { mutate: switchChain } = useSwitchChain();
  const chains = useChains();
  const [open, setOpen] = useState(false);
  const root = useRef(null);

  // Close menu on outside click
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (root.current && !root.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // Unique connectors by id (avoid duplicate "Injected" entries)
  const list = [];
  const seen = new Set();
  for (const c of connectors) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    list.push(c);
  }

  if (!isConnected) {
    return (
      <div className="wallet" ref={root}>
        <button
          type="button"
          className="btn btn--outline"
          disabled={isPending}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          {isPending ? "…" : "Connect"}
        </button>
        {open && (
          <div className="wallet__menu" role="menu">
            {list.length === 0 && <small className="muted">No wallet found</small>}
            {list.map((c) => (
              <button
                key={c.uid}
                type="button"
                className="wallet__item"
                role="menuitem"
                disabled={isPending}
                onClick={() => {
                  connect({ connector: c });
                  setOpen(false);
                }}
              >
                <span>{c.name}</span>
                {isPending && variables?.connector?.uid === c.uid && <small className="muted">…</small>}
              </button>
            ))}
          </div>
        )}
        {error && (
          <small className="wallet__error error" role="alert">
            {error.shortMessage ?? error.message}
          </small>
        )}
      </div>
    );
  }

  if (!chain) {
    return (
      <button type="button" className="btn btn--outline" onClick={() => switchChain({ chainId: chains[0].id })}>
        Switch network
      </button>
    );
  }

  return (
    <div className="wallet" ref={root}>
      <button type="button" className="btn btn--outline" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {short(address)}
      </button>
      {open && (
        <div className="wallet__menu" role="menu">
          <small className="muted">{chain.name}</small>
          <button
            type="button"
            className="wallet__item"
            role="menuitem"
            onClick={() => {
              disconnect();
              setOpen(false);
            }}
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}