import pytest
import os
import json
import shutil
import tempfile
import zipfile
from pathlib import Path
from flask import url_for
from unittest.mock import patch, MagicMock, mock_open
from gametheca.models import User
from gametheca import db
from gametheca.routes_admin_ext.themes import validate_theme_file, is_valid_theme_name
from uuid import uuid4
from io import BytesIO


@pytest.fixture
def admin_user(db_session):
    """Create an admin user."""
    admin_uuid = str(uuid4())
    unique_id = str(uuid4())[:8]
    admin = User(
        user_id=admin_uuid,
        name=f'TestAdmin_{unique_id}',
        email=f'admin_{unique_id}@test.com',
        role='admin',
        is_email_verified=True
    )
    admin.set_password('testpass123')
    db_session.add(admin)
    db_session.commit()
    return admin


@pytest.fixture
def regular_user(db_session):
    """Create a regular user."""
    user_uuid = str(uuid4())
    unique_id = str(uuid4())[:8]
    user = User(
        user_id=user_uuid,
        name=f'TestUser_{unique_id}',
        email=f'user_{unique_id}@test.com',
        role='user',
        is_email_verified=True
    )
    user.set_password('testpass123')
    db_session.add(user)
    db_session.commit()
    return user


@pytest.fixture
def sample_theme_data():
    """Sample theme.json data for testing."""
    return {
        'name': 'Test Theme',
        'description': 'A test theme for unit testing',
        'author': 'Test Author',
        'release_date': '2024-01-01'
    }


def create_test_zip_file(theme_data, include_css=True, include_theme_json=True, size_mb=None):
    """Helper function to create a test zip file."""
    zip_buffer = BytesIO()
    
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        if include_theme_json:
            zip_file.writestr('theme.json', json.dumps(theme_data))
        if include_css:
            zip_file.writestr('css/style.css', 'body { color: red; }')
        
        # Add large file if size_mb is specified
        if size_mb:
            large_content = 'x' * (size_mb * 1024 * 1024)  # Create file of specified size
            zip_file.writestr('large_file.txt', large_content)
    
    zip_buffer.seek(0)
    return zip_buffer


