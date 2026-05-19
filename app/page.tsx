"use client"

import {
  useEffect,
  useMemo,
  useRef,
  useState
} from "react"

import { supabase } from "../lib/supabase"

const BUCKET_NAME = "meyden-media"

export default function Home() {

  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const [contents, setContents] = useState<any[]>([])
  const [logs, setLogs] = useState<any[]>([])

  const [monitorSystem, setMonitorSystem] =
    useState<any>(null)

  const [activeMonitor, setActiveMonitor] =
    useState("fans")

  const [currentPlayingIndex, setCurrentPlayingIndex] =
    useState(0)

  const [newTitle, setNewTitle] = useState("")
  const [selectedFile, setSelectedFile] =
    useState<File | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    checkUser()
  }, [])

  useEffect(() => {

    if (
      filteredContents.length === 0
    ) return

    setCurrentPlayingIndex(0)

  }, [activeMonitor])

  useEffect(() => {

    if (
      filteredContents.length === 0
    ) return

    const seconds =
      monitorSystem?.average_seconds_per_content || 15

    const timer = setTimeout(() => {

      setCurrentPlayingIndex((prev) => {

        if (
          prev + 1 >= filteredContents.length
        ) {
          return 0
        }

        return prev + 1

      })

    }, seconds * 1000)

    return () => clearTimeout(timer)

  }, [
    currentPlayingIndex,
    filteredContents,
    monitorSystem
  ])

  const filteredContents =
    contents.filter(
      (item) =>
        item.monitor_level === activeMonitor
    )

  const currentContent =
    filteredContents[currentPlayingIndex]

  async function checkUser() {

    const {
      data: { session }
    } = await supabase.auth.getSession()

    if (!session?.user) {
      setLoading(false)
      return
    }

    setUser(session.user)

    const { data: logsData } =
      await supabase
        .from("live_activity_logs")
        .select("*")
        .order("created_at", {
          ascending: false
        })
        .limit(20)

    setLogs(logsData || [])

    const { data: contentData } =
      await supabase
        .from("monitor_content")
        .select("*")
        .eq("status", "active")
        .order("promotion_score", {
          ascending: false
        })

    setContents(contentData || [])

    const { data: monitorData } =
      await supabase
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

      totalViews:
        contents.reduce(
          (sum, item) =>
            sum + Number(item.views || 0),
          0
        ),

      totalWatchtime:
        contents.reduce(
          (sum, item) =>
            sum +
            Number(item.watchtime_seconds || 0),
          0
        ),

      totalTunedOn:
        contents.reduce(
          (sum, item) =>
            sum +
            Number(item.tuned_on || 0),
          0
        ),

      totalCoins:
        contents.reduce(
          (sum, item) =>
            sum +
            Number(item.coins_generated || 0),
          0
        )

    }

  }, [contents])

  async function logout() {

    await supabase.auth.signOut()

    window.location.reload()
  }

  async function processAdaptiveCycle() {

    const { error } =
      await supabase.rpc(
        "process_adaptive_cycle"
      )

    if (error) {
      alert(error.message)
      return
    }

    window.location.reload()
  }

  async function tunedOn(contentId: number) {

    if (!user) return

    const target =
      contents.find(
        (item) =>
          item.id === contentId
      )

    if (!target) return

    const updatedScore =
      Number(
        target.promotion_score || 0
      ) + 12

    const updatedViews =
      Number(
        target.views || 0
      ) + 25

    const updatedTuned =
      Number(
        target.tuned_on || 0
      ) + 1

    const updatedWatchtime =
      Number(
        target.watchtime_seconds || 0
      ) + 75

    const updatedCoins =
      Number(
        target.coins_generated || 0
      ) + 2

    let updatedMonitor =
      target.monitor_level

    if (updatedScore >= 1000) {
      updatedMonitor = "international"
    }
    else if (updatedScore >= 400) {
      updatedMonitor = "grand_public"
    }
    else if (updatedScore >= 150) {
      updatedMonitor = "petit_public"
    }
    else if (updatedScore >= 50) {
      updatedMonitor = "public_cible"
    }

    await supabase
      .from("monitor_content")
      .update({

        tuned_on: updatedTuned,

        views: updatedViews,

        watchtime_seconds:
          updatedWatchtime,

        promotion_score:
          updatedScore,

        coins_generated:
          updatedCoins,

        monitor_level:
          updatedMonitor,

        evolution_state:
          updatedScore >= 400
            ? "viral"
            : updatedScore >= 150
            ? "progression"
            : "potentiel"

      })
      .eq("id", contentId)

    await supabase
      .from("live_activity_logs")
      .insert({
        user_id: user.id,
        action: "Tuned On",
        module: "Monitor Stream",
        details:
          `${target.title} → ${updatedMonitor}`
      })

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
      alert("Choisis un fichier.")
      return
    }

    const fileExt =
      selectedFile.name
        .split(".")
        .pop()

    const safeName =
      selectedFile.name
        .replace(/\s+/g, "-")

    const filePath =
      `${user.id}/${Date.now()}-${safeName}`

    const { error: uploadError } =
      await supabase.storage
        .from(BUCKET_NAME)
        .upload(
          filePath,
          selectedFile,
          {
            cacheControl: "3600",
            upsert: false,
            contentType:
              selectedFile.type
          }
        )

    if (uploadError) {
      alert(uploadError.message)
      return
    }

    const {
      data: publicUrlData
    } =
      supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(filePath)

    const fileUrl =
      publicUrlData.publicUrl

    let mediaType = "video"

    if (
      selectedFile.type.startsWith(
        "image/"
      )
    ) {
      mediaType = "image"
    }

    if (
      selectedFile.type.startsWith(
        "audio/"
      )
    ) {
      mediaType = "audio"
    }

    const { error: insertError } =
      await supabase
        .from("monitor_content")
        .insert({

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

    if (insertError) {
      alert(insertError.message)
      return
    }

    window.location.reload()
  }

  if (loading) {

    return (

      <main
        style={{
          background: "#000",
          color: "#ff6600",
          minHeight: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          fontSize: "30px",
          fontFamily: "Arial"
        }}
      >
        Chargement Meyden Stream...
      </main>

    )

  }

  if (!user) {

    return (

      <main
        style={{
          background: "#000",
          color: "#fff",
          minHeight: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          flexDirection: "column",
          fontFamily: "Arial"
        }}
      >

        <h1
          style={{
            color: "#ff6600"
          }}
        >
          MEYDEN MONITOR
        </h1>

        <a
          href="/auth"
          style={{
            color: "#ff6600"
          }}
        >
          Aller au login
        </a>

      </main>

    )

  }

  return (

    <main
      style={{
        background: "#000",
        color: "#fff",
        minHeight: "100vh",
        fontFamily: "Arial"
      }}
    >

      <section
        style={{
          position: "sticky",
          top: 0,
          zIndex: 999,
          background: "#000",
          padding: "20px",
          borderBottom:
            "1px solid #222"
        }}
      >

        <div
          style={{
            display: "flex",
            gap: "10px",
            flexWrap: "wrap"
          }}
        >

          {[
            "fans",
            "public_cible",
            "petit_public",
            "grand_public",
            "international"
          ].map((monitor) => (

            <button
              key={monitor}
              onClick={() =>
                setActiveMonitor(monitor)
              }
              style={{
                background:
                  activeMonitor === monitor
                    ? "#ff6600"
                    : "#111",

                border:
                  "1px solid #ff6600",

                color: "#fff",

                padding: "12px 18px",

                borderRadius: "10px",

                cursor: "pointer"
              }}
            >
              {monitor}
            </button>

          ))}

        </div>

        {monitorSystem && (

          <div
            style={{
              marginTop: "15px",
              display: "flex",
              gap: "20px",
              flexWrap: "wrap",
              color: "#999"
            }}
          >

            <div>
              Cycle :
              {" "}
              {
                monitorSystem.active_cycle_minutes
              }
              min
            </div>

            <div>
              Contenus :
              {" "}
              {
                monitorSystem.total_active_contents
              }
            </div>

            <div>
              Temps/contenu :
              {" "}
              {
                monitorSystem.average_seconds_per_content
              }
              s
            </div>

            <div>
              Mode :
              {" "}
              {
                monitorSystem.monitor_mode
              }
            </div>

          </div>

        )}

      </section>

      <section
        style={{
          padding: "20px"
        }}
      >

        <div
          style={{
            display: "flex",
            gap: "10px",
            flexWrap: "wrap",
            marginBottom: "20px"
          }}
        >

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

        <div
          style={{
            background: "#080808",
            padding: "20px",
            borderRadius: "20px",
            marginBottom: "30px"
          }}
        >

          <h2
            style={{
              color: "#ff6600"
            }}
          >
            Upload média
          </h2>

          <input
            value={newTitle}
            onChange={(e) =>
              setNewTitle(
                e.target.value
              )
            }
            placeholder="Titre"
            style={inputStyle}
          />

          <input
            type="file"
            accept="image/*,video/*,audio/*"
            onChange={(e) =>
              setSelectedFile(
                e.target.files?.[0] ||
                  null
              )
            }
            style={{
              marginTop: "15px"
            }}
          />

          <button
            onClick={uploadMedia}
            style={{
              ...buttonMain,
              marginTop: "20px"
            }}
          >
            Upload Monitor
          </button>

        </div>

        <section
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit,minmax(220px,1fr))",

            gap: "15px",

            marginBottom: "30px"
          }}
        >

          <Stat
            label="Total contenus"
            value={
              stats.totalContents
            }
          />

          <Stat
            label="Total Tuned On"
            value={
              stats.totalTunedOn
            }
          />

          <Stat
            label="Total Views"
            value={
              stats.totalViews
            }
          />

          <Stat
            label="Watchtime"
            value={
              stats.totalWatchtime
            }
          />

          <Stat
            label="Coins"
            value={
              stats.totalCoins
            }
          />

        </section>

        {currentContent && (

          <section
            style={{
              background: "#050505",
              borderRadius: "30px",
              overflow: "hidden",
              border:
                "1px solid #222"
            }}
          >

            <div
              style={{
                padding: "25px"
              }}
            >

              <h1
                style={{
                  color: "#ff6600",
                  fontSize: "42px"
                }}
              >
                {
                  currentContent.title
                }
              </h1>

              <p>
                Monitor :
                {" "}
                {
                  currentContent.monitor_level
                }
              </p>

              <p>
                Score :
                {" "}
                {
                  currentContent.promotion_score
                }
              </p>

              <p>
                Tuned On :
                {" "}
                {
                  currentContent.tuned_on
                }
              </p>

              <p>
                Watchtime :
                {" "}
                {
                  currentContent.watchtime_seconds
                }
              </p>

              <p>
                État :
                {" "}
                {
                  currentContent.evolution_state
                }
              </p>

            </div>

            {currentContent.media_type ===
              "video" && (

              <video
                ref={videoRef}
                src={
                  currentContent.file_url
                }
                autoPlay
                muted
                playsInline
                style={{
                  width: "100%",
                  background: "#000"
                }}
              />

            )}

            {currentContent.media_type ===
              "image" && (

              <img
                src={
                  currentContent.file_url
                }
                alt={
                  currentContent.title
                }
                style={{
                  width: "100%"
                }}
              />

            )}

            {currentContent.media_type ===
              "audio" && (

              <audio
                src={
                  currentContent.file_url
                }
                autoPlay
                style={{
                  width: "100%"
                }}
              />

            )}

            <div
              style={{
                padding: "20px"
              }}
            >

              <button
                onClick={() =>
                  tunedOn(
                    currentContent.id
                  )
                }
                style={buttonMain}
              >
                ❤️ Tuned On
              </button>

            </div>

          </section>

        )}

        <section
          style={{
            marginTop: "40px",
            background: "#080808",
            padding: "20px",
            borderRadius: "20px"
          }}
        >

          <h2
            style={{
              color: "#ff6600"
            }}
          >
            Live Activity Feed
          </h2>

          {logs.map((log) => (

            <div
              key={log.id}
              style={{
                borderBottom:
                  "1px solid #222",
                padding: "12px 0"
              }}
            >

              <div
                style={{
                  color: "#ff6600"
                }}
              >
                {log.action}
              </div>

              <div>
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

    <div
      style={{
        background: "#080808",
        padding: "20px",
        borderRadius: "16px"
      }}
    >

      <div>
        {label}
      </div>

      <h2
        style={{
          color: "#ff6600"
        }}
      >
        {value}
      </h2>

    </div>

  )

}

const inputStyle = {
  width: "100%",
  padding: "14px",
  marginTop: "12px",
  background: "#111",
  border: "1px solid #333",
  borderRadius: "8px",
  color: "white",
  boxSizing: "border-box" as const
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
