import React, { useState, useEffect } from "react";
import Container from "react-bootstrap/Container";
import Nav from "react-bootstrap/Nav";
import Navbar from "react-bootstrap/Navbar";
import NavDropdown from "react-bootstrap/NavDropdown";
import logo from "../assets/logo.png";

export default function Header() {
  const [token, setToken] = useState(
    JSON.parse(localStorage.getItem("auth")) || "",
  );

  const updateToken = () => {
    setToken(JSON.parse(localStorage.getItem("auth")) || "");
  };

  useEffect(() => {
    window.addEventListener("storage", updateToken);
    return () => {
      window.removeEventListener("storage", updateToken);
    };
  }, []);

  return (
    <div style={{ paddingBottom: "70px" }}>
      <Navbar
        expand="lg"
        className="bg-body-tertiary header-enhanced"
        fixed="top"
        style={{ zIndex: 1050 }}
      >
        <Container fluid className="px-3">
          <Navbar.Brand
            href="/"
            style={{
              fontSize: "1.5rem",
              fontWeight: "bold",
              color: "var(--primary-green)",
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <img
              src={logo}
              alt="Turtle Sales Logo"
              style={{
                height: "40px",
                width: "auto",
                objectFit: "contain",
              }}
            />
            Turtle Sales
          </Navbar.Brand>
          <Navbar.Toggle
            aria-controls="basic-navbar-nav"
            style={{
              border: "none",
              padding: "0.25rem 0.5rem",
              fontSize: "1.25rem",
            }}
          />
          <Navbar.Collapse id="basic-navbar-nav">
            <Nav className="me-auto">
              <Nav.Link
                href="/"
                style={{
                  padding: "0.5rem 1rem",
                  borderRadius: "0.5rem",
                  margin: "0 0.25rem",
                  transition: "all 0.2s ease",
                }}
                className="nav-link-enhanced"
              >
                Home
              </Nav.Link>

              {token ? (
                <>
                  <Nav.Link
                    href="/dashboard"
                    style={{
                      padding: "0.5rem 1rem",
                      borderRadius: "0.5rem",
                      margin: "0 0.25rem",
                      transition: "all 0.2s ease",
                    }}
                    className="nav-link-enhanced"
                  >
                    Profile
                  </Nav.Link>
                  <Nav.Link
                    href="/turtle-portal"
                    style={{
                      padding: "0.5rem 1rem",
                      borderRadius: "0.5rem",
                      margin: "0 0.25rem",
                      transition: "all 0.2s ease",
                    }}
                    className="nav-link-enhanced"
                  >
                    Turtle Portal
                  </Nav.Link>
                </>
              ) : (
                <Nav.Link
                  href="/register"
                  style={{
                    padding: "0.5rem 1rem",
                    borderRadius: "0.5rem",
                    margin: "0 0.25rem",
                    transition: "all 0.2s ease",
                  }}
                  className="nav-link-enhanced"
                >
                  Register/Login
                </Nav.Link>
              )}
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>
    </div>
  );
}
