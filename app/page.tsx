"use client"

import { useEffect, useMemo, useState, type CSSProperties } from "react"
import { supabase } from "../lib/supabase"

const BUCKET_NAME = "meyden-media"

const MONITORS = [
  "fans",
  "public_cible",
  "petit_public",
  "grand_public",
  "international"
]

export default function Home() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const [logs, setLogs] = useState<any[]>([])
  const [contents, setContents] = useState<any[]>([])

  const [monitorSystem, setMonitorSystem] = useState<any>(null)

  const [activeMonitor, setActiveMonitor] = useState("fans")

  const [currentIndex, setCurrentIndex] = useState(0)

  const [newTitle, setNewTitle] = useState("")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const filteredContents = useMemo(() => {
    return contents.filter(
      (item) => item.monitor_level === activeMonitor
    )
  }, [contents, activeMonitor])

  const currentContent = filteredContents[currentIndex]

  useEffect(() => {
    checkUser()
  }, [])

  useEffect(() => {
    setCurrentIndex(0)
  }, [activeMonitor])

  useEffect(() => {
    if (filteredContents.length === 0) return

    const seconds =
      Number(monitorSystem?.average_seconds_per_content || 15) > 0
        ? Number(monitorSystem?.average_seconds_per_content || 15)
        : 15

    const timer = setTimeout(() => {
      goNextContent()
    }, seconds * 1000)

    return () => clearTimeout(timer)
  }, [
    currentIndex,
    filteredContents.length,
    activeMonitor,
    monitorSystem
  ])

  function goNextContent() {
    setCurrentIndex((prev) => {
      if (filteredContents.length === 0) return 0

      return prev + 1 >= filteredContents.length
        ? 0
        : prev + 1
    })
  }

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
      .order("promotion_score", { ascending: false })
      .limit(100)

    setContents(contentData || [])

    const { data: monitorData } = await supabase
      .from("monitor_system")
      .select("*")
      .eq("id", "main")
      .single()

    setMonitorSystem(monitorData)

    setLoading(false)
  }

  const stats = useMemo(() => {
    return {
      totalContents: contents.length,

      totalTunedOn: contents.reduce(
        (sum, item) => sum + Number(item.tuned_on || 0),
        0
      ),

      totalViews: contents.reduce(
        (sum, item) => sum + Number(item.views || 0),
        0
      ),

      totalWatchtime: contents.reduce(
        (sum, item) =>
          sum + Number(item.watchtime_seconds || 0),
        0
      ),

      totalCoinsGenerated: contents.reduce(
        (sum, item) =>
          sum + Number(item.coins_generated || 0),
        0
      )
    }
  }, [contents])

  async function logout() {
    await supabase.auth.signOut()
    window.location.reload()
  }

  async function processAdaptiveCycle() {
    const { error } = await supabase.rpc(
      "process_adaptive_cycle"
    )

    if (error) {
      alert(error.message)
      return
    }

    alert("Cycle adaptatif exécuté.")

    checkUser()
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

    try {
      alert("Préparation du fichier...")

      const allowedTypes = [
        "image/",
        "video/",
        "audio/"
      ]

      const isAllowed = allowedTypes.some((type) =>
        selectedFile.type.startsWith(type)
      )

      if (!isAllowed) {
        alert("Format refusé.")
        return
      }

      const safeName = selectedFile.name
        .replace(/\s+/g, "-")
        .replace(/[^a-zA-Z0-9.-]/g, "")

      const filePath = `${user.id}/${Date.now()}-${safeName}`

      alert("Téléversement vers Meyden Storage...")

      const { error: uploadError } =
        await supabase.storage
          .from(BUCKET_NAME)
          .upload(filePath, selectedFile, {
            cacheControl: "3600",
            upsert: false,
            contentType: selectedFile.type
          })

      if (uploadError) {
        alert(`Upload error: ${uploadError.message}`)
        return
      }

      const { data: publicUrlData } =
        supabase.storage
          .from(BUCKET_NAME)
          .getPublicUrl(filePath)

      const fileUrl = publicUrlData.publicUrl

      if (!fileUrl) {
        alert("Impossible de générer le lien public.")
        return
      }

      let mediaType = "video"

      if (selectedFile.type.startsWith("image/")) {
        mediaType = "image"
      }

      if (selectedFile.type.startsWith("audio/")) {
        mediaType = "audio"
      }

      alert("Sauvegarde dans le Monitor...")

      const { error: insertError } =
        await supabase
          .from("monitor_content")
          .insert({
            user_id: user.id,
            title: newTitle.trim(),
            file_url: fileUrl,
            media_type: mediaType,
            content_type: mediaType,
            monitor_level: activeMonitor,
            status: "active",
            tuned_on: 0,
            views: 0,
            watchtime_seconds: 0,
            promotion_score: 0,
            evolution_state: "stable",
            coins_generated: 0
          })

      if (insertError) {
        alert(
          `Database error: ${insertError.message}`
        )
        return
      }

      await supabase
        .from("live_activity_logs")
        .insert({
          user_id: user.id,
          action: "Upload média",
          module: "Meyden Monitor",
          details: `${newTitle.trim()} envoyé dans ${activeMonitor}`
        })

      alert("Upload réussi dans Meyden Monitor.")

      setNewTitle("")
      setSelectedFile(null)

      checkUser()
    } catch (err: any) {
      alert(`Erreur système: ${err.message}`)
    }
  }

  async function tunedOn(contentId: number) {
    if (!user) return

    const target = contents.find(
      (item) => item.id === contentId
    )

    if (!target) return

    const updatedTuned =
      Number(target.tuned_on || 0) + 1

    const updatedViews =
      Number(target.views || 0) + 5

    const updatedScore =
      Number(target.promotion_score || 0) + 6

    const updatedWatchtime =
      Number(target.watchtime_seconds || 0) + 25

    let updatedCoins =
      Number(target.coins_generated || 0)

    let updatedMonitor = target.monitor_level

    if (updatedScore >= 1000) {
      updatedMonitor = "international"
      updatedCoins += 3
    } else if (updatedScore >= 400) {
      updatedMonitor = "grand_public"
      updatedCoins += 2
    } else if (updatedScore >= 150) {
      updatedMonitor = "petit_public"
      updatedCoins += 1
    } else if (updatedScore >= 50) {
      updatedMonitor = "public_cible"
    }

    await supabase
      .from("monitor_content")
      .update({
        tuned_on: updatedTuned,
        views: updatedViews,
        promotion_score: updatedScore,
        coins_generated: updatedCoins,
        watchtime_seconds: updatedWatchtime,
        monitor_level: updatedMonitor,
        evolution_state:
          updatedScore >= 400
            ? "viral"
            : updatedScore >= 150
            ? "progression"
            : updatedScore >= 50
            ? "potentiel"
            : "stable"
      })
      .eq("id", contentId)

    await supabase
      .from("tuned_on_events")
      .insert({
        content_id: contentId,
        user_id: user.id
      })

    await supabase
      .from("live_activity_logs")
      .insert({
        user_id: user.id,
        action: "Tuned On",
        module: "Meyden Monitor",
        details: `Tuned On contenu ${contentId}`
      })

    checkUser()
  }

  if (loading) {
    return (
      <main style={loadingStyle}>
        Chargement Meyden OS...
      </main>
    )
  }

  if (!user) {
    return (
      <main style={loginStyle}>
        <h1 style={{ color: "#ff6600" }}>
          MEYDEN MONITOR
        </h1>

        <p>Aucun utilisateur connecté.</p>

        <a
          href="/auth"
          style={{ color: "#ff6600" }}
        >
          Aller au login
        </a>
      </main>
    )
  }

  return (
    <main style={mainStyle}>
      <section style={stickyStyle}>
        <div style={monitorBarStyle}>
          {MONITORS.map((monitor) => (
            <button
              key={monitor}
              onClick={() =>
                setActiveMonitor(monitor)
              }
              style={{
                ...monitorButtonStyle,
                background:
                  activeMonitor === monitor
                    ? "#ff6600"
                    : "#111"
              }}
            >
              {monitor}
            </button>
          ))}
        </div>

        {monitorSystem && (
          <div style={systemLineStyle}>
            <div>
              Cycle :{" "}
              {
                monitorSystem.active_cycle_minutes
              }{" "}
              min
            </div>

            <div>
              Mode :{" "}
              {monitorSystem.monitor_mode}
            </div>

            <div>
              Contenus :{" "}
              {
                monitorSystem.total_active_contents
              }
            </div>

            <div>
              Utilisateurs live :{" "}
              {
                monitorSystem.total_active_users
              }
            </div>

            <div>
              Temps/contenu :{" "}
              {
                monitorSystem.average_seconds_per_content
              }
              s
            </div>
          </div>
        )}
      </section>

      <section style={{ padding: "40px" }}>
        <h1
          style={{
            color: "#ff6600",
            fontSize: "52px"
          }}
        >
          MEYDEN MONITOR
        </h1>

        <p style={{ color: "#999" }}>
          Diffusion continue adaptative
        </p>

        {currentContent ? (
          <section style={streamBoxStyle}>
            <div style={{ padding: "25px" }}>
              <h2
                style={{
                  color: "#ff6600",
                  fontSize: "38px"
                }}
              >
                {currentContent.title}
              </h2>

              <p>
                Monitor :{" "}
                {currentContent.monitor_level}
              </p>

              <p>
                Tuned On :{" "}
                {currentContent.tuned_on || 0}
              </p>

              <p>
                Views :{" "}
                {currentContent.views || 0}
              </p>

              <p>
                Watchtime :{" "}
                {currentContent.watchtime_seconds ||
                  0}
              </p>

              <p>
                Score :{" "}
                {currentContent.promotion_score ||
                  0}
              </p>

              <p>
                Coins :{" "}
                {currentContent.coins_generated ||
                  0}
              </p>

              <p>
                État :{" "}
                {currentContent.evolution_state ||
                  "stable"}
              </p>
            </div>

            {currentContent.media_type ===
              "video" &&
              currentContent.file_url && (
                <video
                  key={currentContent.id}
                  src={currentContent.file_url}
                  autoPlay
                  muted
                  playsInline
                  controls={false}
                  onEnded={goNextContent}
                  onPause={(e) => {
                    e.currentTarget
                      .play()
                      .catch(() => {})
                  }}
                  style={mediaStyle}
                />
              )}

            {currentContent.media_type ===
              "image" &&
              currentContent.file_url && (
                <img
                  key={currentContent.id}
                  src={currentContent.file_url}
                  alt={currentContent.title}
                  style={mediaStyle}
                />
              )}

            {currentContent.media_type ===
              "audio" &&
              currentContent.file_url && (
                <audio
                  key={currentContent.id}
                  src={currentContent.file_url}
                  autoPlay
                  controls={false}
                  onEnded={goNextContent}
                />
              )}

            <div style={{ padding: "20px" }}>
              <button
                onClick={() =>
                  tunedOn(currentContent.id)
                }
                style={buttonMain}
              >
                ❤️ Tuned On
              </button>
            </div>
          </section>
        ) : (
          <section style={streamBoxStyle}>
            <h2 style={{ color: "#ff6600" }}>
              Aucun contenu dans ce monitor.
            </h2>

            <p>
              Ajoute du contenu ou choisis un
              autre monitor.
            </p>
          </section>
        )}

        <section style={uploadBoxStyle}>
          <h2 style={{ color: "#ff6600" }}>
            Upload média
          </h2>

          <input
            value={newTitle}
            onChange={(e) =>
              setNewTitle(e.target.value)
            }
            placeholder="Titre du contenu"
            style={inputStyle}
          />

          <input
            type="file"
            accept="image/*,video/*,audio/*"
            onChange={(e) =>
              setSelectedFile(
                e.target.files?.[0] || null
              )
            }
            style={{
              marginBottom: "20px",
              color: "#fff"
            }}
          />

          {selectedFile && (
            <div
              style={{
                marginBottom: "20px",
                color: "#00ff99"
              }}
            >
              ✔ Fichier prêt :{" "}
              {selectedFile.name}
            </div>
          )}

          <div style={buttonRowStyle}>
            <button
              onClick={uploadMedia}
              style={buttonMain}
            >
              Upload Monitor
            </button>

            <button
              onClick={processAdaptiveCycle}
              style={buttonDark}
            >
              Adaptive Cycle
            </button>

            <button
              onClick={logout}
              style={buttonDark}
            >
              Logout
            </button>
          </div>
        </section>

        <section style={statsGridStyle}>
          <Stat
            label="Total contenus"
            value={stats.totalContents}
          />

          <Stat
            label="Total Tuned On"
            value={stats.totalTunedOn}
          />

          <Stat
            label="Total Views"
            value={stats.totalViews}
          />

          <Stat
            label="Watchtime"
            value={stats.totalWatchtime}
          />

          <Stat
            label="Coins générés"
            value={stats.totalCoinsGenerated}
          />
        </section>

        <section style={feedStyle}>
          <h2 style={{ color: "#ff6600" }}>
            Live Activity Feed
          </h2>

          {logs.map((log) => (
            <div key={log.id} style={logStyle}>
              <div style={{ color: "#ff6600" }}>
                {log.action}
              </div>

              <div>{log.module}</div>

              <div
                style={{
                  color: "#777",
                  fontSize: "14px"
                }}
              >
                {log.details}
              </div>
            </div>
          ))}
        </section>
      </section>
    </main>
  )
}

