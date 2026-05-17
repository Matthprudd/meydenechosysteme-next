'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function HomePage() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    initialize()
  }, [])

  const initialize = async () => {
    const {
      data: { user }
    } = await supabase.auth.getUser()

    if (!user) {
      setLoading(false)
      return
    }

    setUser(user)

    const { data: profileData } = await supabase
      .from('profiles')
      .select('id,email,nom,role,meyden_level,coins,status')
      .eq('id', user.id)
      .single()

    setProfile(profileData)
    setLoading(false)
  }

  const logout = async () => {
    await supabase.auth.signOut()
    location.reload()
  }

  if (loading) {
    return (
      <main style={{ minHeight: '100vh', background: '#050505', color: 'white', padding: 40 }}>
        Chargement Meyden...
      </main>
    )
  }

  if (!user) {
    return (
      <main style={{ minHeight: '100vh', background: '#050505', color: 'white', padding: 40, fontFamily: 'Arial' }}>
        <h1 style={{ color: '#ff6600' }}>MEYDEN ECHOSYSTEME</h1>
        <p>Aucun utilisateur connecté.</p>
        <a href="/auth" style={{ color: '#ff6600' }}>Aller au login</a>
      </main>
    )
  }

  return (
    <main style={{ minHeight: '100vh', background: '#050505', color: 'white', padding: 40, fontFamily: 'Arial' }}>
      <h1 style={{ color: '#ff6600' }}>MEYDEN OS CORE</h1>

      <section style={{ marginTop: 30, padding: 25, border: '1px solid #ff6600', borderRadius: 14, background: '#111' }}>
        <h2>Profil Meyden Live</h2>
        <p>Email : {profile?.email}</p>
        <p>Nom : {profile?.nom}</p>
        <p>Role : {profile?.role}</p>
        <p>Niveau Meyden : {profile?.meyden_level}</p>
        <p>Coins : {profile?.coins}</p>
        <p>Status : {profile?.status}</p>

        <button onClick={logout} style={{ marginTop: 20, padding: 12, background: '#ff6600', border: 'none', color: 'white' }}>
          Logout
        </button>
      </section>

      <section style={{ marginTop: 30, display: 'grid', gap: 18 }}>
        <div style={{ padding: 22, background: '#111', borderRadius: 14 }}>
          Meyden Monitor — connecté au profil utilisateur
        </div>

        <div style={{ padding: 22, background: '#111', borderRadius: 14 }}>
          Meyden Coins — solde live : {profile?.coins}
        </div>

        <div style={{ padding: 22, background: '#111', borderRadius: 14 }}>
          Creator Dashboard — rôle actuel : {profile?.role}
        </div>

        <div style={{ padding: 22, background: '#111', borderRadius: 14 }}>
          Activity Logs — statut : {profile?.status}
        </div>
      </section>
    </main>
  )
}
