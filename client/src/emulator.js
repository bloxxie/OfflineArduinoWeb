import { CPU, avrInstruction, AVRUSART, usart0Config, AVRClock, clockConfig, AVRTimer, timer0Config } from 'avr8js/dist/esm/index.js';

function parseIntelHex(hexText) {
  const lines = hexText.trim().split(/\r?\n/);
  let upperAddress = 0;
  let maxAddress = 0;
  const memory = {};

  for (const line of lines) {
    if (!line || line[0] !== ':') {
      continue;
    }
    const byteCount = parseInt(line.slice(1, 3), 16);
    const address = parseInt(line.slice(3, 7), 16);
    const recordType = parseInt(line.slice(7, 9), 16);
    const data = line.slice(9, 9 + byteCount * 2);

    if (recordType === 0x00) {
      const absolute = upperAddress + address;
      for (let i = 0; i < byteCount; i++) {
        const byteValue = parseInt(data.slice(i * 2, i * 2 + 2), 16);
        memory[absolute + i] = byteValue;
        if (absolute + i > maxAddress) {
          maxAddress = absolute + i;
        }
      }
    }
    else if (recordType === 0x04) {
      upperAddress = parseInt(data, 16) << 16;
    }
  }

  const byteCountTotal = maxAddress + 1;
  const byteArray = new Uint8Array(byteCountTotal);
  for (let addr = 0; addr <= maxAddress; addr++) {
    byteArray[addr] = memory[addr] || 0;
  }

  const wordCount = Math.ceil(byteCountTotal / 2);
  const program = new Uint16Array(wordCount);
  const view = new DataView(program.buffer);
  for (let i = 0; i < byteCountTotal; i += 2) {
    const low = byteArray[i];
    const high = byteArray[i + 1] || 0;
    view.setUint16(i, low | (high << 8), true);
  }

  return program;
}

function getDigitalPinStates(cpu) {
  const portD = cpu.data[0x2b];
  const portB = cpu.data[0x25];
  const states = [];

  for (let i = 0; i < 8; i++) {
    states.push((portD >> i) & 1);
  }
  for (let i = 0; i < 6; i++) {
    states.push((portB >> i) & 1);
  }

  return states;
}

export class ArduinoEmulator {
  constructor(hex, onLine, onState) {
    this.hex = hex;
    this.onLine = onLine;
    this.onState = onState;
    this.cpu = null;
    this.usart = null;
    this.running = false;
    this.interval = null;
  }

  async init() {
    if (this.cpu) {
      return;
    }

    const progMem = parseIntelHex(this.hex);
    this.cpu = new CPU(progMem, 2048);
    this.clock = new AVRClock(this.cpu, 16000000, clockConfig);
    this.timer0 = new AVRTimer(this.cpu, timer0Config);
    this.usart = new AVRUSART(this.cpu, usart0Config, 16000000);

    this.usart.onLineTransmit = (line) => {
      if (line) {
        this.onLine(line + '\n');
      }
    };
  }

  async start() {
    await this.init();
    if (!this.cpu) {
      throw new Error('CPU initialization failed');
    }
    if (this.running) {
      return;
    }

    this.running = true;
    this.scheduleStep();
  }

  stop() {
    this.running = false;
    if (this.interval) {
      clearTimeout(this.interval);
      this.interval = null;
    }
  }

  scheduleStep() {
    if (!this.running || !this.cpu) {
      return;
    }

    const intervalMs = 20;
    const cycles = Math.round(16000000 * intervalMs / 1000);
    for (let i = 0; i < cycles; i++) {
      avrInstruction(this.cpu);
      this.cpu.tick();
    }

    if (this.onState) {
      this.onState(getDigitalPinStates(this.cpu));
    }

    this.interval = setTimeout(() => this.scheduleStep(), intervalMs);
  }
}
