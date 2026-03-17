// ============================================================
// Virtual File System - In-memory tree-based filesystem
// Production VFS for browser environment
// ============================================================

export interface VFSNode {
  name: string;
  type: 'file' | 'folder' | 'symlink';
  content?: string;
  children?: Map<string, VFSNode>;
  permissions: string;
  owner: string;
  modified: Date;
  created: Date;
  size: number;
  target?: string; // symlink target
}

export interface VFSStat {
  name: string;
  type: 'file' | 'folder' | 'symlink';
  permissions: string;
  owner: string;
  modified: Date;
  created: Date;
  size: number;
}

function createNode(
  name: string,
  type: 'file' | 'folder' | 'symlink',
  content?: string
): VFSNode {
  const now = new Date();
  const node: VFSNode = {
    name,
    type,
    permissions: type === 'folder' ? 'drwxr-xr-x' : '-rw-r--r--',
    owner: 'kasm-user',
    modified: now,
    created: now,
    size: content ? content.length : 0,
  };
  if (type === 'folder') {
    node.children = new Map();
  }
  if (content !== undefined) {
    node.content = content;
  }
  return node;
}

function normalizePath(path: string): string {
  if (!path || path === '') return '/';
  // Ensure leading slash
  if (!path.startsWith('/')) path = '/' + path;
  const parts = path.split('/');
  const resolved: string[] = [];
  for (const part of parts) {
    if (part === '' || part === '.') continue;
    if (part === '..') {
      resolved.pop();
    } else {
      resolved.push(part);
    }
  }
  return '/' + resolved.join('/');
}

function splitPath(path: string): { parent: string; name: string } {
  const normalized = normalizePath(path);
  if (normalized === '/') return { parent: '/', name: '' };
  const lastSlash = normalized.lastIndexOf('/');
  const parent = lastSlash === 0 ? '/' : normalized.substring(0, lastSlash);
  const name = normalized.substring(lastSlash + 1);
  return { parent, name };
}

const TEXT_EXTENSIONS = new Set([
  'txt', 'md', 'json', 'js', 'ts', 'tsx', 'jsx', 'css', 'html', 'htm',
  'xml', 'svg', 'yaml', 'yml', 'toml', 'ini', 'cfg', 'conf', 'sh',
  'bash', 'zsh', 'fish', 'py', 'rb', 'rs', 'go', 'java', 'c', 'h',
  'cpp', 'hpp', 'cs', 'swift', 'kt', 'lua', 'pl', 'php', 'sql', 'r',
  'csv', 'tsv', 'log', 'env', 'gitignore', 'dockerignore', 'editorconfig',
  'prettierrc', 'eslintrc', 'babelrc', 'makefile', 'cmake', 'lock',
]);

function isLikelyText(filename: string): boolean {
  const dot = filename.lastIndexOf('.');
  if (dot === -1) return true; // no extension, assume text
  const ext = filename.slice(dot + 1).toLowerCase();
  return TEXT_EXTENSIONS.has(ext);
}

function matchGlob(name: string, pattern: string): boolean {
  // Convert glob to regex
  let regex = '^';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '*') {
      if (pattern[i + 1] === '*') {
        regex += '.*';
        i++;
      } else {
        regex += '[^/]*';
      }
    } else if (c === '?') {
      regex += '[^/]';
    } else if (c === '[') {
      const end = pattern.indexOf(']', i);
      if (end === -1) {
        regex += '\\[';
      } else {
        regex += pattern.substring(i, end + 1);
        i = end;
      }
    } else if ('.+^${}()|\\'.includes(c)) {
      regex += '\\' + c;
    } else {
      regex += c;
    }
  }
  regex += '$';
  try {
    return new RegExp(regex).test(name);
  } catch {
    return false;
  }
}

export class VirtualFS {
  private root: VFSNode;
  private _mountedHandles = new Map<string, FileSystemDirectoryHandle>();
  private _mountListeners = new Set<(mounts: string[]) => void>();

  constructor() {
    this.root = createNode('/', 'folder');
    this.root.children = new Map();
    this._populate();
  }

  // === File System Access API: Mount a real local folder ===

