"use client"

import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"

export default function Home() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [logs, setLogs] = useState<any[]>([])
  const [contents, setContents] = useState<any[]>([])
  const [newTitle, setNewTitle] = useState("")

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

    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single()

    setProfile(profileData)

    const { data: logsData } = await supabase
      .from("live_activity_logs")
      .select("*")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false })
      .limit(10)

    setLogs(logsData || [])

    const { data: contentData } = await supabase
      .from("monitor_content")
      .select("*")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false })
      .limit(20)

    setContents(contentData || [])

    setLoading(false)
  }

  async function logout() {
    await supabase.auth.signOut()
    window.location.reload()
  }

  async function addCoins() {
    if (!user) return

    await supabase.from("coins_transactions").insert({
      user_id: user.id,
      amount: 5,
      reason: "Tuned On Event"
    })

    await supabase.from("live_activity_logs").insert({
      user_id: user.id,
      action: "Tuned On",
      module: "Meyden Coins",
      details: "+5 coins ajoutés"
    })

    window.location.reload()
  }

  async function addMonitorContent() {
    if (!user || !newTitle.trim()) return

    await supabase.from("monitor_content").insert({
      user_id: user.id,
      title: newTitle.trim(),
      content_type: "video",
      monitor_level: "fans",
      status: "active"
    })

    await supabase.from("live_activity_logs").insert({
      user_id: user.id,
      action: "Nouveau contenu",
      module: "Meyden Monitor",
      details: `${newTitle.trim()} ajouté dans Fans`
    })

    window.location.reload()
  }

  async function runMonitorCycle() {
    await supabase.rpc("process_monitor_cycle")

    await supabase.from("live_activity_logs").insert({
      user_id: user.id,
      action: "Cycle Monitor",
      module: "Meyden Monitor",
      details: "Cycle 2h simulé lancé"
    })

    window.location.reload()
  }

  if (loading) {
    return (
      <div
        style={{
          background: "#000",
          color: "#ff6600",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "24px",
          fontFamily: "Arial"
        }}
      >
        Chargement Meyden OS...
      </div>
    )
  }

  if (!user) {
    return (
      <div
        style={{
          background: "#000",
          color: "#fff",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          fontFamily: "Arial"
        }}
      >
        <h1 style={{ color: "#ff6600", fontSize: "42px" }}>
          MEYDEN ECHOSYSTEME
        </h1>

        <p>Aucun utilisateur connecté.</p>

        <a
          href="/auth"
          style={{
            color: "#ff6600",
            fontSize: "22px"
          }}
        >
          Aller au login
        </a>
      </div>
    )
  }

  return (
    <div
      style={{
        background: "#000",
        color: "#fff",
        minHeight: "100vh",
        padding: "40px",
        fontFamily: "Arial"
      }}
    >
      <h1
        style={{
          color: "#ff6600",
          fontSize: "48px",
          marginBottom: "30px",
          fontWeight: "bold"
        }}
      >
        MEYDEN OS CORE
      </h1>

      <div
        style={{
          border: "1px solid #ff6600",
          borderRadius: "20px",
          padding: "25px",
          marginBottom: "30px",
          background: "#090909"
        }}
      >
        <h2
          style={{
            fontSize: "34px",
            marginBottom: "25px"
          }}
        >
          Session active
        </h2>

        <p>Email : {user.email}</p>
        <p>Role : {profile?.role}</p>
        <p>Nom : {profile?.nom}</p>

        <p
          style={{
            fontSize: "34px",
            color: "#ff6600",
            marginTop: "25px"
          }}
        >
          Coins : {profile?.coins || 0}
        </p>

        <button
          onClick={addCoins}
          style={{
            background: "#ff6600",
            border: "none",
            padding: "16px 28px",
            color: "#fff",
            fontSize: "20px",
            borderRadius: "10px",
            marginTop: "20px",
            cursor: "pointer"
          }}
        >
          +5 Tuned On Coins
        </button>

        <br />

        <button
          onClick={logout}
          style={{
            marginTop: "20px",
            background: "#111",
            border: "1px solid #ff6600",
            padding: "12px 22px",
            color: "#fff",
            fontSize: "18px",
            borderRadius: "10px",
            cursor: "pointer"
          }}
        >
          Logout
        </button>
      </div>

      <div
        style={{
          background: "#080808",
          padding: "30px",
          borderRadius: "20px",
          marginTop: "30px"
        }}
      >
        <h2
          style={{
            color: "#ff6600",
            fontSize: "32px",
            marginBottom: "10px"
          }}
        >
          Meyden Monitor Content
        </h2>

        <p
          style={{
            color: "#aaa",
            marginBottom: "20px"
          }}
        >
          Tout nouveau contenu entre automatiquement dans le monitor FANS.
          Le système le fera évoluer plus tard par cycles de 2 heures.
        </p>

        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Titre du contenu"
          style={{
            width: "100%",
            padding: "16px",
            marginBottom: "20px",
            background: "#111",
            color: "#fff",
            border: "1px solid #ff6600",
            borderRadius: "10px",
            boxSizing: "border-box"
          }}
        />

        <div
          style={{
            display: "flex",
            gap: "10px",
            flexWrap: "wrap"
          }}
        >
          <button
            onClick={addMonitorContent}
            style={{
              background: "#ff6600",
              border: "none",
              padding: "16px 28px",
              color: "#fff",
              borderRadius: "10px",
              fontSize: "18px",
              cursor: "pointer"
            }}
          >
            Ajouter au Monitor Fans
          </button>

          <button
            onClick={runMonitorCycle}
            style={{
              background: "#111",
              border: "1px solid #ff6600",
              padding: "16px 28px",
              color: "#fff",
              borderRadius: "10px",
              fontSize: "18px",
              cursor: "pointer"
            }}
          >
            Lancer cycle 2h test
          </button>
        </div>

        {contents.map((item) => (
          <div
            key={item.id}
            style={{
              marginTop: "20px",
              padding: "20px",
              background: "#111",
              borderRadius: "12px"
            }}
          >
            <strong
              style={{
                fontSize: "22px",
                color: "#ff6600"
              }}
            >
              {item.title}
            </strong>

            <p>Monitor actuel : {item.monitor_level}</p>
            <p>Tuned On : {item.tuned_on}</p>
            <p>Watchtime : {item.watchtime_seconds}s</p>
            <p>Promotion Score : {item.promotion_score || 0}</p>
            <p>État : {item.evolution_state || "stable"}</p>
          </div>
        ))}
      </div>

      <div
        style={{
          background: "#080808",
          padding: "30px",
          borderRadius: "20px",
          marginTop: "30px"
        }}
      >
        <h2
          style={{
            color: "#ff6600",
            fontSize: "32px",
            marginBottom: "20px"
          }}
        >
          Live Activity Feed
        </h2>

        {logs.length === 0 && (
          <p style={{ color: "#999" }}>
            Aucune activité enregistrée.
          </p>
        )}

        {logs.map((log) => (
          <div
            key={log.id}
            style={{
              borderBottom: "1px solid #222",
              padding: "15px 0"
            }}
          >
            <div
              style={{
                color: "#ff6600",
                fontSize: "22px",
                fontWeight: "bold"
              }}
            >
              {log.action}
            </div>

            <div
              style={{
                color: "#fff",
                marginTop: "5px"
              }}
            >
              {log.module}
            </div>

            <div
              style={{
                color: "#777",
                marginTop: "5px",
                fontSize: "14px"
              }}
            >
              {log.details}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
