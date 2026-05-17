'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function HomePage() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)

  useEffect(() => {
    initialize()
  }, [])

  const initialize = async () => {
    const {
      data: { user }
    } = await supabase.auth.getUser()

    if (!user) {
      return
    }

    setUser(user)

    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (!existingProfile) {
      await supabase.from('profiles').insert({
        id: user.id,
        email: user.email,
        full_name: 'Utilisateur Meyden',
        role: 'public'
      })

      const { data: newProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      setProfile(newProfile)
    } else {
      setProfile(existingProfile)
    }
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

        <p>Email : {user.email}</p>

        <p>ID : {user.id}</p>

        <p>
          Role : {profile?.role}
        </p>

        <p>
          Nom : {profile?.full_name}
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
