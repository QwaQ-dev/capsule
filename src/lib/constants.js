export const PAGES = {
  Lock: { title: "Create lock", cta: "Lock" },
  Vest: { title: "Create vesting", cta: "Vest" },
  Burn: { title: "Burn assets", cta: "Burn" },
};

// Order matches the home screen layout (2-column grid, last item may span full width)
export const TOKEN_ACTIONS = [
  { id: "lock", label: "Lock", icon: "lock" },
  { id: "vest", label: "Vest", icon: "trend" },
  { id: "burn", label: "Burn", icon: "flame", tone: "burn" },
  { id: "multisend", label: "Multisend", icon: "radio", tone: "verify" },
  { id: "verificate", label: "Verificate", icon: "clock", tone: "wide" },
];

export const NFT_ACTIONS = [
  { id: "lock", label: "Lock", icon: "lock" },
  { id: "burn", label: "Burn", icon: "flame", tone: "burn" },
  { id: "soon", label: "More soon...", icon: "clock", tone: "wide", disabled: true },
];

export const ABOUT_ACTIONS = [
  { id: "roadmap", label: "Roadmap", icon: "map", tone: "wide" },
  { id: "caps", label: "$CAPS token", icon: "coin", tone: "wide" },
  { id: "team", label: "Team", icon: "user", tone: "wide" },
];

export const BURN_ADDRESS = "0x000…dEaD";
export const TEAM_URL = "https://cape4labs.github.io/"; 

export const addDays = (d, n) => {
  if (!d) return "";
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x.toISOString().slice(0, 10);
};