export function Page({ title, lede, children }) {
  return (
    <div className="od-admin-page">
      <h1>{title}</h1>
      {lede ? <p className="od-admin-lede">{lede}</p> : null}
      {children}
    </div>
  )
}
