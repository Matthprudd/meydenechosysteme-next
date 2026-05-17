"use client"

import { useState } from "react"
import { supabase } from "../lib/supabase"

export default function Home() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [message, setMessage] = useState("")

  async function signUp() {
    const { error } = await supabase.auth.signUp({
      email,
      password
    })

    if (error) {
      setMessage(error.message)
    } else {
      setMessage("Compte créé. Vérifie ton courriel pour confirmer.")
    }
  }

  async function signIn() {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) {
      setMessage(error.message)
    } else {
      setMessage("Connexion réussie. Bienvenue dans Meyden.")
    }
  }

  return (
    <main style={{
      minHeight: "100vh",
      background: "linear-gradient(180deg,#050505,#111)",
      color: "white",
      fontFamily: "Arial, sans-serif",
      padding: "32px"
    }}>
      <h1 style={{ color: "#ff6a00", fontSize: "42px" }}>
        MEYDEN ECHOSYSTEME
      </h1>

      <p>Backend Supabase connecté. Authentification réelle active.</p>

      <section style={{
        maxWidth: "420px",
        marginTop: "32px",
        padding: "24px",
        border: "1px solid rgba(255,106,0,0.45)",
        borderRadius: "18px",
        background: "rgba(255,255,255,0.04)"
      }}>
        <h2 style={{ color: "#ff6a00" }}>Accès Meyden</h2>

        <input
          placeholder="Courriel"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{
            width: "100%",
            padding: "14px",
            marginBottom: "12px",
            borderRadius: "10px",
            border: "1px solid #333",
            background: "#080808",
            color: "white"
          }}
        />

        <input
          placeholder="Mot de passe"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{
            width: "100%",
            padding: "14px",
            marginBottom: "18px",
            borderRadius: "10px",
            border: "1px solid #333",
            background: "#080808",
            color: "white"
          }}
        />

        <button onClick={signUp} style={{
          width: "100%",
          padding: "14px",
          marginBottom: "10px",
          borderRadius: "10px",
          border: "none",
          background: "#ff6a00",
          color: "black",
          fontWeight: "bold"
        }}>
          Créer un compte
        </button>

        <button onClick={signIn} style={{
          width: "100%",
          padding: "14px",
          borderRadius: "10px",
          border: "1px solid #ff6a00",
          background: "transparent",
          color: "#ff6a00",
          fontWeight: "bold"
        }}>
          Connexion
        </button>

        <p style={{ marginTop: "18px", opacity: 0.85 }}>
          {message}
        </p>
      </section>
    </main>
  )
}
