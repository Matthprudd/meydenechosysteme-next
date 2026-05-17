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
      .order("created_at", { ascending: false })
      .limit(20)

    setLogs(logsData || [])

    const { data: contentData } = await supabase
      .from("monitor_content")
      .select("*")
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

    await supabase.from("monitor_content").insert({
      user_id: user.id,
      title: newTitle.trim(),
      content_type: "video",
      monitor_level: "fans",
      status: "active",
      tuned_on: 0,
      views: 0,
      watchtime_seconds: 0
    })

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

    await supabase.from("tuned_on_events").insert({
      content_id: contentId,
      user_id: user.id
    })

    const selected = contents.find((c) => c.id === contentId)

    if (!selected) return

    await supabase
      .from("monitor_content")
      .update({
        tuned_on: (selected.tuned_on || 0) + 1
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
      padding: "40px",
      fontFamily: "Arial"
    }}>

      <h1 style={{
        color: "#ff6600",
        fontSize: "52px",
        marginBottom: "30px"
      }}>
        MEYDEN MONITOR
      </h1>

      <div style={{
        background: "#080808",
        padding: "30px",
        borderRadius: "20px"
      }}>

        <h2 style={{
          color: "#ff6600"
        }}>
          Nouveau contenu
        </h2>

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
            borderRadius: "10px"
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

        </div>

      </div>

      <div style={{
        marginTop: "30px",
        display: "grid",
        gap: "20px"
      }}>

        {contents.map((item) => (

          <div
            key={item.id}
            style={{
              background: "#080808",
              padding: "25px",
              borderRadius: "20px"
            }}
          >

            <h2 style={{
              color: "#ff6600"
            }}>
              {item.title}
            </h2>

            <p>
              Monitor : {item.monitor_level}
            </p>

            <p>
              Tuned On : {item.tuned_on}
            </p>

            <p>
              Promotion Score : {item.promotion_score || 0}
            </p>

            <p>
              État : {item.evolution_state || "stable"}
            </p>

            <button
              onClick={() => tunedOn(item.id)}
              style={{
                marginTop: "15px",
                background: "#ff6600",
                border: "none",
                padding: "12px 20px",
                color: "#fff",
                borderRadius: "10px",
                cursor: "pointer"
              }}
            >
              ❤️ Tuned On
            </button>

          </div>

        ))}

      </div>

      <div style={{
        background: "#080808",
        padding: "30px",
        borderRadius: "20px",
        marginTop: "30px"
      }}>

        <h2 style={{
          color: "#ff6600"
        }}>
          Live Activity Feed
        </h2>

        {logs.map((log) => (

          <div
            key={log.id}
            style={{
              borderBottom: "1px solid #222",
              padding: "12px 0"
            }}
          >

            <div style={{
              color: "#ff6600"
            }}>
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

      </div>

    </div>
  )
}
