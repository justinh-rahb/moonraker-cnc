# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
