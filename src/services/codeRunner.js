/**
 * CodeRunner - Service d'exécution de code multi-langages
 * Supporte: JavaScript, Python, Bash
 */

import { spawn } from 'child_process';
import { writeFileSync, unlinkSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Dossier temporaire pour les scripts
const tempDir = join(__dirname, '../../.temp');
if (!existsSync(tempDir)) {
  mkdirSync(tempDir, { recursive: true });
}

/**
 * Timeout par défaut pour l'exécution de code (5 secondes)
 */
const DEFAULT_TIMEOUT = parseInt(process.env.CODE_TIMEOUT || '5000');

/**
 * Exécute du code JavaScript de manière isolée
 */
async function runJavaScript(code, context, timeout = DEFAULT_TIMEOUT) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    
    // Créer un wrapper pour le code
    const wrappedCode = `
      const context = ${JSON.stringify(context)};
      const { request, params, query, body, headers } = context;
      
      // Fonction pour retourner une réponse
      let __response = { status: 200, body: null, headers: {} };
      
      function respond(data, status = 200, headers = {}) {
        __response = { status, body: data, headers };
      }
      
      function json(data, status = 200) {
        respond(data, status, { 'Content-Type': 'application/json' });
      }
      
      // Exécuter le code utilisateur
      try {
        ${code}
      } catch (error) {
        __response = { 
          status: 500, 
          body: { error: error.message },
          headers: { 'Content-Type': 'application/json' }
        };
      }
      
      // Afficher le résultat pour capture
      console.log('__RESULT__' + JSON.stringify(__response));
    `;
    
    const tempFile = join(tempDir, `js_${randomBytes(8).toString('hex')}.js`);
    writeFileSync(tempFile, wrappedCode);
    
    const child = spawn('node', [tempFile], {
      timeout,
      env: { ...process.env, NODE_ENV: 'sandbox' }
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    child.on('close', (code) => {
      // Nettoyer le fichier temporaire
      try { unlinkSync(tempFile); } catch (e) {}
      
      const executionTime = Date.now() - startTime;
      
      // Extraire le résultat
      const resultMatch = stdout.match(/__RESULT__(.+)$/m);
      
      if (resultMatch) {
        try {
          const result = JSON.parse(resultMatch[1]);
          resolve({
            success: true,
            ...result,
            executionTime,
            logs: stdout.replace(/__RESULT__.+$/m, '').trim()
          });
        } catch (e) {
          resolve({
            success: false,
            status: 500,
            body: { error: 'Erreur de parsing du résultat' },
            executionTime
          });
        }
      } else if (stderr) {
        resolve({
          success: false,
          status: 500,
          body: { error: stderr.trim() },
          executionTime
        });
      } else {
        resolve({
          success: true,
          status: 200,
          body: stdout.trim() || null,
          executionTime
        });
      }
    });
    
    child.on('error', (error) => {
      try { unlinkSync(tempFile); } catch (e) {}
      resolve({
        success: false,
        status: 500,
        body: { error: error.message },
        executionTime: Date.now() - startTime
      });
    });
    
    // Timeout manuel
    setTimeout(() => {
      child.kill('SIGTERM');
    }, timeout);
  });
}

/**
 * Exécute du code Python
 */
