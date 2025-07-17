// This file was previously a simple Gemini text generation app.
// Since index.html loads the CRM application from /src/index.tsx,
// this root-level index.tsx is not directly used by the CRM.
// It's being kept minimal to avoid conflicts or confusion.
// For the CRM application, please see src/index.tsx.

console.log("Root index.tsx loaded. CRM application entry point is /src/index.tsx as per index.html.");

// To run the text generation example independently (if needed for other purposes):
/*
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

const App = () => {
  const [prompt, setPrompt] = useState<string>("");
  const [response, setResponse] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError("Please enter a prompt.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setResponse(""); 
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
      const result: GenerateContentResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });
      setResponse(result.text);
    } catch (e: any) {
      console.error("Error generating content:", e);
      setError(
        e.message || "An error occurred while generating content."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Gemini Text Generation</h1>
      <p style={styles.description}>
        Enter a prompt below and let Gemini generate a response for you. This
        application demonstrates basic text generation using the Google Gemini API.
      </p>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Enter your prompt here..."
        rows={5}
        style={styles.textarea}
        disabled={isLoading}
        aria-label="Prompt for Gemini"
      />
      <button
        onClick={handleGenerate}
        disabled={isLoading}
        style={isLoading ? { ...styles.button, ...styles.buttonDisabled } : styles.button}
        aria-busy={isLoading}
      >
        {isLoading ? "Generating..." : "Generate Text"}
      </button>

      {error && <p style={styles.errorText}>Error: {error}</p>}

      {response && (
        <div style={styles.responseContainer}>
          <h2 style={styles.responseTitle}>Generated Response:</h2>
          <pre style={styles.responseText}>{response}</pre>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"',
    maxWidth: "800px",
    margin: "40px auto",
    padding: "30px",
    backgroundColor: "#f9fafb",
    borderRadius: "12px",
    boxShadow: "0 10px 25px rgba(0, 0, 0, 0.1)",
    color: "#374151",
  },
  title: {
    fontSize: "2.5em",
    color: "#1d4ed8", 
    textAlign: "center" as "center",
    marginBottom: "15px",
  },
  description: {
    fontSize: "1.1em",
    color: "#4b5563",
    textAlign: "center" as "center",
    marginBottom: "30px",
    lineHeight: 1.6,
  },
  textarea: {
    width: "calc(100% - 24px)", 
    padding: "12px",
    marginBottom: "20px",
    border: "1px solid #d1d5db",
    borderRadius: "8px",
    fontSize: "1em",
    lineHeight: 1.5,
    boxShadow: "inset 0 1px 2px rgba(0,0,0,0.05)",
    transition: "border-color 0.2s ease-in-out",
  } as React.CSSProperties,
  button: {
    display: "block",
    width: "100%",
    padding: "14px 20px",
    backgroundColor: "#2563eb", 
    color: "white",
    border: "none",
    borderRadius: "8px",
    fontSize: "1.1em",
    fontWeight: "bold",
    cursor: "pointer",
    transition: "background-color 0.2s ease-in-out, opacity 0.2s ease-in-out",
  },
  buttonDisabled: {
    backgroundColor: "#93c5fd", 
    cursor: "not-allowed",
  },
  responseContainer: {
    marginTop: "30px",
    padding: "20px",
    backgroundColor: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.05)",
  },
  responseTitle: {
    fontSize: "1.5em",
    color: "#10b981", 
    marginBottom: "10px",
  },
  responseText: {
    fontSize: "1em",
    color: "#374151",
    whiteSpace: "pre-wrap" as "pre-wrap",
    wordWrap: "break-word" as "break-word",
    lineHeight: 1.7,
    maxHeight: "400px",
    overflowY: "auto" as "auto",
    padding: "10px",
    backgroundColor: "#f3f4f6",
    borderRadius: "6px",
  },
  errorText: {
    color: "#ef4444", 
    marginTop: "15px",
    fontSize: "1em",
    fontWeight: "bold",
    textAlign: "center" as "center",
  },
};

// Ensure this does not conflict if index.html loads src/index.tsx to the same root
// const geminiAppContainer = document.getElementById("gemini-app-root"); // Example: use a different root ID
// if (geminiAppContainer) {
//   const root = createRoot(geminiAppContainer);
//   root.render(
//     <React.StrictMode>
//       <App />
//     </React.StrictMode>
//   );
// } else {
//   console.info("Gemini app root element not found. This is expected if CRM app is primary.");
// }
*/