class TestValidationFunctions:
    """Tests for validation helper functions."""

    def test_validate_theme_file_valid_zip(self, sample_theme_data):
        """Test validation of a valid ZIP file."""
        zip_file = create_test_zip_file(sample_theme_data)
        zip_file.filename = 'test.zip'  # Ensure filename is set
        is_valid, error = validate_theme_file(zip_file)
        assert is_valid is True
        assert error is None

    def test_validate_theme_file_no_file(self):
        """Test validation when no file is provided."""
        is_valid, error = validate_theme_file(None)
        assert is_valid is False
        assert "No file provided" in error

    def test_validate_theme_file_empty_filename(self):
        """Test validation when file has empty filename."""
        mock_file = MagicMock()
        mock_file.filename = ""
        is_valid, error = validate_theme_file(mock_file)
        assert is_valid is False
        assert "No file provided" in error

    def test_validate_theme_file_too_large(self, sample_theme_data):
        """Test validation of file that's too large."""
        # Mock a large file using MagicMock to simulate the file size behavior
        mock_file = MagicMock()
        mock_file.filename = 'large_test.zip'
        mock_file.tell.return_value = 27 * 1024 * 1024  # 27MB
        mock_file.read.return_value = b'PK\x03\x04'  # Valid ZIP magic bytes
        
        is_valid, error = validate_theme_file(mock_file)
        assert is_valid is False
        assert "exceeds maximum allowed size" in error

    def test_validate_theme_file_empty_file(self):
        """Test validation of empty file."""
        mock_file = MagicMock()
        mock_file.filename = "test.zip"
        mock_file.tell.return_value = 0
        is_valid, error = validate_theme_file(mock_file)
        assert is_valid is False
        assert "File is empty" in error

    def test_validate_theme_file_invalid_zip(self):
        """Test validation of non-ZIP file."""
        mock_file = MagicMock()
        mock_file.filename = "test.zip"
        mock_file.tell.return_value = 1024  # Non-zero size
        mock_file.read.return_value = b"NOT A ZIP"  # Invalid magic bytes
        is_valid, error = validate_theme_file(mock_file)
        assert is_valid is False
        assert "not a valid ZIP archive" in error

    def test_is_valid_theme_name_valid(self):
        """Test validation of valid theme names."""
        valid_names = ["MyTheme", "theme_2024", "Cool-Theme", "Theme123"]
        for name in valid_names:
            is_valid, error = is_valid_theme_name(name)
            assert is_valid is True
            assert error is None

    def test_is_valid_theme_name_empty(self):
        """Test validation of empty theme name."""
        for name in ["", "   ", None]:
            is_valid, error = is_valid_theme_name(name)
            assert is_valid is False
            assert "cannot be empty" in error

    def test_is_valid_theme_name_reserved_windows_names(self):
        """Test validation of Windows reserved names."""
        reserved_names = ["CON", "PRN", "AUX", "NUL", "COM1", "LPT1", "con", "prn"]
        for name in reserved_names:
            is_valid, error = is_valid_theme_name(name)
            assert is_valid is False
            assert "reserved system name" in error

    def test_is_valid_theme_name_reserved_with_extension(self):
        """Test validation of Windows reserved names with extensions."""
        reserved_names = ["CON.txt", "PRN.zip", "COM1.theme"]
        for name in reserved_names:
            is_valid, error = is_valid_theme_name(name)
            assert is_valid is False
            assert "reserved system name" in error

    def test_is_valid_theme_name_dangerous_characters(self):
        """Test validation of names with dangerous characters."""
        dangerous_names = ["theme<", "theme>", "theme:", 'theme"', "theme|", 
                          "theme?", "theme*", "theme\\", "theme/"]
        for name in dangerous_names:
            is_valid, error = is_valid_theme_name(name)
            assert is_valid is False
            assert "invalid characters" in error

    def test_is_valid_theme_name_path_traversal(self):
        """Test validation of names with path traversal attempts."""
        # Test names that would trigger the path traversal check specifically
        traversal_names = [".theme", "theme.", "theme..bad"]
        for name in traversal_names:
            is_valid, error = is_valid_theme_name(name)
            assert is_valid is False
            assert "invalid path elements" in error
        
        # Test names with slashes that will be caught by dangerous character check
        slash_names = ["../theme", "theme/.."] 
        for name in slash_names:
            is_valid, error = is_valid_theme_name(name)
            assert is_valid is False
            assert ("invalid characters" in error or "invalid path elements" in error)


