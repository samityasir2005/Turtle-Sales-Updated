import React, { useState, useEffect, useContext } from "react";
import { Link, useLocation } from "react-router-dom";
import { FiMenu, FiX } from "react-icons/fi";
import logo from "../assets/logo.png";
import { UserContext } from "../usercontext/UserContext";
import "./Header.css";

export default function Header() {
  const { token } = useContext(UserContext);
  const isLoggedIn = Boolean(token);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  const profileTo = token ? "/dashboard" : "/login";
  const portalTo = token ? "/turtle-portal" : "/login";

  const navLinkClass = (path) =>
    [
      "site-header__link",
      location.pathname === path ? "site-header__link--active" : "",
    ]
      .filter(Boolean)
      .join(" ");

  return (
    <div className="site-header-wrap">
      <header className="site-header">
        <div className="site-header__inner">
          <Link to="/" className="site-header__brand" aria-label="Turtle Sales home">
            <img
              src={logo}
              alt=""
              className="site-header__logo-img"
              width={40}
              height={40}
            />
            <span className="site-header__logo-text">Turtle Sales</span>
          </Link>

          <nav className="site-header__nav" aria-label="Primary">
            <Link className={navLinkClass("/")} to="/">
              Home
            </Link>
            <Link className={navLinkClass("/dashboard")} to={profileTo}>
              Profile
            </Link>
            <Link className={navLinkClass("/turtle-portal")} to={portalTo}>
              Turtle Portal
            </Link>
          </nav>

          <div className="site-header__actions">
            {!isLoggedIn && (
              <Link
                to="/login"
                className="site-header__btn site-header__btn--ghost"
              >
                Login
              </Link>
            )}
            <Link
              to="/register"
              className="site-header__btn site-header__btn--primary"
            >
              Get Started
            </Link>
          </div>

          <button
            type="button"
            className="site-header__menu-btn"
            aria-expanded={drawerOpen}
            aria-controls="site-header-drawer"
            onClick={() => setDrawerOpen((o) => !o)}
          >
            {drawerOpen ? <FiX size={22} /> : <FiMenu size={22} />}
            <span className="visually-hidden">Menu</span>
          </button>
        </div>
      </header>

      <div
        className={`site-header__drawer-backdrop ${drawerOpen ? "is-open" : ""}`}
        aria-hidden={!drawerOpen}
        onClick={() => setDrawerOpen(false)}
      />
      <div
        id="site-header-drawer"
        className={`site-header__drawer ${drawerOpen ? "is-open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        <div className="site-header__drawer-nav">
          <Link className={navLinkClass("/")} to="/">
            Home
          </Link>
          <Link className={navLinkClass("/dashboard")} to={profileTo}>
            Profile
          </Link>
          <Link className={navLinkClass("/turtle-portal")} to={portalTo}>
            Turtle Portal
          </Link>
        </div>
        <div className="site-header__drawer-actions">
          {!isLoggedIn && (
            <Link
              to="/login"
              className="site-header__btn site-header__btn--ghost"
            >
              Login
            </Link>
          )}
          <Link
            to="/register"
            className="site-header__btn site-header__btn--primary"
          >
            Get Started
          </Link>
        </div>
      </div>
    </div>
  );
}
