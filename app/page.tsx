"use client"

import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"

export default function Home() {
  const [user, setUser] = useState<any>(null)
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

    const { data: logsData } = await supabase
      .from("live_activity_logs")
      .select("*")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false })
      .limit(20)

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

  async function addMonitorContent() {
    if (!user || !newTitle.trim()) return

    const { error } = await supabase.from("monitor_content").insert({
      user_id: user.id,
      title: newTitle.trim(),
      content_type: "video",
      monitor_level: "fans",
      status: "active",
      tuned_on: 0,
      views: 0,
      watchtime_seconds: 0,
      promotion_score: 0,
      evolution_state: "stable"
    })

    if (error) {
      alert(error.message)
      return
    }

    await supabase.from("live_activity_logs").insert({
      user_id: user.id,
      action: "Nouveau contenu",
      module: "Meyden Monitor",
      details: `${newTitle.trim()} ajouté dans Fans`
    })

    window.location.reload()
  }

  async function tunedOn(contentId: number) {
    if (!user) return

    const selected = contents.find((c) => c.id === contentId)
    if (!selected) return

    const currentTunedOn = Number(selected.tuned_on || 0)

    const { error } = await supabase.from("tuned_on_events").insert({
      content_id: contentId,
      user_id: user.id
    })

    if (error) {
      alert(error.message)
      return
    }

    await supabase
      .from("monitor_content")
      .update({
        tuned_on: currentTunedOn + 1
      })
      .eq("id", contentId)

    await supabase.from("live_activity_logs").insert({
      user_id: user.id,
      action: "Tuned On",
      module: "Meyden Monitor",
      details: `Tuned On sur ${selected.title}`
    })

    window.location.reload()
  }

  async function runMonitorCycle() {
    if (!user) return

    const { error } = await supabase.rpc("process_monitor_cycle")

    if (error) {
      alert(error.message)
      return
    }

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
      <div style={{
        background: "#000",
        color: "#ff6600",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "24px",
        fontFamily: "Arial"
      }}>
        Chargement Meyden OS...
      </div>
    )
  }

  if (!user) {
    return (
      <div style={{
        background: "#000",
        color: "#fff",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        fontFamily: "Arial"
      }}>
        <h1 style={{ color: "#ff6600", fontSize: "42px" }}>
          MEYDEN ECHOSYSTEME
        </h1>

        <p>Aucun utilisateur connecté.</p>

        <a href="/auth" style={{ color: "#ff6600", fontSize: "22px" }}>
          Aller au login
        </a>
      </div>
    )
  }

  return (
    <main style={{
      background: "#000",
      color: "#fff",
      minHeight: "100vh",
      padding: "40px",
      fontFamily: "Arial"
    }}>
      <h1 style={{
        color: "#ff6600",
        fontSize: "52px",
        marginBottom: "30px",
        fontWeight: "bold"
      }}>
        MEYDEN MONITOR
      </h1>

      <section style={{
        background: "#080808",
        padding: "30px",
        borderRadius: "20px",
        marginBottom: "30px"
      }}>
        <h2 style={{ color: "#ff6600" }}>Nouveau contenu</h2>

        <p style={{ color: "#aaa", lineHeight: 1.5 }}>
          Tout contenu entre automatiquement dans le monitor Fans. Les Tuned On
          font progresser le contenu. Les coins sont générés seulement quand le
          contenu atteint Petit public, Grand public ou International.
        </p>

        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Titre du contenu"
          style={{
            width: "100%",
            padding: "16px",
            marginTop: "20px",
            marginBottom: "20px",
            background: "#111",
            color: "#fff",
            border: "1px solid #ff6600",
            borderRadius: "10px",
            boxSizing: "border-box"
          }}
        />

        <div style={{
          display: "flex",
          gap: "10px",
          flexWrap: "wrap"
        }}>
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

          <button
            onClick={logout}
            style={{
              background: "#111",
              border: "1px solid #555",
              padding: "16px 28px",
              color: "#fff",
              borderRadius: "10px",
              fontSize: "18px",
              cursor: "pointer"
            }}
          >
            Logout
          </button>
        </div>
      </section>

      <section style={{
        display: "grid",
        gap: "20px"
      }}>
        {contents.length === 0 && (
          <div style={{
            background: "#080808",
            padding: "25px",
            borderRadius: "20px",
            color: "#aaa"
          }}>
            Aucun contenu Monitor pour l’instant.
          </div>
        )}

        {contents.map((item) => (
          <div
            key={item.id}
            style={{
              background: "#080808",
              padding: "25px",
              borderRadius: "20px",
              border:
                item.monitor_level === "international"
                  ? "1px solid #ff6600"
                  : "1px solid transparent"
            }}
          >
            <h2 style={{ color: "#ff6600" }}>
              {item.title}
            </h2>

            <p>Monitor : {item.monitor_level}</p>
            <p>Tuned On : {item.tuned_on || 0}</p>
            <p>Views : {item.views || 0}</p>
            <p>Watchtime : {item.watchtime_seconds || 0}s</p>
            <p>Promotion Score : {item.promotion_score || 0}</p>
            <p>État : {item.evolution_state || "stable"}</p>

            <button
              onClick={() => tunedOn(item.id)}
              style={{
                marginTop: "15px",
                background: "#ff6600",
                border: "none",
                padding: "12px 20px",
                color: "#fff",
                borderRadius: "10px",
                cursor: "pointer",
                fontSize: "16px"
              }}
            >
              ❤️ Tuned On
            </button>
          </div>
        ))}
      </section>

      <section style={{
        background: "#080808",
        padding: "30px",
        borderRadius: "20px",
        marginTop: "30px"
      }}>
        <h2 style={{ color: "#ff6600" }}>
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
              padding: "12px 0"
            }}
          >
            <div style={{ color: "#ff6600" }}>
              {log.action}
            </div>

            <div>
              {log.module}
            </div>

            <div style={{
              color: "#777",
              fontSize: "14px"
            }}>
              {log.details}
            </div>
          </div>
        ))}
      </section>
    </main>
  )
}