class TestManageThemesRoute:
    """Tests for the manage_themes route."""

    def test_manage_themes_requires_login(self, client):
        """Test that manage themes page requires login."""
        response = client.get('/admin/themes')
        assert response.status_code == 302
        assert 'login' in response.location

    def test_manage_themes_requires_admin(self, client, regular_user):
        """Test that manage themes page requires admin role."""
        with client.session_transaction() as sess:
            sess['_user_id'] = str(regular_user.id)
            sess['_fresh'] = True
        
        response = client.get('/admin/themes')
        assert response.status_code == 302
        assert 'login' in response.location

    def test_manage_themes_admin_access_get(self, client, admin_user):
        """Test that admin can access themes management page."""
        with client.session_transaction() as sess:
            sess['_user_id'] = str(admin_user.id)
            sess['_fresh'] = True
        
        with patch('gametheca.routes_admin_ext.themes.ThemeManager') as mock_theme_manager:
            mock_instance = MagicMock()
            mock_theme_manager.return_value = mock_instance
            mock_instance.get_installed_themes.return_value = []
            mock_instance.get_default_theme.return_value = {'name': 'Default'}
            
            response = client.get('/admin/themes')
            assert response.status_code == 200

    @patch('gametheca.routes_admin_ext.themes.ThemeManager')
    @patch('gametheca.routes_admin_ext.themes.Path')
    def test_manage_themes_upload_folder_creation(self, mock_path, mock_theme_manager, 
                                                 client, admin_user, sample_theme_data):
        """Test upload folder creation when it doesn't exist."""
        with client.session_transaction() as sess:
            sess['_user_id'] = str(admin_user.id)
            sess['_fresh'] = True
        
        # Mock Path behavior
        mock_upload_folder = MagicMock()
        mock_upload_folder.exists.return_value = False
        mock_path.return_value.__truediv__.return_value = mock_upload_folder
        
        mock_instance = MagicMock()
        mock_theme_manager.return_value = mock_instance
        mock_instance.get_installed_themes.return_value = []
        mock_instance.get_default_theme.return_value = {'name': 'Default'}
        
        zip_file = create_test_zip_file(sample_theme_data)
        
        data = {
            'theme_zip': (zip_file, 'test_theme.zip'),
            'submit': 'Upload Theme'
        }
        
        response = client.post('/admin/themes', data=data, content_type='multipart/form-data')
        
        mock_upload_folder.mkdir.assert_called_once()
        assert response.status_code == 302  # Redirect after processing

    @patch('gametheca.routes_admin_ext.themes.ThemeManager')
    @patch('gametheca.routes_admin_ext.themes.Path')
    def test_manage_themes_upload_folder_creation_error(self, mock_path, mock_theme_manager, 
                                                       client, admin_user, sample_theme_data):
        """Test error handling when upload folder creation fails."""
        with client.session_transaction() as sess:
            sess['_user_id'] = str(admin_user.id)
            sess['_fresh'] = True
        
        # Mock Path behavior with mkdir failure
        mock_upload_folder = MagicMock()
        mock_upload_folder.exists.return_value = False
        mock_upload_folder.mkdir.side_effect = Exception("Permission denied")
        mock_path.return_value.__truediv__.return_value = mock_upload_folder
        
        mock_instance = MagicMock()
        mock_theme_manager.return_value = mock_instance
        
        zip_file = create_test_zip_file(sample_theme_data)
        
        data = {
            'theme_zip': (zip_file, 'test_theme.zip'),
            'submit': 'Upload Theme'
        }
        
        response = client.post('/admin/themes', data=data, content_type='multipart/form-data')
        assert response.status_code == 302  # Redirect after error

    @patch('gametheca.routes_admin_ext.themes.ThemeManager')
    @patch('gametheca.routes_admin_ext.themes.Path')
    def test_manage_themes_successful_upload(self, mock_path, mock_theme_manager, client, admin_user, sample_theme_data):
        """Test successful theme upload."""
        with client.session_transaction() as sess:
            sess['_user_id'] = str(admin_user.id)
            sess['_fresh'] = True
        
        # Mock Path behavior - folder exists
        mock_upload_folder = MagicMock()
        mock_upload_folder.exists.return_value = True
        mock_path.return_value.__truediv__.return_value = mock_upload_folder
        
        mock_instance = MagicMock()
        mock_theme_manager.return_value = mock_instance
        mock_instance.upload_theme.return_value = sample_theme_data
        
        zip_file = create_test_zip_file(sample_theme_data)
        
        data = {
            'theme_zip': (zip_file, 'test_theme.zip'),
            'submit': 'Upload Theme'
        }
        
        response = client.post('/admin/themes', data=data, content_type='multipart/form-data')
        assert response.status_code == 302  # Redirect after success
        mock_instance.upload_theme.assert_called_once()

    @patch('gametheca.routes_admin_ext.themes.ThemeManager')
    @patch('gametheca.routes_admin_ext.themes.Path')
    def test_manage_themes_upload_failure(self, mock_path, mock_theme_manager, client, admin_user, sample_theme_data):
        """Test theme upload failure."""
        with client.session_transaction() as sess:
            sess['_user_id'] = str(admin_user.id)
            sess['_fresh'] = True
        
        # Mock Path behavior - folder exists
        mock_upload_folder = MagicMock()
        mock_upload_folder.exists.return_value = True
        mock_path.return_value.__truediv__.return_value = mock_upload_folder
        
        mock_instance = MagicMock()
        mock_theme_manager.return_value = mock_instance
        mock_instance.upload_theme.return_value = None
        
        zip_file = create_test_zip_file(sample_theme_data)
        
        data = {
            'theme_zip': (zip_file, 'test_theme.zip'),
            'submit': 'Upload Theme'
        }
        
        response = client.post('/admin/themes', data=data, content_type='multipart/form-data')
        assert response.status_code == 302  # Redirect after failure

    @patch('gametheca.routes_admin_ext.themes.ThemeManager')
    @patch('gametheca.routes_admin_ext.themes.Path')
    def test_manage_themes_upload_value_error(self, mock_path, mock_theme_manager, client, admin_user, sample_theme_data):
        """Test theme upload with ValueError."""
        with client.session_transaction() as sess:
            sess['_user_id'] = str(admin_user.id)
            sess['_fresh'] = True
        
        # Mock Path behavior - folder exists
        mock_upload_folder = MagicMock()
        mock_upload_folder.exists.return_value = True
        mock_path.return_value.__truediv__.return_value = mock_upload_folder
        
        mock_instance = MagicMock()
        mock_theme_manager.return_value = mock_instance
        mock_instance.upload_theme.side_effect = ValueError("Invalid theme")
        
        zip_file = create_test_zip_file(sample_theme_data)
        
        data = {
            'theme_zip': (zip_file, 'test_theme.zip'),
            'submit': 'Upload Theme'
        }
        
        response = client.post('/admin/themes', data=data, content_type='multipart/form-data')
        assert response.status_code == 302  # Redirect after error

    @patch('gametheca.routes_admin_ext.themes.ThemeManager')
    @patch('gametheca.routes_admin_ext.themes.Path')
    def test_manage_themes_upload_unexpected_error(self, mock_path, mock_theme_manager, client, admin_user, sample_theme_data):
        """Test theme upload with unexpected error."""
        with client.session_transaction() as sess:
            sess['_user_id'] = str(admin_user.id)
            sess['_fresh'] = True
        
        # Mock Path behavior - folder exists
        mock_upload_folder = MagicMock()
        mock_upload_folder.exists.return_value = True
        mock_path.return_value.__truediv__.return_value = mock_upload_folder
        
        mock_instance = MagicMock()
        mock_theme_manager.return_value = mock_instance
        mock_instance.upload_theme.side_effect = Exception("Unexpected error")
        
        zip_file = create_test_zip_file(sample_theme_data)
        
        data = {
            'theme_zip': (zip_file, 'test_theme.zip'),
            'submit': 'Upload Theme'
        }
        
        response = client.post('/admin/themes', data=data, content_type='multipart/form-data')
        assert response.status_code == 302  # Redirect after error

    @patch('gametheca.routes_admin_ext.themes.validate_theme_file')
    @patch('gametheca.routes_admin_ext.themes.ThemeManager')
    @patch('gametheca.routes_admin_ext.themes.Path')
    def test_manage_themes_file_too_large(self, mock_path, mock_theme_manager, mock_validate, client, admin_user, sample_theme_data):
        """Test theme upload with file too large."""
        with client.session_transaction() as sess:
            sess['_user_id'] = str(admin_user.id)
            sess['_fresh'] = True
        
        # Mock Path behavior - folder exists
        mock_upload_folder = MagicMock()
        mock_upload_folder.exists.return_value = True
        mock_path.return_value.__truediv__.return_value = mock_upload_folder
        
        # Mock file validation to return failure
        mock_validate.return_value = (False, "File size (26.0MB) exceeds maximum allowed size (25MB)")
        
        mock_instance = MagicMock()
        mock_theme_manager.return_value = mock_instance
        
        zip_file = create_test_zip_file(sample_theme_data)
        
        data = {
            'theme_zip': (zip_file, 'test_theme.zip'),
            'submit': 'Upload Theme'
        }
        
        response = client.post('/admin/themes', data=data, content_type='multipart/form-data')
        assert response.status_code == 302  # Redirect after error
        # Should not call upload_theme due to size validation
        mock_instance.upload_theme.assert_not_called()


