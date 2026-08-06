import uuid
from flask import Blueprint, render_template, redirect, url_for, request, flash, jsonify, current_app, abort, session
from flask_login import current_user, login_required, login_user
from gametheca import db
from gametheca.models import User, InviteToken, GlobalSettings, Whitelist
from gametheca.forms import LoginForm, RegistrationForm, ResetPasswordRequestForm, InviteForm, UserPasswordForm
from gametheca.utils.auth import _authenticate_and_redirect
from gametheca.utils.smtp import send_email, send_password_reset_email, send_invite_email
from gametheca.utils.processors import get_global_settings
from gametheca.utils.event_logging import log_system_event
from gametheca.utils.oidc import (
    AUTHLIB_AVAILABLE,
    build_oidc_config,
    format_oidc_callback_error,
    format_oidc_idp_error,
    generate_pkce_pair,
    get_oauth_client,
    init_oauth,
    pop_oidc_session,
    provision_or_update_user,
    register_oidc_provider,
    store_oidc_session,
)
from gametheca.utils.login_rate_limit import (
    auth_endpoint_key,
    clear_failures,
    client_ip_from_request,
    is_rate_limited,
    login_rate_key,
    record_failure,
)
from gametheca import cache
from datetime import datetime, timedelta, timezone
from sqlalchemy import func, select
from urllib.parse import urlparse
from itsdangerous import URLSafeTimedSerializer, SignatureExpired, BadSignature
from uuid import uuid4
from sqlalchemy.exc import IntegrityError


login_bp = Blueprint('login', __name__)

_INVALID_CREDS = 'Invalid username or password. USERNAMES ARE CASE SENSITIVE!'

def get_serializer():
    """Get URLSafeTimedSerializer with current app's secret key."""
    return URLSafeTimedSerializer(current_app.config['SECRET_KEY'])

def is_smtp_configured():
    """Check if SMTP settings are properly configured."""
    settings = db.session.execute(select(GlobalSettings)).scalar_one_or_none()
    if not settings:
        return False
    return bool(settings.smtp_server and 
                settings.smtp_port and 
                settings.smtp_username and 
                settings.smtp_password)

@login_bp.context_processor
@cache.cached(timeout=500, key_prefix='global_settings')
def inject_settings():
    """Context processor to inject global settings into templates"""
    return get_global_settings()

@login_bp.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('discover.discover'))

    print("Route: /login")
    form = LoginForm()
    if request.method == 'POST' and form.validate_on_submit():
        username = form.username.data
        password = form.password.data
        ip = client_ip_from_request(request)
        rate_key = login_rate_key(ip, username)

        if is_rate_limited(rate_key) or is_rate_limited(login_rate_key(ip, None)):
            flash('Too many login attempts. Please wait a few minutes and try again.', 'error')
            log_system_event(
                f'Login rate-limited for IP {ip}',
                event_type='login',
                event_level='warning',
            )
            return redirect(url_for('login.login'))

        user = db.session.execute(select(User).filter_by(name=username)).scalar_one_or_none()

        if user:
            if not user.is_email_verified:
                flash('Your account is not activated, check your email.', 'warning')
                log_system_event(f"User {username} attempted to log in with an unverified account.", event_type='login', event_level='warning')
                record_failure(rate_key)
                return redirect(url_for('login.login'))

            if not user.state:
                flash('Your account has been banned.', 'error')
                log_system_event(f"User {username} attempted to log in with a banned account.", event_type='login', event_level='warning')
                print(f"Error: Attempted login to disabled account - User: {username}")
                record_failure(rate_key)
                return redirect(url_for('login.login'))

            if not user.check_password(password):
                flash(_INVALID_CREDS, 'error')
                log_system_event(
                    f"User {username} attempted to log in with invalid credentials.",
                    event_type='login',
                    event_level='warning',
                )
                record_failure(rate_key)
                record_failure(login_rate_key(ip, None))
                return redirect(url_for('login.login'))

            clear_failures(rate_key)
            clear_failures(login_rate_key(ip, None))
            log_system_event(f"User {username} logged in successfully.", event_type='login', event_level='information')
            return _authenticate_and_redirect(username, password)
        else:
            flash(_INVALID_CREDS, 'error')
            log_system_event(
                f"Failed login for unknown user from {ip}",
                event_type='login',
                event_level='warning',
            )
            record_failure(rate_key)
            record_failure(login_rate_key(ip, None))
            return redirect(url_for('login.login'))

    settings_record = db.session.execute(select(GlobalSettings)).scalar_one_or_none()
    oidc_config = build_oidc_config(settings_record)
    return render_template(
        'login/login.html',
        form=form,
        oidc_enabled=oidc_config is not None,
        oidc_display_name=oidc_config.display_name if oidc_config else 'Sign in with SSO',
    )


