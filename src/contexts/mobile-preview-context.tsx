import { createContext, useContext, useState } from "react";

interface MobilePreviewContextValue {
  isMobilePreview: boolean;
  toggle: () => void;
}

const MobilePreviewContext = createContext<MobilePreviewContextValue>({
  isMobilePreview: false,
  toggle: () => {},
});

export function MobilePreviewProvider({ children }: { children: React.ReactNode }) {
  const [isMobilePreview, setIsMobilePreview] = useState(false);
  return (
    <MobilePreviewContext.Provider value={{ isMobilePreview, toggle: () => setIsMobilePreview((v) => !v) }}>
      {children}
    </MobilePreviewContext.Provider>
  );
}

export function useMobilePreview() {
  return useContext(MobilePreviewContext);
}
