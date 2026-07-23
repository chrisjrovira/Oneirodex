# tests/test_utils_ops_issues.py
from sharewarez.utils.ops_issues import derive_issues


def test_good_when_healthy():
    result = derive_issues(
        disk_base_percent=40,
        disk_warez_percent=50,
        path_problems=[],
        scan_failures=0,
        recent_error_count=0,
    )
    assert result['overall'] == 'good'
    assert result['items'] == []


def test_warn_at_85_percent_disk():
    result = derive_issues(
        disk_base_percent=85,
        disk_warez_percent=10,
        path_problems=[],
        scan_failures=0,
        recent_error_count=0,
    )
    assert result['overall'] == 'warn'
    assert any(i['id'] == 'disk_base_high' for i in result['items'])


def test_bad_at_95_percent_disk():
    result = derive_issues(
        disk_base_percent=10,
        disk_warez_percent=96,
        path_problems=[],
        scan_failures=0,
        recent_error_count=0,
    )
    assert result['overall'] == 'bad'
    assert any(i['id'] == 'disk_warez_critical' for i in result['items'])


def test_path_problem_is_bad():
    result = derive_issues(
        disk_base_percent=10,
        disk_warez_percent=10,
        path_problems=[{'key': 'DATA_FOLDER_WAREZ', 'reason': 'missing'}],
        scan_failures=0,
        recent_error_count=0,
    )
    assert result['overall'] == 'bad'


def test_recent_errors_warn():
    result = derive_issues(
        disk_base_percent=10,
        disk_warez_percent=10,
        path_problems=[],
        scan_failures=0,
        recent_error_count=2,
    )
    assert result['overall'] == 'warn'
