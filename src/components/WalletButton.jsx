import { useState } from "react";
import { useChains, useConnect, useConnection, useConnectors, useDisconnect, useSwitchChain } from "wagmi";
import Icon from "./Icon";

const short = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export default function WalletButton() {
  const { address, isConnected, chain } = useConnection();
  const connect = useConnect();
  const connectors = useConnectors();
  const disconnect = useDisconnect();
  const switchChain = useSwitchChain();
  const chains = useChains();
  const [open, setOpen] = useState(false);

  if (!isConnected) {
    return (
      <button className="btn btn--outline" disabled={connect.isPending} title={connect.error?.shortMessage}
        onClick={() => connect.mutate({ connector: connectors[0] })}>
        {connect.isPending ? "Connecting…" : "Connect wallet"} <Icon name="plus" size={14} />
      </button>
    );
  }
  if (!chain) {
    return (
      <button className="btn btn--outline" onClick={() => switchChain.mutate({ chainId: chains[0].id })}>
        Wrong network — switch
      </button>
    );
  }
  return (
    <div className="wallet">
      <button className="btn btn--outline" aria-expanded={open} onClick={() => setOpen((o) => !o)}>{short(address)}</button>
      {open && (
        <div className="wallet__menu">
          <small className="muted">{chain.name}</small>
          <button className="btn btn--outline" onClick={() => { disconnect.mutate(); setOpen(false); }}>Disconnect</button>
        </div>
      )}
    </div>
  );
}