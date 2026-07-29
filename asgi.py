"""
ASGI config for GameTheca production deployment.
This file wraps the Flask app to be compatible with ASGI servers like uvicorn
and provides async file streaming for downloads and static assets.

Static files are served natively (not via WsgiToAsgi) to avoid asgiref
CurrentThreadExecutor failures under concurrent asset loads.
"""

from __future__ import annotations

import asyncio
import json
import mimetypes
import os
import re
import uuid
from pathlib import Path

import aiofiles
from asgiref.wsgi import WsgiToAsgi

from gametheca import create_app, db
from gametheca.async_streaming import (
    async_generate_zipstream_response,
    create_async_streaming_response,
)
from gametheca.models import DownloadRequest, Game, User
from gametheca.utils.event_logging import log_system_event
from gametheca.utils.library_acl import user_can_access_game
from gametheca.utils.play_url import library_platform_key
from gametheca.utils.rom_archive import ArchiveRomError, resolve_playable_rom_path
from gametheca.utils.security import get_allowed_base_directories, is_safe_path
from gametheca.utils.static_files import resolve_static_path
from sqlalchemy import select


# Proper ASGI application with lifespan protocol support
class LazyASGIApp:
    def __init__(self):
        self._app = None
        self._flask_app = None
        self._init_lock = asyncio.Lock()
        self._static_root: Path | None = None

    async def _ensure_flask(self):
        """Create Flask + WsgiToAsgi once, safely under concurrent first hits."""
        if self._app is not None:
            return
        async with self._init_lock:
            if self._app is not None:
                return
            self._flask_app = create_app()
            self._static_root = Path(self._flask_app.static_folder or '').resolve()
            self._app = WsgiToAsgi(self._flask_app)

    async def __call__(self, scope, receive, send):
        if scope["type"] == "lifespan":
            await self._handle_lifespan(receive, send)
        elif scope["type"] == "http":
            path = scope["path"]

            if path.startswith('/download_zip/') or path.startswith('/api/downloadrom/'):
                await self._handle_download(scope, receive, send)
                return

            # Long-lived SSE must not run through WsgiToAsgi — a single sync
            # stream stalls the worker and freezes Discover/Admin/API fetches.
            sse_key = path.rstrip('/') or '/'
            if sse_key in self._SSE_ROUTES:
                cfg = self._SSE_ROUTES[sse_key]
                await self._handle_sse(
                    scope,
                    receive,
                    send,
                    channel=cfg['channel'],
                    event_types=cfg['event_types'],
                    restrict_child=cfg['restrict_child'],
                )
                return

            # Serve /static/* outside WsgiToAsgi — concurrent CSS/JS through the
            # bridge triggers "CurrentThreadExecutor already quit or is broken".
            if path.startswith('/static/'):
                await self._handle_static(scope, receive, send, path)
                return

            await self._ensure_flask()
            await self._app(scope, receive, send)

    # path (no trailing slash) → native async SSE config
    _SSE_ROUTES = {
        '/api/activity/stream': {
            'channel': 'activity',
            'event_types': frozenset({'activity', 'presence', 'hello', 'test'}),
            'restrict_child': True,
        },
        '/api/events/stream': {
            'channel': 'events',
            # scan/download/ops fan-out — emit all bus types
            'event_types': None,
            'restrict_child': False,
        },
    }

    async def _authorize_sse_user(self, user_id, *, restrict_child: bool) -> int | None:
        """Return HTTP error status, or None if the user may open SSE."""
        if not user_id:
            return 401
        with self._flask_app.app_context():
            from gametheca.utils.rbac import normalize_role

            user = db.session.get(User, user_id)
            if not user:
                return 401
            if restrict_child and normalize_role(getattr(user, 'role', None)) == 'child':
                return 403
        return None

    async def _handle_sse(
        self,
        scope,
        receive,
        send,
        *,
        channel: str,
        event_types: frozenset[str] | None,
        restrict_child: bool,
    ):
        """Async SSE — keeps the uvicorn event loop free (not WsgiToAsgi)."""
        import queue as queue_mod

        if scope.get("method") != "GET":
            await self._send_error(send, 405, "Method Not Allowed")
            return

        await self._ensure_flask()
        user_id = await self._get_user_from_session(scope)
        auth_status = await self._authorize_sse_user(user_id, restrict_child=restrict_child)
        if auth_status is not None:
            await self._send_error(
                send,
                auth_status,
                "Unauthorized" if auth_status == 401 else "Restricted",
            )
            return

        from gametheca.utils.event_bus import encode_sse, event_bus

        subscriber = event_bus.subscribe()

        def _poll(timeout: float = 1.0):
            try:
                return subscriber.get(timeout=timeout)
            except queue_mod.Empty:
                return None

        await send({
            "type": "http.response.start",
            "status": 200,
            "headers": [
                (b"content-type", b"text/event-stream"),
                (b"cache-control", b"no-cache"),
                (b"x-accel-buffering", b"no"),
                (b"connection", b"keep-alive"),
            ],
        })

        disconnected = asyncio.Event()

        async def _watch_disconnect():
            while True:
                message = await receive()
                if message.get("type") == "http.disconnect":
                    disconnected.set()
                    return

        hello = (
            f'event: hello\ndata: {{"ok": true, "channel": "{channel}"}}\n\n'
        ).encode('utf-8')
        watcher = asyncio.create_task(_watch_disconnect())
        try:
            await send({
                "type": "http.response.body",
                "body": hello,
                "more_body": True,
            })
            while not disconnected.is_set():
                event = await asyncio.to_thread(_poll, 1.0)
                if disconnected.is_set():
                    break
                if event is None:
                    await send({
                        "type": "http.response.body",
                        "body": b": keepalive\n\n",
                        "more_body": True,
                    })
                    continue
                if event_types is None or event.type in event_types:
                    await send({
                        "type": "http.response.body",
                        "body": encode_sse(event),
                        "more_body": True,
                    })
        except (asyncio.CancelledError, ConnectionResetError, BrokenPipeError):
            pass
        except Exception as exc:
            print(f"Error in {channel} SSE: {exc}")
        finally:
            watcher.cancel()
            try:
                await watcher
            except asyncio.CancelledError:
                pass
            event_bus.unsubscribe(subscriber)
            try:
                await send({"type": "http.response.body", "body": b"", "more_body": False})
            except Exception:
                pass

    async def _handle_static(self, scope, receive, send, path: str):
        """Stream static files with path-traversal protection."""
        if scope.get("method") not in ("GET", "HEAD"):
            await self._send_error(send, 405, "Method Not Allowed")
            return

        await self._ensure_flask()
        root = self._static_root
        if root is None or not root.is_dir():
            await self._send_error(send, 500, "Static root not configured")
            return

        candidate = resolve_static_path(root, path)
        if candidate is None:
            await self._send_error(send, 404, "Not Found")
            return

        if not candidate.is_file():
            await self._send_error(send, 404, "Not Found")
            return

        content_type, _ = mimetypes.guess_type(str(candidate))
        if not content_type:
            content_type = 'application/octet-stream'
        # CSS/JS under themes often mis-detected on some platforms
        lower = candidate.name.lower()
        if lower.endswith('.css'):
            content_type = 'text/css; charset=utf-8'
        elif lower.endswith('.js'):
            content_type = 'application/javascript; charset=utf-8'
        elif lower.endswith('.map'):
            content_type = 'application/json'
        elif lower.endswith('.svg'):
            content_type = 'image/svg+xml'
        elif lower.endswith('.woff2'):
            content_type = 'font/woff2'
        elif lower.endswith('.woff'):
            content_type = 'font/woff'

        try:
            size = candidate.stat().st_size
        except OSError:
            await self._send_error(send, 404, "Not Found")
            return

        headers = [
            (b"content-type", content_type.encode("ascii", "ignore")),
            (b"content-length", str(size).encode()),
            (b"cache-control", b"public, max-age=3600"),
        ]

        await send({
            "type": "http.response.start",
            "status": 200,
            "headers": headers,
        })

        if scope.get("method") == "HEAD":
            await send({"type": "http.response.body", "body": b"", "more_body": False})
            return

        try:
            async with aiofiles.open(candidate, "rb") as fh:
                while True:
                    chunk = await fh.read(65536)
                    if not chunk:
                        break
                    await send({
                        "type": "http.response.body",
                        "body": chunk,
                        "more_body": True,
                    })
            await send({"type": "http.response.body", "body": b"", "more_body": False})
        except Exception as exc:
            print(f"Error streaming static {path}: {exc}")
            try:
                await send({"type": "http.response.body", "body": b"", "more_body": False})
            except Exception:
                pass

    async def _handle_download(self, scope, receive, send):
        """Handle download routes with async file streaming"""
        path = scope["path"]
        method = scope["method"]

        if method != "GET":
            await self._send_error(send, 405, "Method Not Allowed")
            return

        try:
            await self._ensure_flask()

            if path.startswith('/download_zip/'):
                await self._handle_zip_download(scope, receive, send, path)
            elif path.startswith('/api/downloadrom/'):
                await self._handle_rom_download(scope, receive, send, path)

        except Exception as e:
            print(f"Error in async download handler: {str(e)}")
            try:
                await self._send_error(send, 500, "Internal Server Error")
            except Exception as error_e:
                print(f"Could not send error response (response may have already started): {str(error_e)}")
                try:
                    await send({
                        "type": "http.response.body",
                        "body": b"",
                        "more_body": False
                    })
                except Exception:
                    pass

    async def _handle_zip_download(self, scope, receive, send, path):
        """Handle ZIP file downloads"""
        download_id_match = re.match(r'/download_zip/(\d+)', path)
        if not download_id_match:
            await self._send_error(send, 400, "Invalid download ID")
            return

        download_id = int(download_id_match.group(1))

        user_id = await self._get_user_id(scope)
        if not user_id:
            await self._send_error(send, 401, "Unauthorized")
            return

        with self._flask_app.app_context():
            download_request = db.session.execute(
                select(DownloadRequest).filter_by(id=download_id, user_id=user_id)
            ).scalars().first()

            if not download_request:
                await self._send_error(send, 404, "Download not found")
                return

            if download_request.status != 'available':
                await self._send_error(send, 400, "Download not ready")
                return

            file_path = download_request.zip_file_path

            if os.path.isdir(file_path):
                await self._handle_streaming_download(send, download_request, file_path)
                return

            allowed_bases = get_allowed_base_directories(self._flask_app)
            if not allowed_bases:
                await self._send_error(send, 500, "Server configuration error")
                return

            is_safe, error_message = is_safe_path(file_path, allowed_bases)
            if not is_safe:
                log_system_event(
                    f"Security violation - game file outside allowed directories: {file_path[:100]}",
                    event_type='security',
                    event_level='warning',
                )
                await self._send_error(send, 403, "Access denied")
                return

            if not os.path.exists(file_path):
                await self._send_error(send, 404, "File not found")
                return

            filename = os.path.basename(file_path)
            log_system_event(
                f"Async file download: {filename}",
                event_type='download',
                event_level='information',
            )
            await self._stream_file(send, file_path, filename)

    async def _handle_rom_download(self, scope, receive, send, path):
        """Handle ROM file downloads for emulator"""
        rom_match = re.match(r'/api/downloadrom/([a-f0-9-]+)', path)
        if not rom_match:
            await self._send_error(send, 400, "Invalid game UUID")
            return

        game_uuid = rom_match.group(1)

        try:
            uuid.UUID(game_uuid)
        except ValueError:
            log_system_event(
                f"Invalid UUID format attempted for ROM download: {game_uuid}",
                event_type='security',
                event_level='warning',
            )
            await self._send_error(send, 400, "Invalid game identifier")
            return

        user_id = await self._get_user_id(scope)
        if not user_id:
            await self._send_error(send, 401, "Unauthorized")
            return

        with self._flask_app.app_context():
            game = db.session.execute(select(Game).filter_by(uuid=game_uuid)).scalars().first()

            if not game:
                log_system_event(
                    f"ROM download attempt for non-existent game UUID: {game_uuid}",
                    event_type='security',
                    event_level='warning',
                )
                await self._send_error(send, 404, "Game not found")
                return

            user = db.session.get(User, user_id)
            if not user or not user_can_access_game(user, game):
                log_system_event(
                    f"ROM download blocked by library ACL for user_id={user_id} game={game_uuid[:8]}...",
                    event_type='security',
                    event_level='warning',
                )
                await self._send_error(send, 403, "Access denied")
                return

            if not os.path.exists(game.full_disk_path):
                log_system_event(
                    f"ROM download attempt for missing file: {game.name} at {game.full_disk_path}",
                    event_type='security',
                    event_level='warning',
                )
                await self._send_error(send, 404, "ROM file not found on disk")
                return

            allowed_bases = get_allowed_base_directories(self._flask_app)
            is_safe, error_message = is_safe_path(game.full_disk_path, allowed_bases)

            if not is_safe:
                log_system_event(
                    f"Path traversal attempt blocked for ROM download: {game.full_disk_path} - {error_message}",
                    event_type='security',
                    event_level='warning',
                )
                await self._send_error(send, 403, "Access denied")
                return

            cache_dir = os.path.join(
                self._flask_app.root_path,
                'static',
                'library',
                'rom_cache',
                game_uuid,
            )
            platform_key = library_platform_key(game)
            try:
                rom_path, filename = resolve_playable_rom_path(
                    game.full_disk_path,
                    cache_dir=cache_dir,
                    platform=platform_key,
                )
            except ArchiveRomError as exc:
                log_system_event(
                    f"ROM resolve failed for {game.name}: {exc.message}",
                    event_type='download',
                    event_level='warning',
                )
                await self._send_error(
                    send,
                    exc.status_code,
                    exc.message,
                    code=exc.code,
                    hint=exc.hint,
                )
                return

            log_system_event(
                f"ROM file downloaded for WebRetro: {game.name}",
                event_type='download',
                event_level='information',
            )
            await self._stream_file(send, rom_path, filename)

    async def _get_user_id(self, scope):
        """Resolve user id from Bearer token (API clients) or Flask session cookie (web)."""
        headers = dict(scope.get("headers", []))
        auth_header = headers.get(b"authorization", b"").decode("utf-8")
        if auth_header.lower().startswith("bearer "):
            await self._ensure_flask()
            with self._flask_app.app_context():
                from gametheca.utils.api_tokens import verify_bearer_token

                raw = auth_header.split(" ", 1)[1].strip()
                user, token = verify_bearer_token(raw)
                if user and token and token.has_scope('write:download'):
                    return user.id
            return None

        return await self._get_user_from_session(scope)

    async def _get_user_from_session(self, scope):
        """Extract user ID from Flask session cookie"""
        headers = dict(scope.get("headers", []))
        cookie_header = headers.get(b"cookie", b"").decode("utf-8")

        if not cookie_header:
            return None

        cookies = {}
        for cookie in cookie_header.split(';'):
            if '=' in cookie:
                name, value = cookie.strip().split('=', 1)
                cookies[name] = value

        session_cookie = cookies.get('session')
        if not session_cookie:
            return None

        try:
            await self._ensure_flask()
            with self._flask_app.app_context():
                from flask import Request
                from flask.sessions import SecureCookieSessionInterface

                session_interface = SecureCookieSessionInterface()
                environ = {
                    'REQUEST_METHOD': 'GET',
                    'PATH_INFO': '/',
                    'SERVER_NAME': 'localhost',
                    'SERVER_PORT': '5000',
                    'HTTP_COOKIE': cookie_header,
                    'wsgi.url_scheme': 'http',
                }
                request = Request(environ)
                session_data = session_interface.open_session(self._flask_app, request)
                if session_data:
                    user_id = session_data.get('_user_id')
                    if user_id:
                        return int(user_id)
                return None

        except Exception as e:
            log_system_event(
                f"Error parsing Flask session cookie: {str(e)}",
                event_type='security',
                event_level='warning',
            )
            return None

    async def _stream_file(self, send, file_path, filename):
        """Stream a file asynchronously"""
        try:
            async_generator, headers = await create_async_streaming_response(file_path, filename)

            await send({
                "type": "http.response.start",
                "status": 200,
                "headers": [(k.encode(), v.encode()) for k, v in headers.items()],
            })

            async for chunk in async_generator:
                await send({
                    "type": "http.response.body",
                    "body": chunk,
                    "more_body": True,
                })

            await send({
                "type": "http.response.body",
                "body": b"",
                "more_body": False,
            })

        except Exception as e:
            log_system_event(
                f"Error streaming file {filename}: {str(e)}",
                event_type='download',
                event_level='error',
            )
            await self._send_error(send, 500, "Error streaming file")

    async def _handle_streaming_download(self, send, download_request, source_path):
        """Handle zipstream downloads for multi-file games"""
        try:
            allowed_bases = get_allowed_base_directories(self._flask_app)
            if not allowed_bases:
                await self._send_error(send, 500, "Server configuration error")
                return

            is_safe, error_message = is_safe_path(source_path, allowed_bases)
            if not is_safe:
                print(f"Security violation - streaming source outside allowed directories: {source_path[:100]}")
                await self._send_error(send, 403, "Access denied")
                return

            if not os.path.exists(source_path):
                await self._send_error(send, 404, "Source path not found")
                return

            chunk_size = self._flask_app.config.get('ZIPSTREAM_CHUNK_SIZE', 65536)
            compression_level = self._flask_app.config.get('ZIPSTREAM_COMPRESSION_LEVEL', 0)
            enable_zip64 = self._flask_app.config.get('ZIPSTREAM_ENABLE_ZIP64', True)

            if download_request.file_location:
                base_name = os.path.basename(download_request.file_location)
                filename = f"{base_name}.zip" if not base_name.lower().endswith('.zip') else base_name
            else:
                game = download_request.game
                filename = f"{game.name}.zip" if game else "download.zip"

            print(f"Starting zipstream download: {filename}")

            async_generator, headers = async_generate_zipstream_response(
                source_path, filename, chunk_size, compression_level, enable_zip64
            )

            await send({
                "type": "http.response.start",
                "status": 200,
                "headers": [(k.encode(), v.encode()) for k, v in headers.items()],
            })

            async for chunk in async_generator:
                await send({
                    "type": "http.response.body",
                    "body": chunk,
                    "more_body": True,
                })

            await send({
                "type": "http.response.body",
                "body": b"",
                "more_body": False,
            })

            print(f"Completed zipstream download: {filename}")

        except Exception as e:
            error_filename = locals().get('filename', 'unknown')
            print(f"Error streaming ZIP {error_filename}: {str(e)}")
            try:
                await self._send_error(send, 500, "Error streaming ZIP file")
            except Exception:
                try:
                    await send({
                        "type": "http.response.body",
                        "body": b"",
                        "more_body": False,
                    })
                except Exception:
                    pass

    async def _send_error(self, send, status_code, message, *, code=None, hint=None):
        """Send an HTTP error response (JSON). Optional code/hint for ROM extract failures."""
        payload = {"error": message}
        if code:
            payload["code"] = code
        if hint:
            payload["hint"] = hint
        response_body = json.dumps(payload).encode()

        await send({
            "type": "http.response.start",
            "status": status_code,
            "headers": [
                (b"content-type", b"application/json"),
                (b"content-length", str(len(response_body)).encode()),
            ],
        })

        await send({
            "type": "http.response.body",
            "body": response_body,
            "more_body": False,
        })

    async def _handle_lifespan(self, receive, send):
        """Handle ASGI lifespan events (startup/shutdown)"""
        message = await receive()

        if message["type"] == "lifespan.startup":
            try:
                from gametheca.utils.shutdown import register_shutdown_handlers

                register_shutdown_handlers()
                # Eager-init Flask so first browser burst does not race WsgiToAsgi setup.
                await self._ensure_flask()
                await send({"type": "lifespan.startup.complete"})
            except Exception as e:
                print(f"Startup failed: {e}")
                await send({"type": "lifespan.startup.failed", "message": "Startup failed"})

        elif message["type"] == "lifespan.shutdown":
            try:
                from gametheca.utils.shutdown import request_shutdown

                request_shutdown()
                print("🛑 ASGI lifespan shutdown initiated")
                await send({"type": "lifespan.shutdown.complete"})
            except Exception as e:
                print(f"Shutdown failed: {e}")
                await send({"type": "lifespan.shutdown.failed", "message": "Shutdown failed"})


asgi_app = LazyASGIApp()
