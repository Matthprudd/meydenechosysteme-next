"use client"

import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"

export default function Home() {
  const [session, setSession] = useState<any>(null)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [message, setMessage] = useState("")

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signUp() {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      setMessage(error.message)
    } else {
      setMessage("Compte créé.")
    }
  }

  async function signIn() {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setMessage(error.message)
    } else {
      setMessage("Connexion Meyden réussie.")
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  if (session) {
    return (
      <main
        style={{
          minHeight: "100vh",
          background: "#050505",
          color: "white",
          padding: "30px",
          fontFamily: "Arial",
        }}
      >
        <h1 style={{ color: "#ff6a00", fontSize: "42px" }}>
          MEYDEN DASHBOARD
        </h1>

        <p>
          Connecté en tant que :
          <br />
          {session.user.email}
        </p>

        <section
          style={{
            marginTop: "30px",
            padding: "25px",
            borderRadius: "20px",
            border: "1px solid rgba(255,106,0,0.4)",
            background: "rgba(255,255,255,0.04)",
          }}
        >
          <h2 style={{ color: "#ff6a00" }}>
            Meyden Creator Core
          </h2>

          <ul>
            <li>Monitor Level : Public</li>
            <li>Meyden Coins : 0</li>
            <li>Views : 0</li>
            <li>Tuned On : 0</li>
            <li>Watchtime : 0</li>
          </ul>
        </section>

        <button
          onClick={signOut}
          style={{
            marginTop: "25px",
            padding: "14px 20px",
            background: "#ff6a00",
            color: "black",
            border: "none",
            borderRadius: "12px",
            fontWeight: "bold",
          }}
        >
          Déconnexion
        </button>
      </main>
    )
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg,#050505,#111)",
        color: "white",
        fontFamily: "Arial",
        padding: "32px",
      }}
    >
      <h1 style={{ color: "#ff6a00", fontSize: "42px" }}>
        MEYDEN ECHOSYSTEME
      </h1>

      <p>Connexion Meyden sécurisée active.</p>

      <section
        style={{
          maxWidth: "420px",
          marginTop: "32px",
          padding: "24px",
          border: "1px solid rgba(255,106,0,0.45)",
          borderRadius: "18px",
          background: "rgba(255,255,255,0.04)",
        }}
      >
        <h2 style={{ color: "#ff6a00" }}>
          Accès Meyden
        </h2>

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
            color: "white",
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
            color: "white",
          }}
        />

        <button
          onClick={signUp}
          style={{
            width: "100%",
            padding: "14px",
            marginBottom: "10px",
            borderRadius: "10px",
            border: "none",
            background: "#ff6a00",
            color: "black",
            fontWeight: "bold",
          }}
        >
          Créer un compte
        </button>

        <button
          onClick={signIn}
          style={{
            width: "100%",
            padding: "14px",
            borderRadius: "10px",
            border: "1px solid #ff6a00",
            background: "transparent",
            color: "#ff6a00",
            fontWeight: "bold",
          }}
        >
          Connexion
        </button>

        <p style={{ marginTop: "18px" }}>
          {message}
        </p>
      </section>
    </main>
  )
}
