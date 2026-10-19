"""Visible startup failures for pythonw; no third-party dependencies."""
from pathlib import Path
import os
import sys
import traceback
from datetime import datetime

HERE = Path(__file__).resolve().parent
LOG = HERE / 'startup.log'

def notify(message):
    if os.name == 'nt':
        import ctypes
        ctypes.windll.user32.MessageBoxW(None, message, 'KAOPU File Resumer · 启动提示', 0x10)
    else:
        print(message, file=sys.__stderr__)

def main():
    try:
        if LOG.exists() and LOG.stat().st_size > 128 * 1024:
            os.replace(LOG, HERE / 'startup.previous.log')
        log = LOG.open('a', encoding='utf-8', buffering=1)
    except OSError:
        notify('程序目录不可写。请将完整文件夹解压到你自己的文档目录，再运行 launch.vbs。原下载文件未改变。')
        return 2
    sys.stdout = sys.stderr = log
    print('\n--- r01.3 startup', datetime.now().isoformat(timespec='seconds'), '---')
    print('Python', sys.version.split()[0], 'executable', sys.executable)
    try:
        from dpi_support import enable_windows_dpi_awareness
        print('DPI', enable_windows_dpi_awareness())
        import tkinter as tk
        from app import App
        print('Tk', tk.TkVersion)
        root = tk.Tk()
        App(root)
        root.deiconify()
        root.lift()
        print('Main window initialized')
        root.mainloop()
        print('Normal window exit')
        return 0
    except Exception as exc:
        traceback.print_exc()
        log.flush()
        # Show actionable diagnostics even when tkinter cannot import or start.
        from_core = type(exc).__name__ == 'SafetyPause'
        detail = str(exc) if from_core else type(exc).__name__
        notify('程序未能启动：' + detail + '\n\n请查看本文件夹的 startup.log，或将它发回排查。\n不需要重复双击；原下载文件未改变。')
        return 2
    finally:
        sys.stdout, sys.stderr = sys.__stdout__, sys.__stderr__
        log.close()

if __name__ == '__main__':
    raise SystemExit(main())
