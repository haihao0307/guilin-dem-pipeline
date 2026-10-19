"""靠谱文件续传器: local, explicit-action desktop UI (Python 3.12)."""
from __future__ import annotations
import os
import queue
import time
import math
import colorsys
import json
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


def layout_mode(width, height, required_height=520):
    """Pure breakpoint policy; compact retains all critical task actions."""
    return 'compact' if width < 600 or height < max(520, required_height) else 'normal'


def retry_countdown(task, now=None):
    if task.get('status') != 'retry':
        return ''
    seconds = max(0, math.ceil(task.get('retry_at', 0) - (time.time() if now is None else now)))
    label = '证书重检' if task.get('error_kind') == 'tls_certificate' else '自动重试'
    return f'{label} {seconds // 60:02d}:{seconds % 60:02d}'


def task_colors(index):
    """Deterministic golden-angle hues; identity color is unrelated to status."""
    hue = (max(0, int(index)) * 0.618033988749895 + 0.47) % 1
    def rgb(saturation, value):
        return '#' + ''.join(f'{round(c * 255):02x}' for c in colorsys.hsv_to_rgb(hue, saturation, value))
    return rgb(0.42, 0.22), rgb(0.48, 0.92)


def brand_target_pixels(dpi, compact=False):
    return round((40 if compact else 56) * max(1.0, min(3.0, dpi / 96.0)))


