import SocialLinks from "../components/SocialLinks.jsx";
import stage1 from "../assets/roadmap/stage1.png";
import stage2 from "../assets/roadmap/stage2.png";
import stage3 from "../assets/roadmap/stage3.png";

const SYMBOL = "$CAPS";

const STAGES = [
  {
    id: 1,
    img: stage1,
    alt: "Stage 1",
    title: "Free to Use",
    items: [
      `Launch the app: free token verification, 0% fees.`,
      `${SYMBOL} rewards for every action.`,
      'Fixed supply from day one.',
      'Full documentation: how the app, rewards, and contracts work.'
    ],
  },
  {
    id: 2,
    img: stage2,
    alt: "Stage 2",
    title: "Utility and Liquidity",
    items: [
      `Hold-to-use access: a small ${SYMBOL} balance required per request.`,
      `Live liquidity for ${SYMBOL}.`,
      'Oracle-based rewards for locked, burned, and vested value.',
      'Anti-sybil protection built on the oracle.',
      'Crowdsourced audit: open review of the contracts by the community.',
      'Embeddable tools: add locks and vesting directly to your own website or app.'
    ],
  },
  {
    id: 3,
    img: stage3,
    alt: "Stage 3",
    title: "Ecosystem Growth",
    items: [
      "Permanent token rankings by category.",
      `Sponsored Tokens and Sponsored Blog Posts.`,
      `Sponsored revenue shared with holders locked 6+ months, in proportion to the amount locked.`,
    ],
  },
];

export default function Roadmap() {
  return (
    <main className="container roadmap">
      <h1 className="roadmap__title">ROADMAP</h1>

      <div className="roadmap__list">
        {STAGES.map((s) => (
          <section key={s.id} className="roadmap__stage">
            <div className="roadmap__head">
              <img src={s.img} alt={s.alt} />
              <span className="roadmap__subtitle">{s.title}</span>
              <span className="roadmap__dash" aria-hidden="true" />
            </div>
            <ul>
              {s.items.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}