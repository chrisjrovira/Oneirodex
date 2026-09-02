# oneirodex/utils/ops_network.py
import psutil


def get_network_stats():
    try:
        io = psutil.net_io_counters()
        try:
            connections = len(psutil.net_connections())
        except (psutil.AccessDenied, PermissionError, OSError):
            connections = None
        return {
            'bytes_sent': io.bytes_sent,
            'bytes_recv': io.bytes_recv,
            'packets_sent': io.packets_sent,
            'packets_recv': io.packets_recv,
            'errin': getattr(io, 'errin', 0) or 0,
            'errout': getattr(io, 'errout', 0) or 0,
            'dropin': getattr(io, 'dropin', 0) or 0,
            'dropout': getattr(io, 'dropout', 0) or 0,
            'connections': connections,
        }
    except Exception:
        return None
