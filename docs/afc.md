# AFC panel

Retrograde detects the `AFC` Klipper object and subscribes to the printer's advertised `AFC_*` objects through its existing Moonraker WebSocket. Printers without `AFC` have no panel. Detection resets on disconnect, Klipper restart and host changes.

Under **Settings → Panels**, turn off **Enable AFC panel** to hide it for the selected printer. The preference uses the existing per-host settings cache, Moonraker synchronization and import/export. No new settings database or printer configuration is required. The panel also supports saved collapse and dashboard arrangement on wide and compact layouts.

## Display

- Only filament lanes listed in `AFC.lanes` are displayed, using either `AFC_lane` or older `AFC_stepper` status objects. Internal drive/selector objects are excluded even if a unit lists them; units without visible filament lanes are hidden.
- Current/next lane, AFC state, messages, bypass and tool-change progress when reported.
- Filament colour, name, material, remaining weight and spool ID when supplied. Unknown weights stay unknown.
- String and array tool mappings, preparation/load/tool/hub sensors, runout backup and buffer status.
- AFC extruders, tool entry/exit sensors, hubs and buffers. Toolchanger selection/docking is available when advertised.

The AFC-Lite U1 stub can report `status: "empty"` while its filament sensors are true. The panel uses those sensor booleans for loaded state and displays the active lane separately, so several loaded extruders do not appear to be the selected tool.

## Controls

Controls are exposed only when the printer advertises the corresponding command in `gcode.commands`:

| Action | AFC command |
| --- | --- |
| Load/select lane | `CHANGE_TOOL LANE=…` |
| Unload tool filament | `TOOL_UNLOAD LANE=…` |
| Eject lane filament | `LANE_UNLOAD LANE=…` |
| Edit colour/material/weight/spool assignment | `SET_COLOR`, `SET_MATERIAL`, `SET_WEIGHT`, `SET_SPOOL_ID` |
| Assign a tool | `SET_MAP LANE=… MAP=T…` |
| Set a runout backup | `SET_RUNOUT LANE=… RUNOUT=…` |
| Select/dock an AFC toolchanger tool | `AFC_SELECT_TOOL`, `AFC_UNSELECT_TOOL` |
| Lights/message | `TURN_ON_AFC_LED`, `TURN_OFF_AFC_LED`, `AFC_CLEAR_MESSAGE` |

Movement actions require confirmation. All updates query fresh readiness, job/paused/SD activity, idle state, AFC status, lane data and command availability before sending. Printing, paused, busy, unknown and unavailable states block updates. AFC errors block normal controls; clearing a message is allowed while AFC reports an error, provided the printer is idle. Ejection is blocked until the lane is unloaded from its tool.

Requests are bound to the connection generation, and pending operations disable other AFC controls. A reconnect or host change cancels a pending operation. Failed commands are never replayed. A firmware error can occur after a multi-field edit partially succeeds; check the reported values before retrying. Spool ID `0` clears the assignment using AFC's empty `SPOOL_ID=` parameter.

## Reference and validation

The interaction model follows [Fluidd's AFC implementation](https://github.com/fluidd-core/fluidd/tree/738ff932030588adb65684f49be4db893ad03216/src/components/widgets/afc) and its public AFC status/command contract. This is an original Svelte implementation using Retrograde's existing dashboard, dialogs and settings infrastructure.

Validation includes a live read-only U1 AFC-Lite connection, desktop/mobile Chrome, hide/re-enable/reload, and switching to a printer without AFC. A sanitized status fixture from the U1 covers the compatibility schema. Mocked WebSocket tests exercise command generation, capability checks, fresh busy states, disabled preferences, command failures, duplicate prevention and cancellation across hosts.

AFC-Lite is a compatibility layer; it does not validate real AFC hardware behavior or implement every advertised setting. No live load/unload/eject, tool-selection, heating, motion or filament-setting commands were issued during validation. Real AFC hardware remains to be exercised. Advanced hardware calibration/configuration, Spoolman catalogue browsing and the print-start material-assignment workflow are outside this panel's current scope; reported spool IDs and filament metadata are displayed directly from AFC.
