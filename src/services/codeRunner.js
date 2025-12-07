/**
 * CodeRunner - Service d'exécution de code multi-langages
 * Supporte: JavaScript (Node.js), Python
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
    
    const wrappedCode = `
      const context = ${JSON.stringify(context)};
      const { request, params, query, body, headers } = context;
      
      let __response = { status: 200, body: null, headers: {} };
      let __responded = false;
      let __timeout = null;
      
      function respond(data, status = 200, headers = {}) {
        if (__responded) return;
        __responded = true;
        __response = { status, body: data, headers };
        if (__timeout) clearTimeout(__timeout);
        console.log('__RESULT__' + JSON.stringify(__response));
        process.exit(0);
      }
      
      function json(data, status = 200) {
        respond(data, status, { 'Content-Type': 'application/json' });
      }
      
      (async () => {
        try {
          const __userCode = async () => {
            ${code}
          };
          
          const __result = __userCode();
          
          // Si c'est une promesse, on attend
          if (__result && typeof __result.then === 'function') {
            await __result;
          }
          
          // Attendre un délai pour les .then() en chaîne
          __timeout = setTimeout(() => {
            if (!__responded) {
              console.log('__RESULT__' + JSON.stringify(__response));
              process.exit(0);
            }
          }, 4000);
          
        } catch (error) {
          if (!__responded) {
            __response = { 
              status: 500, 
              body: { error: error.message },
              headers: { 'Content-Type': 'application/json' }
            };
            console.log('__RESULT__' + JSON.stringify(__response));
            process.exit(1);
          }
        }
      })();
    `;
    
    // Utiliser .cjs pour forcer CommonJS et permettre require()
    const tempFile = join(tempDir, `js_${randomBytes(8).toString('hex')}.cjs`);
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
 * Exécute du code Python
 */
async function runPython(code, context, timeout = DEFAULT_TIMEOUT) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const pythonPath = process.env.PYTHON_PATH || 'python';
    
    const wrappedCode = `# -*- coding: utf-8 -*-
import json
import sys
sys.stdout.reconfigure(encoding='utf-8')

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

print('__RESULT__' + json.dumps(__response, ensure_ascii=False))
`;
    
    const tempFile = join(tempDir, `py_${randomBytes(8).toString('hex')}.py`);
    writeFileSync(tempFile, wrappedCode, 'utf8');
    
    const child = spawn(pythonPath, [tempFile], { 
      timeout,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' }
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
 * Exécute du code dans le langage spécifié
 */
export async function executeCode(language, code, context, timeout = DEFAULT_TIMEOUT) {
  switch (language.toLowerCase()) {
    case 'javascript':
    case 'js':
      return runJavaScript(code, context, timeout);
      
    case 'python':
    case 'py':
      return runPython(code, context, timeout);
      
    default:
      return {
        success: false,
        status: 400,
        body: { error: `Langage non supporté: ${language}. Utilisez JavaScript ou Python.` }
      };
  }
}

export default { executeCode };
