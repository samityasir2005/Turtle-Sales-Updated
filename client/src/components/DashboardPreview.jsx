import React from "react";
import "../styles/DashboardPreview.css";
import logo from "../assets/logo.png";
import {
  FiGrid,
  FiUser,
  FiUsers,
  FiChevronDown,
  FiBell,
  FiFileText,
  FiCalendar,
  FiSettings,
  FiBarChart2,
  FiTrendingUp,
  FiLogOut,
  FiArrowRight,
} from "react-icons/fi";

const QUICK_ACTIONS = [
  {
    Icon: FiUser,
    title: "Profile",
    description: "View and manage your profile settings",
    tone: "blue",
  },
  {
    Icon: FiCalendar,
    title: "Record Sale",
    description: "Record a sale!",
    tone: "green",
  },
  {
    Icon: FiBarChart2,
    title: "View Sales",
    description: "View all sales and filter by rep or worker",
    tone: "purple",
  },
  {
    Icon: FiTrendingUp,
    title: "Leaderboard",
    description: "View team performance rankings and achievements",
    tone: "orange",
  },
];

export default function DashboardPreview() {
  const greeting =
    new Date().getHours() < 12
      ? "Morning"
      : new Date().getHours() < 18
        ? "Afternoon"
        : "Evening";

  return (
    <section
      className="dashboard-preview"
      id="dashboard-preview"
      aria-label="Turtle Portal preview"
    >
      <div className="dashboard-preview__window">
        <div className="dashboard-preview__chrome">
          <div className="dashboard-preview__dots" aria-hidden>
            <span className="dashboard-preview__dot dashboard-preview__dot--r" />
            <span className="dashboard-preview__dot dashboard-preview__dot--y" />
            <span className="dashboard-preview__dot dashboard-preview__dot--g" />
          </div>
          <div className="dashboard-preview__url">
            <span className="dashboard-preview__url-pill">
              <span className="dashboard-preview__lock" aria-hidden>
                🔒
              </span>
              turtlesales.ca
            </span>
          </div>
        </div>

        <div className="dashboard-preview__shell">
          <aside className="dashboard-preview__sidebar" aria-hidden>
            <div className="dashboard-preview__sb-brand">
              <img
                src={logo}
                alt=""
                width={24}
                height={24}
                className="dashboard-preview__sb-logo-img"
              />
              <span className="dashboard-preview__sb-title">Turtle Sales</span>
            </div>
            <div className="dashboard-preview__search">Search...</div>
            <nav className="dashboard-preview__nav">
              <div className="dashboard-preview__nav-item dashboard-preview__nav-item--active">
                <FiGrid className="dashboard-preview__nav-ic" />
                Dashboard
              </div>
              <div className="dashboard-preview__nav-item">
                <FiUser className="dashboard-preview__nav-ic" />
                Profile
              </div>
              <div className="dashboard-preview__nav-item">
                <FiUsers className="dashboard-preview__nav-ic" />
                Teams
                <FiChevronDown className="dashboard-preview__nav-chev" />
              </div>
              <div className="dashboard-preview__nav-item">
                <FiBell className="dashboard-preview__nav-ic" />
                Notifications
              </div>
              <div className="dashboard-preview__nav-item">
                <FiFileText className="dashboard-preview__nav-ic" />
                Reconciliation
              </div>
              <div className="dashboard-preview__nav-item">
                <FiCalendar className="dashboard-preview__nav-ic" />
                Events
              </div>
              <div className="dashboard-preview__nav-item">
                <FiSettings className="dashboard-preview__nav-ic" />
                Settings
              </div>
            </nav>
          </aside>

          <div className="dashboard-preview__main">
            <header className="dashboard-preview__topbar">
              <div>
                <h2 className="dashboard-preview__portal-title">Turtle Portal</h2>
                <p className="dashboard-preview__portal-sub">
                  Good {greeting}, <span className="dashboard-preview__name">Alex</span>{" "}
                  — <span className="dashboard-preview__role">Employee</span>
                </p>
              </div>
              <div className="dashboard-preview__topbar-actions">
                <span className="dashboard-preview__pill dashboard-preview__pill--solid">
                  <FiBarChart2 size={14} aria-hidden />
                  Quick Sale
                </span>
                <span className="dashboard-preview__pill dashboard-preview__pill--outline">
                  <FiTrendingUp size={14} aria-hidden />
                  View Sales
                </span>
                <span className="dashboard-preview__user-chip">
                  <span className="dashboard-preview__user-ic">
                    <FiUser aria-hidden />
                  </span>
                  <span className="dashboard-preview__user-text">
                    <span className="dashboard-preview__user-line">Alex Chen</span>
                    <span className="dashboard-preview__user-status">Online</span>
                  </span>
                </span>
                <span className="dashboard-preview__logout">
                  <FiLogOut size={14} aria-hidden />
                  Logout
                </span>
              </div>
            </header>

            <div className="dashboard-preview__body-inner">
              <div className="dashboard-preview__section-head">
                <h3 className="dashboard-preview__qh-title">Quick Actions</h3>
                <p className="dashboard-preview__qh-sub">
                  Access your most used features quickly
                </p>
              </div>

              <div className="dashboard-preview__grid">
                {QUICK_ACTIONS.map(({ Icon, title, description, tone }) => (
                  <div
                    key={title}
                    className={`dashboard-preview__card dashboard-preview__card--${tone}`}
                  >
                    <div className="dashboard-preview__card-top">
                      <div
                        className={`dashboard-preview__card-icon dashboard-preview__card-icon--${tone}`}
                      >
                        <Icon size={22} aria-hidden />
                      </div>
                      <FiArrowRight className="dashboard-preview__card-arrow" aria-hidden />
                    </div>
                    <h4 className="dashboard-preview__card-title">{title}</h4>
                    <p className="dashboard-preview__card-desc">{description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
