import React, { useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { UserContext } from "../usercontext/UserContext";
import { motion } from "framer-motion";
import {
  FiMessageSquare,
  FiTrendingUp,
  FiBook,
  FiZap,
  FiArrowRight,
} from "react-icons/fi";
import "../styles/AISalesTraining.css";

const AISalesTraining = () => {
  const { token } = useContext(UserContext);
  const navigate = useNavigate();

  useEffect(() => {
    // Scroll to top when component mounts
    window.scrollTo(0, 0);

    // Redirect to login if not authenticated
    if (!token) {
      navigate("/login");
      return;
    }
  }, [token, navigate]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.6,
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        duration: 0.5,
        ease: "easeOut",
      },
    },
  };

  const features = [
    {
      icon: FiMessageSquare,
      title: "Interactive AI Coach",
      description: "Practice sales conversations with our intelligent AI agent",
      color: "blue",
    },
    {
      icon: FiTrendingUp,
      title: "Performance Analytics",
      description: "Track your progress and identify areas for improvement",
      color: "green",
    },
    {
      icon: FiBook,
      title: "Sales Scripts & Tips",
      description: "Access proven scripts and strategies that work",
      color: "purple",
    },
    {
      icon: FiZap,
      title: "Real-time Feedback",
      description: "Get instant feedback on your pitch and techniques",
      color: "orange",
    },
  ];

  return (
    <motion.div
      className="ai-training-container"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div className="main-cta-section" variants={itemVariants}>
        <div className="training-intro">
          <h1>AI Sales Training</h1>
          <p className="training-tagline">
            Practice real door-to-door sales scenarios with AI-powered customers
          </p>
          <p className="training-description">
            Each session simulates a realistic homeowner interaction. Use voice
            or text to practice your pitch, handle objections, and close the
            sale. Get instant feedback and improve your skills in a risk-free
            environment.
          </p>
        </div>

        <button
          className="practice-btn"
          onClick={() => navigate("/ai-conversation")}
        >
          <span>Start AI Sales Training</span>
          <FiArrowRight />
        </button>
      </motion.div>

      <motion.div className="features-section" variants={containerVariants}>
        <h3 className="features-title">What You'll Learn</h3>
        <div className="features-grid">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              className={`feature-card ${feature.color}`}
              variants={itemVariants}
              whileHover={{
                y: -8,
                transition: { duration: 0.2 },
              }}
            >
              <div className={`feature-icon ${feature.color}`}>
                <feature.icon />
              </div>
              <h4>{feature.title}</h4>
              <p>{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default AISalesTraining;
