import { Button } from '@oneirodex/ui'
import type { ImageRow } from './imagesModel'
import { queueFailureText } from './imagesModel'

/** One image in the queue: thumbnail, meta, download / delete. */
export function QueueRow({
  image,
  busy,
  onDownload,
  onDelete,
  showGame = false,
}: {
  image: ImageRow
  busy?: string
  onDownload: (id: string) => void
  onDelete: (id: string) => void
  showGame?: boolean
}) {
  const status = image.status || (image.is_downloaded ? 'downloaded' : 'pending')
  const failure = queueFailureText(image)
  return (
    <li className="od-images-row">
      {image.local_url ? (
        <img src={image.local_url} alt="" className="od-images-row__thumb" loading="lazy" />
      ) : (
        <span className="od-images-row__thumb od-images-row__thumb--empty" aria-hidden="true" />
      )}
      <div className="od-images-row__meta">
        {showGame ? <strong>{image.game_name}</strong> : null}
        <span>
          {image.image_type} · {status}
          {image.file_missing ? ' · file missing' : ''}
          {failure ? (
            <span className="od-images-row__error" title={failure}>
              {' '}
              — {failure}
            </span>
          ) : null}
        </span>
      </div>
      <div className="od-images-row__actions">
        {status === 'pending' || status === 'failed' || image.file_missing ? (
          <Button
            type="button"
            variant="ghost"
            disabled={Boolean(busy)}
            onClick={() => onDownload(image.id)}
          >
            {status === 'failed' || image.file_missing ? 'Retry' : 'Download'}
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          disabled={Boolean(busy)}
          onClick={() => onDelete(image.id)}
        >
          Delete
        </Button>
      </div>
    </li>
  )
}
