"use client"

import { useEffect, useMemo, useState } from "react"
import { supabase } from "../lib/supabase"

const BUCKET_NAME = "meyden-media"

export default function Home() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [logs, setLogs] = useState<any[]>([])
  const [contents, setContents] = useState<any[]>([])
  const [newTitle, setNewTitle] = useState("")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

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
      .order("promotion_score", { ascending: false })
      .limit(50)

    setContents(contentData || [])
    setLoading(false)
  }

  const stats = useMemo(() => {
    return {
      totalContents: contents.length,
      totalTunedOn: contents.reduce((sum, item) => sum + Number(item.tuned_on || 0), 0),
      totalViews: contents.reduce((sum, item) => sum + Number(item.views || 0), 0),
      totalWatchtime: contents.reduce((sum, item) => sum + Number(item.watchtime_seconds || 0), 0),
      totalCoinsGenerated: contents.reduce((sum, item) => sum + Number(item.coins_generated || 0), 0)
    }
  }, [contents])

  async function logout() {
    await supabase.auth.signOut()
    window.location.reload()
  }

  async function uploadMedia() {
    if (!user) {
      alert("Utilisateur non connecté.")
      return
    }

    if (!newTitle.trim()) {
      alert("Ajoute un titre.")
      return
    }

    if (!selectedFile) {
      alert("Choisis un fichier média.")
      return
    }

    const fileExt = selectedFile.name.split(".").pop()
    const safeName = selectedFile.name
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9.-]/g, "")

    const filePath = `${user.id}/${Date.now()}-${safeName || `media.${fileExt}`}`

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, selectedFile, {
        cacheControl: "3600",
        upsert: false
      })

    if (uploadError) {
      alert(`Upload error: ${uploadError.message}`)
      return
    }

    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath)

    const fileUrl = publicUrlData.publicUrl

    let mediaType = "video"
    if (selectedFile.type.startsWith("image/")) mediaType = "image"
    if (selectedFile.type.startsWith("audio/")) mediaType = "audio"

    const { error } = await supabase.from("monitor_content").insert({
      user_id: user.id,
      title: newTitle.trim(),
      file_url: fileUrl,
      media_type: mediaType,
      content_type: mediaType,
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
      alert(`Database error: ${error.message}`)
      return
    }

    await supabase.from("live_activity_logs").insert({
      user_id: user.id,
      action: "Upload média",
      module: "Meyden Monitor",
      details: newTitle.trim()
    })

    window.location.reload()
  }

  async function tunedOn(contentId: number) {
    if (!user) return

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
      details: `Tuned On contenu ${contentId}`
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
      details: "Cycle 2h lancé"
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
        <h1 style={{ color: "#ff6600" }}>MEYDEN MONITOR</h1>
        <p>Aucun utilisateur connecté.</p>
        <a href="/auth" style={{ color: "#ff6600" }}>Aller au login</a>
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
      <h1 style={{ color: "#ff6600", fontSize: "52px" }}>MEYDEN MONITOR</h1>
      <p style={{ color: "#999" }}>Dashboard Fondateur</p>

      <section style={{
        background: "#080808",
        padding: "30px",
        borderRadius: "20px",
        marginBottom: "30px"
      }}>
        <h2 style={{ color: "#ff6600" }}>Upload média</h2>

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

        <input
          type="file"
          accept="image/*,video/*,audio/*"
          onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
          style={{ marginBottom: "20px", color: "#fff" }}
        />

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button onClick={uploadMedia} style={buttonMain}>
            Upload Monitor
          </button>

          <button onClick={runMonitorCycle} style={buttonDark}>
            Cycle 2h test
          </button>

          <button onClick={logout} style={buttonDark}>
            Logout
          </button>
        </div>
      </section>

      <section style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
        gap: "15px",
        marginBottom: "30px"
      }}>
        <Stat label="Total contenus" value={stats.totalContents} />
        <Stat label="Total Tuned On" value={stats.totalTunedOn} />
        <Stat label="Total Views" value={stats.totalViews} />
        <Stat label="Watchtime" value={stats.totalWatchtime} />
        <Stat label="Coins générés" value={stats.totalCoinsGenerated} />
      </section>

      <section style={{ display: "grid", gap: "20px" }}>
        {contents.map((item) => (
          <div key={item.id} style={{
            background: "#080808",
            padding: "25px",
            borderRadius: "20px"
          }}>
            <h2 style={{ color: "#ff6600" }}>{item.title}</h2>

            <p>Monitor : {item.monitor_level}</p>
            <p>Tuned On : {item.tuned_on || 0}</p>
            <p>Views : {item.views || 0}</p>
            <p>Watchtime : {item.watchtime_seconds || 0}</p>
            <p>Score : {item.promotion_score || 0}</p>
            <p>Coins : {item.coins_generated || 0}</p>
            <p>État : {item.evolution_state || "stable"}</p>

            {item.media_type === "video" && item.file_url && (
              <video src={item.file_url} controls style={mediaStyle} />
            )}

            {item.media_type === "image" && item.file_url && (
              <img src={item.file_url} alt={item.title} style={mediaStyle} />
            )}

            {item.media_type === "audio" && item.file_url && (
              <audio src={item.file_url} controls style={{ width: "100%", marginTop: "15px" }} />
            )}

            <button onClick={() => tunedOn(item.id)} style={buttonMain}>
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

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div style={{
      background: "#080808",
      padding: "20px",
      borderRadius: "16px"
    }}>
      <div>{label}</div>
      <h2 style={{ color: "#ff6600" }}>{value}</h2>
    </div>
  )
}

const buttonMain = {
  background: "#ff6600",
  border: "none",
  padding: "16px 28px",
  color: "#fff",
  borderRadius: "10px",
  fontSize: "18px",
  cursor: "pointer"
}

const buttonDark = {
  background: "#111",
  border: "1px solid #ff6600",
  padding: "16px 28px",
  color: "#fff",
  borderRadius: "10px",
  fontSize: "18px",
  cursor: "pointer"
}

const mediaStyle = {
  width: "100%",
  borderRadius: "14px",
  marginTop: "15px"
}
