"use client"

import { useEffect, useMemo, useState } from "react"
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
    const { data: { session } } = await supabase.auth.getSession()

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
      .order("promotion_score", { ascending: false })
      .limit(50)

    setContents(contentData || [])
    setLoading(false)
  }

  const stats = useMemo(() => {
    const totalContents = contents.length
    const totalTunedOn = contents.reduce((sum, item) => sum + Number(item.tuned_on || 0), 0)
    const totalViews = contents.reduce((sum, item) => sum + Number(item.views || 0), 0)
    const totalWatchtime = contents.reduce((sum, item) => sum + Number(item.watchtime_seconds || 0), 0)
    const totalCoinsGenerated = contents.reduce((sum, item) => sum + Number(item.coins_generated || 0), 0)

    const monitorCounts = {
      fans: contents.filter((item) => item.monitor_level === "fans").length,
      public_cible: contents.filter((item) => item.monitor_level === "public_cible").length,
      petit_public: contents.filter((item) => item.monitor_level === "petit_public").length,
      grand_public: contents.filter((item) => item.monitor_level === "grand_public").length,
      international: contents.filter((item) => item.monitor_level === "international").length
    }

    const topContents = [...contents]
      .sort((a, b) => Number(b.promotion_score || 0) - Number(a.promotion_score || 0))
      .slice(0, 5)

    const alerts = contents.filter((item) => {
      const tuned = Number(item.tuned_on || 0)
      return tuned >= 4 || item.evolution_state === "viral" || item.monitor_level === "international"
    })

    return {
      totalContents,
      totalTunedOn,
      totalViews,
      totalWatchtime,
      totalCoinsGenerated,
      monitorCounts,
      topContents,
      alerts
    }
  }, [contents])

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
      evolution_state: "stable",
      coins_generated: 0
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

    const { error } = await supabase.from("tuned_on_events").insert({
      content_id: contentId,
      user_id: user.id
    })

    if (error) {
      alert(error.message)
      return
    }

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
      <main style={{
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
      </main>
    )
  }

  if (!user) {
    return (
      <main style={{
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
      </main>
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
        marginBottom: "10px",
        fontWeight: "bold"
      }}>
        MEYDEN MONITOR
      </h1>

      <p style={{ color: "#aaa", marginBottom: "30px" }}>
        Centre fondateur — contenus, cycles, Tuned On, progression et coins.
      </p>

      <section style={{
        background: "#080808",
        padding: "30px",
        borderRadius: "20px",
        marginBottom: "30px",
        border: "1px solid rgba(255,102,0,0.35)"
      }}>
        <h2 style={{ color: "#ff6600" }}>Dashboard Fondateur</h2>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: "15px",
          marginTop: "20px"
        }}>
          {[
            ["Contenus", stats.totalContents],
            ["Tuned On", stats.totalTunedOn],
            ["Views", stats.totalViews],
            ["Watchtime", `${stats.totalWatchtime}s`],
            ["Coins générés", stats.totalCoinsGenerated]
          ].map(([label, value]) => (
            <div key={label} style={{
              background: "#111",
              padding: "18px",
              borderRadius: "14px"
            }}>
              <div style={{ color: "#999", fontSize: "14px" }}>{label}</div>
              <div style={{ color: "#ff6600", fontSize: "28px", fontWeight: "bold" }}>
                {value}
              </div>
            </div>
          ))}
        </div>

        <h3 style={{ color: "#ff6600", marginTop: "30px" }}>
          Répartition des Monitors
        </h3>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
          gap: "12px"
        }}>
          {Object.entries(stats.monitorCounts).map(([monitor, count]) => (
            <div key={monitor} style={{
              background: "#111",
              padding: "14px",
              borderRadius: "12px"
            }}>
              <div>{monitor}</div>
              <strong style={{ color: "#ff6600", fontSize: "22px" }}>{count}</strong>
            </div>
          ))}
        </div>

        <h3 style={{ color: "#ff6600", marginTop: "30px" }}>
          Top contenus
        </h3>

        {stats.topContents.map((item) => (
          <div key={item.id} style={{
            background: "#111",
            padding: "14px",
            borderRadius: "12px",
            marginTop: "10px"
          }}>
            <strong>{item.title}</strong>
            <div style={{ color: "#aaa" }}>
              {item.monitor_level} — Score {item.promotion_score || 0} — Tuned On {item.tuned_on || 0}
            </div>
          </div>
        ))}

        <h3 style={{ color: "#ff6600", marginTop: "30px" }}>
          Alertes
        </h3>

        {stats.alerts.length === 0 ? (
          <p style={{ color: "#999" }}>Aucune alerte critique.</p>
        ) : (
          stats.alerts.slice(0, 5).map((item) => (
            <div key={item.id} style={{
              background: "#160b00",
              padding: "14px",
              borderRadius: "12px",
              marginTop: "10px",
              border: "1px solid rgba(255,102,0,0.35)"
            }}>
              {item.title} approche ou dépasse un seuil stratégique.
            </div>
          ))
        )}
      </section>

      <section style={{
        background: "#080808",
        padding: "30px",
        borderRadius: "20px",
        marginBottom: "30px"
      }}>
        <h2 style={{ color: "#ff6600" }}>Nouveau contenu</h2>

        <p style={{ color: "#aaa", lineHeight: 1.5 }}>
          Tout contenu entre dans Fans. Les Tuned On font progresser le contenu. Les coins commencent seulement à Petit public.
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

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button onClick={addMonitorContent} style={{
            background: "#ff6600",
            border: "none",
            padding: "16px 28px",
            color: "#fff",
            borderRadius: "10px",
            fontSize: "18px",
            cursor: "pointer"
          }}>
            Ajouter au Monitor Fans
          </button>

          <button onClick={runMonitorCycle} style={{
            background: "#111",
            border: "1px solid #ff6600",
            padding: "16px 28px",
            color: "#fff",
            borderRadius: "10px",
            fontSize: "18px",
            cursor: "pointer"
          }}>
            Lancer cycle 2h test
          </button>

          <button onClick={logout} style={{
            background: "#111",
            border: "1px solid #555",
            padding: "16px 28px",
            color: "#fff",
            borderRadius: "10px",
            fontSize: "18px",
            cursor: "pointer"
          }}>
            Logout
          </button>
        </div>
      </section>

      <section style={{ display: "grid", gap: "20px" }}>
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
          <div key={item.id} style={{
            background: "#080808",
            padding: "25px",
            borderRadius: "20px",
            border: item.monitor_level === "international"
              ? "1px solid #ff6600"
              : "1px solid transparent"
          }}>
            <h2 style={{ color: "#ff6600" }}>{item.title}</h2>
            <p>Monitor : {item.monitor_level}</p>
            <p>Tuned On : {item.tuned_on || 0}</p>
            <p>Views : {item.views || 0}</p>
            <p>Watchtime : {item.watchtime_seconds || 0}s</p>
            <p>Promotion Score : {item.promotion_score || 0}</p>
            <p>Coins générés : {item.coins_generated || 0}</p>
            <p>État : {item.evolution_state || "stable"}</p>

            <button onClick={() => tunedOn(item.id)} style={{
              marginTop: "15px",
              background: "#ff6600",
              border: "none",
              padding: "12px 20px",
              color: "#fff",
              borderRadius: "10px",
              cursor: "pointer",
              fontSize: "16px"
            }}>
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
        <h2 style={{ color: "#ff6600" }}>Live Activity Feed</h2>

        {logs.length === 0 && (
          <p style={{ color: "#999" }}>Aucune activité enregistrée.</p>
        )}

        {logs.map((log) => (
          <div key={log.id} style={{
            borderBottom: "1px solid #222",
            padding: "12px 0"
          }}>
            <div style={{ color: "#ff6600" }}>{log.action}</div>
            <div>{log.module}</div>
            <div style={{ color: "#777", fontSize: "14px" }}>{log.details}</div>
          </div>
        ))}
      </section>
    </main>
  )
}
