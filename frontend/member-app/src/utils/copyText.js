/**
 * Clipboard copy helpers.
 *
 * The implementation moved into `@oneirodex/ui` (PR-4 d) alongside AccountModal,
 * which shares it. This shim keeps the `../utils/copyText` path other member
 * modules (TokensPage) import.
 */
export { copyText, copyViaElementSelection, copyViaTextarea } from '@oneirodex/ui'
