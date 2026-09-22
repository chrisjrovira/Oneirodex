import type { ArtStudioTab } from './artStudioModel'

/** The studio / stock / marks / images tab strip. */
export function ArtStudioTabs({
  selectTab,
  tab,
}: {
  selectTab: (next: ArtStudioTab) => void
  tab: ArtStudioTab
}) {
  return (
    <div className="od-art-tabs" role="tablist" aria-label="Art studio sections">
      <button
        type="button"
        role="tab"
        aria-selected={tab === 'studio'}
        className={`od-art-tabs__btn${tab === 'studio' ? ' is-active' : ''}`}
        onClick={() => selectTab('studio')}
      >
        Studio
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={tab === 'stock'}
        className={`od-art-tabs__btn${tab === 'stock' ? ' is-active' : ''}`}
        onClick={() => selectTab('stock')}
      >
        Backup &amp; stock
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={tab === 'marks'}
        className={`od-art-tabs__btn${tab === 'marks' ? ' is-active' : ''}`}
        onClick={() => selectTab('marks')}
      >
        System marks
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={tab === 'images'}
        className={`od-art-tabs__btn${tab === 'images' ? ' is-active' : ''}`}
        onClick={() => selectTab('images')}
      >
        Pick &amp; queue
      </button>
    </div>
  )
}
