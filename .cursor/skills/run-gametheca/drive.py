#!/usr/bin/env python3
"""Drive a running GameTheca server: log in, then call its JSON API.

Why this exists rather than a curl one-liner
--------------------------------------------
* `curl` from Git Bash on this checkout cannot reach 127.0.0.1 — it returns
  exit 000 with an empty body while the server is demonstrably serving. Python
  sockets work. So the handle on this app has to be Python.
* Every mutating route wants a session cookie *and* an `X-CSRFToken` header,
  and the two tokens come from different places: the login form field
  (`csrf_token`) and the `csrf-token` <meta> on any rendered page.

Usage
-----
    python .cursor/skills/run-gametheca/drive.py --smoke
    python .cursor/skills/run-gametheca/drive.py --get /api/collections
    python .cursor/skills/run-gametheca/drive.py --post /api/requests --body '{"title":"x"}'
    python .cursor/skills/run-gametheca/drive.py --delete /api/requests/1

`--smoke` walks the shared response envelope (gametheca/utils/api_response.py)
across representative surfaces and prints how each one answered, including the
two responses that deliberately do *not* use the envelope.
"""
from __future__ import annotations

import argparse
import json
import re
import sys

try:
    import requests
except ImportError:  # pragma: no cover
    sys.exit('pip install requests')

ENVELOPE = ('ok', 'error', 'error_code')


def normalize_path(path: str) -> str:
    """Undo MSYS path mangling, and accept a path with or without a slash.

    Git Bash rewrites an argument that starts with `/` into a Windows path
    before Python ever sees it, so `--get /api/collections` arrives as
    `C:/Program Files/Git/api/collections` and requests raises InvalidURL. The
    real fix is `MSYS_NO_PATHCONV=1` (see SKILL.md); this recovers anyway,
    because the failure is baffling if you have not met it before.
    """
    if ':' in path[:3] and '/Git/' in path:
        path = '/' + path.split('/Git/', 1)[1]
    return path if path.startswith('/') else '/' + path


class Client:
    def __init__(self, base: str, user: str, password: str):
        self.base = base.rstrip('/')
        self.user = user
        self.password = password
        self.s = requests.Session()
        # Ignore any proxy/CA env the shell carries; this is always localhost.
        self.s.trust_env = False
        self.csrf = ''

    def login(self) -> bool:
        page = self.s.get(f'{self.base}/login', timeout=15)
        m = re.search(r'name="csrf_token"[^>]*value="([^"]+)"', page.text)
        r = self.s.post(
            f'{self.base}/login',
            # The field is `username`, not `email` — the form asks for the
            # account name even though users also have an address.
            data={'username': self.user, 'password': self.password,
                  'csrf_token': m.group(1) if m else ''},
            allow_redirects=True, timeout=20,
        )
        if '/login' in r.url:
            return False
        page = self.s.get(f'{self.base}/library', timeout=20)
        m = re.search(r'name="csrf-token"[^>]*content="([^"]+)"', page.text)
        self.csrf = m.group(1) if m else ''
        return True

    def call(self, method: str, path: str, body=None):
        headers = {'Accept': 'application/json'}
        if method != 'GET':
            headers['X-CSRFToken'] = self.csrf
        if body is not None:
            headers['Content-Type'] = 'application/json'
        return self.s.request(method, f'{self.base}{path}', headers=headers,
                              data=json.dumps(body) if body is not None else None,
                              timeout=30)


