# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.1] - TBD

### Added
- **UI Improvements**:
  - **Tabbed Settings**: Settings Modal now organized into 5 logical tabs (General, Interface, Macros, Panels, Cameras) to reduce scrolling and improve navigability.
  - **Modal Scroll Lock**: Background page scrolling is now locked when any modal is open (Settings, Connection, File Picker, Confirmation dialogs).
- Temperature Panel improvements
  - **Autoscale Graph**: Graph Y-axis now dynamically scales to the highest visible temperature (plus 10% buffer), improving visibility for lower-temp prints (e.g., PLA at 200°C vs 300°C max).
  - **Interactive Cursor**: Hovering over the graph now displays a vertical cursor and a floating tooltip showing exact temperature values for all sensors at that specific time point.
  - **Hide Monitors**: New setting to hide passive temperature sensors (like Raspberry Pi or MCU temps) from the graph and list, focusing only on heaters (Bed, Extruder).
  - **Hide Graph**: Option to completely hide the temperature graph for a compact view.
  - **Settings Integration**: New "TEMPERATURE DISPLAY" section in Settings Modal to toggle these features. Preserves user preferences.

### Changed
- **Settings UX**: Relocated "Save" button in Settings Modal to the header bar for quicker access.

### Fixed
- Speed Factor and Extrusion Factor sliders now properly sync with the printer
  - Sliders now send M220 (speed) and M221 (extrusion) G-code commands when changed
  - Previously, slider changes only updated local UI state and were immediately overwritten by subscription updates from Moonraker
  - RetroSlider component updated to use local value + change event pattern instead of direct store binding
  - Added `setSpeedFactor()` and `setExtrusionFactor()` functions to machineStore
- Step increments (jog distance, extrude amount/speed, z-offset increment) now persist across page reloads via localStorage
- MiscPanel fan speed control for named fans
  - Correctly extracts fan name from Moonraker key (removes "fan_generic "prefix)
  - Sends proper SET_FAN_SPEED command with extracted fan name
- Remove unused print status handling functions from PrintStatusPanel fixing broken build

## [1.1.0] - 2026-01-25

### Added
- Power Device Control integration with Moonraker's device_power plugin
  - Icon button in header (middle position) for toggling power device on/off
  - Settings dropdown to select device: OFF (hidden), AUTO (recommended), or specific device
  - AUTO mode automatically selects device named "printer" or first available device
  - Real-time status updates via websocket notifications with 5-second polling fallback
  - Visual states: green glow when on, grey when off, disabled when locked during print
  - Orange hover effect with fill-up circle animation
  - Configurable confirmation dialog for power toggle (enabled by default)
  - Tooltip displays device name and current status
  - Graceful error recovery with automatic status re-fetch on API failures
  - Respects `locked_while_printing` flag to prevent power-off during active prints
  - Default setting is OFF (button hidden) until user enables in settings
- Confirmation dialogs for critical print actions (configurable in Settings)
  - Pause, Cancel, and Start Print actions can each require user confirmation
  - Generic "Are you sure?" confirmation modal with configurable button text
  - Cancel confirmation enabled by default, others optional
  - Start Print confirmation applies to both new prints and reprints
  - Settings in Print Control Macros section to enable/disable each confirmation type
- Retro-styled dial gauges for speed and flow monitoring
  - Semi-circular SVG gauges with smooth spring-physics animated needles and green/orange/red color zones
  - EMA filtering and Motion One spring animations for buttery-smooth needle movement with natural acceleration/deceleration
  - Speed gauge displays live toolhead velocity, flow gauge shows volumetric flow rate (mm³/s)
  - Exact digital readouts with smooth visual indicators
  - Configurable max rates, redline thresholds, and zone percentages in Settings Modal
  - Optional graphics-only mode: hide gauge graphics and show only numeric values with larger font size (36px vs 24px)
  - Side-by-side layout in Print Status Panel
- Layer progress display in Print Status Panel
  - Shows current layer and total layers during printing (e.g., "LAYER: 45/120")
  - Fetches layer count from file metadata on print start
  - Estimates current layer from print progress percentage
  - Automatically resets when print completes
