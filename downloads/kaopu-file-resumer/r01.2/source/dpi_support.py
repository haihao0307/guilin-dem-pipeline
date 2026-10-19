"""Opt into Windows DPI-aware text before creating any Tk window.
No settings are changed outside this process. Existing host awareness is respected.
"""
import os

def enable_windows_dpi_awareness():
    if os.name != 'nt':
        return 'non-Windows: native scaling'
    import ctypes
    from ctypes import wintypes
    user32 = ctypes.WinDLL('user32', use_last_error=True)
    try:
        fn = user32.SetProcessDpiAwarenessContext
        fn.argtypes = [ctypes.c_void_p]
        fn.restype = wintypes.BOOL
        if fn(ctypes.c_void_p(-4)):
            return 'Per-monitor DPI awareness v2'
        # ERROR_ACCESS_DENIED means the host/manifest already selected awareness.
        if ctypes.get_last_error() == 5:
            return 'DPI awareness already configured by host'
    except AttributeError:
        pass
    try:
        shcore = ctypes.WinDLL('shcore', use_last_error=True)
        fn = shcore.SetProcessDpiAwareness
        fn.argtypes = [ctypes.c_int]
        fn.restype = ctypes.c_long
        result = fn(2)
        if result == 0:
            return 'Per-monitor DPI awareness'
        if result & 0xffffffff == 0x80070005:
            return 'DPI awareness already configured by host'
    except (AttributeError, OSError):
        pass
    try:
        fn = user32.SetProcessDPIAware
        fn.argtypes = []
        fn.restype = wintypes.BOOL
        return 'System DPI aware' if fn() else 'DPI awareness unavailable; using host default'
    except AttributeError:
        return 'DPI awareness unavailable; using host default'
