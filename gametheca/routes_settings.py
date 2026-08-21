from flask import Blueprint, render_template, redirect, url_for, request, flash, current_app, jsonify
from flask_login import login_required, current_user
from gametheca.forms import EditProfileForm, UserPasswordForm, UserPreferencesForm
from gametheca.models import User, InviteToken, UserPreference
from sqlalchemy import select, func
from gametheca.utils.avatar import DEFAULT_AVATAR, save_avatar, thumbnail_for
from gametheca.utils.processors import get_global_settings
from gametheca import cache
from gametheca import db

settings_bp = Blueprint('settings', __name__)

_TILE_LEGACY = {'S': '25', 'M': '50', 'L': '75', 'XL': '100'}


def _normalize_tile_percent(raw) -> str:
    text = str(raw or '').strip().upper()
    if text in _TILE_LEGACY:
        return _TILE_LEGACY[text]
    try:
        value = int(text)
    except (TypeError, ValueError):
        return '50'
    return str(max(0, min(100, value)))


@settings_bp.context_processor
@cache.cached(timeout=500, key_prefix='global_settings')
def inject_settings():
    """Context processor to inject global settings into templates"""
    return get_global_settings()

@settings_bp.route('/settings_profile_edit', methods=['GET', 'POST'])
@login_required
def settings_profile_edit():
    print("Route: Settings profile edit")
    form = EditProfileForm()

    if form.validate_on_submit():
        file = form.avatar.data
        if file:
            # One implementation of "what is a valid avatar and what happens to
            # the old one", shared with POST /api/account/avatar.
            _path, error = save_avatar(file, current_user, current_app)
            if error:
                flash(error, 'error')
                return redirect(url_for('settings.settings_profile_edit'))
        elif not current_user.avatarpath:
            current_user.avatarpath = DEFAULT_AVATAR

        try:
            db.session.commit()
            flash('Profile updated successfully!', 'success')
        except Exception as e:
            db.session.rollback()
            print(f"Error updating profile: {e}")
            flash('Failed to update profile. Please try again.', 'error')

        return redirect(url_for('settings.settings_profile_edit'))

    print("Form validation failed" if request.method == 'POST' else "Settings profile Form rendering")

    for field, errors in form.errors.items():
        for error in errors:
            print(f"Error in field '{getattr(form, field).label.text}': {error}")
            flash(f"Error in field '{getattr(form, field).label.text}': {error}", 'error')

    # The thumbnail name is a rule about how avatars are stored, so the route
    # answers it rather than the template deriving it with a string replace —
    # which produced a request for a `_thumbnail` file the shipped avatars never
    # had.
    return render_template(
        'settings/settings_profile_edit.html',
        form=form,
        avatarpath=current_user.avatarpath,
        thumbnailpath=thumbnail_for(current_user.avatarpath),
    )

@settings_bp.route('/settings_profile_view', methods=['GET'])
@login_required
def settings_profile_view():
    print("Route: Settings profile view")
    unused_invites = db.session.execute(
        select(func.count(InviteToken.id)).filter_by(
            creator_user_id=current_user.user_id, 
            used=False
        )
    ).scalar()
    remaining_invites = max(0, current_user.invite_quota - unused_invites)
    
    return render_template('settings/settings_profile_view.html', 
                         remaining_invites=remaining_invites,
                         total_invites=current_user.invite_quota)

@settings_bp.route('/settings_password', methods=['GET', 'POST'])
@login_required
def account_pw():
    form = UserPasswordForm()
    user = db.session.get(User, current_user.id)

    if form.validate_on_submit():
        try:
            user.set_password(form.password.data)
            db.session.commit()
            flash('Password changed successfully!', 'success')
            print('Password changed successfully for user ID:', current_user.id)
            return redirect(url_for('settings.account_pw'))
        except Exception as e:
            db.session.rollback()
            print('An error occurred while changing the password:', str(e))
            flash('An error occurred. Please try again.', 'error')

    return render_template('settings/settings_password.html', title='Change Password', form=form, user=user)

@settings_bp.route('/settings_panel', methods=['GET', 'POST'])
@login_required
def settings_panel():
    form = UserPreferencesForm()
    
    if request.method == 'POST' and form.validate_on_submit():
        if not current_user.preferences:
            current_user.preferences = UserPreference(user_id=current_user.id)
        
        current_user.preferences.items_per_page = form.items_per_page.data
        current_user.preferences.default_sort = form.default_sort.data
        current_user.preferences.default_sort_order = form.default_sort_order.data
        current_user.preferences.theme = form.theme.data or 'default'
        current_user.preferences.icon_pack = form.icon_pack.data or 'outline'
        current_user.preferences.font = form.font.data or 'system-ui'
        current_user.preferences.tile_size = _normalize_tile_percent(form.tile_size.data)
        current_user.preferences.preferred_game_locale = (
            form.preferred_game_locale.data or 'en-US'
        )
        
        try:
            db.session.add(current_user.preferences)
            db.session.commit()
            return jsonify({
                'success': True,
                'message': 'Preferences updated successfully!',
                'icon_pack': current_user.preferences.icon_pack or 'outline',
                'font': current_user.preferences.font or 'system-ui',
                'theme': current_user.preferences.theme or 'default',
            })
        except Exception as e:
            db.session.rollback()
            return jsonify({'success': False, 'message': str(e)}), 500
    
    if request.method == 'GET':
        prefs = current_user.preferences
        if prefs:
            form.items_per_page.data = prefs.items_per_page or 50
            form.default_sort.data = prefs.default_sort or 'name'
            form.default_sort_order.data = prefs.default_sort_order or 'asc'
            form.theme.data = prefs.theme or 'default'
            form.icon_pack.data = getattr(prefs, 'icon_pack', None) or 'outline'
            form.font.data = getattr(prefs, 'font', None) or 'system-ui'
            form.tile_size.data = _normalize_tile_percent(getattr(prefs, 'tile_size', None))
            form.preferred_game_locale.data = (
                getattr(prefs, 'preferred_game_locale', None) or 'en-US'
            )
        return render_template('settings/modal_preferences.html', form=form)
    
    return jsonify({
        'success': False,
        'message': 'Form validation failed',
        'errors': form.errors
    }), 400
