import { Toaster } from "react-hot-toast";

export default function AppToaster() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 3500,
        style: {
          borderRadius: 14,
          background: "rgba(12, 16, 32, 0.92)",
          color: "#fff",
          border: "1px solid rgba(255,255,255,0.10)"
        }
      }}
    />
  );
}