class TestThemeReadmeRoute:
    """Tests for the theme_readme route."""

    def test_theme_readme_requires_login(self, client):
        """Test that theme readme page requires login."""
        response = client.get('/admin/themes/readme')
        assert response.status_code == 302
        assert 'login' in response.location

    def test_theme_readme_requires_admin(self, client, regular_user):
        """Test that theme readme page requires admin role."""
        with client.session_transaction() as sess:
            sess['_user_id'] = str(regular_user.id)
            sess['_fresh'] = True
        
        response = client.get('/admin/themes/readme')
        assert response.status_code == 302
        assert 'login' in response.location

    def test_theme_readme_admin_access(self, client, admin_user):
        """Test that admin can access theme readme page."""
        with client.session_transaction() as sess:
            sess['_user_id'] = str(admin_user.id)
            sess['_fresh'] = True
        
        response = client.get('/admin/themes/readme')
        assert response.status_code == 200

    def test_theme_readme_get_method_only(self, client, admin_user):
        """Test that theme readme only accepts GET requests."""
        with client.session_transaction() as sess:
            sess['_user_id'] = str(admin_user.id)
            sess['_fresh'] = True
        
        # GET should work
        response_get = client.get('/admin/themes/readme')
        assert response_get.status_code == 200
        
        # POST should not be allowed
        response_post = client.post('/admin/themes/readme')
        assert response_post.status_code == 405


