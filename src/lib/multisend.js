import { isAddress, parseUnits } from "viem";

export const MAX_ROWS = 5000; 
export const BATCH_SIZE = 200;

export const SAMPLE_CSV = [
  "address,amount",
  "0x1111111111111111111111111111111111111111,100",
  "0x2222222222222222222222222222222222222222,250.5",
  "0x3333333333333333333333333333333333333333,0.75",
].join("\n");

const detectDelimiter = (line) =>
  [",", ";", "\t"].map((d) => [d, line.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];

const clean = (cell = "") => cell.trim().replace(/^"|"$/g, "").trim();

function readCsv(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/)
    .map((l, i) => ({ l, line: i + 1 })).filter((x) => x.l.trim());
  if (!lines.length) return [];
  const delim = detectDelimiter(lines[0].l);
  const head = lines[0].l.split(delim).map((c) => clean(c).toLowerCase());
  const hasHeader = head.includes("address");
  const ai = hasHeader ? head.indexOf("address") : 0;
  const mi = hasHeader && head.includes("amount") ? head.indexOf("amount") : 1;
  return (hasHeader ? lines.slice(1) : lines).map(({ l, line }) => {
    const cells = l.split(delim);
    let amount = clean(cells[mi]);
    if (delim !== ",") amount = amount.replace(",", "."); 
    return { line, address: clean(cells[ai]), amount };
  });
}

function readJson(text) {
  const data = JSON.parse(text);
  const list = Array.isArray(data) ? data : Object.entries(data).map(([address, amount]) => ({ address, amount }));
  return list.map((r, i) => ({ line: i + 1, address: String(r.address ?? "").trim(), amount: String(r.amount ?? "").trim() }));
}

export function parseRecipients(text, filename, decimals = 18, blocked = []) {
  const blockedSet = new Set(blocked.filter(Boolean).map((a) => a.toLowerCase()));
  const errors = [], warnings = [], rows = [];
  let raw;
  try {
    raw = filename.toLowerCase().endsWith(".json") ? readJson(text) : readCsv(text);
  } catch {
    return { rows, errors: [{ line: 0, message: "Check file format" }], warnings, total: 0n, ok: false };
  }
  if (!raw.length) errors.push({ line: 0, message: "No recipients" });
  if (raw.length > MAX_ROWS) errors.push({ line: 0, message: `Max ${MAX_ROWS} addresses, the file has ${raw.length}` });

  const seen = new Set();
  let total = 0n;
  for (const { line, address, amount } of raw.slice(0, MAX_ROWS)) {
    const err = (message) => errors.push({ line, message });
    if (!isAddress(address)) { err("Invalid address"); continue; }
    if (/^0x0{40}$/i.test(address)) { err("Zero address"); continue; }
    if (blockedSet.has(address.toLowerCase())) { err("Sender or router address is not allowed as a recipient"); continue; }
    if (!/^\d+(\.\d+)?$/.test(amount)) { err("Amount must be a number like 100 or 0.5 (no 1e18 notation)"); continue; }
    if ((amount.split(".")[1]?.length ?? 0) > decimals) { err(`More than ${decimals} decimal places`); continue; }
    const units = parseUnits(amount, decimals);
    if (units === 0n) { err("Amount is zero"); continue; }
    if (seen.has(address.toLowerCase())) warnings.push({ line, message: "Repeated address" });
    seen.add(address.toLowerCase());
    rows.push({ line, address, amount, units });
    total += units;
  }
  return { rows, errors, warnings, total, ok: errors.length === 0 && rows.length > 0 };
}

export const chunk = (arr, size = BATCH_SIZE) =>
  Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, (i + 1) * size));