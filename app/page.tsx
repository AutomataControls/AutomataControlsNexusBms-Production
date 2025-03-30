// page.tsx
export default function Home() {
  return (
    <div style={{ 
      display: "flex", 
      justifyContent: "center", 
      alignItems: "center",
      flexDirection: "column",
      height: "100vh",
      background: "linear-gradient(to bottom, #eff6ff, #ffffff)",
      fontFamily: "Arial, sans-serif"
    }}>
      <h1 style={{ 
        color: "#14b8a6", 
        fontSize: "24px",
        marginBottom: "16px"
      }}>
        Automata Controls BMS
      </h1>
      <p style={{ 
        color: "#fdba74",
        marginBottom: "24px"
      }}>
        Building Management System
      </p>
      <a 
        href="/login" 
        style={{
          backgroundColor: "#2dd4bf",
          color: "white",
          padding: "8px 16px",
          borderRadius: "6px",
          textDecoration: "none"
        }}
      >
        Go to Login
      </a>
    </div>
  );
}