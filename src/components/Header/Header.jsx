import { useNavigate } from "react-router-dom";
import "./Header.css";
import logo from "../../assets/logo.png";

function Header() {
  const navigate = useNavigate();

  return (
    <header className="app-header">
      <div className="header-brand">
        <button
          className="header-logo-button"
          onClick={() => navigate("/")}
          aria-label="Go to homepage"
          title="Home"
        >
          <img className="app-logo" src={logo} alt="" />
        </button>
      </div>
    </header>
  );
}

export default Header;