- Build version information injection and display
  - Git commit hash and tag information injected during build process
  - About section in Settings Modal displaying version/commit with GitHub links
  - Automatic fallback to "dev" when git information unavailable
  - TypeScript declarations for build-time variables
  - Repository field added to package.json for proper GitHub linking
- Camera Panel for MJPEG stream display
  - Support for multiple cameras with compact switching buttons
  - Configurable stream URL and snapshot URL per camera
  - Aspect ratio options (16:9, 4:3, 1:1, 21:9) with proper container sizing
  - Flip horizontal/vertical and rotation controls (0°, 90°, 180°, 270°)
  - Live FPS counter overlay (optional per camera)
  - CSS transform support for camera orientation adjustments
  - Camera settings section in Settings Modal with enable/disable toggles
  - Auto-refresh MJPEG stream support for adaptive MJPEG from ustreamer/camera-streamer
  - Panel positioned in right column above Temperature Panel
  - Camera selector buttons integrated into bottom info bar for space efficiency

### Changed
- Print Status Panel filename display now uses flexible width to show more of the filename
- File picker is now accessible whenever machine is not actively printing (previously only when no file loaded)

### Fixed
- Camera switching reliability issues in Camera Panel
  - Camera selection now persists to localStorage, surviving page reloads and component re-mounts
  - Eliminated race condition between user selection and reactive fallback logic
  - Decoupled stream URL updates from camera selection reactive chain to prevent unintended resets
  - Added per-camera configurable target refresh rate (default 5 FPS) with dynamic interval adjustment
  - Refresh interval now updates automatically when switching between cameras with different refresh rates
  - Camera selection now only falls back to first camera when saved camera is deleted/disabled, not on every reactive update
  - Switching cameras now works reliably on first click without requiring multiple toggles
- Flow rate display now clamps negative values to zero during retraction moves (prevents confusing negative flow rates)
- Export settings filename now uses format `<machine title>-<date>.json` instead of hardcoded prefix
- Page title now dynamically reflects the user's configured machine title from settings
- Unified notification styling: persistent and dismissable errors now use the same visual style (persistent errors still have pulsing animation)
- Default connection IP now auto-detects from the page hostname (falls back to `localhost` if unavailable) instead of hardcoded `192.168.2.241`
- Clear and Reprint buttons now also appear when print is CANCELLED (not just COMPLETE)
  - Preserves filename for reprint functionality on both COMPLETE and CANCELLED statuses
  - Allows users to clear cancelled prints or immediately restart them

### Fixed
- Current layer count now updates in real-time during active prints
  - Layer estimate now recalculates continuously based on progress percentage
  - Previously only calculated once when layer was 0, causing stale display
- RetroGauge infinite loop causing "maximum update depth exceeded" error
  - Fixed `$effect` to track previous value and only update when value actually changes
  - Prevents infinite loop from reading and writing the same state

## [1.0.0] - 2026-01-25

### Added
- Settings import/export functionality with JSON file download and upload
- Support for `minimum_cruise_ratio` parameter in Machine Limits Panel for newer Klipper versions (auto-detects and falls back to `max_accel_to_decel` for legacy versions)
- Clear and Reprint buttons to print status panel when print completes
  - Clear button resets print status to idle state
  - Reprint button immediately restarts the same print job
  - Track lastCompletedFilename in machineStore for reprint functionality
  - Add startPrint and clearPrintStatus functions to machineStore

### Changed
- Rearranged settings modal sections to align with main UI panel order (Print Control, Filament, Console, Temperature Presets, Macro Panels)
- Improved installer to automatically serve files with Python http.server when nginx is unavailable or declined
  - Better nginx prompts with clearer messaging
  - Automatic fallback to Python file server
  - Provides immediate access URL and server management commands
  - Uninstaller now also stops running Python servers

### Fixed
- Console panel scroll to bottom behavior for proper auto-scrolling
- File Picker Modal various issues for improved stability
- Moonraker API call to use combined path parameter for correct file operations

### Documentation
- Expanded project documentation

## [0.3.3] - 2026-01-25

