# Oneirodex OAuth2 app in Authentik 2025.8. Loaded via:
#   echo "exec(open('/media/create_oneirodex.py').read())" | docker exec -i authentik ak shell
from authentik.core.models import Application, Group, User
from authentik.crypto.models import CertificateKeyPair
from authentik.flows.models import Flow
from authentik.providers.oauth2.models import ClientTypes, OAuth2Provider, ScopeMapping

CLIENT_ID = 'oneirodex'
CLIENT_SECRET = open('/media/.oneirodex_oidc_secret', 'r', encoding='utf-8').read().strip()
REDIRECT = 'http://192.168.50.116:5006/login/oidc/callback'

authz = Flow.objects.get(slug='default-provider-authorization-implicit-consent')
signing = CertificateKeyPair.objects.filter(name='authentik Self-signed Certificate').first()

defaults = {
    'authorization_flow': authz,
    'client_type': ClientTypes.CONFIDENTIAL,
    'client_id': CLIENT_ID,
    'client_secret': CLIENT_SECRET,
    'include_claims_in_id_token': True,
    'signing_key': signing,
    '_redirect_uris': [{'matching_mode': 'strict', 'url': REDIRECT}],
}
try:
    defaults['authentication_flow'] = Flow.objects.get(slug='default-authentication-flow')
except Exception:
    pass

provider, created = OAuth2Provider.objects.update_or_create(name='Oneirodex', defaults=defaults)
scopes = list(
    ScopeMapping.objects.filter(scope_name__in=['openid', 'email', 'profile', 'offline_access'])
)
groups_map, _ = ScopeMapping.objects.get_or_create(
    name='Oneirodex groups',
    defaults={
        'scope_name': 'groups',
        'description': 'Expose Authentik group names as the groups claim',
        'expression': 'return {"groups": [g.name for g in request.user.ak_groups.all()]}',
    },
)
if groups_map.pk not in {s.pk for s in scopes}:
    scopes.append(groups_map)
provider.property_mappings.set(scopes)
provider.save()

app, _ = Application.objects.update_or_create(
    slug='oneirodex',
    defaults={
        'name': 'Oneirodex',
        'provider': provider,
        'meta_launch_url': 'http://192.168.50.116:5006',
        'policy_engine_mode': 'any',
    },
)

for gname in ('oneirodex-admin', 'oneirodex-librarian', 'oneirodex-child'):
    Group.objects.get_or_create(name=gname)

admin_group = Group.objects.get(name='oneirodex-admin')
for user in User.objects.filter(username='akadmin'):
    user.ak_groups.add(admin_group)

status = 'created' if created else 'updated'
open('/media/.oneirodex_oidc_ok', 'w', encoding='utf-8').write(
    f'{status} slug={app.slug} client_id={provider.client_id} '
    f'issuer=http://192.168.50.116:9000/application/o/oneirodex/\n'
)
print('OIDC_OK')
