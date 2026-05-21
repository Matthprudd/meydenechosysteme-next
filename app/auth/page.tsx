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
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const [logs, setLogs] = useState<any[]>([])
  const [contents, setContents] = useState<any[]>([])
  const [monitorSystem, setMonitorSystem] = useState<any>(null)

  const [livePresence, setLivePresence] = useState<any[]>([])
  const [analyticsHistory, setAnalyticsHistory] = useState<any[]>([])

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

  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null)

  const filteredContents = useMemo(() => {
    return contents.filter(
      (item) =>
        item.monitor_level === activeMonitor &&
        item.status !== "disabled"
    )
  }, [contents, activeMonitor])

  const currentContent = filteredContents[currentIndex]

  const isFounder =
    profile?.role === "fondateur" ||
    profile?.role === "admin"

  useEffect(() => {
    checkUser()
  }, [])

  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel("meyden-presence-engine-v2")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "monitor_content" },
        () => {
          refreshContentOnly()
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "live_presence" },
        () => {
          refreshLivePresence()
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "founder_analytics_history" },
        () => {
          refreshAnalyticsHistory()
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
      await trackWatchtime(false)
      goNextContent()
    }, seconds * 1000)

    return () => clearTimeout(timer)
  }, [
    currentIndex,
    filteredContents.length,
    activeMonitor,
    monitorSystem,
    watchStart
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
    registerLivePresence("watching")
  }, [currentContent])

  useEffect(() => {
    if (!user) return

    const heartbeat = setInterval(() => {
      registerLivePresence("active")
    }, 30000)

    return () => clearInterval(heartbeat)
  }, [user, profile, activeMonitor, currentContent, watchStart])

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

    await ensureProfile(session.user)
    await refreshContentOnly()
    await refreshMonitorSystem()
    await refreshLivePresence()
    await refreshAnalyticsHistory()

    setLoading(false)
  }

  async function ensureProfile(activeUser: any) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", activeUser.id)
      .maybeSingle()

    if (data) {
      setProfile(data)
      return
    }

    const fallbackRole = "testeur"

    const publicName =
      activeUser.email?.split("@")[0] || "Testeur Meyden"

    const { data: inserted } = await supabase
      .from("profiles")
      .insert({
        id: activeUser.id,
        email: activeUser.email,
        public_name: publicName,
        role: fallbackRole
      })
      .select("*")
      .single()

    setProfile(inserted)
  }

  async function refreshContentOnly() {
    const { data } = await supabase
      .from("monitor_content")
      .select("*")
      .order("promotion_score", { ascending: false })
      .limit(200)

    setContents(data || [])
  }

  async function refreshMonitorSystem() {
    const { data } = await supabase
      .from("monitor_system")
      .select("*")
      .eq("id", "main")
      .single()

    setMonitorSystem(data)
  }

  async function refreshLivePresence() {
    const { data } = await supabase
      .from("live_presence")
      .select("*")
      .order("last_seen", { ascending: false })
      .limit(100)

    setLivePresence(data || [])
  }

  async function refreshAnalyticsHistory() {
    const { data } = await supabase
      .from("founder_analytics_history")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(25)

    setAnalyticsHistory(data || [])
  }

  async function registerLivePresence(action: string) {
    if (!user) return

    await supabase.from("live_presence").insert({
      user_id: user.id,
      email: user.email,
      public_name:
        profile?.public_name ||
        user.email?.split("@")[0] ||
        "Testeur Meyden",
      role: profile?.role || "testeur",
      current_monitor: activeMonitor,
      current_content_id: currentContent?.id || null,
      current_content_title:
        currentContent?.title || "Aucun contenu",
      action,
      seconds_active: watchStart
        ? Math.floor((Date.now() - watchStart) / 1000)
        : 0,
      last_seen: new Date().toISOString()
    })
  }

  async function trackWatchtime(completed = false) {
    if (
      !user ||
      !currentContent ||
      !watchStart ||
      alreadyTracked
    ) return

    const watchedSeconds = Math.max(
      1,
      Math.floor((Date.now() - watchStart) / 1000)
    )

    await supabase.from("watchtime_events").insert({
      content_id: currentContent.id,
      user_id: user.id,
      seconds_watched: watchedSeconds,
      completed
    })

    await supabase
      .from("monitor_content")
      .update({
        watchtime_seconds:
          Number(currentContent.watchtime_seconds || 0) +
          watchedSeconds,
        promotion_score:
          Number(currentContent.promotion_score || 0) + 5
      })
      .eq("id", currentContent.id)

    setAlreadyTracked(true)
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

    setUploadStatus("Upload réussi")
    setUploading(false)
    setNewTitle("")
    setSelectedFile(null)
    setMediaInfo(null)
  }

  if (loading) {
    return (
      <main style={loadingStyle}>
        Chargement Meyden OS...
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
          MEYDEN PRESENCE ENGINE V2
        </h1>

        <p style={{ color: "#999" }}>
          Présence live + watchtime + analytics fondateur.
        </p>
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
  fontSize: "24px",
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
```
