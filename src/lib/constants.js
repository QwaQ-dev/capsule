export const PAGES = {
  Lock: { title: "Create lock", cta: "Lock" },
  Vest: { title: "Create vesting", cta: "Vest" },
  Burn: { title: "Burn assets", cta: "Burn" },
};
export const TOKEN_ACTIONS = [
  { id: "lock", label: "Lock", icon: "lock" },
  { id: "vest", label: "Vest", icon: "trend" },
  { id: "burn", label: "Burn", icon: "flame", tone: "burn" },
  { id: "verificate", label: "Verificate", icon: "coin", tone: "verify" },
  { id: "multisend", label: "Multisend", icon: "radio", tone: "verify" },
];
export const NFT_ACTIONS = TOKEN_ACTIONS.slice(0, 3);
export const BURN_ADDRESS = "0x000…dEaD";

export const addDays = (d, n) => {
  if (!d) return "";
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x.toISOString().slice(0, 10);
};