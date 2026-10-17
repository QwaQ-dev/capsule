import { Link } from "react-router-dom";
import logo from "../assets/logo.png";
import WalletButton from "./WalletButton.jsx";
import SocialLinks from "./SocialLinks.jsx";

export default function Header() {
  return (
    <header className="header">
      <div className="container header__row">
        <Link to="/" className="logo" aria-label="Capsule, на главную">
          <img src={logo} alt="" />
        </Link>
        <div className="header__right">
          <WalletButton />
          <SocialLinks />
        </div>
      </div>
    </header>
  );
}