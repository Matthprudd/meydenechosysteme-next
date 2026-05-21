"use client"

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react"
import { supabase } from "../lib/supabase"

const BUCKET_NAME = "meyden-media"
const MAX_FILE_MB = 50
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024

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
      (item) =>
        item.monitor_level === activeMonitor &&
        item.status !== "disabled"
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
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "monitor_content" },
        () => {
          refreshContentOnly()
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "live_activity_logs" },
        () => {
          refreshLogsOnly()
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tester_activity" },
        () => {
          refreshTesterActivities()
        }
      )
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
      goNextContent()
    }, seconds * 1000)

    return () => clearTimeout(timer)
  }, [
    currentIndex,
    filteredContents.length,
    activeMonitor,
    monitorSystem
  ])

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
      .limit(75)

    setTesterActivities(data || [])
  }

  async function registerTesterActivity(action: string) {
    if (!user) return

    await supabase.from("tester_activity").insert({
      user_id: user.id,
      email: user.email,
      current_monitor: activeMonitor,
      current_content_title:
        currentContent?.title || "Aucun contenu",
      action,
      seconds_active: watchStart
        ? Math.floor((Date.now() - watchStart) / 1000)
        : 0,
      last_seen: new Date().toISOString()
    })
  }

  const stats = useMemo(() => {
    const activeTesterIds = new Set(
      testerActivities
        .filter(
          (item) =>
            new Date(item.last_seen).getTime() >
            Date.now() - 5 * 60 * 1000
        )
        .map((item) => item.user_id)
    )

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
      activeTesters: activeTesterIds.size
    }
  }, [contents, testerActivities])

  function analyzeMedia(file: File | null) {
    if (!file) {
      setMediaInfo(null)
      return
    }

    const sizeMB = file.size / 1024 / 1024

    setMediaInfo({
      name: file.name,
      sizeMB: sizeMB.toFixed(2),
      type: file.type,
      tooHeavy: file.size > MAX_FILE_BYTES
    })
  }

  async function uploadMedia() {
    if (!user) return
    if (!newTitle.trim()) return
    if (!selectedFile) return

    setUploading(true)

    const safeName = selectedFile.name
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9.-]/g, "")

    const filePath = `${user.id}/${Date.now()}-${safeName}`

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, selectedFile, {
        cacheControl: "3600",
        upsert: false,
        contentType: selectedFile.type
      })

    if (uploadError) {
      alert(uploadError.message)
      setUploading(false)
      return
    }

    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath)

    const fileUrl = publicUrlData.publicUrl

    let mediaType = "video"

    if (selectedFile.type.startsWith("image/")) {
      mediaType = "image"
    }

    if (selectedFile.type.startsWith("audio/")) {
      mediaType = "audio"
    }

    await supabase.from("monitor_content").insert({
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

    await registerTesterActivity("upload")

    setUploadStatus("Upload réussi")
    setUploading(false)
    setNewTitle("")
    setSelectedFile(null)
    setMediaInfo(null)
  }

  if (loading) {
    return <main style={loadingStyle}>Chargement Meyden OS...</main>
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
                background:
                  activeMonitor === monitor ? "#ff6600" : "#111"
              }}
            >
              {monitor}
            </button>
          ))}
        </div>
      </section>

      <section style={{ padding: "40px" }}>
        <h1 style={{ color: "#ff6600", fontSize: "52px" }}>
          MEYDEN MONITOR
        </h1>

        <section style={testersBoxStyle}>
          <div style={founderHeaderStyle}>
            <h2 style={{ color: "#00ff99" }}>
              Testers Live Panel
            </h2>
          </div>

          <div style={founderStatsStyle}>
            <div>Testeurs actifs : {stats.activeTesters}</div>
            <div>Contenus : {stats.totalContents}</div>
            <div>Views : {stats.totalViews}</div>
            <div>Watchtime : {stats.totalWatchtime}</div>
          </div>

          <div style={{ display: "grid", gap: "12px", marginTop: "20px" }}>
            {testerActivities.slice(0, 15).map((activity) => (
              <div key={activity.id} style={testerItemStyle}>
                <strong>{activity.email}</strong>
                <div style={{ color: "#999", fontSize: "14px" }}>
                  Monitor : {activity.current_monitor}
                </div>
                <div style={{ color: "#999", fontSize: "14px" }}>
                  Contenu : {activity.current_content_title}
                </div>
                <div style={{ color: "#999", fontSize: "14px" }}>
                  Action : {activity.action}
                </div>
              </div>
            ))}
          </div>
        </section>
      </section>
    </main>
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
  fontSize: "24px"
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

const founderHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center"
}

const founderStatsStyle: CSSProperties = {
  display: "flex",
  gap: "20px",
  flexWrap: "wrap",
  marginTop: "20px"
}

const testersBoxStyle: CSSProperties = {
  background: "#071010",
  padding: "25px",
  borderRadius: "20px",
  marginTop: "30px",
  border: "1px solid rgba(0,255,153,.35)"
}

const testerItemStyle: CSSProperties = {
  background: "#101818",
  padding: "15px",
  borderRadius: "14px",
  border: "1px solid #1d3b33"
}
