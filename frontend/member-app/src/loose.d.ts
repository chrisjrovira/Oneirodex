// PR-5a on-ramp: destructured props and option bags from the JS sources have
// no annotations, so `tsc` infers `{}` / required keys from defaults. Real
// prop types land in PR-5b with `strict: true`. `any` here is the same
// nested-payload escape hatch admin used on `adminApi`.
type LooseProps = Record<string, any>