class App:
    def __init__(self, root):
        self.root = root
        root.title('KAOPU File Resumer · r01.6')
        root.geometry('900x600')
        root.minsize(360, 260)
        root.configure(bg=BG)
        assets = Path(__file__).resolve().parent / 'assets'
        for name in ('KAOPU_CORA_restored_r01.ico', 'KAOPU_CORA_restored_r01.png', 'KAOPU_CORA_restored_r01_32.png'):
            if not (assets / name).is_file():
                raise SafetyPause('品牌图标文件不完整，请全部解压r01.6后启动。')
        self.events = queue.Queue()
        self.engine = Engine(Path(__file__).resolve().parent / 'data', self.events.put)
        self.snapshots = {}
        self.archive_window = None
        self.row_markers = {}
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
        s.configure('Title.TLabel', font=('Segoe UI', 18, 'bold'))
        s.configure('TButton', background=PANEL, foreground=FG, borderwidth=0, padding=(9, 4))
        s.map('TButton', background=[('active', '#2b3d51'), ('disabled', '#17202b')], foreground=[('disabled', '#607088')])
        s.configure('Accent.TButton', background=ACCENT, foreground=BG)
        s.map('Accent.TButton', background=[('active', '#a1f5e7')])
        s.configure('TMenubutton', background=PANEL, foreground=FG, padding=(9, 4))
        s.configure('TProgressbar', troughcolor=PANEL, background=ACCENT, thickness=5)
        s.configure('TEntry', fieldbackground=PANEL, foreground=FG, padding=6)
        s.configure('TCombobox', fieldbackground=PANEL, foreground=FG, arrowcolor=FG)
        s.map('TCombobox', fieldbackground=[('readonly', PANEL)], foreground=[('readonly', FG)])
        from tkinter import font as tkfont
        rowheight = tkfont.Font(family='Microsoft YaHei UI', size=10).metrics('linespace') + 8
        s.configure('Treeview', background=PANEL, fieldbackground=PANEL, foreground=FG, rowheight=rowheight, borderwidth=0)
        s.configure('Treeview.Heading', background='#223046', foreground=MUTED, padding=4)
        s.map('Treeview', background=[('selected', '#31516a')], foreground=[('selected', FG)])

    def _layout(self):
        self.compact = None
        self.settings_window = None
        self.main = main = ttk.Frame(self.root, padding=10)
        main.pack(fill='both', expand=True)
        main.columnconfigure(0, weight=1)
        main.rowconfigure(3, weight=1)
        self.banner = ttk.Frame(main)
        self.banner.grid(row=0, column=0, sticky='ew', pady=(0, 10))
        self.brand_label = ttk.Label(self.banner, text='')
        self.brand_label.pack(side='left', padx=(0, 8))
        ttk.Label(self.banner, text='KAOPU File Resumer', style='Title.TLabel').pack(side='left')
        self.brand_status = ttk.Label(self.banner, text='r01.6', style='Muted.TLabel')
        self.brand_status.pack(side='right')
        self.load_brand_icon()
        self.input_panel = ttk.Frame(main)
        self.input_panel.grid(row=1, column=0, sticky='ew', pady=(0, 8))
        self.input_panel.columnconfigure(0, weight=1)
        self.urls = tk.Text(self.input_panel, width=1, height=2, bg=PANEL, fg=FG,
                            insertbackground=ACCENT, relief='flat', font=('Microsoft YaHei UI', 10),
                            padx=8, pady=6, wrap='word')
        self.urls.grid(row=0, column=0, sticky='ew')
        self.urls.bind('<<Paste>>', self.paste_event)
        ttk.Button(self.input_panel, text='加入队列', command=self.enqueue).grid(row=0, column=1, padx=(8, 0))
        ttk.Label(self.input_panel, text='每行一个 HTTPS 链接；粘贴后自动入队。', style='Muted.TLabel').grid(row=1, column=0, sticky='w', pady=(4, 0))
        toolbar = ttk.Frame(main)
        toolbar.grid(row=2, column=0, sticky='ew', pady=(0, 6))
        self.compact_brand_label = ttk.Label(toolbar, image=self.compact_brand_image)
        ttk.Button(toolbar, text='粘贴入队', style='Accent.TButton', command=self.paste_clipboard).pack(side='left')
        ttk.Button(toolbar, text='设置', command=self.open_settings).pack(side='left', padx=6)
        self.summary = ttk.Label(toolbar, text='0 个任务', style='Muted.TLabel')
        self.summary.pack(side='right')
        frame = ttk.Frame(main)
        frame.grid(row=3, column=0, sticky='nsew')
        frame.rowconfigure(0, weight=1)
        frame.columnconfigure(0, weight=1)
        cols = ('name', 'status', 'progress', 'speed', 'eta', 'compact_progress')
        self.tree = ttk.Treeview(frame, columns=cols, show='tree headings', selectmode='extended', height=1)
        self.tree.heading('#0', text='')
        self.tree.column('#0', width=self.marker_column_width, minwidth=self.marker_column_width, stretch=False)
        for col, title in zip(cols, ['文件', '状态', '已下载 / 总量', '速度', '剩余时间', '进度']):
            self.tree.heading(col, text=title)
            self.tree.column(col, width=60, minwidth=20, stretch=True)
        self.tree.grid(row=0, column=0, sticky='nsew')
        scroll = ttk.Scrollbar(frame, orient='vertical', command=self.tree.yview)
        scroll.grid(row=0, column=1, sticky='ns')
        self.tree.configure(yscrollcommand=scroll.set)
        self.tree.bind('<<TreeviewSelect>>', lambda _: self.show_selection())
        self.tree.bind('<Control-a>', self.select_all)
        self.detail = ttk.Label(main, text='选中任务查看状态', width=1, anchor='w', style='Muted.TLabel')
        self.detail.grid(row=4, column=0, sticky='ew', pady=(5, 3))
        self.progress = ttk.Progressbar(main, mode='determinate', maximum=100)
        self.progress.grid(row=5, column=0, sticky='ew', pady=(0, 5))
        actions = ttk.Frame(main)
        actions.grid(row=6, column=0, sticky='ew')
        self.pause_button = ttk.Button(actions, text='暂停', command=lambda: self.task_action('pause'))
        self.pause_button.pack(side='left')
        self.resume_button = ttk.Button(actions, text='继续', command=lambda: self.task_action('resume'))
        self.resume_button.pack(side='left', padx=6)
        more = ttk.Menubutton(actions, text='更多 ▾')
        more.pack(side='left')
        menu = tk.Menu(more, tearoff=False, bg=PANEL, fg=FG, activebackground='#31516a', activeforeground=FG)
        menu.add_command(label='移出选中任务（可恢复）', command=self.archive_selected)
        menu.add_command(label='已移出任务 / 恢复…', command=self.open_archive)
        menu.add_command(label='全选任务', command=lambda: self.tree.selection_set(self.tree.get_children()))
        menu.add_separator()
        menu.add_command(label='任务详情', command=self.show_task_detail)
        menu.add_command(label='更新下载链接…', command=self.update_url)
        menu.add_command(label='打开来源登录', command=self.open_origin)
        menu.add_separator()
        menu.add_command(label='手动输入链接…', command=self.manual_urls)
        menu.add_command(label='导入旧分段…', command=self.import_legacy)
        menu.add_command(label='查看日志', command=self.show_log)
        menu.add_command(label='恢复品牌图标', command=self.load_brand_icon)
        menu.add_command(label='版本与启动位置', command=self.show_about)
        more.configure(menu=menu)
        self.log = tk.Text(main, width=1, height=3, bg='#0c1119', fg=MUTED, relief='flat', state='disabled',
                           font=('Microsoft YaHei UI', 9), padx=8, pady=6, wrap='word')
        self.log.grid(row=7, column=0, sticky='ew', pady=(8, 0))
        self.footer = ttk.Label(main, text='不读取 Cookie。链接过期后，请从来源网站获取同一文件的新链接。',
                                style='Muted.TLabel', width=1)
        self.footer.grid(row=8, column=0, sticky='ew', pady=(6, 0))
        self.normal_chrome = (self.banner, self.input_panel, toolbar, self.detail, self.progress, actions, self.log, self.footer)
        self.root.bind('<Configure>', self.on_resize, add='+')
        self.root.after_idle(lambda: self.apply_layout(self.root.winfo_width(), self.root.winfo_height()))
        self.show_selection()

    def on_resize(self, event):
        if event.widget is self.root:
            self.apply_layout(event.width, event.height)

    def apply_layout(self, width, height):
        # Hidden widgets retain requested sizes: reserve normal chrome + margins
        # and a useful task list, using actual font/DPI-driven measurements.
        required = sum(widget.winfo_reqheight() for widget in self.normal_chrome) + self.tree.winfo_reqheight() + 100
        compact = layout_mode(width, height, required) == 'compact'
        if compact != self.compact:
            self.compact = compact
            for widget in (self.banner, self.input_panel, self.log, self.footer):
                widget.grid_remove() if compact else widget.grid()
            if compact:
                self.compact_brand_label.pack(side='left', before=self.compact_brand_label.master.winfo_children()[1], padx=(0, 5))
            else:
                self.compact_brand_label.pack_forget()
            self.main.configure(padding=6 if compact else 10)
            self.tree.configure(displaycolumns=('name', 'compact_progress') if compact else ('name', 'status', 'progress', 'speed', 'eta'))
            self.show_selection()
        available = max(100, width - (30 if compact else 38) - self.marker_column_width)
        columns = [('name', .67), ('compact_progress', .33)] if compact else [('name', .34), ('status', .15), ('progress', .25), ('speed', .13), ('eta', .13)]
        for name, share in columns:
            self.tree.column(name, width=int(available * share))

    def open_settings(self):
        if self.settings_window and self.settings_window.winfo_exists():
            self.settings_window.lift()
            return
        win = self.settings_window = tk.Toplevel(self.root)
        win.title('KAOPU · 设置')
        win.geometry('380x380')
        win.minsize(300, 220)
        win.configure(bg=BG)
        win.transient(self.root)
        canvas = tk.Canvas(win, bg=BG, highlightthickness=0, width=1)
        scroll = ttk.Scrollbar(win, orient='vertical', command=canvas.yview)
        scroll.pack(side='right', fill='y')
        canvas.pack(side='left', fill='both', expand=True)
        canvas.configure(yscrollcommand=scroll.set)
        body = ttk.Frame(canvas, padding=12)
        slot = canvas.create_window(0, 0, window=body, anchor='nw')
        body.bind('<Configure>', lambda _: canvas.configure(scrollregion=canvas.bbox('all')))
        canvas.bind('<Configure>', lambda e: canvas.itemconfigure(slot, width=e.width))
        def wheel(event):
            canvas.yview_scroll(-1 if event.delta > 0 else 1, 'units')
        win.bind('<MouseWheel>', wheel)
        ttk.Label(body, text='保存目录').pack(anchor='w')
        ttk.Entry(body, textvariable=self.outdir, width=1).pack(fill='x', pady=6)
        ttk.Button(body, text='选择目录…', command=self.choose_dir).pack(anchor='w')
        ttk.Label(body, text='同时下载').pack(anchor='w', pady=(12, 4))
        combo = ttk.Combobox(body, state='readonly', values=list(range(1, 7)), textvariable=self.concurrency, width=5)
        combo.pack(anchor='w')
        combo.bind('<<ComboboxSelected>>', lambda _: self.engine.set_concurrency(self.concurrency.get()))
        ttk.Label(body, text='无进展看门狗').pack(anchor='w', pady=(12, 4))
        dog = ttk.Combobox(body, state='readonly', values=['10 分钟', '30 分钟'], textvariable=self.watchdog, width=10)
        dog.pack(anchor='w')
        def set_watchdog(_):
            self.engine.watchdog_seconds = 600 if self.watchdog.get().startswith('10') else 1800
            self.engine.save()
        dog.bind('<<ComboboxSelected>>', set_watchdog)
        ttk.Label(body, text='链接过期需在浏览器获取新链接。\n程序不会读取浏览器 Cookie。', style='Muted.TLabel').pack(anchor='w', pady=12)
        ttk.Button(body, text='完成', command=win.destroy).pack(anchor='e')

    def show_about(self):
        folder = Path(__file__).resolve().parent
        messagebox.showinfo('KAOPU File Resumer · r01.6', '版本：r01.6\n程序目录：' + str(folder) + '\n队列目录：' + str(folder / 'data') + '\n请确认桌面快捷方式指向此版本。', parent=self.root)

    def show_task_detail(self):
        task = self.snapshots.get(self.selected())
        if task:
            values = self.tree.item(str(task['id']), 'values')
            messagebox.showinfo('任务详情', '\n'.join([str(task.get('name', '')), str(values[1]), str(values[2]),
                                                     '速度：' + str(values[3]), '剩余：' + str(values[4]), '原因：' + {'manual':'手动暂停', 'restored':'恢复后保持暂停', 'archived':'已移出', 'tls_certificate':'证书验证未通过', 'tls_handshake':'TLS连接/握手中断', 'network':'网络中断', 'authentication':'登录/权限需处理', 'source_identity':'源文件身份变化', 'integrity':'文件完整性校验失败', 'missing_url':'需要新链接', 'safety_check':'安全检查需处理', 'local_io':'本地读写异常', 'http_attention':'HTTP需处理'}.get(task.get('pause_reason', ''), '无'), str(task.get('message', ''))]), parent=self.root)

    def show_log(self):
        win = tk.Toplevel(self.root)
        win.title('KAOPU · 日志')
        win.geometry('500x300')
        win.minsize(300, 200)
        view = tk.Text(win, bg=PANEL, fg=FG, wrap='word', width=1, font=('Microsoft YaHei UI', 9))
        scroll = ttk.Scrollbar(win, command=view.yview)
        scroll.pack(side='right', fill='y')
        view.pack(fill='both', expand=True)
        view.configure(yscrollcommand=scroll.set)
        view.insert('1.0', self.log.get('1.0', 'end'))
        view.configure(state='disabled')

    def manual_urls(self):
        value = simpledialog.askstring('加入队列', '输入 HTTPS 下载链接（多个链接用空格分隔）：', parent=self.root)
        if value:
            self.urls.delete('1.0', 'end')
            self.urls.insert('1.0', value)
            self.enqueue()

    def load_brand_icon(self):
        # Versioned immutable assets avoid inherited r01.2 personal-icon overrides.
        # Preserve ui.json unchanged; it contains no download state.
        assets = Path(__file__).resolve().parent / 'assets'
        ico = assets / 'KAOPU_CORA_restored_r01.ico'
        png = assets / 'KAOPU_CORA_restored_r01.png'
        if not ico.is_file() or not png.is_file():
            raise SafetyPause('品牌图标文件不完整，请全部解压r01.6后启动。')
        original = tk.PhotoImage(file=str(png))
        self.window_icon = original
        self.root.iconphoto(True, original)
        if os.name == 'nt':
            self.root.iconbitmap(str(ico))
        dpi = self.root.winfo_fpixels('1i')
        self.marker_column_width = max(36, round(36 * dpi / 96))
        # Integer subsampling retains the approved source and its aspect ratio;
        # no alternate image, stretch, crop, or new runtime dependency.
        normal_divisor = max(1, round(original.width() / brand_target_pixels(dpi)))
        compact_divisor = max(1, round(original.width() / brand_target_pixels(dpi, True)))
        self.brand_image = original.subsample(normal_divisor, normal_divisor)
        self.compact_brand_image = original.subsample(compact_divisor, compact_divisor)
        if hasattr(self, 'compact_brand_label'):
            self.compact_brand_label.configure(image=self.compact_brand_image)
        self.brand_label.configure(image=self.brand_image, text='')
        self.brand_status.configure(text='r01.6')

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
            accepted = self.engine.add_urls(content, self.outdir.get().strip())
            if not accepted:
                self.add_log('这些链接已有任务；若已移出，请在更多菜单中恢复，避免重复下载。')
            self.urls.delete('1.0', 'end')
        except Exception:
            messagebox.showerror('无法加入队列', '请检查链接和保存目录。仅接受 HTTPS 下载链接。', parent=self.root)

    def selected(self):
        ids = self.tree.selection()
        return ids[0] if ids else None

    def select_all(self, _=None):
        self.tree.selection_set(self.tree.get_children())
        return 'break'

    def archive_selected(self):
        ids = self.tree.selection()
        if not ids:
            return
        if not messagebox.askyesno('移出任务', f'将选中的 {len(ids)} 个任务移出列表？\n\n文件、分段与检查点全部保留，可在“更多 → 已移出任务 / 恢复”找回。\n正在运行或连接尚未结束的任务会跳过，不中断下载。', parent=self.root):
            return
        try:
            archived, busy = self.engine.archive_tasks(ids)
            self.add_log(f'已移出 {len(archived)} 个任务；文件和检查点保留。')
            if busy:
                messagebox.showinfo('部分任务仍在运行', f'{len(busy)} 个任务未移出。请先暂停，等待当前连接结束后再移出；也可以等下载完成后再操作。', parent=self.root)
        except Exception:
            messagebox.showerror('移出未完成', '队列保存未完成，请检查磁盘和目录权限后重试。未删除下载文件。', parent=self.root)

    def open_archive(self):
        if self.archive_window and self.archive_window.winfo_exists():
            self.archive_window.lift()
            self.refresh_archive()
            return
        win = self.archive_window = tk.Toplevel(self.root)
        win.title('已移出任务 · 可恢复')
        win.geometry('560x340')
        win.minsize(300, 220)
        win.transient(self.root)
        body = ttk.Frame(win, padding=10)
        body.pack(fill='both', expand=True)
        ttk.Label(body, text='文件与检查点保留；恢复后未完成任务保持暂停。', wraplength=280).pack(anchor='w', pady=(0, 8))
        actions = ttk.Frame(body)
        actions.pack(side='bottom', fill='x', pady=(8, 0))
        ttk.Button(actions, text='恢复选中', command=self.restore_selected).pack(side='left')
        ttk.Button(actions, text='全选', command=lambda: self.archive_tree.selection_set(self.archive_tree.get_children())).pack(side='left', padx=6)
        ttk.Button(actions, text='关闭', command=win.destroy).pack(side='right')
        frame = ttk.Frame(body)
        frame.pack(fill='both', expand=True)
        self.archive_tree = ttk.Treeview(frame, columns=('name', 'progress'), show='tree headings', selectmode='extended')
        self.archive_tree.column('#0', width=self.marker_column_width, minwidth=self.marker_column_width, stretch=False)
        self.archive_tree.heading('name', text='文件')
        self.archive_tree.heading('progress', text='保留进度')
        self.archive_tree.column('name', width=280, minwidth=60)
        self.archive_tree.column('progress', width=160, minwidth=60)
        scroll = ttk.Scrollbar(frame, orient='vertical', command=self.archive_tree.yview)
        scroll.pack(side='right', fill='y')
        self.archive_tree.pack(fill='both', expand=True)
        self.archive_tree.configure(yscrollcommand=scroll.set)
        self.refresh_archive()

    def refresh_archive(self):
        if not self.archive_window or not self.archive_window.winfo_exists():
            return
        with self.engine.lock:
            tasks = [dict(t) for t in self.engine.tasks.values() if t['status'] == 'archived']
        selected = self.archive_tree.selection()
        for iid in self.archive_tree.get_children():
            self.archive_tree.delete(iid)
        for t in tasks:
            tag, marker = self.task_visual(self.archive_tree, t)
            self.archive_tree.insert('', 'end', iid=t['id'], image=marker, tags=(tag,), values=(t['name'], human(t.get('offset', 0))))
        self.archive_tree.selection_set([iid for iid in selected if self.archive_tree.exists(iid)])

    def restore_selected(self):
        try:
            restored = self.engine.restore_tasks(self.archive_tree.selection())
            self.refresh_archive()
            self.add_log(f'已恢复 {len(restored)} 个任务；未完成任务保持暂停。')
        except Exception:
            messagebox.showerror('恢复未完成', '队列保存未完成，请检查磁盘和目录权限后重试。', parent=self.archive_window)

    def task_action(self, action):
        for taskid in self.tree.selection():
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
        if self.compact:
            self.detail.configure(text=str(message))
        self.log.configure(state='normal')
        self.log.insert('end', str(message) + '\n')
        if int(self.log.index('end-1c').split('.')[0]) > 200:
            self.log.delete('1.0', '50.0')
        self.log.see('end')
        self.log.configure(state='disabled')

    def task_visual(self, tree, task):
        index = task.get('color_index', 0)
        background, accent = task_colors(index)
        tag = f'task-color-{index}'
        tree.tag_configure(tag, background=background, foreground=FG)
        if index not in self.row_markers:
            size = max(8, round(self.marker_column_width * 0.28))
            marker = tk.PhotoImage(width=size, height=size)
            marker.put(accent, to=(0, 0, size, size))
            self.row_markers[index] = marker
        # Tree images retain their hue when ttk paints selection background.
        return tag, self.row_markers[index]

    def update_task(self, task):
        taskid = str(task['id'])
        if task.get('status') == 'archived':
            self.snapshots.pop(taskid, None)
            if self.tree.exists(taskid):
                self.tree.delete(taskid)
            self.summary.configure(text=f'{len(self.snapshots)} 个任务')
            self.show_selection()
            self.refresh_archive()
            return
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
        countdown = retry_countdown(task)
        if countdown:
            status = countdown
        values = (task.get('name', '等待识别文件名'), status,
                  f'{human(offset)} / {human(total) if total else "未知"}', human(speed) + '/s' if speed else '—', eta, f'{min(100, offset / total * 100):.1f}%' if total else human(offset))
        tag, marker = self.task_visual(self.tree, task)
        if self.tree.exists(taskid):
            self.tree.item(taskid, values=values, image=marker, tags=(tag,))
        else:
            self.tree.insert('', 'end', iid=taskid, values=values, image=marker, tags=(tag,))
        self.summary.configure(text=f'{len(self.snapshots)} 个任务')
        if not self.selected():
            self.tree.selection_set(taskid)
        if self.selected() == taskid:
            self.show_selection()

    def show_selection(self):
        task = self.snapshots.get(self.selected(), {})
        offset, total = task.get('offset', 0) or 0, task.get('total', 0) or 0
        self.progress.configure(value=min(100, offset / total * 100) if total else 0)
        state = 'normal' if any(self.snapshots.get(i, {}).get('status') != 'complete' for i in self.tree.selection()) else 'disabled'
        self.pause_button.configure(state=state)
        self.resume_button.configure(state=state)
        if len(self.tree.selection()) > 1:
            self.detail.configure(text=f'已选 {len(self.tree.selection())} 个任务 · 可批量暂停/继续；更多 → 移出')
            return
        if not task:
            self.detail.configure(text='选中任务查看状态')
            return
        values = self.tree.item(str(task['id']), 'values')
        if self.compact:
            self.detail.configure(text=f'{values[1]} · {values[2]} · {values[3]}')
        else:
            self.detail.configure(text=(retry_countdown(task) + ' · ' + task.get('message', '')) if task.get('status') == 'retry' else task.get('message') or '可暂停、继续，或在更多菜单更新链接。')

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
        for task in list(self.snapshots.values()):
            if task.get('status') == 'retry':
                self.update_task(task)
        self.root.after(150, self.poll)

    def quit(self):
        if self.closing:
            return
        self.closing = True
        self.detail.configure(text='正在停止连接并保存检查点，请稍候…')
        self.root.title('KAOPU File Resumer · 正在保存')
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
    from dpi_support import enable_windows_dpi_awareness
    enable_windows_dpi_awareness()
    app_root = tk.Tk()
    try:
        App(app_root)
    except Exception as exc:
        app_root.withdraw()
        messagebox.showerror('无法启动', str(exc) if isinstance(exc, SafetyPause) else '启动失败。请运行 diagnose.cmd 查看详情。', parent=app_root)
        app_root.destroy()
        raise
    app_root.mainloop()
