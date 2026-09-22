"""INSP-44 / H4c: the Ops GPU pulse -- NVML when present, a BYO sensor reader
otherwise, None when neither answers. Nothing bundled, never raises."""
from __future__ import annotations

import sys
import types
from types import SimpleNamespace
from unittest.mock import patch

from oneirodex.utils import system_stats as ss

LHM_TREE = {
    'id': 0, 'Text': 'Sensor', 'Children': [
        {'id': 1, 'Text': 'GAMING-PC', 'Children': [
            {'id': 2, 'Text': 'Intel Core i9', 'ImageURL': 'images_icon/cpu.png', 'Children': [
                {'Text': 'Load', 'Children': [{'Text': 'CPU Total', 'Value': '12.0 %'}]},
            ]},
            {'id': 3, 'Text': 'NVIDIA GeForce RTX 2080', 'ImageURL': 'images_icon/nvidia.png', 'Children': [
                {'Text': 'Temperatures', 'Children': [{'Text': 'GPU Core', 'Value': '61.0 °C'}]},
                {'Text': 'Load', 'Children': [{'Text': 'GPU Core', 'Value': '57.0 %'}, {'Text': 'GPU Memory', 'Value': '40.0 %'}]},
                {'Text': 'Data', 'Children': [{'Text': 'GPU Memory Used', 'Value': '3,276 MB'}, {'Text': 'GPU Memory Total', 'Value': '8,192 MB'}]},
            ]},
        ]},
    ],
}


def test_parse_reader_finds_the_gpu_and_ignores_the_cpu():
    parsed = ss.parse_telemetry_reader(LHM_TREE)
    assert parsed['source'] == 'reader' and len(parsed['gpus']) == 1
    gpu = parsed['gpus'][0]
    assert gpu['name'] == 'NVIDIA GeForce RTX 2080'
    assert gpu['util_percent'] == 57.0 and gpu['temp_c'] == 61
    assert gpu['mem_used'] == 3276 * 1024 * 1024 and gpu['mem_total'] == 8192 * 1024 * 1024
    assert ss.parse_telemetry_reader({'Text': 'Sensor', 'Children': []}) is None
    assert ss.parse_telemetry_reader([]) is None
    assert ss.parse_telemetry_reader({'nonsense': 1}) is None


def test_gpu_usage_is_none_without_nvml_or_reader(monkeypatch):
    monkeypatch.delenv('TELEMETRY_READER_URL', raising=False)
    monkeypatch.setitem(sys.modules, 'pynvml', None)  # import fails
    assert ss.get_gpu_usage() is None


def test_gpu_usage_reads_the_byo_reader_and_survives_its_absence(monkeypatch):
    monkeypatch.setenv('TELEMETRY_READER_URL', 'http://gaming-pc:8085/data.json')
    monkeypatch.setitem(sys.modules, 'pynvml', None)
    with patch('oneirodex.utils.http_safe.safe_request', return_value=SimpleNamespace(status_code=200, json=lambda: LHM_TREE)) as req:
        out = ss.get_gpu_usage()
        assert req.call_args.args[:2] == ('GET', 'http://gaming-pc:8085/data.json')
        assert req.call_args.kwargs['timeout'] == ss._GPU_READER_TIMEOUT
    assert out['source'] == 'reader' and out['reader_url'].endswith('/data.json')
    assert out['gpus'][0]['util_percent'] == 57.0
    with patch('oneirodex.utils.http_safe.safe_request', side_effect=OSError('offline')):
        assert ss.get_gpu_usage() is None
    with patch('oneirodex.utils.http_safe.safe_request', return_value=SimpleNamespace(status_code=503, json=lambda: {})):
        assert ss.get_gpu_usage() is None


def test_gpu_usage_prefers_nvml_when_a_device_answers(monkeypatch):
    monkeypatch.delenv('TELEMETRY_READER_URL', raising=False)
    fake = types.ModuleType('pynvml')
    fake.NVML_TEMPERATURE_GPU = 0
    fake.nvmlInit = lambda: None
    fake.nvmlShutdown = lambda: None
    fake.nvmlDeviceGetCount = lambda: 1
    fake.nvmlDeviceGetHandleByIndex = lambda i: 'h0'
    fake.nvmlDeviceGetName = lambda h: b'NVIDIA GeForce RTX 2080'
    fake.nvmlDeviceGetUtilizationRates = lambda h: SimpleNamespace(gpu=33, memory=20)
    fake.nvmlDeviceGetMemoryInfo = lambda h: SimpleNamespace(used=2 * 1024**3, total=8 * 1024**3)
    fake.nvmlDeviceGetTemperature = lambda h, k: 55
    monkeypatch.setitem(sys.modules, 'pynvml', fake)
    out = ss.get_gpu_usage()
    assert out['source'] == 'nvml'
    assert out['gpus'][0] == {'name': 'NVIDIA GeForce RTX 2080', 'util_percent': 33.0, 'mem_used': 2 * 1024**3, 'mem_total': 8 * 1024**3, 'temp_c': 55}

    # A driver-less host: init raises -> fall through to the reader path (unset) -> None
    def boom():
        raise RuntimeError('NVML Shared Library Not Found')
    fake.nvmlInit = boom
    assert ss.get_gpu_usage() is None
