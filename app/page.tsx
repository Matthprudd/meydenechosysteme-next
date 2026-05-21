"use client"

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react"
import { supabase } from "../lib/supabase"

const BUCKET_NAME = "meyden-media"
const MAX_FILE_MB = 50
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024

const MONITORS = ["fans", "public_cible", "petit_public", "grand_public", "international"]

export default function Home() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [logs, setLogs] = useState<any[]>([])
  const [contents, setContents] = useState<any[]>([])
  const [monitorSystem, setMonitorSystem] = useState<any>(null)
  const [testerActivities, setTesterActivities] = useState<any[]>([])

  const [activeMonitor, setActiveMonitor] = useState("fans")
  const [currentIndex, setCurrentIndex] = useState(0)

  const [newTitle, setNewTitle] = useState("")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [mediaInfo, setMediaInfo] = useState<any>(null)

  const [uploading, setUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState("")

  const [volume, setVolume] = useState(0.7)
  const [muted, setMuted] = useState(false)

  const [watchStart, setWatchStart] = useState<number | null>(null)
  const [alreadyTracked, setAlreadyTracked] = useState(false)
  const [showFounderPanel, setShowFounderPanel] = useState(true)
  const [showTestersPanel, setShowTestersPanel] = useState(true)

  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null)

  const filteredContents = useMemo(() => {
    return contents.filter(
      (item) => item.monitor_level === activeMonitor && item.status !== "disabled"
    )
  }, [contents, activeMonitor])

  const currentContent = filteredContents[currentIndex]

  useEffect(() => {
    checkUser()
  }, [])

  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel("meyden-realtime-engine")
      .on("postgres_changes", { event: "*", schema: "public", table: "monitor_content" }, refreshContentOnly)
      .on("postgres_changes", { event: "*", schema: "public", table: "live_activity_logs" }, refreshLogsOnly)
      .on("postgres_changes", { event: "*", schema: "public", table: "watchtime_events" }, () => {
        refreshContentOnly()
        refreshLogsOnly()
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "tuned_on_events" }, () => {
        refreshContentOnly()
        refreshLogsOnly()
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "tester_activity" }, refreshTesterActivities)
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  useEffect(() => {
    setCurrentIndex(0)
  }, [activeMonitor])

  useEffect(() => {
    if (filteredContents.length === 0) return

    const seconds =
      Number(monitorSystem?.average_seconds_per_content || 15) > 0
        ? Number(monitorSystem?.average_seconds_per_content || 15)
        : 15

    const timer = setTimeout(async () => {
      await trackWatchtime(false)
      goNextContent()
    }, seconds * 1000)

    return () => clearTimeout(timer)
  }, [currentIndex, filteredContents.length, activeMonitor, monitorSystem, watchStart])

  useEffect(() => {
    if (mediaRef.current) {
      mediaRef.current.volume = volume
      mediaRef.current.muted = muted
    }
  }, [volume, muted, currentContent])

  useEffect(() => {
    if (!currentContent) return
    setWatchStart(Date.now())
    setAlreadyTracked(false)
    registerTesterActivity("watching")
  }, [currentContent])

  useEffect(() => {
    if (!user) return

    const heartbeat = setInterval(() => {
      registerTesterActivity("active")
    }, 30000)

    return () => clearInterval(heartbeat)
  }, [user, activeMonitor, currentContent])

  function goNextContent() {
    setCurrentIndex((prev) => {
      if (filteredContents.length === 0) return 0
      return prev + 1 >= filteredContents.length ? 0 : prev + 1
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
    await refreshContentOnly()
    await refreshLogsOnly()
    await refreshMonitorSystem()
    await refreshTesterActivities()
    setLoading(false)
  }

  async function refreshContentOnly() {
    const { data } = await supabase
      .from("monitor_content")
      .select("*")
      .order("promotion_score", { ascending: false })
      .limit(150)

    setContents(data || [])
  }

  async function refreshLogsOnly() {
    const { data } = await supabase
      .from("live_activity_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30)

    setLogs(data || [])
  }

  async function refreshMonitorSystem() {
    const { data } = await supabase
      .from("monitor_system")
      .select("*")
      .eq("id", "main")
      .single()

    setMonitorSystem(data)
  }

  async function refreshTesterActivities() {
    const { data } = await supabase
      .from("tester_activity")
      .select("*")
      .order("last_seen", { ascending: false })
      .limit(50)

    setTesterActivities(data || [])
  }

  async function registerTesterActivity(action: string) {
    if (!user) return

    await supabase.from("tester_activity").insert({
      user_id: user.id,
      email: user.email,
      current_monitor: activeMonitor,
      current_content_id: currentContent?.id || null,
      current_content_title: currentContent?.title || "Aucun contenu",
      action,
      seconds_active: watchStart ? Math.floor((Date.now() - watchStart) / 1000) : 0,
      last_seen: new Date().toISOString()
    })
  }

  function analyzeMedia(file: File | null) {
    if (!file) {
      setMediaInfo(null)
      return
    }

    const sizeMB = file.size / 1024 / 1024
    const type = file.type || "inconnu"
    const tooHeavy = file.size > MAX_FILE_BYTES
    const cycleSeconds = Number(monitorSystem?.average_seconds_per_content || 15)
    const position = filteredContents.length + 1
    const estimatedWait = position * cycleSeconds

    const info: any = {
      name: file.name,
      sizeMB: sizeMB.toFixed(2),
      type,
      tooHeavy,
      cycleSeconds,
      position,
      estimatedWait
    }

    if (file.type.startsWith("video/") || file.type.startsWith("audio/")) {
      const url = URL.createObjectURL(file)
      const media = document.createElement(file.type.startsWith("video/") ? "video" : "audio")
      media.preload = "metadata"
      media.src = url

      media.onloadedmetadata = () => {
        info.duration = Math.round(media.duration || 0)
        URL.revokeObjectURL(url)
        setMediaInfo({ ...info })
      }

      media.onerror = () => {
        URL.revokeObjectURL(url)
        setMediaInfo({ ...info })
      }
    } else {
      setMediaInfo(info)
    }
  }

  const stats = useMemo(() => {
    return {
      totalContents: contents.length,
      totalActive: contents.filter((item) => item.status !== "disabled").length,
      totalDisabled: contents.filter((item) => item.status === "disabled").length,
      totalTunedOn: contents.reduce((sum, item) => sum + Number(item.tuned_on || 0), 0),
      totalViews: contents.reduce((sum, item) => sum + Number(item.views || 0), 0),
      totalWatchtime: contents.reduce((sum, item) => sum + Number(item.watchtime_seconds || 0), 0),
      totalCoinsGenerated: contents.reduce((sum, item) => sum + Number(item.coins_generated || 0), 0),
      activeTesters: new Set(
        testerActivities
          .filter((item) => new Date(item.last_seen).getTime() > Date.now() - 5 * 60 * 1000)
          .map((item) => item.user_id)
      ).size
    }
  }, [contents, testerActivities])

  const testerStats = useMemo(() => {
    const grouped: Record<string, any> = {}

    testerActivities.forEach((item) => {
      const key = item.user_id || item.email || "unknown"

      if (!grouped[key]) {
        grouped[key] = {
          email: item.email || "Utilisateur inconnu",
          events: 0,
          seconds: 0,
          lastMonitor: item.current_monitor,
          lastContent: item.current_content_title,
          lastSeen: item.last_seen
        }
      }

      grouped[key].events += 1
      grouped[key].seconds += Number(item.seconds_active || 0)

      if (new Date(item.last_seen).getTime() > new Date(grouped[key].lastSeen).getTime()) {
        grouped[key].lastMonitor = item.current_monitor
        grouped[key].lastContent = item.current_content_title
        grouped[key].lastSeen = item.last_seen
      }
    })

    return Object.values(grouped).sort((a: any, b: any) => b.seconds - a.seconds)
  }, [testerActivities])

  async function trackWatchtime(completed = false) {
    if (!user || !currentContent || !watchStart || alreadyTracked) return

    try {
      const watchedSeconds = Math.max(1, Math.floor((Date.now() - watchStart) / 1000))
      const media = mediaRef.current
      let duration = 0

      if (media && !isNaN(media.duration)) duration = media.duration

      let retention = 0
      if (duration > 0) retention = Math.min(100, Math.floor((watchedSeconds / duration) * 100))

      const abandoned = !completed && retention < 70

      await supabase.from("watchtime_events").insert({
        content_id: currentContent.id,
        user_id: user.id,
        seconds_watched: watchedSeconds,
        completed,
        abandoned,
        retention_percent: retention
      })

      const bonusScore =
        retention >= 90 ? 25 :
        retention >= 70 ? 12 :
        retention >= 40 ? 5 :
        1

      await supabase
        .from("monitor_content")
        .update({
          watchtime_seconds: Number(currentContent.watchtime_seconds || 0) + watchedSeconds,
          promotion_score: Number(currentContent.promotion_score || 0) + bonusScore
        })
        .eq("id", currentContent.id)

      await supabase.from("live_activity_logs").insert({
        user_id: user.id,
        action: completed ? "Watchtime complété" : "Watchtime capté",
        module: "Meyden Watchtime Engine",
        details: `${currentContent.title} | ${watchedSeconds}s | rétention ${retention}%`
      })

      await registerTesterActivity(completed ? "completed" : "watchtime")

      setAlreadyTracked(true)
    } catch (err) {
      console.log("Watchtime tracking error", err)
    }
  }

  async function logout() {
    await supabase.auth.signOut()
    window.location.reload()
  }

  async function processAdaptiveCycle() {
    const { error } = await supabase.rpc("process_adaptive_cycle")

    if (error) {
      alert(error.message)
      return
    }

    setUploadStatus("Cycle adaptatif exécuté.")
    await refreshMonitorSystem()
    await refreshContentOnly()
  }

  async function founderForceMonitor(contentId: number, newMonitor: string) {
    const ok = confirm(`Forcer ce contenu vers ${newMonitor} ?`)
    if (!ok) return

    const { error } = await supabase.rpc("founder_update_content_monitor", {
      content_id: contentId,
      new_monitor: newMonitor
    })

    if (error) {
      alert(error.message)
      return
    }

    await supabase.from("live_activity_logs").insert({
      user_id: user?.id,
      action: "Action Fondateur",
      module: "Founder Panel",
      details: `Contenu ${contentId} forcé vers ${newMonitor}`
    })
  }

  async function founderDisableContent(contentId: number) {
    const ok = confirm("Désactiver ce contenu du Monitor ?")
    if (!ok) return

    const { error } = await supabase.rpc("founder_disable_content", {
      content_id: contentId
    })

    if (error) {
      alert(error.message)
      return
    }

    await supabase.from("live_activity_logs").insert({
      user_id: user?.id,
      action: "Action Fondateur",
      module: "Founder Panel",
      details: `Contenu ${contentId} désactivé`
    })
  }

  async function uploadMedia() {
    if (!user) return alert("Utilisateur non connecté.")
    if (!newTitle.trim()) return alert("Ajoute un titre.")
    if (!selectedFile) return alert("Choisis un fichier média.")

    if (selectedFile.size > MAX_FILE_BYTES) {
      setUploadStatus(`Fichier trop lourd. Maximum actuel : ${MAX_FILE_MB} MB.`)
      alert(`Fichier trop lourd. Maximum actuel : ${MAX_FILE_MB} MB.`)
      return
    }

    try {
      setUploading(true)
      setUploadStatus("Préparation du fichier...")

      const allowedTypes = ["image/", "video/", "audio/"]
      const isAllowed = allowedTypes.some((type) => selectedFile.type.startsWith(type))

      if (!isAllowed) {
        setUploading(false)
        setUploadStatus("")
        alert("Format refusé. Utilise image, vidéo ou audio.")
        return
      }

      const safeName = selectedFile.name
        .replace(/\s+/g, "-")
        .replace(/[^a-zA-Z0-9.-]/g, "")

      const filePath = `${user.id}/${Date.now()}-${safeName}`

      setUploadStatus("Téléversement vers Meyden Storage...")

      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, selectedFile, {
          cacheControl: "3600",
          upsert: false,
          contentType: selectedFile.type
        })

      if (uploadError) {
        setUploading(false)
        setUploadStatus("")
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

      setUploadStatus("Sauvegarde dans le Monitor...")

      const { error: insertError } = await supabase.from("monitor_content").insert({
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
        setUploading(false)
        setUploadStatus("")
        alert(`Database error: ${insertError.message}`)
        return
      }

      await supabase.from("live_activity_logs").insert({
        user_id: user.id,
        action: "Upload média",
        module: "Meyden Monitor",
        details: `${newTitle.trim()} envoyé dans ${activeMonitor}`
      })

      await registerTesterActivity("upload")

      setUploadStatus("Upload réussi dans Meyden Monitor.")
      setUploading(false)
      setNewTitle("")
      setSelectedFile(null)
      setMediaInfo(null)
    } catch (err: any) {
      setUploading(false)
      setUploadStatus("")
      alert(`Erreur système: ${err.message}`)
    }
  }

  async function tunedOn(contentId: number) {
    if (!user) return

    const target = contents.find((item) => item.id === contentId)
    if (!target) return

    const updatedTuned = Number(target.tuned_on || 0) + 1
    const updatedViews = Number(target.views || 0) + 5
    const updatedScore = Number(target.promotion_score || 0) + 6
    const updatedWatchtime = Number(target.watchtime_seconds || 0) + 25

    let updatedCoins = Number(target.coins_generated || 0)
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

    await supabase.from("tuned_on_events").insert({
      content_id: contentId,
      user_id: user.id
    })

    await supabase.from("live_activity_logs").insert({
      user_id: user.id,
      action: "Tuned On",
      module: "Meyden Monitor",
      details: `Tuned On contenu ${contentId}`
    })

    await registerTesterActivity("tuned_on")
  }

  if (loading) return <main style={loadingStyle}>Chargement Meyden OS...</main>

  if (!user) {
    return (
      <main style={loginStyle}>
        <h1 style={{ color: "#ff6600" }}>MEYDEN MONITOR</h1>
        <p>Aucun utilisateur connecté.</p>
        <a href="/auth" style={{ color: "#ff6600" }}>Aller au login</a>
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
              onClick={() => setActiveMonitor(monitor)}
              style={{
                ...monitorButtonStyle,
                background: activeMonitor === monitor ? "#ff6600" : "#111"
              }}
            >
              {monitor}
            </button>
          ))}
        </div>

        {monitorSystem && (
          <div style={systemLineStyle}>
            <div>Cycle : {monitorSystem.active_cycle_minutes} min</div>
            <div>Mode : {monitorSystem.monitor_mode}</div>
            <div>Contenus : {monitorSystem.total_active_contents}</div>
            <div>Utilisateurs live : {monitorSystem.total_active_users}</div>
            <div>Temps/contenu : {monitorSystem.average_seconds_per_content}s</div>
            <div>Testeurs actifs : {stats.activeTesters}</div>
          </div>
        )}
      </section>

      <section style={{ padding: "40px" }}>
        <h1 style={{ color: "#ff6600", fontSize: "52px" }}>MEYDEN MONITOR</h1>
        <p style={{ color: "#999" }}>Diffusion continue adaptative + Realtime Testers Panel</p>

        {currentContent ? (
          <section style={streamBoxStyle}>
            <div style={{ padding: "25px" }}>
              <h2 style={{ color: "#ff6600", fontSize: "38px" }}>{currentContent.title}</h2>
              <p>Monitor : {currentContent.monitor_level}</p>
              <p>Tuned On : {currentContent.tuned_on || 0}</p>
              <p>Views : {currentContent.views || 0}</p>
              <p>Watchtime : {currentContent.watchtime_seconds || 0}</p>
              <p>Score : {currentContent.promotion_score || 0}</p>
              <p>Coins : {currentContent.coins_generated || 0}</p>
              <p>État : {currentContent.evolution_state || "stable"}</p>
            </div>

            {currentContent.media_type === "video" && currentContent.file_url && (
              <>
                <video
                  ref={mediaRef as any}
                  key={currentContent.id}
                  src={currentContent.file_url}
                  autoPlay
                  muted={muted}
                  playsInline
                  controls={false}
                  onEnded={async () => {
                    await trackWatchtime(true)
                    goNextContent()
                  }}
                  onPause={(e) => {
                    trackWatchtime(false)
                    e.currentTarget.play().catch(() => {})
                  }}
                  style={mediaStyle}
                />
                <MiniPlayerControls muted={muted} setMuted={setMuted} volume={volume} setVolume={setVolume} />
              </>
            )}

            {currentContent.media_type === "image" && currentContent.file_url && (
              <img key={currentContent.id} src={currentContent.file_url} alt={currentContent.title} style={mediaStyle} />
            )}

            {currentContent.media_type === "audio" && currentContent.file_url && (
              <>
                <audio
                  ref={mediaRef as any}
                  key={currentContent.id}
                  src={currentContent.file_url}
                  autoPlay
                  muted={muted}
                  controls={false}
                  onEnded={async () => {
                    await trackWatchtime(true)
                    goNextContent()
                  }}
                />
                <MiniPlayerControls muted={muted} setMuted={setMuted} volume={volume} setVolume={setVolume} />
              </>
            )}

            <div style={{ padding: "20px" }}>
              <button onClick={() => tunedOn(currentContent.id)} style={buttonMain}>❤️ Tuned On</button>
            </div>
          </section>
        ) : (
          <section style={streamBoxStyle}>
            <h2 style={{ color: "#ff6600" }}>Aucun contenu dans ce monitor.</h2>
            <p>Ajoute du contenu ou choisis un autre monitor.</p>
          </section>
        )}

        <section style={testersBoxStyle}>
          <div style={founderHeaderStyle}>
            <h2 style={{ color: "#ff6600" }}>Testers Live Panel</h2>
            <button onClick={() => setShowTestersPanel(!showTestersPanel)} style={buttonDark}>
              {showTestersPanel ? "Masquer" : "Afficher"}
            </button>
          </div>

          {showTestersPanel && (
            <>
              <div style={founderStatsStyle}>
                <div>Testeurs actifs 5 min : {stats.activeTesters}</div>
                <div>Événements récents : {testerActivities.length}</div>
              </div>

              <h3 style={{ color: "#ff6600", marginTop: "20px" }}>Classement testeurs</h3>

              <div style={{ display: "grid", gap: "12px" }}>
                {testerStats.slice(0, 10).map((tester: any) => (
                  <div key={tester.email} style={testerItemStyle}>
                    <strong>{tester.email}</strong>
                    <div style={{ color: "#999", fontSize: "14px" }}>
                      Monitor : {tester.lastMonitor || "n/a"} | Contenu : {tester.lastContent || "n/a"}
                    </div>
                    <div style={{ color: "#999", fontSize: "14px" }}>
                      Activité : {tester.events} événements | Watchtime estimé : {tester.seconds}s
                    </div>
                  </div>
                ))}
              </div>

              <h3 style={{ color: "#ff6600", marginTop: "20px" }}>Activité récente</h3>

              <div style={{ display: "grid", gap: "10px" }}>
                {testerActivities.slice(0, 20).map((activity) => (
                  <div key={activity.id} style={testerItemStyle}>
                    <strong>{activity.email}</strong>
                    <div style={{ color: "#999", fontSize: "14px" }}>
                      Action : {activity.action} | Monitor : {activity.current_monitor}
                    </div>
                    <div style={{ color: "#999", fontSize: "14px" }}>
                      Contenu : {activity.current_content_title}
                    </div>
                    <div style={{ color: "#999", fontSize: "14px" }}>
                      Actif : {activity.seconds_active || 0}s | Last seen : {activity.last_seen}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        <section style={founderBoxStyle}>
          <div style={founderHeaderStyle}>
            <h2 style={{ color: "#ff6600" }}>Fondateur Panel v1 — Realtime</h2>
            <button onClick={() => setShowFounderPanel(!showFounderPanel)} style={buttonDark}>
              {showFounderPanel ? "Masquer" : "Afficher"}
            </button>
          </div>

          {showFounderPanel && (
            <>
              <div style={founderStatsStyle}>
                <div>Actifs : {stats.totalActive}</div>
                <div>Désactivés : {stats.totalDisabled}</div>
                <div>Total : {stats.totalContents}</div>
              </div>

              <div style={{ display: "grid", gap: "15px", marginTop: "20px" }}>
                {contents.slice(0, 25).map((item) => (
                  <div key={item.id} style={founderItemStyle}>
                    <div>
                      <strong style={{ color: "#ff6600" }}>{item.title}</strong>
                      <div style={{ color: "#999", fontSize: "14px" }}>
                        ID {item.id} | {item.monitor_level} | score {item.promotion_score || 0} | status {item.status}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "12px" }}>
                      {MONITORS.map((monitor) => (
                        <button key={monitor} onClick={() => founderForceMonitor(item.id, monitor)} style={smallButtonStyle}>
                          → {monitor}
                        </button>
                      ))}

                      <button onClick={() => founderDisableContent(item.id)} style={dangerButtonStyle}>
                        Désactiver
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        <section style={uploadBoxStyle}>
          <h2 style={{ color: "#ff6600" }}>Upload média</h2>

          <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Titre du contenu" style={inputStyle} />

          <input
            type="file"
            accept="image/*,video/*,audio/*"
            onChange={(e) => {
              const file = e.target.files?.[0] || null
              setSelectedFile(file)
              setUploadStatus("")
              analyzeMedia(file)
            }}
            style={{ marginBottom: "20px", color: "#fff" }}
          />

          {selectedFile && <div style={{ marginBottom: "20px", color: "#00ff99" }}>✔ Fichier prêt : {selectedFile.name}</div>}

          {mediaInfo && (
            <div
              style={{
                marginBottom: "20px",
                padding: "15px",
                background: "#111",
                border: mediaInfo.tooHeavy ? "1px solid #ff0033" : "1px solid #00ff99",
                borderRadius: "10px",
                color: "#fff"
              }}
            >
              <div>Type : {mediaInfo.type}</div>
              <div>Taille : {mediaInfo.sizeMB} MB / max {MAX_FILE_MB} MB</div>
              {mediaInfo.duration && <div>Durée : {mediaInfo.duration}s</div>}
              <div>Position estimée dans ce monitor : #{mediaInfo.position}</div>
              <div>Temps moyen par contenu : {mediaInfo.cycleSeconds}s</div>
              <div>Attente estimée avant diffusion : {mediaInfo.estimatedWait}s</div>
              <div style={{ marginTop: "10px", color: mediaInfo.tooHeavy ? "#ff0033" : "#00ff99", fontWeight: "bold" }}>
                {mediaInfo.tooHeavy ? "Fichier trop lourd. Coupe ou compresse avant upload." : "Compatible Meyden Monitor."}
              </div>
            </div>
          )}

          <div style={buttonRowStyle}>
            <button onClick={uploadMedia} disabled={uploading} style={{ ...buttonMain, opacity: uploading ? 0.5 : 1 }}>
              {uploading ? "Téléversement..." : "Upload Monitor"}
            </button>

            <button onClick={processAdaptiveCycle} style={buttonDark}>Adaptive Cycle</button>
            <button onClick={logout} style={buttonDark}>Logout</button>
          </div>

          {uploadStatus && (
            <div style={{ marginTop: "20px", color: uploading ? "#ff6600" : "#00ff99", fontWeight: "bold" }}>
              {uploadStatus}
            </div>
          )}
        </section>

        <section style={statsGridStyle}>
          <Stat label="Total contenus" value={stats.totalContents} />
          <Stat label="Total actifs" value={stats.totalActive} />
          <Stat label="Testeurs actifs" value={stats.activeTesters} />
          <Stat label="Total Tuned On" value={stats.totalTunedOn} />
          <Stat label="Total Views" value={stats.totalViews} />
          <Stat label="Watchtime" value={stats.totalWatchtime} />
          <Stat label="Coins générés" value={stats.totalCoinsGenerated} />
        </section>

        <section style={feedStyle}>
          <h2 style={{ color: "#ff6600" }}>Live Activity Feed — Realtime</h2>
          {logs.map((log) => (
            <div key={log.id} style={logStyle}>
              <div style={{ color: "#ff6600" }}>{log.action}</div>
              <div>{log.module}</div>
              <div style={{ color: "#777", fontSize: "14px" }}>{log.details}</div>
            </div>
          ))}
        </section>
      </section>
    </main>
  )
}

function MiniPlayerControls({ muted, setMuted, volume, setVolume }: any) {
  return (
    <div style={miniControlsStyle}>
      <button onClick={() => setMuted(!muted)} style={miniButtonStyle}>
        {muted ? "🔇" : "🔊"}
      </button>
      <input type="range" min="0" max="1" step="0.01" value={volume} onChange={(e) => setVolume(Number(e.target.value))} style={{ width: "180px" }} />
      <span style={{ color: "#999" }}>{Math.round(volume * 100)}%</span>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div style={statStyle}>
      <div>{label}</div>
      <h2 style={{ color: "#ff6600" }}>{value}</h2>
    </div>
  )
}

const mainStyle: CSSProperties = { background: "#000", color: "#fff", minHeight: "100vh", fontFamily: "Arial" }
const loadingStyle: CSSProperties = { background: "#000", color: "#ff6600", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", fontFamily: "Arial" }
const loginStyle: CSSProperties = { background: "#000", color: "#fff", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", fontFamily: "Arial" }
const stickyStyle: CSSProperties = { position: "sticky", top: 0, zIndex: 999, background: "#000", padding: "15px 20px", borderBottom: "1px solid #222" }
const monitorBarStyle: CSSProperties = { display: "flex", gap: "10px", flexWrap: "wrap" }
const monitorButtonStyle: CSSProperties = { border: "1px solid #ff6600", color: "#fff", padding: "12px 18px", borderRadius: "10px", cursor: "pointer" }
const systemLineStyle: CSSProperties = { marginTop: "15px", color: "#999", display: "flex", gap: "25px", flexWrap: "wrap" }
const streamBoxStyle: CSSProperties = { background: "#080808", borderRadius: "20px", marginBottom: "30px", overflow: "hidden", border: "1px solid #222" }
const founderBoxStyle: CSSProperties = { background: "#090909", padding: "25px", borderRadius: "20px", marginBottom: "30px", border: "1px solid rgba(255,102,0,.35)" }
const testersBoxStyle: CSSProperties = { background: "#071010", padding: "25px", borderRadius: "20px", marginBottom: "30px", border: "1px solid rgba(0,255,153,.35)" }
const founderHeaderStyle: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "15px", flexWrap: "wrap" }
const founderStatsStyle: CSSProperties = { display: "flex", gap: "20px", color: "#999", flexWrap: "wrap" }
const founderItemStyle: CSSProperties = { background: "#111", padding: "15px", borderRadius: "14px", border: "1px solid #222" }
const testerItemStyle: CSSProperties = { background: "#101818", padding: "15px", borderRadius: "14px", border: "1px solid #1d3b33" }
const uploadBoxStyle: CSSProperties = { background: "#080808", padding: "30px", borderRadius: "20px", marginBottom: "30px" }
const inputStyle: CSSProperties = { width: "100%", padding: "16px", marginTop: "20px", marginBottom: "20px", background: "#111", color: "#fff", border: "1px solid #ff6600", borderRadius: "10px", boxSizing: "border-box" }
const buttonRowStyle: CSSProperties = { display: "flex", gap: "10px", flexWrap: "wrap" }
const buttonMain: CSSProperties = { background: "#ff6600", border: "none", padding: "16px 28px", color: "#fff", borderRadius: "10px", fontSize: "18px", cursor: "pointer" }
const buttonDark: CSSProperties = { background: "#111", border: "1px solid #ff6600", padding: "16px 28px", color: "#fff", borderRadius: "10px", fontSize: "18px", cursor: "pointer" }
const smallButtonStyle: CSSProperties = { background: "#222", border: "1px solid #ff6600", color: "#fff", padding: "8px 10px", borderRadius: "8px", cursor: "pointer", fontSize: "12px" }
const dangerButtonStyle: CSSProperties = { background: "#3b0000", border: "1px solid #ff0033", color: "#fff", padding: "8px 10px", borderRadius: "8px", cursor: "pointer", fontSize: "12px" }
const mediaStyle: CSSProperties = { width: "100%", display: "block", background: "#000" }
const miniControlsStyle: CSSProperties = { padding: "15px", display: "flex", gap: "15px", alignItems: "center", background: "#111", flexWrap: "wrap" }
const miniButtonStyle: CSSProperties = { background: "#ff6600", border: "none", color: "#fff", padding: "10px 14px", borderRadius: "8px", cursor: "pointer" }
const statsGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: "15px", marginBottom: "30px" }
const statStyle: CSSProperties = { background: "#080808", padding: "20px", borderRadius: "16px" }
const feedStyle: CSSProperties = { background: "#080808", padding: "30px", borderRadius: "20px", marginTop: "30px" }
const logStyle: CSSProperties = { borderBottom: "1px solid #222", padding: "12px 0" }