  async mountLocalFolder(mountPoint?: string): Promise<string> {
    if (typeof window === 'undefined' || !('showDirectoryPicker' in window)) {
      throw new Error('File System Access API not supported in this browser');
    }
    const handle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
    const name = handle.name as string;
    const target = mountPoint || `/mnt/${name}`;

    // Create mount point in VFS
    this.mkdirp(target);

    // Read the real directory tree into VFS
    await this._readHandleInto(handle, target);

    // Store handle for write-back
    this._mountedHandles.set(target, handle);
    this._notifyMountChange();

    return target;
  }

  getMountedPaths(): string[] {
    return Array.from(this._mountedHandles.keys());
  }

  isMounted(path: string): boolean {
    for (const mount of this._mountedHandles.keys()) {
      if (path === mount || path.startsWith(mount + '/')) return true;
    }
    return false;
  }

  onMountChange(fn: (mounts: string[]) => void): () => void {
    this._mountListeners.add(fn);
    return () => this._mountListeners.delete(fn);
  }

  async unmount(mountPoint: string): Promise<void> {
    this._mountedHandles.delete(mountPoint);
    try { this.rm(mountPoint, true); } catch {}
    this._notifyMountChange();
  }

  /** Re-read a mounted folder from disk */
  async refreshMount(mountPoint: string): Promise<void> {
    const handle = this._mountedHandles.get(mountPoint);
    if (!handle) throw new Error(`Not a mount point: ${mountPoint}`);
    // Clear existing children
    const node = this._resolve(mountPoint);
    if (node && node.children) node.children.clear();
    await this._readHandleInto(handle, mountPoint);
  }

  /** Write a VFS file back to the real filesystem */
  async syncToLocal(vfsPath: string): Promise<void> {
    let mountPoint = '';
    for (const mp of this._mountedHandles.keys()) {
      if (vfsPath.startsWith(mp + '/') || vfsPath === mp) {
        mountPoint = mp;
        break;
      }
    }
    if (!mountPoint) return; // not a mounted path

    const handle = this._mountedHandles.get(mountPoint)!;
    const relativePath = vfsPath.slice(mountPoint.length + 1);
    if (!relativePath) return;

    const parts = relativePath.split('/').filter(Boolean);
    let dirHandle = handle;
    // Navigate to parent directory
    for (let i = 0; i < parts.length - 1; i++) {
      dirHandle = await dirHandle.getDirectoryHandle(parts[i], { create: true });
    }

    const fileName = parts[parts.length - 1];
    const node = this._resolve(vfsPath);
    if (!node) return;

    if (node.type === 'file') {
      const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
      const writable = await (fileHandle as any).createWritable();
      await writable.write(node.content ?? '');
      await writable.close();
    }
  }

  private async _readHandleInto(handle: FileSystemDirectoryHandle, vfsPath: string, depth = 0): Promise<void> {
    if (depth > 8) return; // safety limit
    const entries: any = handle.entries();
    for await (const [name, entryHandle] of entries) {
      const childPath = `${vfsPath}/${name}`;
      if (entryHandle.kind === 'directory') {
        try { this.mkdir(childPath); } catch {}
        await this._readHandleInto(entryHandle as FileSystemDirectoryHandle, childPath, depth + 1);
      } else {
        try {
          const file: File = await (entryHandle as any).getFile();
          // Only read text files under 1MB
          if (file.size < 1024 * 1024 && isLikelyText(file.name)) {
            const content = await file.text();
            this.writeFile(childPath, content);
            // Set correct metadata
            const node = this._resolve(childPath);
            if (node) {
              node.modified = new Date(file.lastModified);
              node.size = file.size;
            }
          } else {
            // Create a placeholder for binary/large files
            this.writeFile(childPath, `[Binary file: ${file.name}, ${file.size} bytes]`);
            const node = this._resolve(childPath);
            if (node) {
              node.modified = new Date(file.lastModified);
              node.size = file.size;
            }
          }
        } catch {}
      }
    }
  }

  private _notifyMountChange(): void {
    const mounts = this.getMountedPaths();
    this._mountListeners.forEach(fn => fn(mounts));
  }

  private _resolve(path: string): VFSNode | null {
    const normalized = normalizePath(path);
    if (normalized === '/') return this.root;
    const parts = normalized.split('/').filter(Boolean);
    let current = this.root;
    for (const part of parts) {
      if (!current.children) return null;
      const child = current.children.get(part);
      if (!child) return null;
      current = child;
    }
    return current;
  }