class TestDeleteThemeRoute:
    """Tests for the delete_theme route."""

    def test_delete_theme_requires_login(self, client):
        """Test that delete theme requires login."""
        response = client.post('/admin/themes/delete/test_theme')
        assert response.status_code == 302
        assert 'login' in response.location

    def test_delete_theme_requires_admin(self, client, regular_user):
        """Test that delete theme requires admin role."""
        with client.session_transaction() as sess:
            sess['_user_id'] = str(regular_user.id)
            sess['_fresh'] = True
        
        response = client.post('/admin/themes/delete/test_theme')
        assert response.status_code == 302
        assert 'login' in response.location

    @patch('gametheca.routes_admin_ext.themes.ThemeManager')
    def test_delete_theme_success(self, mock_theme_manager, client, admin_user):
        """Test successful theme deletion."""
        with client.session_transaction() as sess:
            sess['_user_id'] = str(admin_user.id)
            sess['_fresh'] = True
        
        mock_instance = MagicMock()
        mock_theme_manager.return_value = mock_instance
        
        response = client.post('/admin/themes/delete/test_theme')
        assert response.status_code == 302  # Redirect after deletion
        mock_instance.delete_themefile.assert_called_once_with('test_theme')

    @patch('gametheca.routes_admin_ext.themes.ThemeManager')
    def test_delete_theme_value_error(self, mock_theme_manager, client, admin_user):
        """Test theme deletion with ValueError."""
        with client.session_transaction() as sess:
            sess['_user_id'] = str(admin_user.id)
            sess['_fresh'] = True
        
        mock_instance = MagicMock()
        mock_theme_manager.return_value = mock_instance
        mock_instance.delete_themefile.side_effect = ValueError("Cannot delete default theme")
        
        response = client.post('/admin/themes/delete/Default')
        assert response.status_code == 302  # Redirect after error

    @patch('gametheca.routes_admin_ext.themes.ThemeManager')
    def test_delete_theme_unexpected_error(self, mock_theme_manager, client, admin_user):
        """Test theme deletion with unexpected error."""
        with client.session_transaction() as sess:
            sess['_user_id'] = str(admin_user.id)
            sess['_fresh'] = True
        
        mock_instance = MagicMock()
        mock_theme_manager.return_value = mock_instance
        mock_instance.delete_themefile.side_effect = Exception("File system error")
        
        response = client.post('/admin/themes/delete/test_theme')
        assert response.status_code == 302  # Redirect after error

    def test_delete_theme_post_method_only(self, client, admin_user):
        """Test that delete theme only accepts POST requests."""
        with client.session_transaction() as sess:
            sess['_user_id'] = str(admin_user.id)
            sess['_fresh'] = True
        
        # GET should not be allowed
        response_get = client.get('/admin/themes/delete/test_theme')
        assert response_get.status_code == 405


