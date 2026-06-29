import { ArduinoEmulator } from './emulator.js';

class ArduinoApp {
  constructor() {
    this.sessionId = this.generateSessionId();
    this.isRunning = false;
    this.emulator = null;
    this.tabs = [];
    this.activeTabId = null;
    this.initializeElements();
    this.attachEventListeners();
    this.initTabs();
  }

  generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  initializeElements() {
    this.codeEditor = document.getElementById('codeEditor');
    this.runBtn = document.getElementById('runBtn');
    this.formatBtn = document.getElementById('formatBtn');
    this.stopBtn = document.getElementById('stopBtn');
    this.clearBtn = document.getElementById('clearBtn');
    this.clearSerialBtn = document.getElementById('clearSerialBtn');
    this.openFileBtn = document.getElementById('openFileBtn');
    this.newTabBtn = document.getElementById('newTabBtn');
    this.fileInput = document.getElementById('fileInput');
    this.tabBar = document.getElementById('tabBar');
    this.serialOutput = document.getElementById('serialOutput');
    this.statusBar = document.getElementById('statusBar');
    this.digitalPinsContainer = document.getElementById('digitalPins');
    this.analogPinsContainer = document.getElementById('analogPins');
    this.editorSection = document.querySelector('.editor-section');
  }

  attachEventListeners() {
    this.runBtn.addEventListener('click', () => this.compileAndRun());
    this.formatBtn.addEventListener('click', () => this.formatCode());
    this.stopBtn.addEventListener('click', () => this.stopSimulation());
    this.clearBtn.addEventListener('click', () => this.clearCode());
    this.clearSerialBtn.addEventListener('click', () => this.clearSerialOutput());
    this.openFileBtn.addEventListener('click', () => this.fileInput.click());
    this.newTabBtn.addEventListener('click', () => this.createNewTab());
    this.fileInput.addEventListener('change', (e) => this.handleFileInput(e));

    this.codeEditor.addEventListener('input', () => this.saveCurrentTabContent());
    this.codeEditor.addEventListener('keydown', (e) => this.handleEditorKeydown(e));

    this.editorSection.addEventListener('dragover', (e) => this.handleDragOver(e));
    this.editorSection.addEventListener('dragleave', () => this.editorSection.classList.remove('drag-over'));
    this.editorSection.addEventListener('drop', (e) => this.handleDrop(e));
  }