  private _resolveParent(path: string): { parent: VFSNode; name: string } | null {
    const { parent, name } = splitPath(path);
    if (!name) return null;
    const parentNode = this._resolve(parent);
    if (!parentNode || parentNode.type !== 'folder') return null;
    return { parent: parentNode, name };
  }

  exists(path: string): boolean {
    return this._resolve(path) !== null;
  }

  stat(path: string): VFSStat {
    const node = this._resolve(path);
    if (!node) throw new Error(`stat: cannot stat '${path}': No such file or directory`);
    return {
      name: node.name,
      type: node.type,
      permissions: node.permissions,
      owner: node.owner,
      modified: node.modified,
      created: node.created,
      size: node.type === 'folder' ? (node.children?.size ?? 0) * 4096 : node.size,
    };
  }

  mkdir(path: string): void {
    const resolved = normalizePath(path);
    const info = this._resolveParent(resolved);
    if (!info) throw new Error(`mkdir: cannot create directory '${path}': No such file or directory`);
    if (info.parent.children!.has(info.name)) {
      throw new Error(`mkdir: cannot create directory '${path}': File exists`);
    }
    const node = createNode(info.name, 'folder');
    info.parent.children!.set(info.name, node);
    info.parent.modified = new Date();
  }

  mkdirp(path: string): void {
    const normalized = normalizePath(path);
    const parts = normalized.split('/').filter(Boolean);
    let current = this.root;
    for (const part of parts) {
      if (!current.children) throw new Error(`mkdirp: '${current.name}' is not a directory`);
      let child = current.children.get(part);
      if (!child) {
        child = createNode(part, 'folder');
        current.children.set(part, child);
        current.modified = new Date();
      }
      current = child;
    }
  }

  touch(path: string): void {
    const resolved = normalizePath(path);
    const existing = this._resolve(resolved);
    if (existing) {
      existing.modified = new Date();
      return;
    }
    const info = this._resolveParent(resolved);
    if (!info) throw new Error(`touch: cannot touch '${path}': No such file or directory`);
    const node = createNode(info.name, 'file', '');
    info.parent.children!.set(info.name, node);
    info.parent.modified = new Date();
  }

  writeFile(path: string, content: string): void {
    const resolved = normalizePath(path);
    const existing = this._resolve(resolved);
    if (existing) {
      if (existing.type === 'folder') throw new Error(`writeFile: '${path}' is a directory`);
      existing.content = content;
      existing.size = content.length;
      existing.modified = new Date();
      return;
    }
    const info = this._resolveParent(resolved);
    if (!info) throw new Error(`writeFile: cannot create '${path}': No such file or directory`);
    const node = createNode(info.name, 'file', content);
    node.size = content.length;
    info.parent.children!.set(info.name, node);
    info.parent.modified = new Date();
  }

  appendFile(path: string, content: string): void {
    const resolved = normalizePath(path);
    const existing = this._resolve(resolved);
    if (existing) {
      if (existing.type === 'folder') throw new Error(`appendFile: '${path}' is a directory`);
      existing.content = (existing.content || '') + content;
      existing.size = existing.content.length;
      existing.modified = new Date();
      return;
    }
    // If doesn't exist, create it
    this.writeFile(path, content);
  }

  readFile(path: string): string {
    const node = this._resolve(path);
    if (!node) throw new Error(`readFile: '${path}': No such file or directory`);
    if (node.type === 'folder') throw new Error(`readFile: '${path}': Is a directory`);
    return node.content ?? '';
  }

  readDir(path: string): VFSNode[] {
    const node = this._resolve(path);
    if (!node) throw new Error(`readDir: '${path}': No such file or directory`);
    if (node.type !== 'folder') throw new Error(`readDir: '${path}': Not a directory`);
    return Array.from(node.children?.values() ?? []);
  }

  readDirNames(path: string): string[] {
    return this.readDir(path).map(n => n.name);
  }

  rm(path: string, recursive = false): void {
    const resolved = normalizePath(path);
    if (resolved === '/') throw new Error("rm: cannot remove '/'");
    const info = this._resolveParent(resolved);
    if (!info) throw new Error(`rm: cannot remove '${path}': No such file or directory`);
    const target = info.parent.children!.get(info.name);
    if (!target) throw new Error(`rm: cannot remove '${path}': No such file or directory`);
    if (target.type === 'folder' && !recursive) {
      if (target.children && target.children.size > 0) {
        throw new Error(`rm: cannot remove '${path}': Directory not empty (use recursive)`);
      }
    }
    info.parent.children!.delete(info.name);
    info.parent.modified = new Date();
  }

