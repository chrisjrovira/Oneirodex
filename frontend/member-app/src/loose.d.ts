// PR-5b: destructured props and nested API payloads stay on LooseProps
// (`Record<string, any>`), the same escape hatch admin used on `adminApi`.
// Real per-component prop types can land later without flipping `strict`.
type LooseProps = Record<string, any>