  async compileAndRun() {
    const code = this.codeEditor.value.trim();
    if (!code) {
      this.setStatus('No code to execute', 'error');
      return;
    }
    if (this.isRunning) {
      this.setStatus('Simulation already running', 'error');
      return;
    }

    try {
      this.isRunning = true;
      this.runBtn.disabled = true;
      this.setStatus('Compiling sketch locally...');

      const response = await fetch('/api/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      });

      const result = await response.json();
      if (!response.ok || result.error) {
        throw new Error(result.error || `HTTP ${response.status}`);
      }

      this.setStatus('Starting AVR simulation...', 'success');
      this.clearSerialOutput();

      this.emulator = new ArduinoEmulator(result.hex, (line) => {
        this.appendSerialOutput(line);
      }, (digitalPins) => {
        this.updatePinStatus(digitalPins, new Array(6).fill(0));
      });

      await this.emulator.start();
      this.setStatus('Simulation running', 'success');
    } catch (error) {
      this.setStatus(`Error: ${error.message}`, 'error');
      this.displaySerialOutput(`Error: ${error.message}`);
      console.error('Simulation error:', error);
      this.isRunning = false;
      this.runBtn.disabled = false;
    }
  }

  stopSimulation() {
    if (this.emulator) {
      this.emulator.stop();
      this.setStatus('Simulation stopped', 'info');
    }
    this.isRunning = false;
    this.runBtn.disabled = false;
  }

  appendSerialOutput(output) {
    this.serialOutput.textContent += output;
    this.serialOutput.scrollTop = this.serialOutput.scrollHeight;
  }

  displaySerialOutput(output) {
    this.serialOutput.textContent = output || '(No output)';
    this.serialOutput.scrollTop = this.serialOutput.scrollHeight;
  }

  clearSerialOutput() {
    this.serialOutput.textContent = '';
  }

  updatePinStatus(digitalPins, analogPins) {
    this.digitalPinsContainer.innerHTML = '';
    digitalPins.forEach((value, index) => {
      const pinElement = this.createPinElement(`D${index}`, value);
      this.digitalPinsContainer.appendChild(pinElement);
    });

    this.analogPinsContainer.innerHTML = '';
    analogPins.forEach((value, index) => {
      const pinElement = this.createPinElement(`A${index}`, value);
      this.analogPinsContainer.appendChild(pinElement);
    });
  }

  createPinElement(label, value) {
    const div = document.createElement('div');
    div.className = 'pin-indicator';

    const labelEl = document.createElement('span');
    labelEl.className = 'pin-label';
    labelEl.textContent = label;

    const valueEl = document.createElement('div');
    valueEl.className = `pin-value ${value ? 'high' : 'low'}`;
    valueEl.textContent = value ? 'H' : 'L';

    div.appendChild(labelEl);
    div.appendChild(valueEl);

    return div;
  }

  clearCode() {
    if (confirm('Are you sure you want to clear the code editor?')) {
      this.codeEditor.value = '';
      this.clearSerialOutput();
      this.digitalPinsContainer.innerHTML = '';
      this.analogPinsContainer.innerHTML = '';
      this.setStatus('Code cleared');
    }
  }

  setStatus(message, type = 'info') {
    this.statusBar.textContent = message;
    this.statusBar.className = 'status-bar ' + type;
    if (type === 'success') {
      setTimeout(() => {
        this.statusBar.textContent = 'Ready';
        this.statusBar.className = 'status-bar';
      }, 5000);
    }
  }

  handleEditorKeydown(event) {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      this.compileAndRun();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      this.formatCode();
      return;
    }

    if (event.key === 'Tab') {
      event.preventDefault();
      const { selectionStart, selectionEnd, value } = this.codeEditor;
      const indent = '  ';

      if (selectionStart === selectionEnd) {
        this.codeEditor.setRangeText(indent, selectionStart, selectionEnd, 'end');
      } else {
        const selectedText = value.slice(selectionStart, selectionEnd);
        const lines = selectedText.split('\n');

        if (event.shiftKey) {
          const unindented = lines.map(line => line.startsWith(indent) ? line.slice(indent.length) : line.replace(/^\t/, '')).join('\n');
          this.codeEditor.setRangeText(unindented, selectionStart, selectionEnd, 'end');
        } else {
          const indented = lines.map(line => indent + line).join('\n');
          this.codeEditor.setRangeText(indented, selectionStart, selectionEnd, 'end');
        }
      }
      return;
    }

    if (event.key === 'Enter') {
      const { selectionStart, value } = this.codeEditor;
      const beforeCursor = value.slice(0, selectionStart);
      const lastLineBreak = beforeCursor.lastIndexOf('\n');
      const currentLine = beforeCursor.slice(lastLineBreak + 1);
      const indentMatch = currentLine.match(/^\s*/);
      if (indentMatch) {
        event.preventDefault();
        const indent = indentMatch[0];
        const insertText = '\n' + indent;

        if (currentLine.trim().endsWith('{')) {
          this.codeEditor.setRangeText(insertText + '  ', selectionStart, selectionStart, 'end');
        } else {
          this.codeEditor.setRangeText(insertText, selectionStart, selectionStart, 'end');
        }
      }
    }
  }

