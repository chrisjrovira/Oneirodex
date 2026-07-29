import psutil
import os
from config import Config
import platform

def get_cpu_usage():
    """Get CPU usage percentage"""
    try:
        cpu_percent = psutil.cpu_percent(interval=1)
        cpu_count_physical = psutil.cpu_count(logical=False)
        cpu_count_logical = psutil.cpu_count(logical=True)
        return {
            'percent': cpu_percent,
            'cores_physical': cpu_count_physical,
            'cores_logical': cpu_count_logical
        }
    except Exception as e:
        print(f"Error getting CPU usage: {e}")
        return None

def get_memory_usage():
    """Get memory usage statistics"""
    try:
        memory = psutil.virtual_memory()
        return {
            'total': memory.total,
            'available': memory.available,
            'used': memory.used,
            'percent': memory.percent
        }
    except Exception as e:
        print(f"Error getting memory usage: {e}")
        return None

def get_disk_usage():
    """Get disk usage for the application's base folder"""
    try:
        base_path = Config.BASE_FOLDER_WINDOWS if os.name == 'nt' else Config.BASE_FOLDER_POSIX
        if not os.path.exists(base_path):
            return None
        
        disk_usage = psutil.disk_usage(base_path)
        return {
            'total': disk_usage.total,
            'used': disk_usage.used,
            'free': disk_usage.free,
            'percent': disk_usage.percent
        }
    except Exception as e:
        print(f"Error getting disk usage: {e}")
        return None

def get_games_folder_usage():
    """Get disk usage for the games folder."""
    try:
        games_path = Config.DATA_FOLDER_GAMES
        if not os.path.exists(games_path):
            return None

        disk_usage = psutil.disk_usage(games_path)
        return {
            'total': disk_usage.total,
            'used': disk_usage.used,
            'free': disk_usage.free,
            'percent': disk_usage.percent
        }
    except Exception as e:
        print(f"Error getting games folder disk usage: {e}")
        return None


def get_warez_folder_usage():
    """Deprecated alias for get_games_folder_usage."""
    return get_games_folder_usage()

def format_bytes(bytes_value):
    """Convert bytes to human readable format"""
    if bytes_value is None:
        return "N/A"
    
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if bytes_value < 1024:
            return f"{bytes_value:.2f} {unit}"
        bytes_value /= 1024
    return f"{bytes_value:.2f} PB"

def get_load_average():
    """Return 1/5/15-minute load averages when the OS exposes them.

    Linux/macOS via ``os.getloadavg``; Windows and restricted hosts return None.
    """
    try:
        one, five, fifteen = os.getloadavg()
        return {
            '1': round(float(one), 2),
            '5': round(float(five), 2),
            '15': round(float(fifteen), 2),
        }
    except (AttributeError, OSError) as e:
        # Windows has no getloadavg; some containers deny /proc/loadavg.
        print(f"Load average unavailable: {e}")
        return None
    except Exception as e:
        print(f"Error getting load average: {e}")
        return None


def get_process_memory():
    """Return this process RSS (bytes) when cheaply available via psutil."""
    try:
        proc = psutil.Process()
        rss = int(proc.memory_info().rss)
        return {
            'pid': proc.pid,
            'rss_bytes': rss,
        }
    except (psutil.Error, OSError, AttributeError) as e:
        print(f"Process memory unavailable: {e}")
        return None
    except Exception as e:
        print(f"Error getting process memory: {e}")
        return None


def get_process_count():
    """Get number of running processes"""
    try:
        return len(psutil.pids())
    except Exception as e:
        print(f"Error getting process count: {e}")
        return None

def get_open_files():
    """Get number of open files (platform specific)"""
    try:
        if platform.system() == 'Linux':
            # On Linux, we can get this from /proc/sys/fs/file-nr
            with open('/proc/sys/fs/file-nr') as f:
                return int(f.read().split()[0])
        else:
            # On Windows, we'll return the number of handles as an approximation
            return len(psutil.Process().open_files())
    except Exception as e:
        print(f"Error getting open files count: {e}")
        return None
