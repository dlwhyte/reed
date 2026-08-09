import { useEffect } from "react";
import { SignedIn, SignedOut, SignIn, useAuth } from "@clerk/clerk-react";
import Notes from "./pages/Notes";
import { setTokenGetter } from "./lib/api";

const E2E_BYPASS = import.meta.env.VITE_E2E_BYPASS === "true";

// Bridges Clerk's useAuth().getToken (only accessible inside the provider
// tree) into the module-level api.ts token getter so fetch() calls can
// attach Authorization headers without being React components.
function AuthBridge() {
  const { getToken } = useAuth();
  useEffect(() => {
    setTokenGetter(() => getToken());
    return () => setTokenGetter(null);
  }, [getToken]);
  return null;
}

export default function App() {
  if (E2E_BYPASS) {
    return <Notes />;
  }

  return (
    <>
      <SignedIn>
        <AuthBridge />
        <Notes />
      </SignedIn>
      <SignedOut>
        <div
          style={{
            minHeight: "100vh",
            display: "grid",
            placeItems: "center",
            padding: 24,
            background: "#f8f1e4",
          }}
        >
          <SignIn routing="hash" />
        </div>
      </SignedOut>
    </>
  );
}