class TestResetDefaultThemesRoute:
    """Tests for the reset_default_themes route."""

    def test_reset_default_themes_requires_login(self, client):
        """Test that reset default themes requires login."""
        response = client.post('/admin/themes/reset')
        assert response.status_code == 302
        assert 'login' in response.location

    def test_reset_default_themes_requires_admin(self, client, regular_user):
        """Test that reset default themes requires admin role."""
        with client.session_transaction() as sess:
            sess['_user_id'] = str(regular_user.id)
            sess['_fresh'] = True
        
        response = client.post('/admin/themes/reset')
        assert response.status_code == 302
        assert 'login' in response.location

    @patch('gametheca.routes_admin_ext.themes.log_system_event')
    @patch('os.path.exists')
    def test_reset_default_themes_missing_source(self, mock_exists, mock_log, client, admin_user):
        """Test reset default themes when source directory is missing."""
        with client.session_transaction() as sess:
            sess['_user_id'] = str(admin_user.id)
            sess['_fresh'] = True

        mock_exists.return_value = False

        response = client.post('/admin/themes/reset')
        assert response.status_code == 302  # Redirect after error
        mock_log.assert_called()

    @patch('gametheca.routes_admin_ext.themes.log_system_event')
    @patch('shutil.copytree')
    @patch('shutil.rmtree')
    @patch('pathlib.Path.exists')
    @patch('pathlib.Path.mkdir')
    def test_reset_default_themes_success(self, mock_mkdir, mock_exists, mock_rmtree, mock_copytree, mock_log, client, admin_user):
        """Test successful reset of default themes."""
        with client.session_transaction() as sess:
            sess['_user_id'] = str(admin_user.id)
            sess['_fresh'] = True

        mock_exists.return_value = True

        response = client.post('/admin/themes/reset')
        assert response.status_code == 302  # Redirect after success
        mock_copytree.assert_called_once()
        mock_log.assert_called()

    @patch('gametheca.routes_admin_ext.themes.log_system_event')
    @patch('shutil.copytree')
    @patch('pathlib.Path.exists')
    def test_reset_default_themes_copy_failure(self, mock_exists, mock_copytree, mock_log, client, admin_user):
        """Test reset default themes with failure during copying."""
        with client.session_transaction() as sess:
            sess['_user_id'] = str(admin_user.id)
            sess['_fresh'] = True

        mock_exists.return_value = True
        mock_copytree.side_effect = Exception("Copy failed")

        response = client.post('/admin/themes/reset')
        assert response.status_code == 302
        mock_log.assert_called()

    @patch('gametheca.routes_admin_ext.themes.log_system_event')
    @patch('os.path.exists')
    def test_reset_default_themes_unexpected_error(self, mock_exists, mock_log, client, admin_user):
        """Test reset default themes with unexpected error."""
        with client.session_transaction() as sess:
            sess['_user_id'] = str(admin_user.id)
            sess['_fresh'] = True
        
        mock_exists.side_effect = Exception("Unexpected error")
        
        response = client.post('/admin/themes/reset')
        assert response.status_code == 302  # Redirect after error
        mock_log.assert_called()

    def test_reset_default_themes_post_method_only(self, client, admin_user):
        """Test that reset default themes only accepts POST requests."""
        with client.session_transaction() as sess:
            sess['_user_id'] = str(admin_user.id)
            sess['_fresh'] = True
        
        # GET should not be allowed
        response_get = client.get('/admin/themes/reset')
        assert response_get.status_code == 405