  formatCode() {
    const raw = this.codeEditor.value.replace(/\r\n/g, '\n').replace(/\t/g, '  ');
    const lines = raw.split('\n');
    let indentLevel = 0;
    const formattedLines = lines.map((line) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return '';
      }

      if (/^[\}\)\]]/.test(trimmed)) {
        indentLevel = Math.max(indentLevel - 1, 0);
      }

      const formattedLine = '  '.repeat(indentLevel) + trimmed;
      const openBraces = (trimmed.match(/\{/g) || []).length;
      const closeBraces = (trimmed.match(/\}/g) || []).length;
      indentLevel += openBraces - closeBraces;
      if (indentLevel < 0) {
        indentLevel = 0;
      }

      return formattedLine;
    });

    const cursorPosition = this.codeEditor.selectionStart;
    this.codeEditor.value = formattedLines.join('\n');
    this.saveCurrentTabContent();
    this.codeEditor.selectionStart = this.codeEditor.selectionEnd = cursorPosition;
    this.setStatus('Code formatted', 'success');
  }

  initTabs() {
    const initialContent = this.codeEditor.value || this.getDefaultSketch();
    const initialName = 'main.ino';
    this.tabs = [];
    this.createNewTab(initialName, initialContent);
  }

  getDefaultSketch() {
    return `void setup() {
  Serial.begin(9600);
  for (int pin = 0; pin <= 13; pin++) {
    pinMode(pin, OUTPUT);
    digitalWrite(pin, LOW);
  }
}

void loop() {
  // chase up from 0 to 13
  for (int pin = 0; pin <= 13; pin++) {
    digitalWrite(pin, HIGH);
    delay(100);
    digitalWrite(pin, LOW);
  }

  // chase back from 13 to 0
  for (int pin = 13; pin >= 0; pin--) {
    digitalWrite(pin, HIGH);
    delay(100);
    digitalWrite(pin, LOW);
  }
}`;
  }

  createNewTab(name = 'untitled.ino', content = '') {
    this.saveCurrentTabContent();
    const tabId = 'tab_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    this.tabs.push({ id: tabId, name, content });
    this.activeTabId = tabId;
    this.renderTabBar();
    this.updateEditorFromActiveTab();
    this.setStatus(`Created ${name}`, 'success');
  }

  renderTabBar() {
    this.tabBar.innerHTML = '';
    this.tabs.forEach((tab) => {
      const tabButton = document.createElement('button');
      tabButton.type = 'button';
      tabButton.className = `tab${tab.id === this.activeTabId ? ' active' : ''}`;
      tabButton.textContent = tab.name;
      tabButton.addEventListener('click', () => this.switchTab(tab.id));

      const closeButton = document.createElement('span');
      closeButton.className = 'tab-close';
      closeButton.textContent = '×';
      closeButton.addEventListener('click', (event) => {
        event.stopPropagation();
        this.closeTab(tab.id);
      });

      tabButton.appendChild(closeButton);
      this.tabBar.appendChild(tabButton);
    });
  }

  switchTab(tabId) {
    if (tabId === this.activeTabId) {
      return;
    }
    this.saveCurrentTabContent();
    this.activeTabId = tabId;
    this.renderTabBar();
    this.updateEditorFromActiveTab();
    const activeTab = this.getActiveTab();
    this.setStatus(`Switched to ${activeTab?.name || 'tab'}`);
  }

  closeTab(tabId) {
    const tabIndex = this.tabs.findIndex((tab) => tab.id === tabId);
    if (tabIndex === -1) {
      return;
    }

    const isActive = this.tabs[tabIndex].id === this.activeTabId;
    const closedName = this.tabs[tabIndex].name;
    this.tabs.splice(tabIndex, 1);

    if (this.tabs.length === 0) {
      this.createNewTab('untitled.ino', '');
      return;
    }

    if (isActive) {
      const nextIndex = tabIndex < this.tabs.length ? tabIndex : this.tabs.length - 1;
      this.activeTabId = this.tabs[nextIndex].id;
      this.updateEditorFromActiveTab();
    }

    this.renderTabBar();
    this.setStatus(`Closed ${closedName}`, 'info');
  }

  getActiveTab() {
    return this.tabs.find((tab) => tab.id === this.activeTabId) || null;
  }

  saveCurrentTabContent() {
    const activeTab = this.getActiveTab();
    if (activeTab) {
      activeTab.content = this.codeEditor.value;
    }
  }

  updateEditorFromActiveTab() {
    const activeTab = this.getActiveTab();
    if (activeTab) {
      this.codeEditor.value = activeTab.content;
    }
  }

  handleFileInput(event) {
    const file = event.target.files && event.target.files[0];
    if (file) {
      this.openFile(file);
    }
    event.target.value = null;
  }

  handleDragOver(event) {
    event.preventDefault();
    this.editorSection.classList.add('drag-over');
    event.dataTransfer.dropEffect = 'copy';
  }

  handleDrop(event) {
    event.preventDefault();
    this.editorSection.classList.remove('drag-over');

    const file = event.dataTransfer.files && event.dataTransfer.files[0];
    if (file) {
      this.openFile(file);
    }
  }

  openFile(file) {
    const acceptedTypes = ['.ino', '.txt', '.c', '.cpp', '.h'];
    const lowerName = file.name.toLowerCase();
    if (!acceptedTypes.some((ext) => lowerName.endsWith(ext))) {
      this.setStatus('Only .ino, .txt, .c, .cpp, and .h files are supported', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const content = reader.result || '';
      this.createNewTab(file.name, content);
      this.setStatus(`Opened ${file.name}`, 'success');
    };

    reader.onerror = () => {
      this.setStatus(`Failed to read ${file.name}`, 'error');
    };

    reader.readAsText(file);
  }

  clearCode() {
    if (confirm('Are you sure you want to clear the current sketch?')) {
      const activeTab = this.getActiveTab();
      if (activeTab) {
        activeTab.content = '';
        this.codeEditor.value = '';
      }
      this.clearSerialOutput();
      this.digitalPinsContainer.innerHTML = '';
      this.analogPinsContainer.innerHTML = '';
      this.setStatus('Code cleared');
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.app = new ArduinoApp();
  window.app.setStatus('Ready');
});
