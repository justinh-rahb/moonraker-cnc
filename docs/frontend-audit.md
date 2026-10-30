# Frontend completion audit — 2026-10-30

## Reference and scope

Compared the running Retro CNC Panel and Mainsail on the same Qidi printer in Chrome. Inspected the current source and three native settings exports (January and October formats). Reviewed Moonraker's current file, history and database APIs, Klipper's status reference, and upstream Mainsail/Fluidd persistence code. Printer inspection was read-only; no print, movement, heating, calibration, configuration changes or database writes were performed on the printer.

The implementation targets dependable everyday printer control and job workflows. It does not claim every Mainsail plugin or advanced visualization.

## Priorities and findings

| Priority | Finding | Resolution |
| --- | --- | --- |
| P0 | Socket disconnects never reconnect; pending commands can hang indefinitely | Automatic backoff, connect timeout, heartbeat, focus/online/resume probes, bounded RPCs; never replay commands |
| P0 | Stale socket callbacks and asynchronous initialization can affect the next host | Connection generations, snapshot reset, response checks, per-host dashboard component lifecycle |
| P0 | A single global config mixes cameras, macros, layouts and increments | Host profiles, explicit management UI, deep defaults, legacy migration and database synchronization |
| P0 | Settings changes don't follow a printer to another browser | Dedicated `retro_cnc_panel` Moonraker namespace, local cache, visible sync state and conflict resolution |
| P0 | Manual moves force absolute mode afterward; selected extruder can differ from the actual active tool | SAVE/RESTORE_GCODE_STATE, actual tool activation and toolhead extruder subscription |
| P1 | Routes duplicate parsing and fail to close views on Back | One parser/controller, mutually exclusive routes, directory deep links, malformed URL fallback |
| P1 | Only elapsed time is displayed; slicer layers get overwritten by partial status notifications | Remaining/completion estimates, separate total/printing durations, bounded interpolation, retained slicer counters |
| P1 | File browser is short, lacks preview/details, and can apply old directory responses | Taller responsive browser, search, metadata/thumbnail/download, stale request guards, sequential multiple uploads |
| P1 | No job history view | Paginated Moonraker history with result, start, duration, filament and file navigation |
| P1 | Controls lack numeric entry and resets | Validated numeric fields and slider resets; configured tuning and motion-limit resets |
| P1 | Pin controls guess scale from the name | Read Klipper's configured scale/PWM; binary outputs use toggles; heater/controller fans and filament sensors have status readouts |
| P1 | Cold extrusion and jogging unhomed axes remain offered | Cold-extrusion hint, actual heater threshold, job/homing restrictions |
| P1 | Macro setup requires guessing command names | Discover configured macros; add from the settings UI; per-macro confirmation option |
| P1 | Webcam discovery reads a doubly wrapped response | Use Moonraker's actual result shape and discard stale responses |
| P1 | Pages deploys on application changes | Replace legacy branch publishing with docs-filtered Actions workflow |
| P2 | Fixed layout, mobile overflow and inconsistent focus | Layout edit lock, drag handles and keyboard movement, separate phone/desktop orders, focus/scroll management |
| P2 | Build metadata leaks development detail | Production hides commit diagnostic row; normal version and useful system information remain |
| P2 | Heavy presentation obscures information | Build-selectable Flight theme, semantic tokens, numeric typography, less decoration, reduced-motion support |

## Persistence design

Printer settings and UX preferences (macros, cameras, presets, dashboard layouts by viewport, temperature graphs, console, gauge settings and increments) live under `retro_cnc_panel.settings`. The value carries a schema version. Neither Mainsail nor Fluidd namespaces are modified.

The browser retains its host list, transport addresses, active-host selection and cached configurations. This follows Fluidd's separation; Mainsail additionally supports a server-stored host list. Connection addresses are excluded from the shared settings document. Theme selection is an internal build setting, not an exposed preference.

On connect and focus the client compares local, server and last-synchronized copies. Server settings initialize a new browser. Offline edits upload when the remote copy still matches the common ancestor. Divergent edits require an explicit choice. The database API has no compare-and-swap operation: two writes in exactly the same interval remain last-write-wins. Do not interpret the conflict check as a distributed transaction.

Legacy single-printer exports are still supported. Importing another printer's export adds/selects that host instead of changing an unrelated host. Export Config remains a single-printer native export; Export All Hosts produces a versioned workspace export. The original v1 storage entry remains available for rollback. Invalid v2 storage is retained under a recovery key before fallback.

## Validation

- Node's test runner exercises real production modules: migration and host isolation, import rejection/round trips, deep defaults, URL normalization, route parsing, progress/time calculations, database reconciliation and RPC/database integration using mock sockets.
- Socket tests cover stale callbacks, request timeout, disconnect reset, actual automatic retry/cancellation, retained slicer layers and configured pin capabilities.
- Real Qidi telemetry, fans/pins, metadata, thumbnails and history were read in Chrome from a local validation build with `VITE_READ_ONLY=true`.
- Chrome checks cover file previews, Back, layout movement and persistence, and a 390 × 844 viewport. The phone file browser and dashboard were checked for horizontal overflow.
- The Qidi October export, generic October export and January legacy export were imported and exported using the application's importer. Chrome's automated file chooser could not complete because its extension lacked file-URL access; native UI automation also timed out. No browser security permissions were changed.
- Hardware writes, actual print start/pause/cancel, live file uploads/deletes, database writes and power toggles are tested with mocks or left for an authorized hardware acceptance session.

## Remaining differences from Mainsail

Advanced tools remain outside this change: 3D G-code visualization, mesh editing/visualization, object exclusion, print queues, timelapse management, firmware/configuration-file editing, extension-specific tools and authenticated Moonraker login/token refresh. Use Mainsail for those workflows. This frontend currently expects a Moonraker connection authorized by the host's existing trusted-network/reverse-proxy configuration.

Remaining-time values are estimates, labeled by source. Slicer time is used until there is enough live file progress; file progress then adapts to actual printing duration. Pauses suppress the predicted finish timestamp. Sparse/reconnecting data is never extrapolated indefinitely. Hardware acceptance of pause/resume, multiple physical extruders and sleep/resume on mobile operating systems remains necessary before declaring universal device support.

The docs site currently consists of static files and has no npm build dependencies. The Pages workflow watches `docs/**` and itself on `dev`; app dependency or source changes do not deploy documentation. GitHub Pages publishing must be set to GitHub Actions (the repository setting was updated during this task).

## API references

- [Moonraker file API](https://moonraker.readthedocs.io/en/latest/external_api/file_manager/)
- [Moonraker history API](https://moonraker.readthedocs.io/en/latest/external_api/history/)
- [Moonraker database API](https://moonraker.readthedocs.io/en/latest/external_api/database/)
- [Klipper status reference](https://www.klipper3d.org/Status_Reference.html)
- [Mainsail settings implementation](https://github.com/mainsail-crew/mainsail/blob/develop/src/store/gui/actions.ts)
- [Fluidd settings implementation](https://github.com/fluidd-core/fluidd/blob/develop/src/store/config/actions.ts)
