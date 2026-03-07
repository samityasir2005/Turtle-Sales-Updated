import React, { useEffect, useState } from "react";
import Logo from "../assets/logo.png";
import { FaEye, FaEyeSlash, FaCheck, FaXmark } from "react-icons/fa6";
import "../styles/Register.css";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import { motion } from "framer-motion";

const Register = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [email, setEmail] = useState("");
  const navigate = useNavigate();
  const [token, setToken] = useState(
    JSON.parse(localStorage.getItem("auth")) || "",
  );

  // Password strength calculation
  const calculatePasswordStrength = (password) => {
    let score = 0;
    const criteria = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /\d/.test(password),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    };

    Object.values(criteria).forEach((met) => met && score++);
    return { score, criteria };
  };

  // Username validation
  const validateUsername = (username) => {
    const criteria = {
      length: username.length >= 3 && username.length <= 20,
      noSpaces: !/\s/.test(username),
      validChars: /^[a-zA-Z0-9_.-]+$/.test(username),
      startsWithLetter: /^[a-zA-Z]/.test(username),
    };
    return criteria;
  };

  // Email validation
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const passwordStrength = calculatePasswordStrength(password);
  const usernameValidation = validateUsername(username);

  const getPasswordStrengthLevel = (score) => {
    if (score <= 2) return { level: "Weak", color: "#ff4757", width: "33%" };
    if (score <= 3) return { level: "Medium", color: "#ffa502", width: "66%" };
    return { level: "Strong", color: "#2ed573", width: "100%" };
  };

  const strengthInfo = getPasswordStrengthLevel(passwordStrength.score);

  // Check if passwords match
  const passwordsMatch =
    password === confirmPassword && confirmPassword.length > 0;

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();

    // Validate username
    const usernameChecks = validateUsername(username);
    if (!Object.values(usernameChecks).every(Boolean)) {
      toast.error("Please fix the username requirements");
      return;
    }

    // Validate email
    if (!validateEmail(email)) {
      toast.error("Please enter a valid email address");
      return;
    }

    // Validate password strength
    if (passwordStrength.score < 3) {
      toast.error("Password must be at least Medium strength");
      return;
    }

    // Check if passwords match
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (
      username.length > 0 &&
      email.length > 0 &&
      password.length > 0 &&
      confirmPassword.length > 0
    ) {
      const formData = {
        name: username,
        email,
        password,
      };

      try {
        const response = await axios.post(
          `${import.meta.env.VITE_API_URL}/auth/register`,
          formData,
        );
        toast.success("Registration successful");
        navigate("/login");
      } catch (err) {
        if (err.response && err.response.data) {
          const errorMessage = err.response.data.msg;
          if (errorMessage === "Email already in use") {
            toast.error("Email already in use");
          } else {
            toast.error(errorMessage);
          }
        } else {
          toast.error("An error occurred. Please try again.");
        }
      }
    }
  };

  useEffect(() => {
    if (token !== "") {
      navigate("/dashboard");
    }
  }, [token]);

  return (
    <div className="register-container">
      <div className="register-background">
        <div className="purple-gradient"></div>
      </div>

      <motion.div
        className="register-card"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <motion.div
          className="logo-section"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <img src={Logo} alt="Logo" className="logo" />
          <h1 className="brand-title">Create Account</h1>
          <p className="brand-subtitle">Please enter your details</p>
        </motion.div>

        <motion.form
          onSubmit={handleRegisterSubmit}
          className="register-form"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          {/* Username Input with Validation */}
          <div className="input-group">
            <input
              type="text"
              name="name"
              placeholder="Username"
              className="form-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
            {username && (
              <div className="validation-info">
                <div className="validation-item">
                  {usernameValidation.length ? (
                    <FaCheck className="valid" />
                  ) : (
                    <FaXmark className="invalid" />
                  )}
                  <span>3-20 characters</span>
                </div>
                <div className="validation-item">
                  {usernameValidation.startsWithLetter ? (
                    <FaCheck className="valid" />
                  ) : (
                    <FaXmark className="invalid" />
                  )}
                  <span>Start with a letter</span>
                </div>
                <div className="validation-item">
                  {usernameValidation.validChars ? (
                    <FaCheck className="valid" />
                  ) : (
                    <FaXmark className="invalid" />
                  )}
                  <span>Only letters, numbers, _, -, .</span>
                </div>
                <div className="validation-item">
                  {usernameValidation.noSpaces ? (
                    <FaCheck className="valid" />
                  ) : (
                    <FaXmark className="invalid" />
                  )}
                  <span>No spaces</span>
                </div>
              </div>
            )}
          </div>

          {/* Email Input */}
          <div className="input-group">
            <input
              type="email"
              name="email"
              placeholder="Email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            {email && !validateEmail(email) && (
              <div className="validation-info">
                <div className="validation-item">
                  <FaXmark className="invalid" />
                  <span>Enter a valid email address</span>
                </div>
              </div>
            )}
          </div>

          {/* Password Input with Strength Meter */}
          <div className="input-group">
            <div className="password-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="Password"
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>

            {password && (
              <div className="password-strength">
                <div className="strength-bar">
                  <div
                    className="strength-fill"
                    style={{
                      width: strengthInfo.width,
                      backgroundColor: strengthInfo.color,
                    }}
                  ></div>
                </div>
                <span
                  className="strength-text"
                  style={{ color: strengthInfo.color }}
                >
                  {strengthInfo.level}
                </span>

                <div className="password-requirements">
                  <div className="requirement-item">
                    {passwordStrength.criteria.length ? (
                      <FaCheck className="valid" />
                    ) : (
                      <FaXmark className="invalid" />
                    )}
                    <span>At least 8 characters</span>
                  </div>
                  <div className="requirement-item">
                    {passwordStrength.criteria.uppercase ? (
                      <FaCheck className="valid" />
                    ) : (
                      <FaXmark className="invalid" />
                    )}
                    <span>One uppercase letter</span>
                  </div>
                  <div className="requirement-item">
                    {passwordStrength.criteria.lowercase ? (
                      <FaCheck className="valid" />
                    ) : (
                      <FaXmark className="invalid" />
                    )}
                    <span>One lowercase letter</span>
                  </div>
                  <div className="requirement-item">
                    {passwordStrength.criteria.number ? (
                      <FaCheck className="valid" />
                    ) : (
                      <FaXmark className="invalid" />
                    )}
                    <span>One number</span>
                  </div>
                  <div className="requirement-item">
                    {passwordStrength.criteria.special ? (
                      <FaCheck className="valid" />
                    ) : (
                      <FaXmark className="invalid" />
                    )}
                    <span>One special character</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password Input */}
          <div className="input-group">
            <input
              type="password"
              name="confirmPassword"
              placeholder="Confirm Password"
              className="form-input"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
            {confirmPassword && (
              <div className="validation-info">
                <div className="validation-item">
                  {passwordsMatch ? (
                    <FaCheck className="valid" />
                  ) : (
                    <FaXmark className="invalid" />
                  )}
                  <span>
                    {passwordsMatch
                      ? "Passwords match"
                      : "Passwords don't match"}
                  </span>
                </div>
              </div>
            )}
          </div>

          <motion.button
            type="submit"
            className="submit-btn"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Create Account
          </motion.button>
        </motion.form>

        <div className="auth-footer">
          <p>
            Already have an account?{" "}
            <Link to="/login" className="auth-link">
              Login
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Register;
