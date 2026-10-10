import { useNavigate } from "react-router-dom";
import { useConnection } from "wagmi";
import Icon from "../components/Icon";
import { TOKEN_ACTIONS, NFT_ACTIONS } from "../lib/constants";
import { usePositions } from "../hooks/usePositions";
import { elysiumTestnet } from "../lib/wagmi";

const EXPLORER = elysiumTestnet.blockExplorers.default.url;

function ActionGroup({ title, standard, actions, onPick }) {
  return (
    <section className="group">
      <div className="group__head">
        <span className="chip">{title}</span>
        <small className="muted">{standard}</small>
      </div>
      <div className="group__actions">
        {actions.map((a) => (
          <button key={a.id} className={`tile ${a.tone ? `tile--${a.tone}` : ""}`} onClick={() => onPick(title, a.id)}>
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
  const { data, isPending, isFetching, error } = usePositions(); // [CONTRACT READ] события AssetRouter

  let status = "";
  if (!isConnected) status = "Connect wallet to see your positions";
  else if (error) status = "Не удалось загрузить позиции";
  else if (isPending && isFetching) status = "Loading…";
  else if (!data?.length) status = "No positions yet";

  return (
    <section className="positions-block" data-onchain="read">
      <h2 className="positions">Your Positions</h2>
      {status ? (
        <p className="positions__status muted" role={error ? "alert" : undefined}>{status}</p>
      ) : (
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Asset</th><th>Action</th><th>Quantity</th><th>Start date</th><th>End date</th><th />
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
                  <td><a className="explorer" href={`${EXPLORER}/tx/${p.hash}`} target="_blank" rel="noreferrer">Check in Explorer ›</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const onPick = (group, id) => {
    if (["verificate", "multisend"].includes(id)) navigate(`/${id}`);
    else if (["lock", "vest", "burn"].includes(id)) navigate(`/${group === "Tokens" ? "tokens" : "nft"}/${id}`);
  };
  return (
    <main className="home">
      <div className="home__inner">
        <section className="hero">
          <h1 className="hero__title">
            Check any token.<br />Lock yours.<br /><span>Earn their trust.</span>
          </h1>
          {/* маскот: положи файл в public/mascot.png */}
          <img className="hero__mascot" src="/mascot.png" alt="" onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
        </section>

        <div className="groups">
          <ActionGroup title="Tokens" standard="ERC-20" actions={TOKEN_ACTIONS} onPick={onPick} />
          <ActionGroup title="NFTs" standard="ERC-721" actions={NFT_ACTIONS} onPick={onPick} />
        </div>

        <Positions />
      </div>
    </main>
  );
}