import { useNavigate } from "react-router-dom";
import icon from "../../assets/icon.png";
import "./Header.css";

function Header() {
  const navigate = useNavigate();

  return (
    <header className="app-header">
      <img className="app-logo" src={icon} alt="Logo" />

      <button className="upload-link" onClick={() => navigate("/")}>
        Collections
      </button>
    </header>
  );
}

export default Header;