@login_bp.route('/login/oidc')
def oidc_start():
    """Begin OIDC authorization code + PKCE flow."""
    if current_user.is_authenticated:
        return redirect(url_for('discover.discover'))

    settings_record = db.session.execute(select(GlobalSettings)).scalar_one_or_none()
    config = build_oidc_config(settings_record)
    if not config:
        flash('Single sign-on is not enabled.', 'warning')
        return redirect(url_for('login.login'))

    if not AUTHLIB_AVAILABLE:
        flash('SSO is configured but authlib is not installed. Contact an administrator.', 'error')
        return redirect(url_for('login.login'))

    code_verifier, code_challenge = generate_pkce_pair()
    state = uuid.uuid4().hex
    store_oidc_session(session, state, code_verifier)

    init_oauth(current_app)
    register_oidc_provider(current_app, config)
    oauth_client = get_oauth_client()
    if oauth_client is None:
        flash('SSO client failed to initialize.', 'error')
        return redirect(url_for('login.login'))

    redirect_uri = config.redirect_uri or url_for('login.oidc_callback', _external=True)
    return oauth_client.oidc.authorize_redirect(
        redirect_uri=redirect_uri,
        state=state,
        code_challenge=code_challenge,
        code_challenge_method='S256',
    )


@login_bp.route('/login/oidc/callback')
def oidc_callback():
    """Handle OIDC callback, JIT-provision user, and establish session."""
    if current_user.is_authenticated:
        return redirect(url_for('discover.discover'))

    settings_record = db.session.execute(select(GlobalSettings)).scalar_one_or_none()
    config = build_oidc_config(settings_record)
    if not config:
        flash('Single sign-on is not enabled.', 'warning')
        return redirect(url_for('login.login'))

    if not AUTHLIB_AVAILABLE:
        flash('SSO is configured but authlib is not installed.', 'error')
        return redirect(url_for('login.login'))

    idp_error = request.args.get('error')
    if idp_error:
        flash(
            format_oidc_idp_error(idp_error, request.args.get('error_description')),
            'error',
        )
        return redirect(url_for('login.login'))

    expected_state, code_verifier = pop_oidc_session(session)
    callback_state = request.args.get('state')
    if not expected_state or expected_state != callback_state:
        flash('Invalid SSO state. Please try again.', 'error')
        return redirect(url_for('login.login'))

    init_oauth(current_app)
    register_oidc_provider(current_app, config)
    oauth_client = get_oauth_client()
    if oauth_client is None:
        flash('SSO client failed to initialize.', 'error')
        return redirect(url_for('login.login'))

    try:
        token = oauth_client.oidc.authorize_access_token(code_verifier=code_verifier)
        claims = token.get('userinfo')
        if not claims:
            claims = oauth_client.oidc.parse_id_token(token)
        user = provision_or_update_user(db.session, claims, config)
    except ValueError as exc:
        db.session.rollback()
        flash(str(exc), 'error')
        return redirect(url_for('login.login'))
    except Exception as exc:
        db.session.rollback()
        current_app.logger.exception('OIDC callback failed: %s', exc)
        flash(format_oidc_callback_error(exc), 'error')
        return redirect(url_for('login.login'))

    login_user(user, remember=True)
    log_system_event(
        f"User {user.name} logged in via OIDC SSO.",
        event_type='login',
        event_level='information',
    )

    next_page = request.args.get('next')
    if not next_page or urlparse(next_page).netloc != '':
        next_page = url_for('discover.discover')
    return redirect(next_page)


