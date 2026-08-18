from gametheca.utils.api_response import api_error, api_ok
from flask import Blueprint, current_app, render_template, request, jsonify
from flask_login import login_required
from gametheca.utils.auth import admin_required
from gametheca.utils.global_settings import (
    global_settings_row,
    global_settings_row_or_create,
)
from gametheca.utils.processors import get_global_settings
from gametheca.models import GlobalSettings
from gametheca import db
from sqlalchemy import select
from gametheca.utils.smtp_test import SMTPTester
from gametheca import cache

smtp_bp = Blueprint('smtp', __name__)

@smtp_bp.context_processor
@cache.cached(timeout=500, key_prefix='global_settings')
def inject_settings():
    """Context processor to inject global settings into templates"""
    return get_global_settings()


@smtp_bp.route('/admin/smtp_settings', methods=['GET', 'POST'])
@login_required
@admin_required
def smtp_settings():
    settings = global_settings_row()
    if request.method == 'POST':
        data = request.json
        settings = global_settings_row_or_create()
        
        # Validate required fields when SMTP is enabled
        if data.get('smtp_enabled'):
            if not data.get('smtp_server'):
                return jsonify({'status': 'error', 'message': 'SMTP server is required when SMTP is enabled'}), 400
            if not data.get('smtp_port'):
                return jsonify({'status': 'error', 'message': 'SMTP port is required when SMTP is enabled'}), 400
            if not data.get('smtp_username'):
                return jsonify({'status': 'error', 'message': 'SMTP username is required when SMTP is enabled'}), 400
            if not data.get('smtp_password'):
                return jsonify({'status': 'error', 'message': 'SMTP password is required when SMTP is enabled'}), 400
            if not data.get('smtp_default_sender'):
                return jsonify({'status': 'error', 'message': 'Default sender email is required when SMTP is enabled'}), 400
            
            # Validate port number
            try:
                port = int(data.get('smtp_port', 587))
                if port <= 0 or port > 65535:
                    return jsonify({'status': 'error', 'message': 'Invalid port number. Must be between 1 and 65535'}), 400
                settings.smtp_port = port
            except ValueError:
                return jsonify({'status': 'error', 'message': 'SMTP port must be a valid number'}), 400
        
        settings.smtp_enabled = data.get('smtp_enabled', False)
        settings.smtp_server = data.get('smtp_server')
        settings.smtp_username = data.get('smtp_username')
        settings.smtp_password = data.get('smtp_password')
        settings.smtp_use_tls = data.get('smtp_use_tls', True)
        settings.smtp_default_sender = data.get('smtp_default_sender')
        settings.smtp_enabled = data.get('smtp_enabled', False)
        
        try:
            db.session.commit()
            return jsonify({'status': 'success', 'message': 'SMTP settings updated successfully'})
        except Exception as e:
            db.session.rollback()
            current_app.logger.warning('SMTP settings save failed: %s', e)
        # Stays on jsonify: admin_manage_smtp_settings.js reads `data.status`.
        return jsonify({'status': 'error', 'message': 'Could not save SMTP settings'}), 500
    
    return render_template('admin/admin_manage_smtp_settings.html', settings=settings)

@smtp_bp.route('/admin/smtp_test', methods=['POST'])
@login_required
@admin_required
def smtp_test():
    settings = global_settings_row()
    if not settings:
        return api_error('SMTP settings not configured', code='bad_request')

    # Create SMTPTester instance
    tester = SMTPTester(debug=False)
    print(f"Testing SMTP connection using settings: {settings.smtp_server}:{settings.smtp_port}")
    # Test the connection using settings from database
    success, result = tester.test_connection(
        host=settings.smtp_server,
        port=settings.smtp_port,
        username=settings.smtp_username,
        password=settings.smtp_password,
        use_tls=settings.smtp_use_tls,
        timeout=10
    )

    if success:
        # 200 + `success`: the request worked, the connection test is what
        # failed or passed. admin_manage_smtp_settings.js reads `data.success`.
        return jsonify({
            'success': True,
            'result': result
        })
    else:
        return jsonify({
            'success': False,
            'message': result
        })