function Stat({
  label,
  value
}: {
  label: string
  value: any
}) {
  return (
    <div style={statStyle}>
      <div>{label}</div>

      <h2 style={{ color: "#ff6600" }}>
        {value}
      </h2>
    </div>
  )
}

const mainStyle: CSSProperties = {
  background: "#000",
  color: "#fff",
  minHeight: "100vh",
  fontFamily: "Arial"
}

const loadingStyle: CSSProperties = {
  background: "#000",
  color: "#ff6600",
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "24px",
  fontFamily: "Arial"
}

const loginStyle: CSSProperties = {
  background: "#000",
  color: "#fff",
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexDirection: "column",
  fontFamily: "Arial"
}

const stickyStyle: CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 999,
  background: "#000",
  padding: "15px 20px",
  borderBottom: "1px solid #222"
}

const monitorBarStyle: CSSProperties = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap"
}

const monitorButtonStyle: CSSProperties = {
  border: "1px solid #ff6600",
  color: "#fff",
  padding: "12px 18px",
  borderRadius: "10px",
  cursor: "pointer"
}

const systemLineStyle: CSSProperties = {
  marginTop: "15px",
  color: "#999",
  display: "flex",
  gap: "25px",
  flexWrap: "wrap"
}

const streamBoxStyle: CSSProperties = {
  background: "#080808",
  borderRadius: "20px",
  marginBottom: "30px",
  overflow: "hidden",
  border: "1px solid #222"
}