@login_bp.route('/register', methods=['GET', 'POST'])
def register():
    if current_user.is_authenticated:
        return redirect(url_for('login.login'))
    print("Route: /register")

    # Attempt to get the invite token from the query parameters
    invite_token_from_url = request.args.get('token')
    # An invite token is a credential — logging it verbatim would let anyone
    # with log access redeem the invite. Presence only.
    print(f"Invite token present: {bool(invite_token_from_url)}")
    invite = None
    if invite_token_from_url:
        invite = db.session.execute(select(InviteToken).filter_by(token=invite_token_from_url, used=False)).scalar_one_or_none()
        print(f"Invite found: {invite}")
        if invite:
            # Handle timezone comparison safely
            current_time = datetime.now(timezone.utc)
            if invite.expires_at.tzinfo:
                # Timezone-aware comparison
                is_valid = invite.expires_at >= current_time
            else:
                # Timezone-naive comparison
                naive_current = current_time.replace(tzinfo=None)
                is_valid = invite.expires_at >= naive_current
            
            if is_valid:
                # The invite is valid; skip the whitelist check later
                pass
            else:
                invite = None  # Invalidate
                flash('The invite is invalid or has expired.', 'warning')
                return redirect(url_for('login.register'))
        else:
            invite = None  # Invalidate
            flash('The invite is invalid or has expired.', 'warning')
            return redirect(url_for('login.register'))
    form = RegistrationForm()
    if form.validate_on_submit():
        try:
            email_address = form.email.data.lower()
            existing_user_email = db.session.execute(select(User).filter(func.lower(User.email) == email_address)).scalar_one_or_none()
            if existing_user_email:
                print(f"/register: Email already in use - {email_address}")
                flash('This email is already in use. Please use a different email or log in.')
                return redirect(url_for('login.register'))
                    # Proceed with the whitelist check only if no valid invite token is provided
            if not invite:
                whitelist = db.session.execute(select(Whitelist).filter(func.lower(Whitelist.email) == email_address)).scalar_one_or_none()
                if not whitelist:
                    flash('Your email is not whitelisted.')
                    return redirect(url_for('login.register'))

            existing_user = db.session.execute(select(User).filter_by(name=form.username.data)).scalar_one_or_none()
            if existing_user is not None:
                print(f"/register: User already exists - {form.username.data}")
                flash('User already exists. Please Log in.')
                return redirect(url_for('login.register'))

            user_uuid = str(uuid4())
            existing_uuid = db.session.execute(select(User).filter_by(user_id=user_uuid)).scalar_one_or_none()
            if existing_uuid is not None:
                print("/register: UUID collision detected.")
                flash('An error occurred while registering. Please try again.')
                return redirect(url_for('login.register'))

            user = User(
                user_id=user_uuid,
                name=form.username.data,
                email=form.email.data.lower(),
                role='user',
                is_email_verified=False,
                email_verification_token=get_serializer().dumps(form.email.data, salt='email-confirm'),
                token_creation_time=datetime.now(timezone.utc),
                created=datetime.now(timezone.utc)
            )
            user.set_password(form.password.data)
            db.session.add(user)
            db.session.commit()
            
            log_system_event(f"New user registered: {user.name}", event_type='audit', event_level='information')
            
            if invite:
                invite.used = True
                invite.used_by = user.user_id
                invite.used_at = datetime.now(timezone.utc)

            # Verification email
            verification_token = user.email_verification_token
            confirm_url = url_for('login.confirm_email', token=verification_token, _external=True)
            html = render_template('login/registration_activate.html', confirm_url=confirm_url)
            subject = "Please confirm your email"
            send_email(user.email, subject, html)


            flash('A confirmation email has been sent via email.', 'success')
            return redirect(url_for('site.index'))
        except IntegrityError as e:
            db.session.rollback()
            print(f"IntegrityError occurred: {e}")
            flash('error while registering. Please try again.')

    return render_template('login/registration.html', title='Register', form=form)


@login_bp.route('/confirm/<token>')
def confirm_email(token):
    try:
        email = get_serializer().loads(token, salt='email-confirm', max_age=900)  # 15 minutes
    except SignatureExpired:
        return render_template('login/confirmation_expired.html'), 400
    except BadSignature:
        return render_template('login/confirmation_invalid.html'), 400

    user = db.session.execute(select(User).filter_by(email=email)).scalar_one_or_none() or abort(404)
    if user.is_email_verified:
        return render_template('login/registration_already_confirmed.html')
    else:
        user.is_email_verified = True
        db.session.add(user)
        db.session.commit()
        return render_template('login/confirmation_success.html')


