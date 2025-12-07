/**
 * DependencyManager - Gestion des dépendances pour les routes API
 * Détecte, installe et gère les packages npm et pip
 */

import { spawn } from 'child_process';

// Instance Prisma partagée (sera initialisée via setPrisma)
let prisma = null;

/**
 * Configure l'instance Prisma à utiliser
 * @param {PrismaClient} prismaInstance - Instance Prisma du serveur
 */
export function setPrisma(prismaInstance) {
  prisma = prismaInstance;
}

/**
 * Vérifie que Prisma est initialisé
 */
function ensurePrisma() {
  if (!prisma) {
    throw new Error('DependencyManager: Prisma non initialisé. Appelez setPrisma() d\'abord.');
  }
}

/**
 * Détecte les imports/require dans du code JavaScript
 */
function detectJsImports(code) {
  const imports = new Set();
  
  // require('package') ou require("package")
  const requireRegex = /require\s*\(\s*['"]([^'"./][^'"]*)['"]\s*\)/g;
  let match;
  while ((match = requireRegex.exec(code)) !== null) {
    // Prendre seulement le nom du package (pas le sous-chemin)
    const pkg = match[1].split('/')[0];
    if (!isBuiltinModule(pkg)) {
      imports.add(pkg);
    }
  }
  
  // import ... from 'package'
  const importRegex = /import\s+.*?\s+from\s+['"]([^'"./][^'"]*)['"]/g;
  while ((match = importRegex.exec(code)) !== null) {
    const pkg = match[1].split('/')[0];
    if (!isBuiltinModule(pkg)) {
      imports.add(pkg);
    }
  }
  
  // import 'package'
  const importDirectRegex = /import\s+['"]([^'"./][^'"]*)['"]/g;
  while ((match = importDirectRegex.exec(code)) !== null) {
    const pkg = match[1].split('/')[0];
    if (!isBuiltinModule(pkg)) {
      imports.add(pkg);
    }
  }
  
  return Array.from(imports);
}

/**
 * Détecte les imports dans du code Python
 */
function detectPythonImports(code) {
  const imports = new Set();
  
  // Normaliser les retours à la ligne
  const normalizedCode = code.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  // import package ou import package.submodule
  const importRegex = /(?:^|\n)\s*import\s+(\w+)/g;
  let match;
  while ((match = importRegex.exec(normalizedCode)) !== null) {
    if (!isBuiltinPythonModule(match[1])) {
      imports.add(match[1]);
    }
  }
  
  // from package import ...
  const fromImportRegex = /(?:^|\n)\s*from\s+(\w+)/g;
  while ((match = fromImportRegex.exec(normalizedCode)) !== null) {
    if (!isBuiltinPythonModule(match[1])) {
      imports.add(match[1]);
    }
  }
  
  return Array.from(imports);
}

/**
 * Modules Node.js intégrés (pas besoin d'installation)
 */
function isBuiltinModule(name) {
  const builtins = [
    'assert', 'buffer', 'child_process', 'cluster', 'console', 'constants',
    'crypto', 'dgram', 'dns', 'domain', 'events', 'fs', 'http', 'https',
    'module', 'net', 'os', 'path', 'perf_hooks', 'process', 'punycode',
    'querystring', 'readline', 'repl', 'stream', 'string_decoder', 'sys',
    'timers', 'tls', 'tty', 'url', 'util', 'v8', 'vm', 'wasi', 'worker_threads', 'zlib'
  ];
  return builtins.includes(name);
}

/**
 * Modules Python intégrés (pas besoin d'installation)
 */
function isBuiltinPythonModule(name) {
  const builtins = [
    'abc', 'aifc', 'argparse', 'array', 'ast', 'asynchat', 'asyncio', 'asyncore',
    'atexit', 'audioop', 'base64', 'bdb', 'binascii', 'binhex', 'bisect',
    'builtins', 'bz2', 'calendar', 'cgi', 'cgitb', 'chunk', 'cmath', 'cmd',
    'code', 'codecs', 'codeop', 'collections', 'colorsys', 'compileall',
    'concurrent', 'configparser', 'contextlib', 'contextvars', 'copy', 'copyreg',
    'cProfile', 'crypt', 'csv', 'ctypes', 'curses', 'dataclasses', 'datetime',
    'dbm', 'decimal', 'difflib', 'dis', 'distutils', 'doctest', 'email',
    'encodings', 'enum', 'errno', 'faulthandler', 'fcntl', 'filecmp', 'fileinput',
    'fnmatch', 'fractions', 'ftplib', 'functools', 'gc', 'getopt', 'getpass',
    'gettext', 'glob', 'graphlib', 'grp', 'gzip', 'hashlib', 'heapq', 'hmac',
    'html', 'http', 'idlelib', 'imaplib', 'imghdr', 'imp', 'importlib', 'inspect',
    'io', 'ipaddress', 'itertools', 'json', 'keyword', 'lib2to3', 'linecache',
    'locale', 'logging', 'lzma', 'mailbox', 'mailcap', 'marshal', 'math',
    'mimetypes', 'mmap', 'modulefinder', 'multiprocessing', 'netrc', 'nis',
    'nntplib', 'numbers', 'operator', 'optparse', 'os', 'ossaudiodev', 'pathlib',
    'pdb', 'pickle', 'pickletools', 'pipes', 'pkgutil', 'platform', 'plistlib',
    'poplib', 'posix', 'posixpath', 'pprint', 'profile', 'pstats', 'pty', 'pwd',
    'py_compile', 'pyclbr', 'pydoc', 'queue', 'quopri', 'random', 're', 'readline',
    'reprlib', 'resource', 'rlcompleter', 'runpy', 'sched', 'secrets', 'select',
    'selectors', 'shelve', 'shlex', 'shutil', 'signal', 'site', 'smtpd', 'smtplib',
    'sndhdr', 'socket', 'socketserver', 'spwd', 'sqlite3', 'ssl', 'stat',
    'statistics', 'string', 'stringprep', 'struct', 'subprocess', 'sunau',
    'symtable', 'sys', 'sysconfig', 'syslog', 'tabnanny', 'tarfile', 'telnetlib',
    'tempfile', 'termios', 'test', 'textwrap', 'threading', 'time', 'timeit',
    'tkinter', 'token', 'tokenize', 'trace', 'traceback', 'tracemalloc', 'tty',
    'turtle', 'turtledemo', 'types', 'typing', 'unicodedata', 'unittest', 'urllib',
    'uu', 'uuid', 'venv', 'warnings', 'wave', 'weakref', 'webbrowser', 'winreg',
    'winsound', 'wsgiref', 'xdrlib', 'xml', 'xmlrpc', 'zipapp', 'zipfile', 'zipimport', 'zlib'
  ];
  return builtins.includes(name);
}

/**
 * Détecte les dépendances dans du code selon le langage
 */
export function detectDependencies(code, language) {
  switch (language.toLowerCase()) {
    case 'javascript':
    case 'js':
      return { language: 'javascript', packages: detectJsImports(code) };
    case 'python':
    case 'py':
      return { language: 'python', packages: detectPythonImports(code) };
    default:
      return { language, packages: [] };
  }
}

/**
 * Installe un package npm
 * Timeout de 120 secondes pour éviter les blocages
 * Compatible Windows, Linux, Mac
 */
async function installNpmPackage(packageName) {
  return new Promise((resolve, reject) => {
    const isWindows = process.platform === 'win32';
    
    // Sur Windows avec shell:true, pnpm fonctionne directement
    const child = spawn('pnpm', ['add', packageName], {
      cwd: process.cwd(),
      shell: isWindows, // shell:true sur Windows, false sur Unix
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    let stdout = '';
    let stderr = '';
    let killed = false;
    
    // Timeout de 120 secondes (les installations peuvent être lentes)
    const timeout = setTimeout(() => {
      killed = true;
      child.kill('SIGTERM');
      reject(new Error(`Timeout: l'installation de ${packageName} a pris trop de temps (>120s)`));
    }, 120000);
    
    child.stdout.on('data', (data) => { stdout += data.toString(); });
    child.stderr.on('data', (data) => { stderr += data.toString(); });
    
    child.on('close', (code) => {
      clearTimeout(timeout);
      if (killed) return;
      
      if (code === 0) {
        resolve({ success: true, output: stdout });
      } else {
        reject(new Error(stderr || stdout || `Exit code: ${code}`));
      }
    });
    
    child.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

/**
 * Désinstalle un package npm
 * Timeout de 60 secondes
 * Compatible Windows, Linux, Mac
 */
async function uninstallNpmPackage(packageName) {
  return new Promise((resolve, reject) => {
    const isWindows = process.platform === 'win32';
    
    const child = spawn('pnpm', ['remove', packageName], {
      cwd: process.cwd(),
      shell: isWindows,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    let stdout = '';
    let stderr = '';
    let killed = false;
    
    // Timeout de 60 secondes
    const timeout = setTimeout(() => {
      killed = true;
      child.kill('SIGTERM');
      reject(new Error(`Timeout: la désinstallation de ${packageName} a pris trop de temps (>60s)`));
    }, 60000);
    
    child.stdout.on('data', (data) => { stdout += data.toString(); });
    child.stderr.on('data', (data) => { stderr += data.toString(); });
    
    child.on('close', (code) => {
      clearTimeout(timeout);
      if (killed) return;
      
      if (code === 0) {
        resolve({ success: true, output: stdout });
      } else {
        reject(new Error(stderr || stdout || `Exit code: ${code}`));
      }
    });
    
    child.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

/**
 * Installe un package pip
 * Timeout de 120 secondes
 * Compatible Windows, Linux, Mac
 */
async function installPipPackage(packageName) {
  const pythonPath = process.env.PYTHON_PATH || 'python';
  const isWindows = process.platform === 'win32';
  
  return new Promise((resolve, reject) => {
    const child = spawn(pythonPath, ['-m', 'pip', 'install', packageName], {
      shell: isWindows,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    let stdout = '';
    let stderr = '';
    let killed = false;
    
    // Timeout de 120 secondes
    const timeout = setTimeout(() => {
      killed = true;
      child.kill('SIGTERM');
      reject(new Error(`Timeout: l'installation de ${packageName} a pris trop de temps (>120s)`));
    }, 120000);
    
    child.stdout.on('data', (data) => { stdout += data.toString(); });
    child.stderr.on('data', (data) => { stderr += data.toString(); });
    
    child.on('close', (code) => {
      clearTimeout(timeout);
      if (killed) return;
      
      if (code === 0) {
        resolve({ success: true, output: stdout });
      } else {
        reject(new Error(stderr || stdout || `Exit code: ${code}`));
      }
    });
    
    child.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

/**
 * Désinstalle un package pip
 * Timeout de 60 secondes
 * Compatible Windows, Linux, Mac
 */
async function uninstallPipPackage(packageName) {
  const pythonPath = process.env.PYTHON_PATH || 'python';
  const isWindows = process.platform === 'win32';
  
  return new Promise((resolve, reject) => {
    const child = spawn(pythonPath, ['-m', 'pip', 'uninstall', '-y', packageName], {
      shell: isWindows,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    let stdout = '';
    let stderr = '';
    let killed = false;
    
    // Timeout de 60 secondes
    const timeout = setTimeout(() => {
      killed = true;
      child.kill('SIGTERM');
      reject(new Error(`Timeout: la désinstallation de ${packageName} a pris trop de temps (>60s)`));
    }, 60000);
    
    child.stdout.on('data', (data) => { stdout += data.toString(); });
    child.stderr.on('data', (data) => { stderr += data.toString(); });
    
    child.on('close', (code) => {
      clearTimeout(timeout);
      if (killed) return;
      
      if (code === 0) {
        resolve({ success: true, output: stdout });
      } else {
        reject(new Error(stderr || stdout || `Exit code: ${code}`));
      }
    });
    
    child.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

/**
 * Installe une dépendance
 */
export async function installDependency(name, language) {
  ensurePrisma();
  
  try {
    if (language === 'javascript') {
      await installNpmPackage(name);
    } else if (language === 'python') {
      await installPipPackage(name);
    } else {
      throw new Error(`Langage non supporté: ${language}`);
    }
    
    // Enregistrer en base
    const dep = await prisma.dependency.upsert({
      where: { name_language: { name, language } },
      create: { name, language, version: 'latest' },
      update: { updatedAt: new Date() }
    });
    
    return { success: true, dependency: dep };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Désinstalle une dépendance
 */
export async function uninstallDependency(name, language) {
  ensurePrisma();
  
  try {
    if (language === 'javascript') {
      await uninstallNpmPackage(name);
    } else if (language === 'python') {
      await uninstallPipPackage(name);
    } else {
      throw new Error(`Langage non supporté: ${language}`);
    }
    
    // Supprimer de la base
    await prisma.dependency.deleteMany({
      where: { name, language }
    });
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Met à jour les dépendances utilisées par une route
 */
export async function updateRouteDependencies(routeId, code, language) {
  ensurePrisma();
  
  const { packages } = detectDependencies(code, language);
  
  // Pour chaque dépendance détectée
  for (const pkg of packages) {
    const existing = await prisma.dependency.findUnique({
      where: { name_language: { name: pkg, language } }
    });
    
    if (existing) {
      // Ajouter cette route à la liste des utilisateurs
      const usedBy = existing.usedBy ? existing.usedBy.split(',').filter(Boolean) : [];
      if (!usedBy.includes(routeId)) {
        usedBy.push(routeId);
        await prisma.dependency.update({
          where: { id: existing.id },
          data: { usedBy: usedBy.join(',') }
        });
      }
    }
  }
  
  return packages;
}

/**
 * Retire une route des utilisateurs d'une dépendance
 */
export async function removeRouteFromDependencies(routeId) {
  ensurePrisma();
  
  const dependencies = await prisma.dependency.findMany();
  
  for (const dep of dependencies) {
    const usedBy = dep.usedBy ? dep.usedBy.split(',').filter(Boolean) : [];
    const index = usedBy.indexOf(routeId);
    
    if (index > -1) {
      usedBy.splice(index, 1);
      await prisma.dependency.update({
        where: { id: dep.id },
        data: { usedBy: usedBy.join(',') }
      });
    }
  }
}

/**
 * Liste toutes les dépendances installées
 */
export async function listDependencies() {
  ensurePrisma();
  
  return prisma.dependency.findMany({
    orderBy: { name: 'asc' }
  });
}

/**
 * Nettoie les dépendances non utilisées
 */
export async function cleanUnusedDependencies() {
  ensurePrisma();
  
  const dependencies = await prisma.dependency.findMany();
  const removed = [];
  
  for (const dep of dependencies) {
    const usedBy = dep.usedBy ? dep.usedBy.split(',').filter(Boolean) : [];
    
    if (usedBy.length === 0) {
      // Désinstaller et supprimer
      try {
        await uninstallDependency(dep.name, dep.language);
        removed.push(dep.name);
      } catch (e) {
        console.error(`Erreur lors de la suppression de ${dep.name}:`, e.message);
      }
    }
  }
  
  return removed;
}

export default {
  setPrisma,
  detectDependencies,
  installDependency,
  uninstallDependency,
  updateRouteDependencies,
  removeRouteFromDependencies,
  listDependencies,
  cleanUnusedDependencies
};