  mv(src: string, dst: string): void {
    const srcResolved = normalizePath(src);
    const srcInfo = this._resolveParent(srcResolved);
    if (!srcInfo) throw new Error(`mv: cannot stat '${src}': No such file or directory`);
    const srcNode = srcInfo.parent.children!.get(srcInfo.name);
    if (!srcNode) throw new Error(`mv: cannot stat '${src}': No such file or directory`);

    const dstResolved = normalizePath(dst);
    const dstNode = this._resolve(dstResolved);

    if (dstNode && dstNode.type === 'folder') {
      // Move into the destination folder
      dstNode.children!.set(srcNode.name, srcNode);
      dstNode.modified = new Date();
    } else {
      // Rename or move to new name
      const dstInfo = this._resolveParent(dstResolved);
      if (!dstInfo) throw new Error(`mv: cannot move '${src}' to '${dst}': No such file or directory`);
      srcNode.name = dstInfo.name;
      dstInfo.parent.children!.set(dstInfo.name, srcNode);
      dstInfo.parent.modified = new Date();
    }

    srcInfo.parent.children!.delete(srcInfo.name);
    srcInfo.parent.modified = new Date();
  }

  cp(src: string, dst: string, recursive = false): void {
    const srcNode = this._resolve(src);
    if (!srcNode) throw new Error(`cp: cannot stat '${src}': No such file or directory`);
    if (srcNode.type === 'folder' && !recursive) {
      throw new Error(`cp: -r not specified; omitting directory '${src}'`);
    }

    const clone = this._cloneNode(srcNode);
    const dstResolved = normalizePath(dst);
    const dstNode = this._resolve(dstResolved);

    if (dstNode && dstNode.type === 'folder') {
      dstNode.children!.set(clone.name, clone);
      dstNode.modified = new Date();
    } else {
      const dstInfo = this._resolveParent(dstResolved);
      if (!dstInfo) throw new Error(`cp: cannot create '${dst}': No such file or directory`);
      clone.name = dstInfo.name;
      dstInfo.parent.children!.set(dstInfo.name, clone);
      dstInfo.parent.modified = new Date();
    }
  }

  private _cloneNode(node: VFSNode): VFSNode {
    const clone: VFSNode = {
      name: node.name,
      type: node.type,
      permissions: node.permissions,
      owner: node.owner,
      modified: new Date(),
      created: new Date(),
      size: node.size,
    };
    if (node.content !== undefined) clone.content = node.content;
    if (node.children) {
      clone.children = new Map();
      for (const [key, child] of node.children) {
        clone.children.set(key, this._cloneNode(child));
      }
    }
    return clone;
  }

  find(path: string, pattern: string): string[] {
    const results: string[] = [];
    const base = normalizePath(path);
    const node = this._resolve(base);
    if (!node) throw new Error(`find: '${path}': No such file or directory`);

    const walk = (n: VFSNode, currentPath: string) => {
      if (matchGlob(n.name, pattern)) {
        results.push(currentPath);
      }
      if (n.children) {
        for (const [, child] of n.children) {
          const childPath = currentPath === '/' ? `/${child.name}` : `${currentPath}/${child.name}`;
          walk(child, childPath);
        }
      }
    };

    walk(node, base);
    return results;
  }

  chmod(path: string, permissions: string): void {
    const node = this._resolve(path);
    if (!node) throw new Error(`chmod: cannot access '${path}': No such file or directory`);
    node.permissions = permissions;
    node.modified = new Date();
  }

  glob(pattern: string): string[] {
    // Simple glob expansion from root or cwd
    const results: string[] = [];
    const patternParts = pattern.split('/').filter(Boolean);

    const walk = (node: VFSNode, currentPath: string, depth: number) => {
      if (depth >= patternParts.length) {
        results.push(currentPath);
        return;
      }
      const pat = patternParts[depth];
      if (pat === '**') {
        // match zero or more directories
        walk(node, currentPath, depth + 1);
        if (node.children) {
          for (const [, child] of node.children) {
            const childPath = currentPath === '/' ? `/${child.name}` : `${currentPath}/${child.name}`;
            walk(child, childPath, depth); // stay at same pattern depth
          }
        }
      } else {
        if (node.children) {
          for (const [name, child] of node.children) {
            if (matchGlob(name, pat)) {
              const childPath = currentPath === '/' ? `/${child.name}` : `${currentPath}/${child.name}`;
              if (depth === patternParts.length - 1) {
                results.push(childPath);
              } else {
                walk(child, childPath, depth + 1);
              }
            }
          }
        }
      }
    };

    walk(this.root, '/', 0);
    return results;
  }

