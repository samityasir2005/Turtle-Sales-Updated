import React from "react";
import { Outlet } from "react-router-dom";
import Header from "../components/Header";
import Breadcrumb from "../components/Breadcrumb";
import "../styles/Breadcrumb.css";

const HomeLayout = () => {
  return (
    <>
      <Header />
      <Breadcrumb />
      <Outlet />
    </>
  );
};

export default HomeLayout;