#: (label, method, path, expected status, body, keys that must survive)
SMOKE = [
    ('collections missing',   'GET',    '/api/collections/nope',                 404, None, None),
    ('collections no name',   'POST',   '/api/collections',                      400, {},   None),
    ('wishlist no title',     'POST',   '/api/requests',                         400, {},   None),
    ('wishlist missing',      'DELETE', '/api/requests/999999',                  404, None, None),
    ('support missing',       'GET',    '/api/support/tickets/999999',           404, None, None),
    ('wanted no game_uuid',   'POST',   '/api/updates/wanted/fulfill',           400, {},   None),
    ('cheats bad game',       'GET',    '/api/games/not-a-uuid/cheats',          404, None, None),
    ('chat channel missing',  'GET',    '/api/chat/channels/999999/messages',    404, None, None),
    ('chat space missing',    'GET',    '/api/chat/spaces/999999/members',       404, None, None),
    ('download bad uuid',     'GET',    '/api/games/not-a-uuid/versions',        400, None, None),
    ('providers no query',    'GET',    '/api/providers/igdb/search',            400, None, None),
    ('file_types bad cat',    'GET',    '/api/file_types/nope',                  400, None, None),
    ('library_tools no uuid', 'POST',   '/api/library_tools/check_freshness',    400, {},   None),
    ('unmatched bad status',  'GET',    '/api/unmatched_folders/export?status=x', 400, None, None),
    # Success through api_ok — carries error/error_code as null on purpose.
    ('wanted fulfill ok',     'POST',   '/api/updates/wanted/fulfill',           200,
     {'game_uuid': 'no-such-game'}, ['ok', 'error', 'error_code', 'success']),
    # Deliberately NOT the envelope. Both are live client contracts:
    # scanQueuePolicy.js branches on `status`, and three runbooks curl /healthz.
    ('scan queue [contract]', 'POST',   '/api/admin/libraries/scan',             400, {},
     ['status', 'job_id', 'position', 'message']),
    ('healthz    [contract]', 'GET',    '/healthz',                              200, None,
     ['status', 'probe', 'version']),
]


def smoke(c: Client) -> int:
    rows, bad = [], 0
    for label, method, path, expect, body, want in SMOKE:
        r = c.call(method, path, body)
        try:
            data = r.json()
        except ValueError:
            rows.append((label, f'{r.status_code}!', '<non-json>', '', ''))
            bad += 1
            continue
        ok_status = r.status_code == expect
        shape = 'envelope' if all(k in data for k in ENVELOPE) else 'plain'
        note, missing = '', [k for k in (want or []) if k not in data]
        if want:
            note = 'keeps ' + ','.join(k for k in want if k in data)
            if missing:
                note += '  MISSING:' + ','.join(missing)
        if not ok_status or missing:
            bad += 1
        rows.append((label, f'{r.status_code}{"" if ok_status else f" WANT {expect}"}',
                     shape, data.get('error_code') or '', note))

    w = max(len(r[0]) for r in rows) + 2
    print(f'{"endpoint".ljust(w)}{"status".ljust(12)}{"shape".ljust(11)}'
          f'{"error_code".ljust(14)}note')
    print('-' * (w + 60))
    for row in rows:
        print(f'{row[0].ljust(w)}{row[1].ljust(12)}{row[2].ljust(11)}'
              f'{row[3].ljust(14)}{row[4]}')
    print(f'\n{len(rows) - bad}/{len(rows)} as expected')
    return 1 if bad else 0


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('--base', default='http://127.0.0.1:5099')
    p.add_argument('--user', default='RunSkillAdmin')
    p.add_argument('--password', default='VerifyRun!2026')
    p.add_argument('--smoke', action='store_true')
    p.add_argument('--get'); p.add_argument('--post')
    p.add_argument('--put'); p.add_argument('--delete')
    p.add_argument('--body', help='JSON string')
    a = p.parse_args()

    c = Client(a.base, a.user, a.password)
    if not c.login():
        # serve.sh bootstraps RunSkillAdmin, but an existing admin may already
        # own the row it found; pass --user to use that one instead.
        print(f'login failed as {a.user!r} at {a.base}', file=sys.stderr)
        return 2
    print(f'logged in as {a.user}  csrf={"yes" if c.csrf else "NO"}\n')

    if a.smoke or not any((a.get, a.post, a.put, a.delete)):
        return smoke(c)

    method, raw = next((m, v) for m, v in
                       (('GET', a.get), ('POST', a.post), ('PUT', a.put), ('DELETE', a.delete))
                       if v)
    path = normalize_path(raw)
    r = c.call(method, path, json.loads(a.body) if a.body else None)
    print(f'{method} {path} -> HTTP {r.status_code}')
    try:
        print(json.dumps(r.json(), indent=2, sort_keys=True))
    except ValueError:
        print(r.text[:2000])
    return 0 if r.ok else 1


if __name__ == '__main__':
    sys.exit(main())