  // Expand globs relative to a directory
  expandGlob(cwd: string, pattern: string): string[] {
    if (pattern.startsWith('/')) {
      return this.glob(pattern);
    }
    // Relative pattern: expand from cwd
    const base = this._resolve(cwd);
    if (!base || base.type !== 'folder') return [];

    const results: string[] = [];
    const patternParts = pattern.split('/').filter(Boolean);

    const walk = (node: VFSNode, currentPath: string, depth: number) => {
      if (depth >= patternParts.length) {
        results.push(currentPath);
        return;
      }
      const pat = patternParts[depth];
      if (node.children) {
        for (const [name, child] of node.children) {
          if (matchGlob(name, pat)) {
            const childPath = currentPath ? `${currentPath}/${child.name}` : child.name;
            if (depth === patternParts.length - 1) {
              results.push(childPath);
            } else {
              walk(child, childPath, depth + 1);
            }
          }
        }
      }
    };

    walk(base, '', 0);
    return results;
  }

  // Get the node's full path for display
  getNode(path: string): VFSNode | null {
    return this._resolve(path);
  }

  // Tree display helper
  tree(path: string, prefix = '', isLast = true): string {
    const node = this._resolve(path);
    if (!node) return `${path}: No such file or directory`;
    const lines: string[] = [];
    this._tree(node, path, '', true, lines, 0);
    return lines.join('\n');
  }

  private _tree(node: VFSNode, path: string, prefix: string, isRoot: boolean, lines: string[], depth: number): void {
    if (depth > 10) return; // prevent infinite recursion
    if (isRoot) {
      lines.push(path);
    }
    if (node.children) {
      const entries = Array.from(node.children.values());
      entries.forEach((child, i) => {
        const isLast = i === entries.length - 1;
        const connector = isLast ? '\u2514\u2500\u2500 ' : '\u251c\u2500\u2500 ';
        const name = child.type === 'folder' ? child.name + '/' : child.name;
        lines.push(prefix + connector + name);
        if (child.type === 'folder') {
          const newPrefix = prefix + (isLast ? '    ' : '\u2502   ');
          this._tree(child, '', newPrefix, false, lines, depth + 1);
        }
      });
    }
  }

  // Du helper: return total size recursively
  du(path: string): number {
    const node = this._resolve(path);
    if (!node) throw new Error(`du: cannot access '${path}': No such file or directory`);
    return this._duNode(node);
  }

  private _duNode(node: VFSNode): number {
    if (node.type === 'file') return node.size;
    let total = 4096; // directory overhead
    if (node.children) {
      for (const [, child] of node.children) {
        total += this._duNode(child);
      }
    }
    return total;
  }

  // Resolve a path that might be relative to cwd
  resolvePath(cwd: string, path: string): string {
    if (path.startsWith('/')) return normalizePath(path);
    if (path === '~' || path.startsWith('~/')) {
      return normalizePath('/home/kasm-user' + path.substring(1));
    }
    return normalizePath(cwd + '/' + path);
  }

  // Pre-populate with realistic filesystem
  private _populate(): void {
    const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);

    // /home/kasm-user structure
    this.mkdirp('/home/kasm-user/Documents');
    this.mkdirp('/home/kasm-user/Pictures');
    this.mkdirp('/home/kasm-user/Downloads');
    this.mkdirp('/home/kasm-user/Projects/kasm-ui');
    this.mkdirp('/home/kasm-user/Projects/website/src');
    this.mkdirp('/home/kasm-user/Music');
    this.mkdirp('/home/kasm-user/.config/kasm');
    this.mkdirp('/home/kasm-user/.config/nvim');
    this.mkdirp('/usr/bin');
    this.mkdirp('/usr/lib');
    this.mkdirp('/etc');
    this.mkdirp('/tmp');
    this.mkdirp('/var/log');

