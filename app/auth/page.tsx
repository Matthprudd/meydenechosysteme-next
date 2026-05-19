"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "../../lib/supabase"

export default function AuthPage() {
  const router = useRouter()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  async function signIn() {
    if (!email || !password) {
      alert("Entre ton courriel et ton mot de passe.")
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password
    })

    setLoading(false)

    if (error) {
      alert(error.message)
      return
    }

    router.replace("/")
  }

  async function signUp() {
    if (!email || !password) {
      alert("Entre ton courriel et ton mot de passe.")
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password
    })

    setLoading(false)

    if (error) {
      alert(error.message)
      return
    }

    alert("Compte créé. Connecte-toi maintenant.")
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#050505",
        color: "white",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        fontFamily: "Arial",
        padding: "20px"
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: "380px",
          padding: "30px",
          border: "1px solid #ff6600",
          borderRadius: "16px",
          background: "#111"
        }}
      >
        <h1 style={{ color: "#ff6600" }}>MEYDEN LOGIN</h1>

        <input
          type="email"
          placeholder="Courriel"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
        />

        <input
          type="password"
          placeholder="Mot de passe / NIP"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle}
        />

        <button onClick={signIn} disabled={loading} style={buttonMain}>
          {loading ? "Chargement..." : "Connexion"}
        </button>

        <button onClick={signUp} disabled={loading} style={buttonDark}>
          Créer un compte
        </button>
      </section>
    </main>
  )
}

const inputStyle = {
  width: "100%",
  padding: "14px",
  marginTop: "12px",
  background: "#222",
  border: "1px solid #333",
  borderRadius: "8px",
  color: "white",
  boxSizing: "border-box" as const
}

const buttonMain = {
  width: "100%",
  padding: "14px",
  marginTop: "20px",
  background: "#ff6600",
  border: "none",
  borderRadius: "8px",
  color: "white",
  cursor: "pointer"
}

const buttonDark = {
  width: "100%",
  padding: "14px",
  marginTop: "10px",
  background: "#333",
  border: "none",
  borderRadius: "8px",
  color: "white",
  cursor: "pointer"
}
