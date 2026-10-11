import { useMemo, useState } from "react";
import { erc20Abi, formatUnits, isAddress } from "viem";
import { useConnection } from "wagmi";
import Icon from "../components/Icon";
import { PageShell, SummaryCard } from "../components/ActionLayout";
import { Field, Checkbox } from "../components/Field";
import { parseRecipients, chunk, SAMPLE_CSV, MAX_ROWS } from "../lib/multisend";
import { CONTRACTS, routerAbi } from "../lib/contracts";
import { useTokenInfo } from "../hooks/useTokenInfo";
import { useTx } from "../hooks/useTx";


function downloadSample() {
  const blob = new Blob([SAMPLE_CSV + "\n"], { type: "text/csv" });
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "sample.csv" });
  a.click();
  URL.revokeObjectURL(a.href);
}

function Issues({ items, tone }) {
  if (!items.length) return null;
  return (
    <ul className={`issues issues--${tone}`} role={tone === "error" ? "alert" : undefined}>
      {items.slice(0, 5).map((e, i) => (
        <li key={i}>{e.line ? `Строка ${e.line}: ` : ""}{e.message}</li>
      ))}
      {items.length > 5 && <li>... more {items.length - 5}</li>}
    </ul>
  );
}

export default function Multisend() {
  const [token, setToken] = useState("");
  const [source, setSource] = useState(null); // { name, text }
  const [confirmed, setConfirmed] = useState(false);
  const [progress, setProgress] = useState("");
  const { address, isConnected } = useConnection();
  const tx = useTx();
  const info = useTokenInfo(token); // [CONTRACT READ] symbol, decimals, balanceOf
  const decimals = info.decimals ?? 18;
  const symbol = info.symbol ?? "TOKEN";

  const result = useMemo(
    () => (source ? parseRecipients(source.text, source.name, decimals, [address, CONTRACTS.router]) : null),
    [source, decimals, address]
  );
  const batches = result?.ok ? chunk(result.rows).length : 0;

  const onFile = async (e) => {
    const f = e.target.files[0];
    if (f) setSource({ name: f.name, text: await f.text() });
    e.target.value = ""; 
  };

  const onStart = async () => {
    const parts = chunk(result.rows);
    try {
      setProgress("approve");
      if (info.allowance == null || info.allowance < result.total) {
        await tx.send({ address: token, abi: erc20Abi, functionName: "approve", args: [CONTRACTS.router, result.total] });
      }
      for (const [i, part] of parts.entries()) {
        setProgress(`${i + 1}/${parts.length}`);
        await tx.send({
          address: CONTRACTS.router, abi: routerAbi, functionName: "distribute",
          args: [token, part.map((r) => r.address), part.map((r) => r.units)],
        });
      }
    } catch { /* tx.error */ }
    setProgress("");
  };

  const form = (
    <>
      <Field label="Token CA:" hint={info.symbol} onchain="read"><input value={token} onChange={(e) => setToken(e.target.value)} placeholder="0x…" /></Field>
      <div className="pair pair--files">
        <div className="field">
          <span className="field__label">Attach a file (csv/json)</span>
          <label className="drop">
            <input type="file" accept=".csv,.json" hidden onChange={onFile} />
            <Icon name="file" size={20} />
            {source && <small className="drop__name">{source.name}</small>}
          </label>
        </div>
        <div className="field">
          <span className="field__label">Download sample</span>
          <button type="button" className="sample" onClick={downloadSample}>
            <Icon name="download" size={16} /> Sample.csv
          </button>
        </div>
      </div>
      {result && <Issues items={result.errors} tone="error" />}
      {result?.ok && <Issues items={result.warnings} tone="warn" />}
      {tx.error && <small className="error" role="alert">{tx.error}</small>}
      <Checkbox checked={confirmed} onChange={setConfirmed}>I confirm this action</Checkbox>
    </>
  );

  return (
    <PageShell label="Multisend" icon="radio" title="Multisend">
      <div className="lock__grid">
        <form className="panel form form--short" onSubmit={(e) => e.preventDefault()}>{form}</form>
        <SummaryCard
          rows={[
            ["Total adresses:", result?.ok ? result.rows.length : "—"],
            ["Total amount:", result?.ok ? `${formatUnits(result.total, decimals)} ${symbol}` : "—"],
            ["Transactions:", batches || "—"],
            ["Fee:", "gas only"],
          ]}
          cta={progress ? `Sending ${progress}…` : "Start"} onClick={onStart} onchain="write"
          disabled={!isConnected || !isAddress(token) || !result?.ok || !confirmed || !!progress} />
      </div>
    </PageShell>
  );
}