    // Documents
    this._writeWithMeta('/home/kasm-user/Documents/report.txt',
`Quarterly Report - Q1 2026
===========================

Revenue: $2.4M (+12% YoY)
Active Users: 48,000
New Features Shipped: 14

Key Highlights:
- Launched VFS-based file manager
- Terminal emulator with full shell support
- Improved window management with snap zones
- 99.97% uptime achieved

Next Quarter Goals:
- Multi-user collaboration features
- Plugin marketplace
- Mobile responsive layout
`, d(2026, 3, 15));

    this._writeWithMeta('/home/kasm-user/Documents/notes.txt',
`Meeting Notes - March 2026
--------------------------
- Review UI component library
- Finalize theming system
- Test drag and drop between windows
- Performance audit on window rendering
- Ship terminal v2 with pipe support
`, d(2026, 3, 12));

    this._writeWithMeta('/home/kasm-user/Documents/budget.csv',
`Category,Amount,Status
Engineering,450000,Approved
Marketing,120000,Pending
Infrastructure,280000,Approved
Design,95000,Approved
QA,110000,Pending
`, d(2026, 3, 8));

    this._writeWithMeta('/home/kasm-user/Documents/todo.txt',
`TODO List
=========
[x] Set up project repository
[x] Implement window manager
[x] Create file manager app
[ ] Add drag-and-drop support
[ ] Implement clipboard manager
[ ] Write unit tests
[ ] Performance optimization pass
[ ] Accessibility audit
`, d(2026, 3, 14));

    // Pictures
    this._writeWithMeta('/home/kasm-user/Pictures/screenshot.png', '[PNG image data, 1920x1080, 8-bit/color RGBA]', d(2026, 3, 14));
    this._writeWithMeta('/home/kasm-user/Pictures/wallpaper.jpg', '[JPEG image data, 3840x2160, progressive]', d(2026, 2, 20));
    this._writeWithMeta('/home/kasm-user/Pictures/logo.svg',
`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="20" fill="#6c5ce7"/>
  <text x="50" y="65" text-anchor="middle" fill="white" font-size="40" font-weight="bold">K</text>
</svg>`, d(2026, 3, 1));

    // Downloads
    this._writeWithMeta('/home/kasm-user/Downloads/setup.sh',
`#!/bin/bash
# Kasm UI Development Setup
set -e

echo "Installing dependencies..."
npm install

echo "Building project..."
npm run build

echo "Setup complete!"
`, d(2026, 3, 17));
    this.chmod('/home/kasm-user/Downloads/setup.sh', '-rwxr-xr-x');

    this._writeWithMeta('/home/kasm-user/Downloads/data.json',
`{
  "version": "2.0.0",
  "entries": [
    { "id": 1, "name": "Alpha", "status": "active" },
    { "id": 2, "name": "Beta", "status": "testing" },
    { "id": 3, "name": "Gamma", "status": "active" }
  ],
  "metadata": {
    "generated": "2026-03-17",
    "format": "json"
  }
}`, d(2026, 3, 17));

    this._writeWithMeta('/home/kasm-user/Downloads/archive.tar.gz', '[gzip compressed data, from Unix, original size 2048000]', d(2026, 3, 16));

    // Projects/kasm-ui
    this._writeWithMeta('/home/kasm-user/Projects/kasm-ui/package.json',
`{
  "name": "kasm-ui",
  "version": "1.0.0",
  "description": "A bleeding-edge React desktop environment",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "lint": "eslint . --ext ts,tsx",
    "test": "vitest",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.2.4",
    "react-dom": "^19.2.4",
    "zustand": "^5.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "typescript": "^5.9.0",
    "vite": "^7.2.0",
    "vitest": "^3.0.0"
  }
}`, d(2026, 3, 17));

    this._writeWithMeta('/home/kasm-user/Projects/kasm-ui/tsconfig.json',
`{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "jsx": "react-jsx",
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}`, d(2026, 3, 10));

    this._writeWithMeta('/home/kasm-user/Projects/kasm-ui/README.md',
`# Kasm UI

A bleeding-edge React desktop environment built with:
- React 19 + TypeScript 5.9
- Vite 7 for blazing fast HMR
- Zustand for state management
- Custom window manager with snap zones

## Getting Started

\`\`\`bash
npm install
npm run dev
\`\`\`

## Architecture

- \`/src/core\` - Window manager, theming, state
- \`/src/apps\` - Built-in applications
- \`/src/shell\` - Panel, taskbar, system tray
\`\`\`
`, d(2026, 3, 10));

