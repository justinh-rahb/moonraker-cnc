# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
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
