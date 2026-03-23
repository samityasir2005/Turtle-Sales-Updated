import React from "react";
import "../styles/Landing.css";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { FiEdit3, FiTrendingUp, FiClock, FiUsers } from "react-icons/fi";
import Logo from "../assets/logo.png";
import DashboardPreview from "../components/DashboardPreview";

const KEY_FEATURES = [
  {
    Icon: FiClock,
    title: "Manage timeslots & schedules",
    description:
      "Assign work windows, set availability, and keep your crew aligned on the calendar.",
    tone: "teal",
  },
  {
    Icon: FiEdit3,
    title: "Record sales",
    description:
      "Log door-to-door sales in the field so every deal is captured and trackable.",
    tone: "primary",
  },
  {
    Icon: FiTrendingUp,
    title: "Leaderboard",
    description:
      "See team rankings, compare performance, and spotlight top reps.",
    tone: "forest",
  },
  {
    Icon: FiUsers,
    title: "Organize your team",
    description:
      "Structure your organization, roles, and members so everyone has the right access.",
    tone: "primary",
  },
];

const Landing = () => {
  const navigate = useNavigate();

  const handleGetStarted = () => {
    navigate("/register");
  };

  const handleWatchDemo = () => {
    const el = document.getElementById("dashboard-preview");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { duration: 0.5, staggerChildren: 0.08 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.45, ease: "easeOut" },
    },
  };

  const featureVariants = {
    hidden: { opacity: 0, y: 24 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.4, ease: "easeOut" },
    },
  };

  return (
    <div className="landing">
      <motion.div
        className="landing__content"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <section className="landing__hero">
          <motion.div className="landing__headline" variants={itemVariants}>
            <span className="landing__h1-line landing__h1-line--regular">
              Organize Your
            </span>
            <span className="landing__h1-line">
              <span className="landing__h1-accent">Door-to-Door Sales</span>{" "}
              <span className="landing__h1-line--regular">Team</span>
            </span>
          </motion.div>

          <motion.p className="landing__subtitle" variants={itemVariants}>
            One platform to manage all aspects of door-to-door sales. Record and
            track sales, manage reps and workers, streamline payroll operations.
          </motion.p>

          <motion.div className="landing__cta-row" variants={itemVariants}>
            <motion.button
              type="button"
              className="landing__btn landing__btn--primary"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={handleGetStarted}
            >
              Get Started
              <span className="landing__cta-arrow" aria-hidden>
                →
              </span>
            </motion.button>
            <motion.button
              type="button"
              className="landing__btn landing__btn--secondary"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={handleWatchDemo}
            >
              Watch Demo
            </motion.button>
          </motion.div>
        </section>

        <DashboardPreview />

        <motion.section
          className="landing__features"
          id="features-section"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-40px" }}
        >
          <div className="landing__features-inner">
            <div className="landing__features-head">
              <span className="landing__features-eyebrow">Platform</span>
              <h2 className="landing__features-title">Key Features</h2>
              <p className="landing__features-lead">
                Schedules, sales capture, rankings, and team structure—built for
                door-to-door workflows.
              </p>
            </div>
            <div className="landing__features-grid">
              {KEY_FEATURES.map(({ Icon, title, description, tone }) => (
                <motion.article
                  key={title}
                  className={`landing__feature-card landing__feature-card--${tone}`}
                  variants={featureVariants}
                  whileHover={{ y: -4 }}
                >
                  <div
                    className={`landing__feature-icon landing__feature-icon--${tone}`}
                  >
                    <Icon className="landing__feature-icon-svg" aria-hidden />
                  </div>
                  <div className="landing__feature-body">
                    <h3 className="landing__feature-heading">{title}</h3>
                    <p className="landing__feature-text">{description}</p>
                  </div>
                </motion.article>
              ))}
            </div>
          </div>
        </motion.section>
      </motion.div>

      <footer className="landing__footer">
        <div className="landing__footer-inner">
          <div className="landing__footer-brand">
            <img src={Logo} alt="" className="landing__footer-logo" width={32} height={32} />
            <span className="landing__footer-name">Turtle Sales</span>
          </div>
          <p className="landing__footer-copy">
            © {new Date().getFullYear()} Turtle Sales by Yasir Corp. Making
            door-to-door sales easy.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
