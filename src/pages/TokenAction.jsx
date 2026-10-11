import { useState } from "react";
import { useConnection } from "wagmi";
import { erc20Abi, formatUnits, isAddress, parseUnits } from "viem";
import ActionLayout, { SummaryCard } from "../components/ActionLayout";
import { Field, DateInput, SelectInput, Checkbox } from "../components/Field";
import { PAGES, addDays } from "../lib/constants";
import { CONTRACTS, BURN_METHODS, routerAbi, toUnix, days, isFuture } from "../lib/contracts";
import { useTokenInfo } from "../hooks/useTokenInfo";
import { useTx } from "../hooks/useTx";

export default function TokenAction({ tab, base }) {
  const { address, isConnected } = useConnection();
  const [token, setToken] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [cliff, setCliff] = useState("");
  const [duration, setDuration] = useState("");
  const [method, setMethod] = useState("");
  const [agreed, setAgreed] = useState(false);
  const tx = useTx();

  const info = useTokenInfo(token); // [CONTRACT READ] symbol, decimals, balanceOf
  const decimals = info.decimals ?? 18;
  const symbol = info.symbol ?? "TOKEN";

  let units = 0n;
  try { units = amount ? parseUnits(amount, decimals) : 0n; } catch {  }
  const enough = info.balance == null || units <= info.balance;
  const dateOk = isFuture(date);
  const cliffOk = Number(cliff || 0) <= Number(duration || 0);

  const feeRow = ["Fee:", "gas only"]; 
  const ready = isConnected && isAddress(token) && units > 0n && enough && (
    tab === "Lock" ? dateOk : tab === "Vest" ? dateOk && Number(duration) > 0 && cliffOk : method && agreed
  );
  const rows = {
    Lock: [["Unlocks:", date || "XX.XX.XXXX"], feeRow],
    Vest: [
      ["Unlocks:", addDays(date, Number(cliff || 0) + Number(duration || 0)) || "XX.XX.XXXX"],
      ["Duration:", `${duration || "XXX"} Days`], feeRow,
    ],
    Burn: [["Destination:", method ? (BURN_METHODS[method] ? "Burned" : "Vault, 1000 years") : "—"], feeRow],
  }[tab];

  const submit = async () => {
    const call = {
      Lock: ["createVesting", [token, units, address, toUnix(date), 0n, 0n]],
      Vest: ["createVesting", [token, units, address, toUnix(date), days(duration), days(cliff)]],
      Burn: ["disposeERC20", [token, units, BURN_METHODS[method]]],
    }[tab];
    try {
      if (info.allowance == null || info.allowance < units) {
        await tx.send({ address: token, abi: erc20Abi, functionName: "approve", args: [CONTRACTS.router, units] });
      }
      await tx.send({ address: CONTRACTS.router, abi: routerAbi, functionName: call[0], args: call[1] });
    } catch { /* tx.error */ }
  };

  const dateError = date && !dateOk && <small className="error" role="alert">Enter valid date</small>;

  const form = (
    <>
      <Field label="Token" hint={info.symbol ?? "Token name"} onchain="read">
        <input value={token} onChange={(e) => setToken(e.target.value.trim())} placeholder="0x… token address" />
      </Field>
      <Field label="Amount" aside={info.balance != null ? `Balance ${formatUnits(info.balance, decimals)}` : "Balance —"} onchain="read">
        <div className="input-wrap">
          <input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <button type="button" className="max" disabled={info.balance == null}
            onClick={() => setAmount(formatUnits(info.balance, decimals))}>Max</button>
        </div>
      </Field>
      {!enough && <small className="error" role="alert">Not enough tokens</small>}
      {tab === "Lock" && <><Field label="Unlock date"><DateInput value={date} onChange={setDate} /></Field>{dateError}</>}
      {tab === "Vest" && (
        <>
          <Field label="Start date"><DateInput value={date} onChange={setDate} /></Field>
          {dateError}
          <div className="pair">
            <Field label="Cliff | days"><input type="number" min="0" value={cliff} onChange={(e) => setCliff(e.target.value)} /></Field>
            <Field label="Duration | days"><input type="number" min="1" value={duration} onChange={(e) => setDuration(e.target.value)} /></Field>
          </div>
          {!cliffOk && <small className="error" role="alert">Cliff cannot be more than Duration</small>}
        </>
      )}
      {tab === "Burn" && (
        <>
          <Field label="Burn method">
            <SelectInput value={method} onChange={setMethod} options={Object.keys(BURN_METHODS)} placeholder="Select method" />
          </Field>
          <Checkbox checked={agreed} onChange={setAgreed}>I confirm this action</Checkbox>
        </>
      )}
      {tx.error && <small className="error" role="alert">{tx.error}</small>}
    </>
  );

  return (
    <ActionLayout label="Tokens" icon="coin" tab={tab} base={base} short={tab === "Burn"} form={form}
      summary={<SummaryCard icon="coin" headline={`${amount || 0} ${symbol}`} rows={rows}
        cta={tx.pending ? "Confirm in wallet…" : PAGES[tab].cta} disabled={!ready || tx.pending}
        onClick={submit} onchain="write" />} />
  );
}