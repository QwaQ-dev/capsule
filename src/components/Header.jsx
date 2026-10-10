import { Link } from "react-router-dom";
import Icon from "./Icon";
import logo from "../assets/logo.png";
import WalletButton from "./WalletButton.jsx"

export default function Header() {
  return (
    <header className="header">
      <div className="container header__row">
        <Link to="/" className="logo" aria-label="Capsule, на главную">
          <img src={logo} alt="" />
        </Link>
        <WalletButton />
      </div>
    </header>
  );
}