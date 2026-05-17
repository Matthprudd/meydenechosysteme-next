"use client"

import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"

export default function Home() {

  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkUser()
  }, [])

  async function checkUser() {

    const {
      data: { session }
    } = await supabase.auth.getSession()

    if (!session?.user) {
      setLoading(false)
      return
    }

    setUser(session.user)

    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single()

    setProfile(data)
    setLoading(false)
  }

  async function logout() {
    await supabase.auth.signOut()
    window.location.reload()
  }

  async function addCoins() {

  if (!user) return

  await supabase
    .from("coins_transactions")
    .insert({
      user_id: user.id,
      amount: 5,
      reason: "Tuned On Event"
    })

  await supabase
    .from("live_activity_logs")
    .insert({
      user_id: user.id,
      action: "Tuned On",
      module: "Meyden Coins",
      details: "+5 coins ajoutés"
    })

  window.location.reload()
}

  if (loading) {
    return (
      <div style={{
        background: "#000",
        color: "#ff6600",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "24px"
      }}>
        Chargement Meyden OS...
      </div>
    )
  }

  return (
    <div style={{
      background: "#000",
      color: "#fff",
      minHeight: "100vh",
      padding: "60px"
    }}>

      <h1 style={{
        color: "#ff6600",
        fontSize: "64px",
        marginBottom: "40px",
        fontWeight: "bold"
      }}>
        MEYDEN OS CORE
      </h1>

      <div style={{
        border: "1px solid #ff6600",
        borderRadius: "20px",
        padding: "30px",
        marginBottom: "30px",
        background: "#090909"
      }}>

        <h2 style={{
          fontSize: "48px",
          marginBottom: "30px"
        }}>
          Session active
        </h2>

        <p style={{ fontSize: "30px" }}>
          Email : {user.email}
        </p>

        <p style={{ fontSize: "30px" }}>
          Role : {profile?.role}
        </p>

        <p style={{ fontSize: "30px" }}>
          Nom : {profile?.nom}
        </p>

        <p style={{
          fontSize: "42px",
          color: "#ff6600",
          marginTop: "30px"
        }}>
          Coins : {profile?.coins || 0}
        </p>

        <button
          onClick={addCoins}
          style={{
            background: "#ff6600",
            border: "none",
            padding: "20px 40px",
            color: "#fff",
            fontSize: "26px",
            borderRadius: "10px",
            marginTop: "30px",
            cursor: "pointer"
          }}
        >
          +5 Tuned On Coins
        </button>

        <br />

        <button
          onClick={logout}
          style={{
            marginTop: "30px",
            background: "#111",
            border: "1px solid #ff6600",
            padding: "15px 30px",
            color: "#fff",
            fontSize: "20px",
            borderRadius: "10px",
            cursor: "pointer"
          }}
        >
          Logout
        </button>

      </div>

      <div style={{
        display: "grid",
        gap: "20px"
      }}>

        <div style={{
          background: "#080808",
          padding: "30px",
          borderRadius: "20px",
          fontSize: "28px"
        }}>
          Meyden Monitor
        </div>

        <div style={{
          background: "#080808",
          padding: "30px",
          borderRadius: "20px",
          fontSize: "28px"
        }}>
          Creator Dashboard
        </div>

        <div style={{
          background: "#080808",
          padding: "30px",
          borderRadius: "20px",
          fontSize: "28px"
        }}>
          Activity Logs
        </div>

      </div>

    </div>
  )
}
