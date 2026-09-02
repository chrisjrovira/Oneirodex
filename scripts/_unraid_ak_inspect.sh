#!/bin/bash
set -eu
docker exec authentik ak shell <<'PY'
from authentik.providers.oauth2.models import OAuth2Provider
from authentik.core.models import Application
print('OAuth2Provider fields', [f.name for f in OAuth2Provider._meta.get_fields()][:40])
print('redirect type', OAuth2Provider._meta.get_field('_redirect_uris'))
import authentik.providers.oauth2.models as m
print('oauth2 models', [x for x in dir(m) if not x.startswith('_')])
from authentik.providers.oauth2.models import ScopeMapping
print('scope maps:')
for s in ScopeMapping.objects.all():
    print(' ', s.name, s.scope_name)
from authentik.crypto.models import CertificateKeyPair
for k in CertificateKeyPair.objects.all():
    print('key', k.name, k.pk)
from authentik.flows.models import Flow
for f in Flow.objects.filter(designation__in=['authorization','authentication']):
    print('flow', f.slug, f.pk)
PY
