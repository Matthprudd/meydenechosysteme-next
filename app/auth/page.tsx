'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

export default function AuthPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function signUp() {
    if (!email || !password) {
      alert('Entre ton courriel et ton mot de passe.')
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.signUp({
      email,
      password
    })

    setLoading(false)

    if (error) {
      alert(error.message)
      return
    }

    alert('Compte créé. Tu peux maintenant te connecter.')
  }

  async function signIn() {
    if (!email || !password) {
      alert('Entre ton courriel et ton mot de passe.')
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    setLoading(false)

    if (error) {
      alert(error.message)
      return
    }

    router.push('/')
    router.refresh()
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#050505',
        color: 'white',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        fontFamily: 'Arial',
        padding: 20
      }}
    >
      <section
        style={{
          width: '100%',
          maxWidth: 380,
          padding: 30,
          border: '1px solid #ff6600',
          borderRadius: 16,
          background: '#111'
        }}
      >
        <h1 style={{ color: '#ff6600', marginBottom: 10 }}>
          MEYDEN LOGIN
        </h1>

        <p style={{ color: '#aaa' }}>
          Connexion au Meyden Monitor.
        </p>

        <input
          type="email"
          placeholder="Courriel"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{
            width: '100%',
            padding: 14,
            marginTop: 20,
            background: '#222',
            border: '1px solid #333',
            borderRadius: 8,
            color: 'white',
            boxSizing: 'border-box'
          }}
        />

        <input
          type="password"
          placeholder="Mot de passe / NIP"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{
            width: '100%',
            padding: 14,
            marginTop: 10,
            background: '#222',
            border: '1px solid #333',
            borderRadius: 8,
            color: 'white',
            boxSizing: 'border-box'
          }}
        />

        <button
          onClick={signIn}
          disabled={loading}
          style={{
            width: '100%',
            padding: 14,
            marginTop: 20,
            background: '#ff6600',
            border: 'none',
            borderRadius: 8,
            color: 'white',
            cursor: 'pointer',
            opacity: loading ? 0.6 : 1
          }}
        >
          {loading ? 'Connexion...' : 'Connexion'}
        </button>

        <button
          onClick={signUp}
          disabled={loading}
          style={{
            width: '100%',
            padding: 14,
            marginTop: 10,
            background: '#333',
            border: 'none',
            borderRadius: 8,
            color: 'white',
            cursor: 'pointer',
            opacity: loading ? 0.6 : 1
          }}
        >
          Créer un compte
        </button>
      </section>
    </main>
  )
}
