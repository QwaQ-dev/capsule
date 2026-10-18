import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useConnection } from "wagmi";
import Icon from "../components/Icon";
import { Checkbox } from "../components/Field";
import { TOKEN_ACTIONS, NFT_ACTIONS, ABOUT_ACTIONS, TEAM_URL } from "../lib/constants";
import { usePositions } from "../hooks/usePositions";
import { useTx } from "../hooks/useTx";
import { CONTRACTS, routerAbi } from "../lib/contracts";
import { elysiumTestnet } from "../lib/wagmi";

const EXPLORER = elysiumTestnet.blockExplorers.default.url;

function ActionGroup({ title, standard, actions, onPick, stacked }) {
  return (
    <section className={`group ${stacked ? "group--stacked" : ""}`}>
      <div className="group__head">
        <span className="chip">{title}</span>
        {standard && <small className="muted">{standard}</small>}
      </div>
      <div className={`group__actions ${stacked ? "group__actions--stack" : ""}`}>
        {actions.map((a) => (
          <button
            key={a.id}
            type="button"
            className={`tile ${a.tone ? `tile--${a.tone}` : ""} ${a.disabled ? "tile--disabled" : ""}`}
            disabled={a.disabled}
            onClick={() => !a.disabled && onPick(title, a.id)}
          >
            <Icon name={a.icon} />
            <span>{a.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function Positions() {
  const { isConnected } = useConnection();
  const { data, isPending, isFetching, error } = usePositions();
  const tx = useTx();
  const queryClient = useQueryClient();
  const [claiming, setClaiming] = useState("");
  // Whether the user wants the optional action reward when claiming
  const [wantsReward, setWantsReward] = useState(true);

  const claim = async (p) => {
    setClaiming(p.key);
    try {
      // Append wantsReward to the claim args (releaseVesting / release overloads)
      await tx.send(
        {
          address: CONTRACTS.router,
          abi: routerAbi,
          functionName: p.claim.fn,
          args: [...p.claim.args, wantsReward],
        },
        { final: true }
      );
      await queryClient.invalidateQueries({ queryKey: ["positions"] });
    } catch { /* error is stored in tx.error */ }
    setClaiming("");
  };

  let status = "";
  if (!isConnected) status = "Connect wallet to see your positions";
  else if (error) status = "Cannot load positions";
  else if (isPending && isFetching) status = "Loading…";
  else if (!data?.length) status = "No positions yet";

  return (
    <section className="positions-block" data-onchain="read">
      <h2 className="positions">Your Positions</h2>
      {status ? (
        <p className="positions__status muted" role={error ? "alert" : undefined}>{status}</p>
      ) : (
        <>
          <Checkbox checked={wantsReward} onChange={setWantsReward}>
            Receive action reward when claiming
          </Checkbox>
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Asset</th><th>Action</th><th>Quantity</th><th>Start date</th><th>End date</th><th /><th />
                </tr>
              </thead>
              <tbody>
                {data.map((p) => (
                  <tr key={p.key}>
                    <td>{p.asset}</td>
                    <td>{p.action}</td>
                    <td>{p.quantity}</td>
                    <td>{p.start}</td>
                    <td>{p.end}</td>
                    <td>
                      {p.claim && (
                        <button className="btn btn--outline btn--sm" data-onchain="write" disabled={!!claiming} onClick={() => claim(p)}>
                          {claiming === p.key ? "Claiming…" : "Claim"}
                        </button>
                      )}
                    </td>
                    <td><a className="explorer" href={`${EXPLORER}/tx/${p.hash}`} target="_blank" rel="noreferrer">Check in Explorer ›</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {tx.success && (
        <div className="tx-success" role="status">
          <span className="tx-success__title">✓ Claimed</span>
          <a className="explorer" href={`${EXPLORER}/tx/${tx.hash}`} target="_blank" rel="noreferrer">
            Check in Explorer ›
          </a>
        </div>
      )}
      {tx.error && <small className="error" role="alert">{tx.error}</small>}
    </section>
  );
}

export default function Home() {
  const navigate = useNavigate();

  const onPick = (group, id) => {
    if (["verificate", "multisend"].includes(id)) {
      navigate(`/${id}`);
      return;
    }
    if (["lock", "vest", "burn"].includes(id)) {
      navigate(`/${group === "Tokens" ? "tokens" : "nft"}/${id}`);
      return;
    }
    if (group === "About us") {
      if (id === "caps") navigate("/cape");
      if (id === "roadmap") navigate("/roadmap");
      if (id === "team") window.open(TEAM_URL, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <main className="home">
      <div className="home__inner">
        <section className="hero">
          <h1 className="hero__title">
            Check any token.<br />Lock yours.<br /><span>Earn their trust.</span>
          </h1>
          <img className="hero__mascot" src="/mascot.png" alt="" onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
        </section>

        <div className="groups">
          <ActionGroup title="Tokens" standard="ERC-20" actions={TOKEN_ACTIONS} onPick={onPick} />
          <ActionGroup title="NFTs" standard="ERC-721" actions={NFT_ACTIONS} onPick={onPick} />
          <ActionGroup title="About us" actions={ABOUT_ACTIONS} onPick={onPick} stacked />
        </div>

        <Positions />
      </div>
    </main>
  );
}