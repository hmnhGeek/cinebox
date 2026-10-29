import { createContext, useContext, useState } from "react";
import { useLocation } from "react-router-dom";

const ActorsFilterContext = createContext(null);

export function ActorsFilterProvider({ children }) {
  const location = useLocation();

  const [hasProfileImage, setHasProfileImage] = useState(() => {
    if (location.pathname !== "/actors") {
      return false;
    }

    return (
      new URLSearchParams(location.search).get("hasProfileImage") === "true"
    );
  });

  return (
    <ActorsFilterContext.Provider
      value={{ hasProfileImage, setHasProfileImage }}
    >
      {children}
    </ActorsFilterContext.Provider>
  );
}

export function useActorsFilter() {
  const context = useContext(ActorsFilterContext);

  if (!context) {
    throw new Error(
      "useActorsFilter must be used within an ActorsFilterProvider.",
    );
  }

  return context;
}
