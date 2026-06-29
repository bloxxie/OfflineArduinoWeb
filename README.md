# Arduino Offline Server

An offline, local web-based Arduino circuit simulator. Write and test Arduino C code without physical hardware or internet connection.

## Features

- ✅ **Offline Web Interface** - Run completely locally in your browser
- ✅ **Arduino C Code Editor** - Write sketches directly in the web interface
- ✅ **Serial Monitor** - See real-time output from your code
- ✅ **Pin Status Display** - Visualize digital and analog pin states
- ✅ **Arduino Simulator** - JavaScript-based Arduino runtime

## Supported Arduino Functions

### Basic I/O
- `digitalWrite(pin, value)` - Set digital pin HIGH/LOW
- `digitalRead(pin)` - Read digital pin state
- `pinMode(pin, mode)` - Set pin mode (INPUT/OUTPUT)

### Serial Communication
- `Serial.begin(baudRate)` - Initialize serial (simulated)
- `Serial.print(value)` - Print to serial monitor
- `Serial.println(value)` - Print with newline

### Timing
- `delay(ms)` - Delay execution (simulated)
- `millis()` - Get milliseconds since start

### Hardware (Arduino Uno Compatible)
- 14 Digital Pins (0-13)
- 6 Analog Pins (A0-A5)

## Getting Started

### Installation

1. Navigate to the project directory:
```bash
cd /home/san/Projects/Niche\ Projects/ArduinoOfflineServer
```

2. Install dependencies:
```bash
npm install
```

### Running the Server

Start the development server:
```bash
npm start
```

Or with auto-reload:
```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## Usage

1. **Write Code** - Write your Arduino C code in the editor
2. **Compile & Run** - Click the "Compile & Run" button or press Ctrl+Enter
3. **View Output** - Check the Serial Monitor for output
4. **Check Pins** - See digital pin states in real-time

### Offline Compiler Requirement

This project now uses a real AVR emulator for the Arduino Uno. To compile your code locally, install `arduino-cli` and the Arduino AVR core:

```bash
# install Arduino CLI locally if not installed
# follow https://arduino.github.io/arduino-cli/latest/installation/

arduino-cli core update-index
arduino-cli core install arduino:avr
```

If `arduino-cli` is not installed, the simulator will display an error when you try to run.

### Example Code

```cpp
void setup() {
  Serial.begin(9600);
  pinMode(13, OUTPUT);
}

void loop() {
  Serial.println("Blink!");
  digitalWrite(13, HIGH);
  delay(1000);
  digitalWrite(13, LOW);
  delay(1000);
}
```

## Project Structure

```
ArduinoOfflineServer/
├── client/
│   ├── index.html          # Main web interface
│   └── src/
│       ├── app.js          # Frontend application logic
│       └── styles.css      # Styling
├── server/
│   └── index.js            # Express server
├── simulator/
│   └── arduino-simulator.js # Arduino runtime engine
├── package.json            # Project dependencies
└── README.md              # This file
```

## Future Enhancements

- [ ] Support for multiple loop iterations
- [ ] More Arduino functions (analogRead, analogWrite, PWM simulation)
- [ ] Interrupt handling
- [ ] Library support
- [ ] Circuit visualization
- [ ] Pin configuration UI
- [ ] Code validation and linting
- [ ] Project save/load functionality
- [ ] Debugging with breakpoints

## Troubleshooting

### Port already in use
If port 3000 is already in use, you can specify a different port:
```bash
PORT=3001 npm start
```

### Blank page
Make sure you're accessing `http://localhost:3000` (not HTTPS)

## License

MIT
