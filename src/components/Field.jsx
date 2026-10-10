import Icon from "./Icon";

export function Field({ label, hint, aside, onchain, children }) {
  return (
    <label className="field" data-onchain={onchain}>
      <span className="field__label">{label}{aside && <small className="muted">{aside}</small>}</span>
      {children}
      {hint && <small className="muted">{hint}</small>}
    </label>
  );
}

export function DateInput({ value, onChange }) {
  return (
    <div className="input-wrap">
      <input type="date" value={value} onChange={(e) => onChange(e.target.value)} />
      <span className="input-icon"><Icon name="cal" size={16} /></span>
    </div>
  );
}

export function SelectInput({ value, onChange, options, placeholder }) {
  return (
    <div className="input-wrap">
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="" disabled>{placeholder}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      <span className="input-icon"><Icon name="down" size={16} /></span>
    </div>
  );
}

export function Checkbox({ checked, onChange, children }) {
  return (
    <label className="check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  );
}