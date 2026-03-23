import React from "react";
import {
  RouterProvider,
  createBrowserRouter,
  Navigate,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ErrorBoundary from "./components/ErrorBoundary";
import "bootstrap/dist/css/bootstrap.min.css";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./App.css"; // Add this import for global styles

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
});
import {
  Dashboard,
  HomeLayout,
  Landing,
  Login,
  Logout,
  Register,
} from "./pages";
import TurtlePortal from "./pages/TurtlePortal";
import { UserProvider } from "./usercontext/UserContext";
import WelcomePage from "./pages/WelcomePage";
import ManageOrg from "./pages/ManageOrg";
import ManageTimeslots from "./pages/ManageTimeslots";
import ViewTimeslots from "./pages/ViewTimeslots";
import ViewSales from "./pages/viewsales";
import EmployeePaystub from "./pages/EmployeePaystub";
import SalesLeaderboard from "./pages/SalesLeaderboard";

const router = createBrowserRouter([
  {
    path: "/",
    element: <HomeLayout />,
    children: [
      {
        index: true,
        element: <Landing />,
      },
      {
        path: "login",
        element: <Login />,
      },
      {
        path: "register",
        element: <Register />,
      },
      {
        path: "dashboard",
        element: <Dashboard />,
      },
      {
        path: "logout",
        element: <Logout />,
      },
      {
        path: "welcome",
        element: <WelcomePage />,
      },
      {
        path: "manage-org",
        element: <ManageOrg />,
      },
      {
        path: "turtle-portal",
        element: <TurtlePortal />,
      },
      {
        path: "manage-timeslots",
        element: <ManageTimeslots />,
      },
      {
        path: "track-sales",
        element: <ViewTimeslots />,
      },
      {
        path: "view-timeslots",
        element: <ViewTimeslots />,
      },
      {
        path: "view-sales",
        element: <ViewSales />,
      },
      {
        path: "employee-paystub",
        element: <EmployeePaystub />,
      },
      {
        path: "sales-leaderboard",
        element: <SalesLeaderboard />,
      },
      {
        path: "ai-sales-training",
        element: (
          <Navigate
            to="/turtle-portal"
            replace
            state={{ aiTrainerComingSoon: true }}
          />
        ),
      },
      {
        path: "ai-conversation",
        element: (
          <Navigate
            to="/turtle-portal"
            replace
            state={{ aiTrainerComingSoon: true }}
          />
        ),
      },
    ],
  },
]);

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <UserProvider>
          <RouterProvider router={router} />
          <ToastContainer
            position="top-right"
            autoClose={4000}
            hideProgressBar={false}
            newestOnTop={true}
            closeOnClick
            rtl={false}
            pauseOnFocusLoss
            draggable
            pauseOnHover
            theme="light"
            toastStyle={{
              borderRadius: "12px",
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.12)",
              fontSize: "0.875rem",
              fontWeight: "600",
            }}
            bodyStyle={{
              padding: "12px 16px",
            }}
            progressStyle={{
              background:
                "linear-gradient(90deg, var(--primary-green), var(--secondary-green))",
            }}
          />
        </UserProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
