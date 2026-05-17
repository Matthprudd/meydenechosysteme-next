export const metadata = {
  title: "Meyden Echosysteme",
  description: "Meyden OS Core connecté à Supabase"
}

export default function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body style={{ margin: 0 }}>
        {children}
      </body>
    </html>
  )
}