class TestApplyThemeRoute:
    """Tests for the apply_theme route."""

    def test_apply_theme_requires_login(self, client):
        """Test that applying a theme requires login."""
        response = client.post('/admin/themes/apply', json={'theme': 'default'})
        assert response.status_code == 302
        assert 'login' in response.location

    def test_apply_theme_requires_admin(self, client, regular_user):
        """Test that applying a theme requires admin role."""
        with client.session_transaction() as sess:
            sess['_user_id'] = str(regular_user.id)
            sess['_fresh'] = True

        response = client.post('/admin/themes/apply', json={'theme': 'default'})
        assert response.status_code == 302
        assert 'login' in response.location

    def test_apply_theme_post_method_only(self, client, admin_user):
        """Test that applying a theme only accepts POST requests."""
        with client.session_transaction() as sess:
            sess['_user_id'] = str(admin_user.id)
            sess['_fresh'] = True

        response = client.get('/admin/themes/apply')
        assert response.status_code == 405

    def test_apply_theme_requires_a_theme_name(self, client, admin_user):
        """Test that an empty payload is rejected."""
        with client.session_transaction() as sess:
            sess['_user_id'] = str(admin_user.id)
            sess['_fresh'] = True

        response = client.post('/admin/themes/apply', json={})
        assert response.status_code == 400
        assert response.get_json()['success'] is False

    def test_apply_theme_rejects_path_traversal(self, client, admin_user):
        """Test that a traversal attempt never reaches the filesystem check."""
        with client.session_transaction() as sess:
            sess['_user_id'] = str(admin_user.id)
            sess['_fresh'] = True

        response = client.post('/admin/themes/apply', json={'theme': '../../etc'})
        assert response.status_code == 400

    def test_apply_theme_rejects_unknown_theme(self, client, admin_user):
        """Test that a theme that is not installed is rejected."""
        with client.session_transaction() as sess:
            sess['_user_id'] = str(admin_user.id)
            sess['_fresh'] = True

        response = client.post('/admin/themes/apply', json={'theme': 'not_installed_theme'})
        assert response.status_code == 404

    def test_apply_theme_creates_preferences_when_missing(self, client, admin_user, db_session):
        """Test that applying a theme works for a user with no preferences row."""
        with client.session_transaction() as sess:
            sess['_user_id'] = str(admin_user.id)
            sess['_fresh'] = True

        response = client.post('/admin/themes/apply', json={'theme': 'default'})

        assert response.status_code == 200
        body = response.get_json()
        assert body['success'] is True
        assert body['theme'] == 'default'
        assert body['icon_pack'] == 'outline'
        db_session.refresh(admin_user)
        assert admin_user.preferences is not None
        assert admin_user.preferences.theme == 'default'

    @patch('gametheca.routes_admin_ext.themes.Path')
    def test_apply_theme_updates_existing_preference(self, mock_path, client, admin_user, db_session):
        """Test that an installed preset replaces the previous preference."""
        with client.session_transaction() as sess:
            sess['_user_id'] = str(admin_user.id)
            sess['_fresh'] = True

        client.post('/admin/themes/apply', json={'theme': 'default'})
        response = client.post('/admin/themes/apply', json={'theme': 'aurora'})

        assert response.status_code == 200
        db_session.refresh(admin_user)
        assert admin_user.preferences.theme == 'aurora'

    @patch('gametheca.routes_admin_ext.themes.Path')
    def test_apply_theme_accepts_form_data(self, mock_path, client, admin_user, db_session):
        """Test that the endpoint also accepts a plain form post."""
        with client.session_transaction() as sess:
            sess['_user_id'] = str(admin_user.id)
            sess['_fresh'] = True

        response = client.post('/admin/themes/apply', data={'theme': 'ember'})

        assert response.status_code == 200
        db_session.refresh(admin_user)
        assert admin_user.preferences.theme == 'ember'

    def test_apply_theme_persists_explicit_icon_pack(self, client, admin_user, db_session, app):
        """Explicit icon_pack in the body is stored on UserPreference like Preferences."""
        real_themes = Path(app.root_path) / 'static' / 'library' / 'themes'
        real_theme = real_themes / 'aurora_icon_test'
        real_theme.mkdir(parents=True, exist_ok=True)
        (real_theme / 'theme.json').write_text(
            json.dumps({'name': 'Aurora Icon Test', 'default_icon_pack': 'pixel'}),
            encoding='utf-8',
        )
        try:
            with client.session_transaction() as sess:
                sess['_user_id'] = str(admin_user.id)
                sess['_fresh'] = True

            response = client.post(
                '/admin/themes/apply',
                json={'theme': 'aurora_icon_test', 'icon_pack': 'filled'},
            )
            assert response.status_code == 200
            assert response.get_json() == {
                'success': True,
                'theme': 'aurora_icon_test',
                'icon_pack': 'filled',
            }
            db_session.refresh(admin_user)
            assert admin_user.preferences.theme == 'aurora_icon_test'
            assert admin_user.preferences.icon_pack == 'filled'
        finally:
            shutil.rmtree(real_theme, ignore_errors=True)

    def test_apply_theme_falls_back_to_theme_json_default_icon_pack(
        self, client, admin_user, db_session, app
    ):
        """Omitting icon_pack uses theme.json default_icon_pack when present."""
        real_themes = Path(app.root_path) / 'static' / 'library' / 'themes'
        real_theme = real_themes / 'ember_icon_test'
        real_theme.mkdir(parents=True, exist_ok=True)
        (real_theme / 'theme.json').write_text(
            json.dumps({'name': 'Ember Icon Test', 'default_icon_pack': 'filled'}),
            encoding='utf-8',
        )
        try:
            with client.session_transaction() as sess:
                sess['_user_id'] = str(admin_user.id)
                sess['_fresh'] = True

            response = client.post(
                '/admin/themes/apply',
                json={'theme': 'ember_icon_test'},
            )
            assert response.status_code == 200
            body = response.get_json()
            assert body['success'] is True
            assert body['theme'] == 'ember_icon_test'
            assert body['icon_pack'] == 'filled'
            db_session.refresh(admin_user)
            assert admin_user.preferences.icon_pack == 'filled'
        finally:
            shutil.rmtree(real_theme, ignore_errors=True)

    def test_apply_theme_null_icon_pack_uses_theme_json_default(
        self, client, admin_user, db_session, app
    ):
        """JSON null icon_pack still falls back to theme.json default_icon_pack."""
        real_themes = Path(app.root_path) / 'static' / 'library' / 'themes'
        real_theme = real_themes / 'violet_icon_test'
        real_theme.mkdir(parents=True, exist_ok=True)
        (real_theme / 'theme.json').write_text(
            json.dumps({'name': 'Violet Icon Test', 'default_icon_pack': 'soft'}),
            encoding='utf-8',
        )
        try:
            with client.session_transaction() as sess:
                sess['_user_id'] = str(admin_user.id)
                sess['_fresh'] = True

            response = client.post(
                '/admin/themes/apply',
                json={'theme': 'violet_icon_test', 'icon_pack': None},
            )
            assert response.status_code == 200
            assert response.get_json()['icon_pack'] == 'soft'
            db_session.refresh(admin_user)
            assert admin_user.preferences.icon_pack == 'soft'
        finally:
            shutil.rmtree(real_theme, ignore_errors=True)


