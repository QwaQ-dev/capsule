import SocialLinks from "../components/SocialLinks.jsx";
import stage1 from "../assets/roadmap/stage1.png";
import stage2 from "../assets/roadmap/stage2.png";
import stage3 from "../assets/roadmap/stage3.png";

const STAGES = [
  {
    id: 1,
    img: stage1,
    alt: "Stage 1",
    items: [
      "Post your memes at any point during the competition and let the community decide what gets adopted.",
      "Each concept should have its own name and ticker.",
    ],
  },
  {
    id: 2,
    img: stage2,
    alt: "Stage 2",
    items: [
      "Post your memes at any point during the competition and let the community decide what gets adopted.",
      "Each concept should have its own name and ticker.",
    ],
  },
  {
    id: 3,
    img: stage3,
    alt: "Stage 3",
    items: [
      "Post your memes at any point during the competition and let the community decide what gets adopted.",
      "Each concept should have its own name and ticker.",
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