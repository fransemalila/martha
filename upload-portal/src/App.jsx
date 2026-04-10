import React, { useState } from "react";
import LoginGate from "./components/LoginGate";
import UploadPage from "./components/UploadPage";

export default function App() {
  const [authenticated, setAuthenticated] = useState(
    () => sessionStorage.getItem("upload_auth") === "true"
  );

  const handleLogin = () => {
    sessionStorage.setItem("upload_auth", "true");
    setAuthenticated(true);
  };

  const handleLogout = () => {
    sessionStorage.removeItem("upload_auth");
    sessionStorage.removeItem("upload_password");
    setAuthenticated(false);
  };

  if (!authenticated) {
    return <LoginGate onLogin={handleLogin} />;
  }

  return <UploadPage onLogout={handleLogout} />;
}
