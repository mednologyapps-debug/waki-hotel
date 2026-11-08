export default function HotelPageSkeleton({ title = 'Cargando información...' }) {
  return (
    <main className="hotel-dashboard waki-page-skeleton" role="status" aria-live="polite" aria-label={title}>
      <div className="waki-page-skeleton__top">
        <span className="waki-shimmer waki-page-skeleton__title" />
        <span className="waki-shimmer waki-page-skeleton__action" />
      </div>
      <span className="waki-shimmer waki-page-skeleton__subtitle" />
      <div className="waki-page-skeleton__grid">
        <span className="waki-shimmer waki-page-skeleton__tile" />
        <span className="waki-shimmer waki-page-skeleton__tile" />
        <span className="waki-shimmer waki-page-skeleton__tile" />
      </div>
      <div className="waki-page-skeleton__panel">
        <span className="waki-shimmer waki-page-skeleton__panel-title" />
        <span className="waki-shimmer waki-page-skeleton__line" />
        <span className="waki-shimmer waki-page-skeleton__line" />
        <span className="waki-shimmer waki-page-skeleton__line short" />
      </div>
    </main>
  )
}