    this._writeWithMeta('/home/kasm-user/Projects/kasm-ui/Makefile',
`# Kasm UI Makefile

.PHONY: all build clean dev test

all: build

build:
\tnpm run build

dev:
\tnpm run dev

test:
\tnpm run test

clean:
\trm -rf dist node_modules/.cache

lint:
\tnpm run lint
`, d(2026, 3, 5));

    // Projects/website
    this._writeWithMeta('/home/kasm-user/Projects/website/index.html',
`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kasm Technologies</title>
  <link rel="stylesheet" href="src/style.css">
</head>
<body>
  <div id="app"></div>
  <script type="module" src="src/main.ts"></script>
</body>
</html>`, d(2026, 3, 10));

    this._writeWithMeta('/home/kasm-user/Projects/website/src/style.css',
`* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: system-ui, sans-serif; background: #0a0a1a; color: #e0e0e0; }
.container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
h1 { font-size: 3rem; margin-bottom: 1rem; }
`, d(2026, 3, 8));

    // Music
    this._writeWithMeta('/home/kasm-user/Music/playlist.m3u',
`#EXTM3U
#EXTINF:240,Artist - Track One
music/track01.mp3
#EXTINF:195,Artist - Track Two
music/track02.mp3
#EXTINF:312,Artist - Track Three
music/track03.mp3
`, d(2026, 2, 20));

    // .config
    this._writeWithMeta('/home/kasm-user/.config/kasm/settings.json',
`{
  "theme": "kasm-dark",
  "panelPosition": "bottom",
  "panelHeight": 48,
  "workspaces": 4,
  "animations": true,
  "fontSize": 13,
  "fontFamily": "Inter, system-ui, sans-serif"
}`, d(2026, 3, 1));

    this._writeWithMeta('/home/kasm-user/.config/kasm/keybindings.json',
`{
  "Super_L": "toggle-app-menu",
  "Alt+Tab": "switch-window",
  "Alt+F4": "close-window",
  "Super+D": "show-desktop",
  "Super+L": "lock-screen",
  "Ctrl+Alt+T": "open-terminal"
}`, d(2026, 3, 1));

    this._writeWithMeta('/home/kasm-user/.config/nvim/init.lua',
`-- Neovim configuration
vim.o.number = true
vim.o.relativenumber = true
vim.o.tabstop = 2
vim.o.shiftwidth = 2
vim.o.expandtab = true
vim.o.termguicolors = true
vim.o.signcolumn = "yes"
vim.g.mapleader = " "
`, d(2026, 2, 15));

    // Root-level home file
    this._writeWithMeta('/home/kasm-user/.bashrc',
`# ~/.bashrc
export PATH="$HOME/.local/bin:$PATH"
export EDITOR=nvim
export TERM=xterm-256color

alias ll='ls -la'
alias gs='git status'
alias gd='git diff'

PS1='\\[\\033[01;32m\\]\\u@kasm-desktop\\[\\033[00m\\]:\\[\\033[01;34m\\]\\w\\[\\033[00m\\]\\$ '
`, d(2026, 2, 10));

    this._writeWithMeta('/home/kasm-user/.profile',
`# ~/.profile
if [ -f "$HOME/.bashrc" ]; then
  . "$HOME/.bashrc"
fi
`, d(2026, 1, 15));

    // /etc files
    this._writeWithMeta('/etc/hostname', 'kasm-desktop\n', d(2026, 1, 1));
    this._writeWithMeta('/etc/os-release',
`NAME="KasmOS"
VERSION="1.0.0"
ID=kasmos
PRETTY_NAME="KasmOS 1.0.0"
HOME_URL="https://kasmweb.com"
`, d(2026, 1, 1));
    this._writeWithMeta('/etc/passwd',
`root:x:0:0:root:/root:/bin/bash
kasm-user:x:1000:1000:Kasm User:/home/kasm-user:/bin/bash
`, d(2026, 1, 1));

    // /var/log
    this._writeWithMeta('/var/log/syslog',
`Mar 17 08:00:01 kasm-desktop systemd[1]: Started Session Manager
Mar 17 08:00:02 kasm-desktop kasm-wm[512]: Window manager initialized
Mar 17 08:00:02 kasm-desktop kasm-panel[513]: Panel loaded with 6 applets
Mar 17 08:00:03 kasm-desktop kasm-apps[514]: App registry: 8 apps registered
Mar 17 08:00:05 kasm-desktop kasm-desktop[1]: Desktop ready
`, d(2026, 3, 17));

