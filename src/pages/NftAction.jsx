import { useState } from "react";
import { useConnection } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { erc721Abi, isAddress } from "viem";
import Icon from "../components/Icon";
import ActionLayout, { SummaryCard } from "../components/ActionLayout";
import { Field, DateInput, SelectInput, Checkbox } from "../components/Field";
import { PAGES } from "../lib/constants";
import { CONTRACTS, BURN_METHODS, DAY, routerAbi, toUnix, isFuture } from "../lib/contracts";
import { useTx } from "../hooks/useTx";
import { useOwnedNfts } from "../hooks/useOwnedNfts";
import { publicClient as client } from "../lib/wagmi";

function NftPicker({ ids, selected, onToggle }) {
  return (
    <div className="nft-grid">
      {ids.map((raw, i) => {
        const id = String(raw);
        const on = selected.includes(id);
        return (
          <button type="button" key={id} aria-pressed={on} className={`nft nft--${i % 4} ${on ? "is-selected" : ""}`} onClick={() => onToggle(id)}>
            {on && <span className="nft__check"><Icon name="check" size={10} /></span>}
            <Icon name="cube" size={16} />
            <span>#{id}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function NftAction({ tab, base }) {
  const { address, isConnected } = useConnection();
  const [collection, setCollection] = useState("");
  const [selected, setSelected] = useState([]); 
  const [date, setDate] = useState("");
  const [interval, setIntervalDays] = useState("");
  const [perBatch, setPerBatch] = useState("");
  const [method, setMethod] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [progress, setProgress] = useState("");
  const tx = useTx();
  const queryClient = useQueryClient();
  const nfts = useOwnedNfts(collection);

  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const dateOk = isFuture(date);
  const feeRow = ["Fee:", "gas only"]; 

  const ready = isConnected && isAddress(collection) && selected.length > 0 && (
    tab === "Lock" ? dateOk : tab === "Vest" ? dateOk && Number(interval) > 0 && Number(perBatch) > 0 : method && agreed
  );
  const rows = {
    Lock: [["Unlocks:", date || "XX.XX.XXXX"], feeRow],
    Vest: [["Starts:", date || "XX.XX.XXXX"], ["Release:", `${perBatch || 1}/${interval || "XX"} Days`], feeRow],
    Burn: [["Destination:", method ? (BURN_METHODS[method] ? "Burned" : "Vault, 1000 years") : "—"], feeRow],
  }[tab];

  const submit = async () => {
    const perBatchN = Math.max(1, Math.floor(Number(perBatch) || 1));
    const unlockAt = (i) => toUnix(date) + BigInt(Math.floor(i / perBatchN)) * BigInt(Math.floor(Number(interval))) * DAY;
    try {
      for (const [i, label] of selected.entries()) {
        setProgress(`${i + 1}/${selected.length}`);
        const id = BigInt(label);
        const read = (functionName, args) => client.readContract({ address: collection, abi: erc721Abi, functionName, args });
        const [approved, approvedAll] = await Promise.all([read("getApproved", [id]), read("isApprovedForAll", [address, CONTRACTS.router])]);
        if (approved.toLowerCase() !== CONTRACTS.router.toLowerCase() && !approvedAll) {
          await tx.send({ address: collection, abi: erc721Abi, functionName: "approve", args: [CONTRACTS.router, id] });
        }
        const call = tab === "Burn"
          ? { functionName: "disposeERC721", args: [collection, id, BURN_METHODS[method]] }
          : { functionName: "lock", args: [collection, id, address, tab === "Lock" ? toUnix(date) : unlockAt(i)] };
        await tx.send({ address: CONTRACTS.router, abi: routerAbi, ...call });
      }
      setSelected([]);
    } catch { /* tx.error */ }
    queryClient.invalidateQueries({ queryKey: ["nfts"] }); 
    setProgress("");
  };

  let nftsStatus = "";
  if (!isConnected) nftsStatus = "Connect wallet to see your NFTs";
  else if (!isAddress(collection)) nftsStatus = "Enter collection address";
  else if (nfts.error) nftsStatus = nfts.error.message;
  else if (nfts.isPending) nftsStatus = "Loading NFTs...";
  else if (!nfts.data.ids.length) nftsStatus = "You have no NFTs from this collection";

  const dateError = date && !dateOk && <small className="error" role="alert">Date must be at future</small>;

  const form = (
    <>
      <Field label="Collection" hint={nfts.data?.name ?? "Collection name"} onchain="read">
        <input value={collection} placeholder="0x… collection address"
          onChange={(e) => { setCollection(e.target.value.trim()); setSelected([]); }} />
      </Field>
      <Field label="NFTs" onchain="read">
        <input readOnly value={selected.map((id) => `#${id}`).join(", ")} placeholder="Select NFTs below" />
      </Field>
      {nftsStatus
        ? <p className="nft-empty muted" role={nfts.error ? "alert" : undefined}>{nftsStatus}</p>
        : <NftPicker ids={nfts.data.ids} selected={selected} onToggle={toggle} />}
      {tab === "Lock" && <><Field label="Unlock date"><DateInput value={date} onChange={setDate} /></Field>{dateError}</>}
      {tab === "Vest" && (
        <>
          <Field label="Start date"><DateInput value={date} onChange={setDate} /></Field>
          {dateError}
          <div className="pair">
            <Field label="Interval | days"><input type="number" min="1" value={interval} onChange={(e) => setIntervalDays(e.target.value)} /></Field>
            <Field label="NFTs per batch"><input type="number" min="1" value={perBatch} onChange={(e) => setPerBatch(e.target.value)} /></Field>
          </div>
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
    <ActionLayout label="NFT" icon="cube" tab={tab} base={base} short={tab === "Burn"} form={form}
      summary={<SummaryCard icon="cube" headline={`${selected.length} NFT`} rows={rows}
        cta={progress ? `Sending ${progress}…` : PAGES[tab].cta} disabled={!ready || !!progress}
        onClick={submit} onchain="write" />} />
  );
}