"""靠谱文件续传器: local, explicit-action desktop UI (Python 3.12)."""
from __future__ import annotations
import os
import queue
import tkinter as tk
from tkinter import ttk, filedialog, messagebox, simpledialog
from pathlib import Path
import webbrowser
from urllib.parse import urlsplit
from core import Engine, SafetyPause

BG = '#10151f'
PANEL = '#192231'
FG = '#e7eef7'
MUTED = '#95a6bd'
ACCENT = '#77dfcd'


def human(n):
    try:
        v = float(n or 0)
    except (TypeError, ValueError):
        return '—'
    for unit in ('B', 'KB', 'MB', 'GB', 'TB'):
        if abs(v) < 1024 or unit == 'TB':
            return f'{v:.1f} {unit}'
        v /= 1024


class App:
    def __init__(self, root):
        self.root = root
        root.title('靠谱文件续传器 · r01.1')
        root.geometry('1120x760')
        root.minsize(920, 640)
        root.configure(bg=BG)
        try:
            root.iconbitmap(str(Path(__file__).with_name('app.ico')))
        except tk.TclError:
            pass
        self.events = queue.Queue()
        self.engine = Engine(Path(__file__).resolve().parent / 'data', self.events.put)
        self.snapshots = {}
        self.outdir = tk.StringVar(value=str(Path.home() / 'Downloads' / '靠谱文件续传'))
        self.concurrency = tk.IntVar(value=self.engine.concurrency)
        self.watchdog = tk.StringVar(value='30 分钟' if self.engine.watchdog_seconds == 1800 else '10 分钟')
        self._style()
        self._layout()
        self.closing = False
        with self.engine.lock:
            restored = [dict(t) for t in self.engine.tasks.values()]
        for task in restored:
            self.update_task(task)
        root.protocol('WM_DELETE_WINDOW', self.quit)
        root.after(100, self.poll)

    def _style(self):
        s = ttk.Style()
        s.theme_use('clam')
        s.configure('.', font=('Microsoft YaHei UI', 10), background=BG, foreground=FG)
        s.configure('TFrame', background=BG)
        s.configure('TLabel', background=BG, foreground=FG)
        s.configure('Muted.TLabel', foreground=MUTED)
        s.configure('Title.TLabel', font=('Microsoft YaHei UI', 23, 'bold'))
        s.configure('TButton', background=PANEL, foreground=FG, borderwidth=0, padding=(13, 8))
        s.map('TButton', background=[('active', '#2b3d51'), ('disabled', '#17202b')], foreground=[('disabled', '#607088')])
        s.configure('Accent.TButton', background=ACCENT, foreground=BG)
        s.map('Accent.TButton', background=[('active', '#a1f5e7')])
        s.configure('TEntry', fieldbackground=PANEL, foreground=FG, padding=6)
        s.configure('TCombobox', fieldbackground=PANEL, foreground=FG, arrowcolor=FG)
        s.map('TCombobox', fieldbackground=[('readonly', PANEL)], foreground=[('readonly', FG)])
        s.configure('Treeview', background=PANEL, fieldbackground=PANEL, foreground=FG, rowheight=36, borderwidth=0)
        s.configure('Treeview.Heading', background='#223046', foreground=MUTED, padding=8)
        s.map('Treeview', background=[('selected', '#31516a')], foreground=[('selected', FG)])

    def _layout(self):
        main = ttk.Frame(self.root, padding=24)
        main.pack(fill='both', expand=True)
        head = ttk.Frame(main)
        head.pack(fill='x')
        ttk.Label(head, text='靠谱文件续传器', style='Title.TLabel').pack(side='left')
        ttk.Label(head, text='LOCAL · RESUMABLE · YOUR FILES', style='Muted.TLabel').pack(side='right')
        ttk.Label(main, text='把链接放进来，剩下的交给队列。支持断点续传的服务器可接着下载。', style='Muted.TLabel').pack(anchor='w', pady=(6, 16))
        urlframe = ttk.Frame(main)
        urlframe.pack(fill='x')
        self.urls = tk.Text(urlframe, height=3, bg=PANEL, fg=FG, insertbackground=ACCENT,
                            relief='flat', font=('Microsoft YaHei UI', 10), padx=12, pady=10, wrap='word')
        self.urls.pack(side='left', fill='x', expand=True)
        self.urls.bind('<<Paste>>', self.paste_event)
        ttk.Button(urlframe, text='粘贴并入队', style='Accent.TButton', command=self.paste_clipboard).pack(side='right', padx=(12, 0))
        ttk.Label(main, text='每行一个 HTTPS 下载链接；在输入框粘贴后自动入队。手动输入后点「加入队列」。', style='Muted.TLabel').pack(anchor='w', pady=(6, 10))
        settings = ttk.Frame(main)
        settings.pack(fill='x')
        ttk.Label(settings, text='保存到').pack(side='left')
        ttk.Entry(settings, textvariable=self.outdir).pack(side='left', fill='x', expand=True, padx=8)
        ttk.Button(settings, text='选择目录', command=self.choose_dir).pack(side='left')
        ttk.Button(settings, text='加入队列', command=self.enqueue).pack(side='left', padx=(8, 0))
        tuning = ttk.Frame(main)
        tuning.pack(fill='x', pady=12)
        ttk.Label(tuning, text='同时下载').pack(side='left')
        combo = ttk.Combobox(tuning, state='readonly', width=3, values=list(range(1, 7)), textvariable=self.concurrency)
        combo.pack(side='left', padx=(8, 18))
        combo.bind('<<ComboboxSelected>>', lambda _: self.engine.set_concurrency(self.concurrency.get()))
        ttk.Label(tuning, text='无进展看门狗').pack(side='left')
        dog = ttk.Combobox(tuning, state='readonly', width=9, values=['10 分钟', '30 分钟'], textvariable=self.watchdog)
        dog.pack(side='left', padx=8)
        def set_watchdog(_):
            self.engine.watchdog_seconds = 600 if self.watchdog.get().startswith('10') else 1800
            self.engine.save()
        dog.bind('<<ComboboxSelected>>', set_watchdog)
        ttk.Button(tuning, text='导入旧分段…', command=self.import_legacy).pack(side='right')
        cols = ('name', 'status', 'progress', 'speed', 'eta')
        frame = ttk.Frame(main)
        frame.pack(fill='both', expand=True)
        self.tree = ttk.Treeview(frame, columns=cols, show='headings', selectmode='browse', height=7)
        for col, title, width in zip(cols, ['文件', '状态', '已下载 / 总量', '速度', '剩余时间'], [340, 140, 190, 110, 100]):
            self.tree.heading(col, text=title)
            self.tree.column(col, width=width, minwidth=65, stretch=col in ('name', 'progress'))
        self.tree.pack(side='left', fill='both', expand=True)
        scroll = ttk.Scrollbar(frame, orient='vertical', command=self.tree.yview)
        scroll.pack(side='right', fill='y')
        self.tree.configure(yscrollcommand=scroll.set)
        self.tree.bind('<<TreeviewSelect>>', lambda _: self.show_selection())
        actions = ttk.Frame(main)
        actions.pack(fill='x', pady=(12, 8))
        for title, cmd in [('暂停', lambda: self.task_action('pause')), ('继续', lambda: self.task_action('resume')),
                           ('更新下载链接…', self.update_url), ('打开来源登录', self.open_origin)]:
            ttk.Button(actions, text=title, command=cmd).pack(side='left', padx=(0, 8))
        self.summary = ttk.Label(actions, text='0 个任务', style='Muted.TLabel')
        self.summary.pack(side='right')
        self.detail = ttk.Label(main, text='选中一个任务查看状态。', style='Muted.TLabel', wraplength=1000)
        self.detail.pack(anchor='w', pady=(0, 6))
        self.log = tk.Text(main, height=4, bg='#0c1119', fg=MUTED, relief='flat', state='disabled',
                           font=('Microsoft YaHei UI', 9), padx=10, pady=8, wrap='word')
        self.log.pack(fill='x')
        ttk.Label(main, text='链接过期或需要登录时，请在浏览器获取新的下载链接再更新。不会读取浏览器 Cookie，也不绕过站点登录。',
                  style='Muted.TLabel', wraplength=1050).pack(anchor='w', pady=(9, 0))

    def choose_dir(self):
        result = filedialog.askdirectory(parent=self.root, initialdir=self.outdir.get())
        if result:
            self.outdir.set(result)

    def paste_event(self, _):
        self.paste_clipboard()
        return 'break'

    def paste_clipboard(self):
        try:
            content = self.root.clipboard_get()
        except tk.TclError:
            messagebox.showinfo('剪贴板为空', '请先复制 HTTPS 下载链接。', parent=self.root)
            return
        self.urls.delete('1.0', 'end')
        self.urls.insert('1.0', content)
        self.enqueue()

    def enqueue(self):
        content = self.urls.get('1.0', 'end').strip()
        if not content:
            return
        if not self.outdir.get().strip():
            messagebox.showinfo('选择目录', '请先选择文件保存目录。', parent=self.root)
            return
        try:
            self.engine.add_urls(content, self.outdir.get().strip())
            self.urls.delete('1.0', 'end')
        except Exception:
            messagebox.showerror('无法加入队列', '请检查链接和保存目录。仅接受 HTTPS 下载链接。', parent=self.root)

    def selected(self):
        ids = self.tree.selection()
        return ids[0] if ids else None

    def task_action(self, action):
        taskid = self.selected()
        if taskid:
            try:
                getattr(self.engine, action)(taskid)
            except SafetyPause as exc:
                self.add_log(str(exc))
            except Exception:
                self.add_log('操作未完成，请检查任务状态后重试。')

    def update_url(self):
        taskid = self.selected()
        if not taskid:
            return
        if self.snapshots.get(taskid, {}).get('status') == 'complete':
            messagebox.showinfo('任务已完成', '新文件请加入新任务。', parent=self.root)
            return
        self.engine.pause(taskid)
        value = simpledialog.askstring('更新下载链接', '已请求暂停。请粘贴同一个文件的新 HTTPS 下载链接：', parent=self.root)
        if value:
            try:
                self.engine.update_url(taskid, value.strip())
            except SafetyPause as exc:
                messagebox.showinfo('更新暂未完成', str(exc) + '\n当前连接可能需要约 20 秒结束，请稍后重试。', parent=self.root)
            except Exception:
                messagebox.showerror('更新失败', '请确认这是有效的 HTTPS 下载链接。', parent=self.root)

    def open_origin(self):
        taskid = self.selected()
        if not taskid:
            return
        # Open only origin: never propagate a signed URL or query token to a login page.
        task = self.snapshots.get(taskid, {})
        url = task.get('origin', '')
        p = urlsplit(url)
        if p.scheme != 'https' or not p.hostname:
            messagebox.showinfo('来源不可用', '请在原来的浏览器页面登录并获取新下载链接。', parent=self.root)
            return
        origin = f'https://{p.hostname}' + (f':{p.port}' if p.port else '')
        webbrowser.open(origin)

    def import_legacy(self):
        folder = filedialog.askdirectory(parent=self.root, title='选择旧下载的分段目录（保留原文件）')
        if not folder:
            return
        if not messagebox.askyesno('复制旧分段', '导入会复制已有分段，原目录和旧版本保持不变。大文件可能耗时较长，并需要额外磁盘空间。\n\n原工具的抽样匹配不能证明原分段无空洞；导入会核验检查点哈希，完成后执行全 ZIP CRC。校验失败会保留文件并暂停，不自动重下。\n\n确认复制并开始续传这个目录中的对应文件？\n' + folder, parent=self.root):
            return
        links = simpledialog.askstring('旧文件下载链接', '粘贴同一个原文件的 HTTPS 下载链接：', parent=self.root)
        if not links:
            return
        # Copying can be long; never block Tk's event loop.
        import threading
        def run():
            try:
                self.engine.import_legacy(folder, links)
            except SafetyPause as exc:
                self.events.put({'kind': 'log', 'message': str(exc)})
            except Exception:
                self.events.put({'kind': 'log', 'message': '旧分段导入失败，请检查目录、链接和可用空间。原文件保持不变。'})
        threading.Thread(target=run, daemon=True).start()
        self.add_log('正在检查并复制旧分段，完成后将显示在队列中。')

    def add_log(self, message):
        self.log.configure(state='normal')
        self.log.insert('end', str(message) + '\n')
        if int(self.log.index('end-1c').split('.')[0]) > 200:
            self.log.delete('1.0', '50.0')
        self.log.see('end')
        self.log.configure(state='disabled')

    def update_task(self, task):
        taskid = str(task['id'])
        self.snapshots[taskid] = dict(task)
        offset, total, speed = task.get('offset', 0) or 0, task.get('total', 0) or 0, task.get('speed', 0) or 0
        eta = '—'
        if speed > 0 and total > offset:
            secs = int((total - offset) / speed)
            eta = f'{secs // 3600}时{secs % 3600 // 60}分' if secs >= 3600 else f'{secs // 60}分{secs % 60}秒'
        status = task.get('status', '')
        status = {'queued': '排队中', 'downloading': '下载中', 'paused': '已暂停', 'completed': '已完成', 'complete': '已完成',
                  'error': '需处理', 'failed': '需处理', 'retrying': '等待重试', 'waiting': '等待中', 'stalled': '无进展',
                  'needs_url': '需要新链接', 'running': '下载中', 'checking': '核验检查点',
                  'verifying': '完整性校验', 'retry': '等待重试', 'attention': '需要处理'}.get(status, status)
        values = (task.get('name', '等待识别文件名'), status,
                  f'{human(offset)} / {human(total) if total else "未知"}', human(speed) + '/s' if speed else '—', eta)
        if self.tree.exists(taskid):
            self.tree.item(taskid, values=values)
        else:
            self.tree.insert('', 'end', iid=taskid, values=values)
        self.summary.configure(text=f'{len(self.snapshots)} 个任务')
        if self.selected() == taskid:
            self.show_selection()

    def show_selection(self):
        task = self.snapshots.get(self.selected(), {})
        self.detail.configure(text=task.get('message') or '已选中任务，可暂停、继续或更新链接。')

    def poll(self):
        for _ in range(200):
            try:
                event = self.events.get_nowait()
            except queue.Empty:
                break
            if event.get('kind') == 'closed':
                self.root.destroy()
                return
            if event.get('kind') == 'update' and event.get('task'):
                self.update_task(event['task'])
            elif event.get('kind') == 'log':
                self.add_log(event.get('message', ''))
        self.root.after(150, self.poll)

    def quit(self):
        if self.closing:
            return
        self.closing = True
        self.detail.configure(text='正在停止连接并保存检查点，请稍候…')
        self.root.title('靠谱文件续传器 · 正在保存')
        def disable(widget):
            for child in widget.winfo_children():
                try:
                    child.configure(state='disabled')
                except tk.TclError:
                    pass
                disable(child)
        disable(self.root)
        import threading
        def finish():
            try:
                self.engine.close()
            finally:
                self.events.put({'kind': 'closed'})
        threading.Thread(target=finish, daemon=False).start()


if __name__ == '__main__':
    app_root = tk.Tk()
    try:
        App(app_root)
    except Exception as exc:
        app_root.withdraw()
        messagebox.showerror('无法启动', str(exc) if isinstance(exc, SafetyPause) else '启动失败。请运行 diagnose.cmd 查看详情。', parent=app_root)
        app_root.destroy()
        raise
    app_root.mainloop()