    // /usr/bin "executables"
    const bins = ['ls', 'cat', 'grep', 'find', 'chmod', 'mkdir', 'rm', 'cp', 'mv', 'echo', 'date', 'whoami', 'uname', 'bash', 'sh', 'node', 'npm', 'git', 'vim', 'nvim', 'python3', 'curl', 'wget'];
    for (const bin of bins) {
      this._writeWithMeta(`/usr/bin/${bin}`, `#!/bin/bash\n# ${bin} binary stub`, d(2026, 1, 1));
      this.chmod(`/usr/bin/${bin}`, '-rwxr-xr-x');
    }
  }

  private _writeWithMeta(path: string, content: string, modified: Date): void {
    this.writeFile(path, content);
    const node = this._resolve(path);
    if (node) {
      node.modified = modified;
      node.created = modified;
    }
  }

  // === OPFS Persistence: survive page navigation ===

  async persistToOPFS(): Promise<void> {
    try {
      const root = await navigator.storage.getDirectory();
      const fileHandle = await root.getFileHandle('kasm-vfs.json', { create: true });
      const writable = await (fileHandle as any).createWritable();
      const data = this._serializeTree(this.root);
      await writable.write(JSON.stringify(data));
      await writable.close();
    } catch (err) {
      console.warn('OPFS persist failed:', err);
    }
  }

  async restoreFromOPFS(): Promise<boolean> {
    try {
      const root = await navigator.storage.getDirectory();
      const fileHandle = await root.getFileHandle('kasm-vfs.json');
      const file = await fileHandle.getFile();
      const text = await file.text();
      const data = JSON.parse(text);
      this._deserializeTree(data, this.root);
      return true;
    } catch {
      return false; // no saved state or parse error
    }
  }

  private _serializeTree(node: VFSNode): any {
    const obj: any = {
      n: node.name,
      t: node.type,
      p: node.permissions,
      o: node.owner,
      m: node.modified.toISOString(),
      c: node.created.toISOString(),
      s: node.size,
    };
    if (node.content !== undefined) obj.d = node.content;
    if (node.children && node.children.size > 0) {
      obj.ch = {};
      for (const [name, child] of node.children) {
        obj.ch[name] = this._serializeTree(child);
      }
    }
    return obj;
  }

  private _deserializeTree(data: any, target: VFSNode): void {
    if (!data.ch) return;
    if (!target.children) target.children = new Map();

    for (const [name, childData] of Object.entries<any>(data.ch)) {
      const node: VFSNode = {
        name: childData.n || name,
        type: childData.t || 'file',
        permissions: childData.p || '-rw-r--r--',
        owner: childData.o || 'kasm-user',
        modified: new Date(childData.m || Date.now()),
        created: new Date(childData.c || Date.now()),
        size: childData.s || 0,
      };
      if (childData.d !== undefined) node.content = childData.d;
      if (childData.t === 'folder') {
        node.children = new Map();
        this._deserializeTree(childData, node);
      }
      target.children.set(name, node);
    }
  }

  /** Start auto-persist: debounced save to OPFS on any mutation */
  startAutoPersist(intervalMs = 5000): () => void {
    const timer = setInterval(() => this.persistToOPFS(), intervalMs);
    // Also persist on page unload
    const beforeUnload = () => {
      // Use sync-ish approach: write to localStorage as fallback
      try {
        const data = this._serializeTree(this.root);
        localStorage.setItem('kasm-vfs-emergency', JSON.stringify(data));
      } catch {}
    };
    window.addEventListener('beforeunload', beforeUnload);

    return () => {
      clearInterval(timer);
      window.removeEventListener('beforeunload', beforeUnload);
    };
  }

  /** Restore from OPFS or localStorage emergency backup */
  async restoreState(): Promise<boolean> {
    // Try OPFS first
    const opfsOk = await this.restoreFromOPFS();
    if (opfsOk) return true;

    // Try localStorage emergency backup
    try {
      const raw = localStorage.getItem('kasm-vfs-emergency');
      if (raw) {
        const data = JSON.parse(raw);
        this._deserializeTree(data, this.root);
        localStorage.removeItem('kasm-vfs-emergency');
        return true;
      }
    } catch {}

    return false;
  }
}

// Singleton export
export const vfs = new VirtualFS();
