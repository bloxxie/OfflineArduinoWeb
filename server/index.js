const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');
const { ArduinoSimulator } = require('../simulator/arduino-simulator.js');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../client')));
app.use('/node_modules', express.static(path.join(__dirname, '../node_modules')));

function resolveArduinoCliPath() {
  const envPath = process.env.ARDUINO_CLI_PATH;
  if (envPath && fs.existsSync(envPath)) {
    return envPath;
  }

  const knownPaths = [
    '/usr/bin/arduino-cli',
    '/usr/local/bin/arduino-cli',
    '/snap/bin/arduino-cli',
    path.join(os.homedir(), '.local/bin/arduino-cli')
  ];

  for (const candidate of knownPaths) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }

  try {
    const resolved = execFileSync('bash', ['-lc', 'command -v arduino-cli'], {
      stdio: ['ignore', 'pipe', 'ignore']
    })
      .toString()
      .trim();
    if (resolved) {
      return resolved;
    }
  } catch (err) {
    // ignore, fallback below
  }

  try {
    const resolved = execFileSync('bash', ['-lc', 'which arduino-cli'], {
      stdio: ['ignore', 'pipe', 'ignore']
    })
      .toString()
      .trim();
    if (resolved) {
      return resolved;
    }
  } catch (err) {
    return null;
  }

  return null;
}

function arduinoCliAvailable() {
  const cliPath = resolveArduinoCliPath();
  if (!cliPath) {
    return false;
  }

  try {
    execFileSync(cliPath, ['version'], { stdio: 'ignore' });
    return true;
  } catch (err) {
    return false;
  }
}

function findHexFile(dir) {
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      const nested = findHexFile(fullPath);
      if (nested) {
        return nested;
      }
    }
    else if (item.isFile() && item.name.endsWith('.hex')) {
      return fullPath;
    }
  }
  return null;
}

app.post('/api/compile', (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ error: 'No code provided' });
    }

    if (!arduinoCliAvailable()) {
      return res.status(500).json({
        error: 'Local arduino-cli toolchain is required. Install arduino-cli and Arduino AVR core locally.'
      });
    }

    const sketchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arduino-sketch-'));
    const sketchName = path.basename(sketchDir);
    const sketchFile = path.join(sketchDir, `${sketchName}.ino`);
    fs.writeFileSync(sketchFile, code, 'utf8');

    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arduino-build-'));
    const cliPath = resolveArduinoCliPath();
    if (!cliPath) {
      throw new Error('arduino-cli could not be resolved. Set ARDUINO_CLI_PATH or ensure it is installed in PATH.');
    }

    execFileSync(cliPath, [
      'compile',
      '--fqbn',
      'arduino:avr:uno',
      '--output-dir',
      outputDir,
      sketchDir
    ], { stdio: 'pipe' });

    const hexPath = findHexFile(outputDir);
    if (!hexPath) {
      return res.status(500).json({ error: 'Compiled hex file not found.' });
    }

    const hex = fs.readFileSync(hexPath, 'utf8');
    res.json({ success: true, hex });
  } catch (error) {
    const message = error.stderr ? error.stderr.toString() : error.message;
    res.status(500).json({ error: message });
  }
});

// Store active simulators
const simulators = new Map();

// Debug route
app.get('/api/debug', (req, res) => {
  res.json({
    path: process.env.PATH,
    ARDUINO_CLI_PATH: process.env.ARDUINO_CLI_PATH || null,
    resolvedCliPath: resolveArduinoCliPath(),
    arduinoCliAvailable: arduinoCliAvailable()
  });
});

// Routes

// Serve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

// Execute Arduino code
app.post('/api/execute', (req, res) => {
  try {
    const { code, sessionId } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: 'No code provided' });
    }

    // Create or get existing simulator
    let simulator;
    if (simulators.has(sessionId)) {
      simulator = simulators.get(sessionId);
    } else {
      simulator = new ArduinoSimulator();
      simulators.set(sessionId, simulator);
    }

    // Execute the code
    const output = simulator.execute(code);
    
    res.json({ success: true, output });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get serial output
app.get('/api/serial/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const simulator = simulators.get(sessionId);
  
  if (!simulator) {
    return res.status(404).json({ error: 'Session not found' });
  }

  res.json({ output: simulator.getSerialOutput() });
});

// Clear session
app.post('/api/clear/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  simulators.delete(sessionId);
  res.json({ success: true, message: 'Session cleared' });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`Arduino Offline Server running at http://localhost:${PORT}`);
  console.log(`Resolved arduino-cli: ${resolveArduinoCliPath() || 'not found'}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Kill the process on that port or set PORT to a different value.`);
  } else {
    console.error(err);
  }
  process.exit(1);
});
