import React, { useEffect, useState } from "react";
import Logo from "../assets/logo.png";
import { FaEye, FaEyeSlash } from "react-icons/fa6";
import "../styles/Login.css";
import { Link, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import { motion } from "framer-motion";

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [token, setToken] = useState(
    JSON.parse(localStorage.getItem("auth")) || ""
  );
  const navigate = useNavigate();

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    let email = e.target.email.value;
    let password = e.target.password.value;

    if (email && password) {
      const formData = { email, password };

      try {
        const response = await axios.post(
          `${import.meta.env.VITE_API_URL}/auth/login`,
          formData
        );

        localStorage.setItem("auth", JSON.stringify(response.data.token));
        setToken(JSON.stringify(response.data.token));

        toast.success("Login successful");

        if (response.data.firstLogin) {
          navigate("/welcome");
        } else {
          navigate(redirectAfterLogin());
        }

        window.location.reload();
      } catch (err) {
        if (err.response?.data) {
          const errorMessage = err.response.data.msg;
          if (errorMessage === "Bad password") {
            toast.error("Incorrect password, Please try again");
          } else if (errorMessage === "Bad credentials") {
            toast.error("User does not exist");
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
      const from = location.state?.from?.pathname;
      const dest =
        from && from !== "/login" && from !== "/register" ? from : "/dashboard";
      navigate(dest, { replace: true });
    }
  }, [token, navigate, location.state]);

  return (
    <div className="login-container">
      <motion.div
        className="login-card"
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
          <h1 className="brand-title">Welcome Back</h1>
          <p className="brand-subtitle">Please enter your details</p>
        </motion.div>

        <motion.form
          onSubmit={handleLoginSubmit}
          className="login-form"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <div className="input-group">
            <input
              type="email"
              name="email"
              placeholder="Email"
              className="form-input"
              required
            />
          </div>

          <div className="input-group">
            <div className="password-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="Password"
                className="form-input"
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
          </div>

          <div className="forgot-password">
            <Link to="/forgot-password" className="forgot-password-link">
              Forgot Password?
            </Link>
          </div>

          <motion.button
            type="submit"
            className="submit-btn"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Sign In
          </motion.button>
        </motion.form>

        <div className="auth-footer">
          <p>
            Don't have an account?{" "}
            <Link to="/register" className="auth-link">
              Sign Up
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
