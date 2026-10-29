"use client";

// The last line of defence: runs only when the root layout itself breaks, so it has to supply
// its own <html> and <body> and can't use the app's stylesheet tokens or components. The
// dashboard's own error.tsx handles everything below the layout.
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, display: "grid", minHeight: "100vh", placeItems: "center" }}>
        <div role="alert" style={{ maxWidth: 420, padding: 32, textAlign: "center" }}>
          <h1 style={{ fontSize: 20, margin: 0 }}>Something went wrong</h1>
          <p style={{ color: "#555", fontSize: 14 }}>The dashboard hit an unexpected problem. Your session is still active.</p>
          <button
            type="button"
            onClick={reset}
            style={{ marginTop: 12, padding: "8px 16px", fontSize: 14, fontWeight: 600, borderRadius: 8, border: 0, background: "#1d6b57", color: "#fff", cursor: "pointer" }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
