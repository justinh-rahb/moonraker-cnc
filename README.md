# Retro CNC Panel

A retro-styled, reactive web interface for controlling 3D printers and CNC machines running Klipper/Moonraker. Built with Svelte for a snappy, responsive experience with a distinct 1980s terminal aesthetic.

![Retro CNC Panel Home](docs/screenshot-1.png)
![Retro CNC Panel Config](docs/screenshot-2.png)

## Features

### 🎮 Real-Time Control
- **Live Position Tracking**: WebSocket connection displays real-time X/Y/Z coordinates
- **Multi-Axis Jogging**: Precise movement control with configurable step sizes (0.1mm - 100mm)
- **Individual & Combined Homing**: Home all axes or individual X, Y, Z axes
- **Motors Control**: Quick motors off (M84) for manual intervention

### 🔥 Temperature Monitoring
- **Dynamic Sensor Detection**: Automatically discovers and displays all temperature sensors
- **Multi-Extruder Support**: Detects and controls multiple extruders (T0, T1, T2+)
- **Live Graph**: Real-time temperature visualization

### ⚙️ Customization
- **Configurable Macros**: 8 customizable macro buttons (labels + G-code)
- **Custom Panel Title**: Rename the interface for your machine
- **Persistent Settings**: Auto-save to localStorage (IP, autoconnect, macros, title)
- **Autoconnect**: Optional automatic connection on page load

### 🎨 Retro Aesthetic
- **CRT Scanline Effect**: Authentic terminal appearance
- **Glowing Green Displays**: Classic monochrome look
- **Tactile Button Feedback**: Shadow-based 3D press effects
- **Orbitron Font**: Retro-futuristic typography

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

Open your browser to `http://localhost:5173`

## Initial Setup

1. **First Launch**: Enter your Moonraker IP address (e.g., `192.168.1.100:7125`)
2. **Enable Autoconnect** (optional): Check the box to skip the connection modal on future visits
3. **Customize** (optional):
   - Click "CONFIGURE PANEL" in the bottom-right
   - Set your machine name (e.g., "SNAPMAKER U1")
   - Customize macro buttons for your workflow

## Configuration

### Connection Settings
- **IP Address**: Your printer's Moonraker instance
- **Port**: Default is `7125`
- **Autoconnect**: Automatically connect on page load

### Macro Buttons
Each of the 8 macro buttons can be customized with:
- **Label**: Display name
- **G-code**: Command to execute (supports any Klipper macro)

**Default Macros**:
- Motion Panel: Z Offset Test, Compensation, PID Tuning
- Power Panel: Firmware Restart, System Info, Power controls

All settings persist to browser localStorage automatically.

## Control Layout

### Toolhead Panel
```
┌───────┬───────┬───────┐
│   X   │  Y+   │   Y   │  Individual axis homing
├───────┼───────┼───────┤
│  X-   │  ALL  │  X+   │  Center homes all axes
├───────┼───────┼───────┤
│   Z   │  Y-   │ M-OFF │  Motors off bottom-right
└───────┴───────┴───────┘
```

### Extruder Panel
- Tool selector (T0/T1/T2...) for multi-extruder setups
- Extrusion factor control
- Retract/Extrude buttons

### Temperature Panel
- Dynamically displays all detected temperature sensors
- Extruders, heated bed, MCU, host CPU

## Tech Stack

- **Framework**: Svelte 4 + Vite
- **Communication**: WebSocket (JSON-RPC 2.0)
- **Styling**: Vanilla CSS with CSS variables
- **State Management**: Svelte stores
- **Persistence**: localStorage API

## Browser Support

Modern browsers with WebSocket support:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## Development

```bash
# Run dev server with hot reload
npm run dev

# Type checking (if using TypeScript)
npm run check

# Build production bundle
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
src/
├── stores/              # State management
│   ├── machineStore.js  # Printer state & commands
│   ├── configStore.js   # Settings persistence
│   └── websocket.js     # WebSocket client
├── lib/
│   └── components/
│       ├── ui/          # Reusable components
│       └── modules/     # Feature panels
├── app.css              # Global styles
└── App.svelte           # Main app layout
```

## Contributing

Contributions welcome! This is a personal project but feel free to fork and adapt for your setup.

## License

MIT

## Acknowledgments

- Inspired by classic 1980s CRT terminal interfaces
- Built for Klipper/Moonraker ecosystem
- Fonts: Orbitron, Share Tech Mono (Google Fonts)
