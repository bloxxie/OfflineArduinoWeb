/**
 * Arduino Simulator - Simulates basic Arduino C code execution
 * Supports: digitalWrite, digitalRead, pinMode, Serial.print, Serial.println, delay, millis
 */

class ArduinoSimulator {
  constructor() {
    this.serialOutput = '';
    this.digitalPins = new Array(14).fill(0); // Arduino Uno has 14 digital pins
    this.analogPins = new Array(6).fill(0); // Arduino Uno has 6 analog pins
    this.pinModes = {}; // track pin modes
    this.startTime = Date.now();
    this.loopCount = 0;
    this.maxLoops = 10000; // prevent infinite loops
  }

  /**
   * Parse and execute Arduino code
   */
  execute(code) {
    try {
      this.serialOutput = '';
      this.loopCount = 0;
      this.startTime = Date.now();

      // Create a safe execution environment
      const sandbox = this.createSandbox();
      
      // Convert Arduino syntax to JavaScript
      let jsCode = code
        // Remove 'void' keyword before function names
        .replace(/void\s+setup\s*\(/g, 'function setup(')
        .replace(/void\s+loop\s*\(/g, 'function loop(')
        // Handle other void functions
        .replace(/void\s+(\w+)\s*\(/g, 'function $1(')
        // Remove type declarations (int, float, etc.)
        .replace(/\b(int|float|double|byte|boolean|long)\s+/g, 'var ');

      // Define constants
      const HIGH = 1;
      const LOW = 0;
      const INPUT = 'INPUT';
      const OUTPUT = 'OUTPUT';

      // Build the complete executable code
      const executableCode = `
var digitalWrite = __digitalWrite;
var digitalRead = __digitalRead;
var pinMode = __pinMode;
var Serial = __Serial;
var delay = __delay;
var millis = __millis;
var attachInterrupt = __attachInterrupt;
var HIGH = __HIGH;
var LOW = __LOW;
var INPUT = __INPUT;
var OUTPUT = __OUTPUT;

${jsCode}

// Call setup if it exists
if (typeof setup === 'function') {
  setup();
}

// Call loop if it exists (simulating Arduino behavior)
if (typeof loop === 'function') {
  for (var i = 0; i < 5; i++) {
    loop();
  }
}
`;

      // Create execution context
      const executionContext = {
        __digitalWrite: sandbox.digitalWrite,
        __digitalRead: sandbox.digitalRead,
        __pinMode: sandbox.pinMode,
        __Serial: sandbox.Serial,
        __delay: sandbox.delay,
        __millis: sandbox.millis,
        __attachInterrupt: sandbox.attachInterrupt,
        __HIGH: HIGH,
        __LOW: LOW,
        __INPUT: INPUT,
        __OUTPUT: OUTPUT
      };

      // Execute using Function constructor with context variables
      const executor = new Function(...Object.keys(executionContext), executableCode);
      executor(...Object.values(executionContext));

      return {
        serial: this.serialOutput,
        digitalPins: this.digitalPins.slice(0, 14),
        analogPins: this.analogPins.slice(0, 6),
        status: 'completed',
        message: 'Code executed successfully'
      };
    } catch (error) {
      console.error('Simulator Error:', error);
      console.error('Error Message:', error.message);
      return {
        serial: this.serialOutput,
        status: 'error',
        message: error.message
      };
    }
  }

  /**
   * Create a sandbox with Arduino functions
   */
  createSandbox() {
    const self = this;

    return {
      digitalWrite: (pin, value) => {
        if (pin >= 0 && pin < 14) {
          self.digitalPins[pin] = value ? 1 : 0;
        }
      },

      digitalRead: (pin) => {
        if (pin >= 0 && pin < 14) {
          return self.digitalPins[pin];
        }
        return 0;
      },

      pinMode: (pin, mode) => {
        self.pinModes[pin] = mode; // 'INPUT' or 'OUTPUT'
      },

      Serial: {
        print: (value) => {
          self.serialOutput += String(value);
        },
        println: (value) => {
          self.serialOutput += String(value) + '\n';
        },
        begin: (baudRate) => {
          // Serial initialization (no-op in simulation)
        }
      },

      delay: (ms) => {
        // In real Arduino, this blocks. In simulator, we just track it
        // Actual blocking would freeze the browser, so we simulate it differently
      },

      millis: () => {
        return Date.now() - self.startTime;
      },

      attachInterrupt: (pin, handler, mode) => {
        // Placeholder for interrupt handling
      }
    };
  }

  /**
   * Get accumulated serial output
   */
  getSerialOutput() {
    return this.serialOutput;
  }

  /**
   * Get current pin states
   */
  getPinStates() {
    return {
      digital: this.digitalPins.slice(0, 14),
      analog: this.analogPins.slice(0, 6)
    };
  }

  /**
   * Reset simulator state
   */
  reset() {
    this.serialOutput = '';
    this.digitalPins.fill(0);
    this.analogPins.fill(0);
    this.pinModes = {};
    this.loopCount = 0;
  }
}

module.exports = { ArduinoSimulator };