async function runPython(code, context, timeout = DEFAULT_TIMEOUT) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const pythonPath = process.env.PYTHON_PATH || 'python';
    
    // Créer un wrapper pour le code Python
    const wrappedCode = `
import json
import sys

context = json.loads('''${JSON.stringify(context)}''')
request = context.get('request', {})
params = context.get('params', {})
query = context.get('query', {})
body = context.get('body', {})
headers = context.get('headers', {})

__response = {'status': 200, 'body': None, 'headers': {}}

def respond(data, status=200, headers={}):
    global __response
    __response = {'status': status, 'body': data, 'headers': headers}

def json_response(data, status=200):
    respond(data, status, {'Content-Type': 'application/json'})

try:
${code.split('\n').map(line => '    ' + line).join('\n')}
except Exception as e:
    __response = {'status': 500, 'body': {'error': str(e)}, 'headers': {'Content-Type': 'application/json'}}

print('__RESULT__' + json.dumps(__response))
`;
    
    const tempFile = join(tempDir, `py_${randomBytes(8).toString('hex')}.py`);
    writeFileSync(tempFile, wrappedCode);
    
    const child = spawn(pythonPath, [tempFile], { timeout });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    child.on('close', (code) => {
      try { unlinkSync(tempFile); } catch (e) {}
      
      const executionTime = Date.now() - startTime;
      const resultMatch = stdout.match(/__RESULT__(.+)$/m);
      
      if (resultMatch) {
        try {
          const result = JSON.parse(resultMatch[1]);
          resolve({
            success: true,
            ...result,
            executionTime,
            logs: stdout.replace(/__RESULT__.+$/m, '').trim()
          });
        } catch (e) {
          resolve({
            success: false,
            status: 500,
            body: { error: 'Erreur de parsing du résultat' },
            executionTime
          });
        }
      } else if (stderr) {
        resolve({
          success: false,
          status: 500,
          body: { error: stderr.trim() },
          executionTime
        });
      } else {
        resolve({
          success: true,
          status: 200,
          body: stdout.trim() || null,
          executionTime
        });
      }
    });
    
    child.on('error', (error) => {
      try { unlinkSync(tempFile); } catch (e) {}
      resolve({
        success: false,
        status: 500,
        body: { error: `Python non disponible: ${error.message}` },
        executionTime: Date.now() - startTime
      });
    });
    
    setTimeout(() => {
      child.kill('SIGTERM');
    }, timeout);
  });
}

/**
 * Exécute du code Bash/Shell
 */
async function runBash(code, context, timeout = DEFAULT_TIMEOUT) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    
    // Variables d'environnement pour le script
    const env = {
      ...process.env,
      REQUEST_METHOD: context.request?.method || 'GET',
      REQUEST_PATH: context.request?.path || '/',
      REQUEST_PARAMS: JSON.stringify(context.params || {}),
      REQUEST_QUERY: JSON.stringify(context.query || {}),
      REQUEST_BODY: JSON.stringify(context.body || {}),
      REQUEST_HEADERS: JSON.stringify(context.headers || {})
    };
    
    const isWindows = process.platform === 'win32';
    let child;
    let tempFile = null;
    
    if (isWindows) {
      // Sur Windows, utiliser PowerShell avec -Command
      child = spawn('powershell', ['-NoProfile', '-Command', code], { timeout, env, shell: true });
    } else {
      // Sur Linux/Mac, utiliser bash avec fichier temporaire
      tempFile = join(tempDir, `sh_${randomBytes(8).toString('hex')}.sh`);
      writeFileSync(tempFile, code);
      child = spawn('bash', [tempFile], { timeout, env });
    }
    
    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    child.on('close', (exitCode) => {
      if (tempFile) try { unlinkSync(tempFile); } catch (e) {}
      
      const executionTime = Date.now() - startTime;
      
      if (exitCode === 0) {
        resolve({
          success: true,
          status: 200,
          body: stdout.trim(),
          executionTime
        });
      } else {
        resolve({
          success: false,
          status: 500,
          body: { error: stderr.trim() || `Exit code: ${exitCode}` },
          executionTime
        });
      }
    });
    
    child.on('error', (error) => {
      if (tempFile) try { unlinkSync(tempFile); } catch (e) {}
      resolve({
        success: false,
        status: 500,
        body: { error: error.message },
        executionTime: Date.now() - startTime
      });
    });
    
    setTimeout(() => {
      child.kill('SIGTERM');
    }, timeout);
  });
}

/**
 * Exécute du code dans le langage spécifié
 */
export async function executeCode(language, code, context, timeout = DEFAULT_TIMEOUT) {
  const enableJS = process.env.ENABLE_JAVASCRIPT !== 'false';
  const enablePython = process.env.ENABLE_PYTHON !== 'false';
  const enableBash = process.env.ENABLE_BASH !== 'false';
  
  switch (language.toLowerCase()) {
    case 'javascript':
    case 'js':
      if (!enableJS) {
        return { success: false, status: 503, body: { error: 'JavaScript execution is disabled' } };
      }
      return runJavaScript(code, context, timeout);
      
    case 'python':
    case 'py':
      if (!enablePython) {
        return { success: false, status: 503, body: { error: 'Python execution is disabled' } };
      }
      return runPython(code, context, timeout);
      
    case 'bash':
    case 'sh':
    case 'shell':
      if (!enableBash) {
        return { success: false, status: 503, body: { error: 'Bash execution is disabled' } };
      }
      return runBash(code, context, timeout);
      
    default:
      return {
        success: false,
        status: 400,
        body: { error: `Langage non supporté: ${language}` }
      };
  }
}

export default { executeCode };