class TestThemeRoutesIntegration:
    """Integration tests for theme routes."""

    def test_theme_routes_blueprint_registration(self, app):
        """Test that all theme routes are properly registered."""
        with app.test_request_context():
            assert url_for('admin2.manage_themes') == '/admin/themes'
            assert url_for('admin2.theme_readme') == '/admin/themes/readme'
            assert url_for('admin2.delete_theme', theme_name='test') == '/admin/themes/delete/test'
            assert url_for('admin2.reset_default_themes') == '/admin/themes/reset'
            assert url_for('admin2.apply_theme') == '/admin/themes/apply'

    def test_theme_routes_require_authentication(self, client):
        """Test that all theme routes require authentication."""
        routes = [
            '/admin/themes',
            '/admin/themes/readme',
            '/admin/themes/reset'
        ]
        
        for route in routes:
            response = client.get(route) if 'reset' not in route else client.post(route)
            assert response.status_code == 302
            assert 'login' in response.location

    def test_theme_routes_require_admin_role(self, client, regular_user):
        """Test that all theme routes require admin role."""
        with client.session_transaction() as sess:
            sess['_user_id'] = str(regular_user.id)
            sess['_fresh'] = True
        
        routes = [
            '/admin/themes',
            '/admin/themes/readme',
            '/admin/themes/reset'
        ]
        
        for route in routes:
            response = client.get(route) if 'reset' not in route else client.post(route)
            assert response.status_code == 302
            assert 'login' in response.location

    @patch('gametheca.routes_admin_ext.themes.ThemeManager')
    def test_theme_workflow_complete(self, mock_theme_manager, client, admin_user, sample_theme_data):
        """Test complete theme management workflow."""
        with client.session_transaction() as sess:
            sess['_user_id'] = str(admin_user.id)
            sess['_fresh'] = True
        
        mock_instance = MagicMock()
        mock_theme_manager.return_value = mock_instance
        mock_instance.get_installed_themes.return_value = []
        mock_instance.get_default_theme.return_value = {'name': 'Default'}
        mock_instance.upload_theme.return_value = sample_theme_data
        
        # Test GET request to themes management page
        with patch('os.path.exists', return_value=True):
            response = client.get('/admin/themes')
            assert response.status_code == 200
        
        # Test theme upload
        with patch('os.path.exists', return_value=True):
            zip_file = create_test_zip_file(sample_theme_data)
            data = {
                'theme_zip': (zip_file, 'test_theme.zip'),
                'submit': 'Upload Theme'
            }
            response = client.post('/admin/themes', data=data, content_type='multipart/form-data')
            assert response.status_code == 302
        
        # Test theme deletion
        response = client.post('/admin/themes/delete/test_theme')
        assert response.status_code == 302
        
        # Test readme access
        response = client.get('/admin/themes/readme')
        assert response.status_code == 200