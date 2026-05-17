export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg,#050505 0%,#101014 100%)",
        color: "white",
        fontFamily: "Arial, sans-serif",
        padding: "40px"
      }}
    >
      <h1
        style={{
          fontSize: "48px",
          color: "#ff6a00",
          marginBottom: "20px"
        }}
      >
        MEYDEN ECHOSYSTEME
      </h1>

      <p
        style={{
          fontSize: "18px",
          opacity: 0.8,
          marginBottom: "40px"
        }}
      >
        Backend Supabase connecté. Infrastructure Meyden active.
      </p>

      <section
        style={{
          border: "1px solid rgba(255,106,0,0.4)",
          borderRadius: "20px",
          padding: "30px",
          background: "rgba(255,255,255,0.04)"
        }}
      >
        <h2
          style={{
            color: "#ff6a00",
            marginBottom: "20px"
          }}
        >
          Meyden OS Core
        </h2>

        <ul
          style={{
            lineHeight: "2"
          }}
        >
          <li>Connexion Supabase</li>
          <li>Authentification Meyden</li>
          <li>Base de données active</li>
          <li>Coins système</li>
          <li>Monitor architecture</li>
          <li>Dashboard créateur</li>
          <li>Logs activité plateforme</li>
        </ul>
      </section>
    </main>
  )
}