const uploadBoxStyle: CSSProperties = {
  background: "#080808",
  padding: "30px",
  borderRadius: "20px",
  marginBottom: "30px"
}

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "16px",
  marginTop: "20px",
  marginBottom: "20px",
  background: "#111",
  color: "#fff",
  border: "1px solid #ff6600",
  borderRadius: "10px",
  boxSizing: "border-box"
}

const buttonRowStyle: CSSProperties = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap"
}

const buttonMain: CSSProperties = {
  background: "#ff6600",
  border: "none",
  padding: "16px 28px",
  color: "#fff",
  borderRadius: "10px",
  fontSize: "18px",
  cursor: "pointer"
}

const buttonDark: CSSProperties = {
  background: "#111",
  border: "1px solid #ff6600",
  padding: "16px 28px",
  color: "#fff",
  borderRadius: "10px",
  fontSize: "18px",
  cursor: "pointer"
}

const mediaStyle: CSSProperties = {
  width: "100%",
  display: "block",
  background: "#000"
}

const statsGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(220px,1fr))",
  gap: "15px",
  marginBottom: "30px"
}

const statStyle: CSSProperties = {
  background: "#080808",
  padding: "20px",
  borderRadius: "16px"
}

const feedStyle: CSSProperties = {
  background: "#080808",
  padding: "30px",
  borderRadius: "20px",
  marginTop: "30px"
}

const logStyle: CSSProperties = {
  borderBottom: "1px solid #222",
  padding: "12px 0"
}
