/** Shared stub for More destinations not yet fully migrated. */
export function StubPage({ title }) {
  return (
    <div className="gt-more-page">
      <div className="gt-page-header">
        <h1>{title}</h1>
      </div>
      <p>Loading…</p>
    </div>
  )
}

export function CollectionsPage() {
  return <StubPage title="Collections" />
}

export function CollectionDetailPage() {
  return <StubPage title="Collection" />
}

export function WishlistPage() {
  return <StubPage title="Wishlist" />
}

export function OwnershipPage() {
  return <StubPage title="Ownership" />
}

export function BigPicturePage() {
  return <StubPage title="Big Picture" />
}

export function VrPage() {
  return <StubPage title="VR" />
}

export function TrailersPage() {
  return <StubPage title="Trailers" />
}
