"use client"

import { useEffect, useMemo, useState } from "react"
import { supabase } from "../lib/supabase"

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

    const totalContents = contents.length

    const totalTunedOn =
      contents.reduce(
        (sum, item) => sum + Number(item.tuned_on || 0),
        0
      )

    const totalViews =
      contents.reduce(
        (sum, item) => sum + Number(item.views || 0),
        0
      )

    const totalWatchtime =
      contents.reduce(
        (sum, item) => sum + Number(item.watchtime_seconds || 0),
        0
      )

    const totalCoinsGenerated =
      contents.reduce(
        (sum, item) => sum + Number(item.coins_generated || 0),
        0
      )

    return {
      totalContents,
      totalTunedOn,
      totalViews,
      totalWatchtime,
      totalCoinsGenerated
    }

  }, [contents])

  async function logout() {
    await supabase.auth.signOut()
    window.location.reload()
  }

  async function uploadMedia() {

    if (!selectedFile || !user || !newTitle.trim()) return

    const fileExt =
      selectedFile.name.split(".").pop()

    const fileName =
      `${Date.now()}.${fileExt}`

    const filePath =
      `${user.id}/${fileName}`

    const { error: uploadError } =
      await supabase.storage
        .from("meyden-media")
        .upload(filePath, selectedFile)

    if (uploadError) {
      alert(uploadError.message)
      return
    }

    const {
      data: publicUrlData
    } = supabase.storage
      .from("meyden-media")
      .getPublicUrl(filePath)

    const fileUrl =
      publicUrlData.publicUrl

    let mediaType = "video"

    if (
      selectedFile.type.startsWith("image/")
    ) {
      mediaType = "image"
    }

    if (
      selectedFile.type.startsWith("audio/")
    ) {
      mediaType = "audio"
    }

    const { error } =
      await supabase
        .from("monitor_content")
        .insert({

          user_id: user.id,

          title: newTitle.trim(),

          file_url: fileUrl,

          media_type: mediaType,

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

    await supabase
      .from("live_activity_logs")
      .insert({
        user_id: user.id,
        action: "Upload média",
        module: "Meyden Monitor",
        details: newTitle.trim()
      })

    window.location.reload()
  }

  async function tunedOn(contentId: number) {

    if (!user) return

    const { error } =
      await supabase
        .from("tuned_on_events")
        .insert({
          content_id: contentId,
          user_id: user.id
        })

    if (error) {
      alert(error.message)
      return
    }

    await supabase
      .from("live_activity_logs")
      .insert({
        user_id: user.id,
        action: "Tuned On",
        module: "Meyden Monitor",
        details: `Tuned On contenu ${contentId}`
      })

    window.location.reload()
  }

  async function runMonitorCycle() {

    const { error } =
      await supabase.rpc(
        "process_monitor_cycle"
      )

    if (error) {
      alert(error.message)
      return
    }

    await supabase
      .from("live_activity_logs")
      .insert({
        user_id: user.id,
        action: "Cycle Monitor",
        module: "Meyden Monitor",
        details: "Cycle 2h lancé"
      })

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
          alignItems: "center",
          justifyContent: "center",
          fontSize: "24px",
          fontFamily: "Arial"
        }}
      >
        Chargement Meyden OS...
      </main>
    )
  }

  return (

    <main
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
          fontSize: "52px",
          marginBottom: "10px"
        }}
      >
        MEYDEN MONITOR
      </h1>

      <p
        style={{
          color: "#999",
          marginBottom: "30px"
        }}
      >
        Dashboard Fondateur
      </p>

      <section
        style={{
          background: "#080808",
          padding: "30px",
          borderRadius: "20px",
          marginBottom: "30px"
        }}
      >

        <h2 style={{ color: "#ff6600" }}>
          Upload média
        </h2>

        <input
          value={newTitle}
          onChange={(e) =>
            setNewTitle(e.target.value)
          }
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

        <input
          type="file"
          onChange={(e) =>
            setSelectedFile(
              e.target.files?.[0] || null
            )
          }
          style={{
            marginBottom: "20px"
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
            onClick={uploadMedia}
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
            Upload Monitor
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
            Cycle 2h test
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

      <section
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit,minmax(220px,1fr))",
          gap: "15px",
          marginBottom: "30px"
        }}
      >

        <div
          style={{
            background: "#080808",
            padding: "20px",
            borderRadius: "16px"
          }}
        >
          <div>Total contenus</div>
          <h2 style={{ color: "#ff6600" }}>
            {stats.totalContents}
          </h2>
        </div>

        <div
          style={{
            background: "#080808",
            padding: "20px",
            borderRadius: "16px"
          }}
        >
          <div>Total Tuned On</div>
          <h2 style={{ color: "#ff6600" }}>
            {stats.totalTunedOn}
          </h2>
        </div>

        <div
          style={{
            background: "#080808",
            padding: "20px",
            borderRadius: "16px"
          }}
        >
          <div>Total Views</div>
          <h2 style={{ color: "#ff6600" }}>
            {stats.totalViews}
          </h2>
        </div>

        <div
          style={{
            background: "#080808",
            padding: "20px",
            borderRadius: "16px"
          }}
        >
          <div>Watchtime</div>
          <h2 style={{ color: "#ff6600" }}>
            {stats.totalWatchtime}
          </h2>
        </div>

        <div
          style={{
            background: "#080808",
            padding: "20px",
            borderRadius: "16px"
          }}
        >
          <div>Coins générés</div>
          <h2 style={{ color: "#ff6600" }}>
            {stats.totalCoinsGenerated}
          </h2>
        </div>

      </section>

      <section
        style={{
          display: "grid",
          gap: "20px"
        }}
      >

        {contents.map((item) => (

          <div
            key={item.id}
            style={{
              background: "#080808",
              padding: "25px",
              borderRadius: "20px"
            }}
          >

            <h2
              style={{
                color: "#ff6600"
              }}
            >
              {item.title}
            </h2>

            <p>
              Monitor :
              {" "}
              {item.monitor_level}
            </p>

            <p>
              Tuned On :
              {" "}
              {item.tuned_on || 0}
            </p>

            <p>
              Views :
              {" "}
              {item.views || 0}
            </p>

            <p>
              Watchtime :
              {" "}
              {item.watchtime_seconds || 0}
            </p>

            <p>
              Score :
              {" "}
              {item.promotion_score || 0}
            </p>

            <p>
              Coins :
              {" "}
              {item.coins_generated || 0}
            </p>

            <p>
              État :
              {" "}
              {item.evolution_state}
            </p>

            {item.media_type === "video" && (
              <video
                src={item.file_url}
                controls
                style={{
                  width: "100%",
                  borderRadius: "14px",
                  marginTop: "15px"
                }}
              />
            )}

            {item.media_type === "image" && (
              <img
                src={item.file_url}
                alt=""
                style={{
                  width: "100%",
                  borderRadius: "14px",
                  marginTop: "15px"
                }}
              />
            )}

            {item.media_type === "audio" && (
              <audio
                src={item.file_url}
                controls
                style={{
                  width: "100%",
                  marginTop: "15px"
                }}
              />
            )}

            <button
              onClick={() =>
                tunedOn(item.id)
              }
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

      </section>

      <section
        style={{
          background: "#080808",
          padding: "30px",
          borderRadius: "20px",
          marginTop: "30px"
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
              {log.module}
            </div>

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

    </main>
  )
}
