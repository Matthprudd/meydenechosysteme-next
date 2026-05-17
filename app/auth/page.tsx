'use client'

import { useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function AuthPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const signUp = async () => {
    const { error } = await supabase.auth.signUp({
      email,
      password
    })

    if (error) {
      alert(error.message)
    } else {
      alert('Compte créé.')
    }
  }

  const signIn = async () => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) {
      alert(error.message)
    } else {
      alert('Connexion réussie.')
    }
  }

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
      <div
        style={{
          width: 320,
          padding: 30,
          border: '1px solid #ff6600',
          borderRadius: 12,
          background: '#111'
        }}
      >
        <h1 style={{ color: '#ff6600' }}>
          MEYDEN LOGIN
        </h1>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{
            width: '100%',
            padding: 12,
            marginTop: 20,
            background: '#222',
            border: 'none',
            color: 'white'
          }}
        />

        <input
          type="password"
          placeholder="Mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{
            width: '100%',
            padding: 12,
            marginTop: 10,
            background: '#222',
            border: 'none',
            color: 'white'
          }}
        />

        <button
          onClick={signIn}
          style={{
            width: '100%',
            padding: 12,
            marginTop: 20,
            background: '#ff6600',
            border: 'none',
            color: 'white',
            cursor: 'pointer'
          }}
        >
          Connexion
        </button>

        <button
          onClick={signUp}
          style={{
            width: '100%',
            padding: 12,
            marginTop: 10,
            background: '#333',
            border: 'none',
            color: 'white',
            cursor: 'pointer'
          }}
        >
          Créer un compte
        </button>
      </div>
    </div>
  )
}