@login_bp.route('/reset_password_request', methods=['GET', 'POST'])
def reset_password_request():
    if current_user.is_authenticated:
        return redirect(url_for('login.login'))
    print('pwr Reset Password Request')
    form = ResetPasswordRequestForm()
    if form.validate_on_submit():
        ip = client_ip_from_request(request)
        reset_key = auth_endpoint_key('pwd_reset', ip)
        if is_rate_limited(reset_key):
            flash('Too many password reset requests. Please wait and try again.', 'error')
            return redirect(url_for('login.reset_password_request'))
        print(f'pwr form data: {form.data}')
        user = db.session.execute(select(User).filter_by(email=form.email.data.lower())).scalar_one_or_none()
        print(f'pwr user: {user}')
        # Always record attempt (even unknown email) to slow enumeration
        record_failure(reset_key)
        if user:
            # Generate a unique token
            token = get_serializer().dumps(user.email, salt='password-reset-salt')
            user.password_reset_token = token
            user.token_creation_time = datetime.now(timezone.utc)
            
            log_system_event(f"Password reset requested for user: {user.email}", event_type='password_reset', event_level='information')
            
            db.session.commit()

            # Send reset email
            print('Calling send password reset email function...')
            send_password_reset_email(user.email, token)
        # Same response whether or not the email exists (anti-enumeration)
        flash('If that email is registered, password reset instructions were sent.')
        return redirect(url_for('login.login'))

    return render_template('login/reset_password_request.html', title='Reset Password', form=form)

@login_bp.route('/reset_password/<token>', methods=['GET', 'POST'])
def reset_password(token):
    if current_user.is_authenticated:
        return redirect(url_for('login.login'))

    user = db.session.execute(select(User).filter_by(password_reset_token=token)).scalar_one_or_none()
    if not user or user.token_creation_time + timedelta(minutes=15) < datetime.now(timezone.utc):
        flash('The password reset link is invalid or has expired.')
        return redirect(url_for('login.login'))

    form = UserPasswordForm()

    if form.validate_on_submit():
        user.set_password(form.password.data)
        user.password_reset_token = None
        db.session.commit()
        flash('Your password has been reset.')
        return redirect(url_for('login.login'))

    return render_template('login/reset_password.html', form=form, token=token)


@login_bp.route('/user/invites', methods=['GET', 'POST'])
@login_required
def invites():
    settings = db.session.execute(select(GlobalSettings)).scalar_one_or_none()
    site_url = settings.site_url if settings else 'http://127.0.0.1'
    smtp_enabled = is_smtp_configured()
    if site_url == 'http://127.0.0.1'and current_user.role == 'admin':
        flash('Please configure the site URL in the admin settings.', 'danger')
    form = InviteForm()
    if form.validate_on_submit():
        email = request.form.get('email')
        # Ensure the user has invites left to send
        current_invites = db.session.scalar(select(func.count(InviteToken.id)).filter_by(creator_user_id=current_user.user_id, used=False))
        if current_user.invite_quota > current_invites:
            token = str(uuid.uuid4())
            invite_token = InviteToken(
                token=token, 
                creator_user_id=current_user.user_id,
                recipient_email=email
            )
            db.session.add(invite_token)
            db.session.commit()

            settings = db.session.execute(select(GlobalSettings)).scalar_one_or_none()
            site_url = settings.site_url if settings else 'http://127.0.0.1'
            
            # Build the invite URL using the configured site URL
            invite_url = f"{site_url}/register?token={token}"

            send_invite_email(email, invite_url)

            flash('Invite sent successfully. The invite expires after 48 hours.', 'success')
        else:
            flash('You have reached your invite limit.', 'danger')
        return redirect(url_for('login.invites'))

    invites = db.session.execute(select(InviteToken).filter_by(creator_user_id=current_user.user_id, used=False)).scalars().all()
    current_invites_count = len(invites)
    remaining_invites = max(0, current_user.invite_quota - current_invites_count)

    return render_template('/login/user_invites.html', 
                         form=form, 
                         invites=invites, 
                         invite_quota=current_user.invite_quota, 
                         site_url=site_url, 
                         smtp_enabled=smtp_enabled,
                         current_invites_count=current_invites_count, 
                         remaining_invites=remaining_invites, 
                         current_datetime=datetime.now(timezone.utc))

@login_bp.route('/delete_invite/<token>', methods=['POST'])
@login_required
def delete_invite(token):
    try:
        invite = db.session.execute(select(InviteToken).filter_by(token=token, creator_user_id=current_user.user_id)).scalar_one_or_none()
        if invite:
            db.session.delete(invite)
            db.session.commit()
            return jsonify({'success': True})
        else:
            return jsonify({'success': False, 'message': 'Invite not found or you do not have permission to delete it.'})
    except Exception as e:
        db.session.rollback()
        print(f"Error deleting invite: {str(e)}")
        return jsonify({'success': False, 'message': 'An error occurred while deleting the invite.'}), 500
