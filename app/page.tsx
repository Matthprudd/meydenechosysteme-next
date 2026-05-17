'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function HomePage() {
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    checkUser()
  }, [])

  const checkUser = async () => {
    const {
      data: { user }
    } = await supabase.auth.getUser()

    setUser(user)
  }

  const logout = async () => {
    await supabase.auth.signOut()
    location.reload()
  }

  if (!user) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#050505',
          color: 'white',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          fontFamily: 'Arial'
        }}
      >
        <div>
          <h1 style={{ color: '#ff6600' }}>
            MEYDEN ECHOSYSTEME
          </h1>

          <p>
            Aucun utilisateur connecté.
          </p>

          <a
            href="/auth"
            style={{
              color: '#ff6600'
            }}
          >
            Aller au login
          </a>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#050505',
        color: 'white',
        padding: 40,
        fontFamily: 'Arial'
      }}
    >
      <h1 style={{ color: '#ff6600' }}>
        MEYDEN OS CORE
      </h1>

      <div
        style={{
          marginTop: 30,
          padding: 20,
          border: '1px solid #ff6600',
          borderRadius: 12,
          background: '#111'
        }}
      >
        <h2>Session active</h2>

        <p>
          Email : {user.email}
        </p>

        <p>
          ID : {user.id}
        </p>

        <p>
          Statut : CONNECTÉ
        </p>

        <button
          onClick={logout}
          style={{
            marginTop: 20,
            padding: 12,
            background: '#ff6600',
            border: 'none',
            color: 'white',
            cursor: 'pointer'
          }}
        >
          Logout
        </button>
      </div>

      <div
        style={{
          marginTop: 30,
          display: 'grid',
          gap: 20
        }}
      >
        <div
          style={{
            padding: 20,
            background: '#111',
            borderRadius: 12
          }}
        >
          Meyden Monitor
        </div>

        <div
          style={{
            padding: 20,
            background: '#111',
            borderRadius: 12
          }}
        >
          Meyden Coins
        </div>

        <div
          style={{
            padding: 20,
            background: '#111',
            borderRadius: 12
          }}
        >
          Creator Dashboard
        </div>

        <div
          style={{
            padding: 20,
            background: '#111',
            borderRadius: 12
          }}
        >
          Activity Logs
        </div>
      </div>
    </div>
  )
}