### Fixed
- File Picker Modal: Fixed directory navigation by using correct Moonraker API path format (path must include root prefix like "gcodes/subdir")

## [0.3.2] - 2026-01-24

### Fixed
- File Picker Modal: Fixed issue with double-clicking files to start print not working on built versions (worked in dev mode)

## [0.3.1] - 2026-01-24

### Fixed
- File Picker Modal: Fixed issue with root path handling when browsing directories

## [0.3.0] - 2026-01-24

### Added
- Machine Limits Panel for configuring max velocity, max acceleration, square corner velocity, and cruise ratio/max_accel_to_decel (auto-detects Klipper version)
- Console Panel with configurable message ordering (newest-first/oldest-first), command history navigation, and adjustable input position
- File Picker Modal for browsing Klipper's gcode directory with subdirectory navigation, file uploads, and "Send & Print" functionality
- Z-offset baby-stepping controls on toolhead panel with configurable increments (0.01mm, 0.05mm, 0.1mm, 0.25mm)
- Notification system for displaying unhandled errors and Klipper state issues with dismissal and status light integration
- File selection via File bar click when no file is loaded

### Changed
- Jog increment button styling and behavior

## [0.2.0] - 2026-01-24

### Added
- **Print Status Panel with Real-Time Monitoring**
  - New `PrintStatusPanel` component displaying comprehensive print information
  - Color-coded LED status indicators:
    - Green: Ready/Complete
    - Orange: Printing/Paused/Busy
    - Red: Error
  - Real-time display of current filename, progress, duration, speed (mm/s), and volumetric flow (mm³/s)
  - Pause/Resume and Cancel buttons (visible only during active prints)
  - Configurable macro names for pause/resume/cancel operations in settings
  - Panel positioned at top of left column for prominent visibility

- **Live Speed and Flow Metrics**
  - Motion report subscription for `live_velocity` and `live_extruder_velocity`
  - Volumetric flow calculation from extruder velocity (assumes 1.75mm filament)
  - Displays 0 values when not actively printing

- **BUSY Status Detection**
  - Monitors `idle_timeout` state from Klipper
  - Shows BUSY status when executing commands (homing, probing, macros) without active print job
  - Detects when `idle_timeout` is "Printing" while `print_stats` is "standby"
  - Orange RUN LED indicator during BUSY state

- **Animated SVG Icons in Header**
  - Settings button: Custom gear/cog SVG with spin animation on hover
  - E-STOP button: Hexagonal stop symbol SVG with pulse animation
  - Enhanced button styling with flexbox layout and hover effects

### Changed
- Updated `machineStore` to track print data (filename, progress, duration)
- Added orange LED color support to `Led` component
- Improved button visual feedback throughout interface
- Updated `package-lock.json`

### Fixed
- BUSY status now correctly reverts to STANDBY when commands complete
  - Separated raw `printStatsState` from derived display status
  - Status now re-derives from both `printStatsState` and `idleState` on every change
  - Ensures accurate status updates when either state changes independently

### Removed
- Redundant status indicator from Header (functionality moved to `PrintStatusPanel`)

## [0.1.1] - 2026-01-24

### Changed
- Renamed MOTION macro panel to CALIBRATION
- Renamed POWER macro panel to SYSTEM
- Updated default CALIBRATION macros: BED MESH CALIBRATE, PROBE CALIBRATE, PID EXTRUDER, PID BED
- Updated default SYSTEM macros: FIRMWARE RESTART, SYSTEM INFO
- Removed POWEROFF NOW and POWEROFF CANCEL macros from defaults

## [0.1.0] - 2026-01-24

### Added
- Initial release of Retro CNC Panel
- Toolhead control panel with XYZ positioning and homing controls
- Extruder control with load/unload macro buttons
- Temperature panel for hotend and bed monitoring
- Macro panel with configurable custom macros
- Miscellaneous controls panel
- WebSocket-based real-time communication with Moonraker
- Local storage persistence for user settings
- Custom confirmation dialog components
- Retro-styled dark theme UI

### Changed
- Replaced browser confirm() dialogs with custom Svelte dialog components

### Fixed
- Macro panel delete button functionality
- Extruder control ordering
