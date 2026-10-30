<script>
    import { dialog } from "../../dialog.js";
    import { createEventDispatcher, onMount, onDestroy } from "svelte";
    import ControlButton from "./ControlButton.svelte";
    import ConfirmDialog from "./ConfirmDialog.svelte";
    import InputDialog from "./InputDialog.svelte";
    import { send, connectionState, getConnectionGeneration, onNotification } from "../../../stores/websocket.js";
    import { machineState } from "../../../stores/machineStore.js";
    import { configStore } from "../../../stores/configStore.js";
    import { serverUrl } from "../../config.js";
    import { filePickerPath } from "../../../stores/uiStore.js";

    export let isOpen = false;



    onDestroy(() => {

    });

    const dispatch = createEventDispatcher();

    // State
    $: currentPath = $filePickerPath;
    let files = [];
    let diskUsage;
    let directories = [];
    let loading = false;
    let error = null;
    let selectedItem = null;
    let search = '';
    let fileDetails = null;
    let detailsLoading = false;
    let directoryRequest = 0;
    let detailRequest = 0;
    let lastDirectoryKey = '';
    let uploadRequest;
    $: baseUrl = serverUrl($configStore.server);
    $: selectedInUse = (isPrinting || isPaused) && selectedItem && ($machineState.printFilename === selectedPath || (selectedItem.dirname && $machineState.printFilename.startsWith([currentPath,selectedItem.dirname].filter(Boolean).join('/') + '/')));
    $: selectedPath = selectedItem?.filename ? [currentPath,selectedItem.filename].filter(Boolean).join('/') : '';
    $: thumbnail = fileDetails?.thumbnails?.slice().sort((a,b) => b.width-a.width)[0];
    $: thumbnailUrl = thumbnail && selectedPath ? baseUrl + '/server/files/gcodes/' + [...currentPath.split('/').filter(Boolean), ...thumbnail.relative_path.split('/')].map(encodeURIComponent).join('/') : '';

    let sortBy = "name"; // name, date, size
    let sortAsc = true;

    // Upload state
    let uploading = false;
    let batchUploading = false;
    let uploadLabel = '';
    let uploadProgress = 0;
    let dragOver = false;
    let fileInput;

    // Confirm dialog state
    let confirmOpen = false;
    let confirmMessage = "";
    let confirmCallback = () => {};

    // Input dialog state
    let inputOpen = false;
    let inputTitle = "";
    let inputMessage = "";
    let inputValue = "";
    let inputPlaceholder = "";
    let inputCallback = () => {};

    // Reactive state from stores
    $: isPrinting = $machineState.status === "PRINTING";
    $: isPaused = $machineState.status === "PAUSED";
    $: canStartPrint = $machineState.isReady && !isPrinting && !isPaused;
    $: isConnected = $connectionState === "connected";

    // Build breadcrumb path segments
    $: pathSegments = currentPath ? currentPath.split("/").filter(Boolean) : [];

    // Sorted files
    $: sortedFiles = files.filter(f => f.filename.toLowerCase().includes(search.toLowerCase())).sort((a, b) => {
        let cmp = 0;
        if (sortBy === "name") {
            cmp = a.filename.localeCompare(b.filename);
        } else if (sortBy === "date") {
            cmp = (a.modified || 0) - (b.modified || 0);
        } else if (sortBy === "size") {
            cmp = (a.size || 0) - (b.size || 0);
        }
        return sortAsc ? cmp : -cmp;
    });

    // Sorted directories
    $: sortedDirs = directories.filter(d => !d.dirname.startsWith('.') && d.dirname.toLowerCase().includes(search.toLowerCase())).sort((a, b) =>
        a.dirname.localeCompare(b.dirname),
    );

    // Fetch directory contents using server.files.get_directory
    const fetchDirectory = async (path = "") => {
        if (!isConnected) return;

        const request = ++directoryRequest, generation = getConnectionGeneration();
        lastDirectoryKey = generation + ':' + path;
        loading = true; error = null; selectedItem = null; fileDetails = null; detailRequest++;


        try {
            // Moonraker expects path to include the root prefix (e.g., "gcodes/subdir")
            const fullPath = path ? `gcodes/${path}` : "gcodes";
            const result = await send("server.files.get_directory", {
                path: fullPath,
                extended: true,
            });

            if (request !== directoryRequest || generation !== getConnectionGeneration() || path !== $filePickerPath) return;
            // The API returns { dirs: [...], files: [...], disk_usage: {...}, root_info: {...} }
            // Filter files to only show gcode files
            files = (result.files || []).filter((item) => {
                const name = item.filename || "";
                const ext = name.split(".").pop().toLowerCase();
                return ["gcode", "g", "gco", "ufp"].includes(ext);
            });

            directories = result.dirs || [];
            diskUsage = result.disk_usage;
        } catch (e) {
            if (request !== directoryRequest || generation !== getConnectionGeneration() || path !== $filePickerPath) return;
            console.error("Failed to fetch directory:", e);
            error = e.message || "Failed to load files";
            files = [];
            directories = [];
        } finally {
            if (request === directoryRequest) loading = false;
        }
    };

    // Navigate to a subdirectory
    const navigateToDir = (dirName) => {
        const newPath = currentPath ? `${currentPath}/${dirName}` : dirName;
        $filePickerPath = newPath;
    };

    // Navigate to parent directory
    const navigateUp = () => {
        if (!currentPath) return;
        const parts = currentPath.split("/");
        parts.pop();
        $filePickerPath = parts.join("/");
    };

    // Navigate to a specific breadcrumb segment
    const navigateToBreadcrumb = (index) => {
        if (index < 0) {
            $filePickerPath = '';
        } else {
            const newPath = pathSegments.slice(0, index + 1).join("/");
            $filePickerPath = newPath;
        }
    };

    // Select a file or directory
    const selectItem = async (item) => {
        selectedItem = selectedItem === item ? null : item;
        fileDetails = null;
        const request = ++detailRequest, generation = getConnectionGeneration();
        if (!selectedItem?.filename) return;
        const filename = [currentPath,item.filename].filter(Boolean).join('/');
        detailsLoading = true;
        try {
            const metadata = await send('server.files.metadata', { filename });
            if (request === detailRequest && generation === getConnectionGeneration()) fileDetails = metadata;
        } catch (e) { if (request === detailRequest && generation === getConnectionGeneration()) error = e.message; }
        finally { if (request === detailRequest) detailsLoading = false; }
    };

    const showInput = (title, message, value, placeholder, callback) => {
        inputTitle = title;
        inputMessage = message;
        inputValue = value;
        inputPlaceholder = placeholder;
        inputCallback = callback;
        inputOpen = true;
    };

    const handleDelete = () => {
        if (!selectedItem) return;

        const isDir = !!selectedItem.dirname;
        const name = isDir ? selectedItem.dirname : selectedItem.filename;
        const itemPath = currentPath ? `${currentPath}/${name}` : name;
        const fullRootPath = `gcodes/${itemPath}`;

        confirmMessage = `Permanently delete "${name}"?`;
        confirmCallback = async () => {
            try {
                if (isDir) {
                    await send("server.files.delete_directory", {
                        path: fullRootPath,
                        force: true,
                    });
                } else {
                    await send("server.files.delete_file", {
                        path: fullRootPath,
                    });
                }
                fetchDirectory(currentPath);
            } catch (e) {
                error = `Delete failed: ${e.message}`;
            }
        };
        confirmOpen = true;
    };

    const handleRename = () => {
        if (!selectedItem) return;
        const isDir = !!selectedItem.dirname;
        const oldName = isDir ? selectedItem.dirname : selectedItem.filename;

        showInput(
            "RENAME",
            `Rename "${oldName}" to:`,
            oldName,
            "New name",
            async (newName) => {
                if (!newName || newName === oldName) return;
                try {
                    const oldPath = currentPath
                        ? `${currentPath}/${oldName}`
                        : oldName;
                    const source = `gcodes/${oldPath}`;
                    const dest = currentPath
                        ? `gcodes/${currentPath}/${newName}`
                        : `gcodes/${newName}`;
                    await send("server.files.move", { source, dest });
                    fetchDirectory(currentPath);
                } catch (e) {
                    error = `Rename failed: ${e.message}`;
                }
            },
        );
    };

    const handleMove = () => {
        if (!selectedItem) return;
        const isDir = !!selectedItem.dirname;
        const name = isDir ? selectedItem.dirname : selectedItem.filename;
        const oldPath = currentPath ? `${currentPath}/${name}` : name;

        showInput(
            "MOVE",
            "Enter new path (relative to gcodes root):",
            oldPath,
            "path/to/destination",
            async (newPath) => {
                if (!newPath || newPath === oldPath) return;
                try {
                    const source = `gcodes/${oldPath}`;
                    const dest = `gcodes/${newPath}`;
                    await send("server.files.move", { source, dest });
                    fetchDirectory(currentPath);
                } catch (e) {
                    error = `Move failed: ${e.message}`;
                }
            },
        );
    };

    const handleNewFolder = () => {
        showInput(
            "NEW FOLDER",
            "Enter folder name:",
            "",
            "New Folder",
            async (name) => {
                if (!name) return;
                try {
                    const newPath = currentPath
                        ? `gcodes/${currentPath}/${name}`
                        : `gcodes/${name}`;
                    await send("server.files.post_directory", {
                        path: newPath,
                    });
                    fetchDirectory(currentPath);
                } catch (e) {
                    error = `Create folder failed: ${e.message}`;
                }
            },
        );
    };

    const showConfirm = (message, callback) => {
        confirmMessage = message;
        confirmCallback = callback;
        confirmOpen = true;
    };

    // Start print immediately
    const startPrint = async () => {
        // Can only print files
        if (!selectedItem || selectedItem.dirname || !canStartPrint) return;

        const filePath = currentPath
            ? `${currentPath}/${selectedItem.filename}`
            : selectedItem.filename;

        const doPrint = async () => {
            try {
                await send("printer.print.start", { filename: filePath });
                dispatch("printStarted", {
                    path: filePath,
                    file: selectedItem,
                });
                handleClose();
            } catch (e) {
                console.error("Failed to start print:", e);
                error = e.message || "Failed to start print";
            }
        };

        if ($configStore.printControl?.confirmStartPrint ?? true) {
            showConfirm(`Start printing "${selectedItem.filename}"?`, doPrint);
        } else {
            await doPrint();
        }
    };

    const handleUpload = async fileList => {
        if (batchUploading || !fileList?.length) return;
        const generation = getConnectionGeneration();
        batchUploading = true;
        try {
            const queue = Array.from(fileList);
            for(let index = 0; index < queue.length; index++) {
                if(generation !== getConnectionGeneration()) break;
                uploadLabel = `${index+1}/${queue.length} ${queue[index].name}`;
                await uploadSingle([queue[index]]);
                if(error) break;
            }
        } finally {batchUploading = false; uploadLabel = '';}
    };

    // Handle file upload
    const uploadSingle = async (fileList) => {
        if (import.meta.env.VITE_READ_ONLY === "true") {error = "Uploads are disabled in read-only validation mode"; return;}
        if (!fileList || fileList.length === 0) return;

        const file = fileList[0];
        const ext = file.name.split(".").pop().toLowerCase();

        if (!["gcode", "g", "gco", "ufp"].includes(ext)) {
            error = "Only .gcode, .g, .gco and .ufp files are supported";
            return;
        }

        uploading = true;
        uploadProgress = 0;
        error = null;

        try {
            // Get the server URL from config
            const serverConfig = $configStore.server;
            const baseUrl = serverUrl(serverConfig);
            const generation = getConnectionGeneration();

            const formData = new FormData();
            formData.append("file", file);
            formData.append("root", "gcodes");
            if (currentPath) {
                formData.append("path", currentPath);
            }

            const xhr = new XMLHttpRequest();
            uploadRequest = xhr;
            xhr.timeout = 120000;

            xhr.upload.addEventListener("progress", (e) => {
                if (e.lengthComputable) {
                    uploadProgress = Math.round((e.loaded / e.total) * 100);
                }
            });

            await new Promise((resolve, reject) => {
                xhr.onload = () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve(xhr.response);
                    } else {
                        reject(new Error(`Upload failed: ${xhr.statusText}`));
                    }
                };
                xhr.onabort = () => reject(new Error("Upload cancelled because the connection changed"));
                xhr.ontimeout = () => reject(new Error("Upload timed out"));
                xhr.onerror = () => reject(new Error("Upload failed"));
                xhr.open("POST", `${baseUrl}/server/files/upload`);
                xhr.send(formData);
            });

            if (generation !== getConnectionGeneration()) return;
            // Refresh directory
            await fetchDirectory(currentPath);
        } catch (e) {
            console.error("Upload failed:", e);
            error = e.message || "Upload failed";
        } finally {
            uploading = false;
            uploadProgress = 0;
        }
    };

    // Handle file input change
    const onFileInputChange = (e) => {
        handleUpload(e.target.files);
        e.target.value = ""; // Reset input
    };

    // Trigger file input click
    const triggerUpload = () => {
        fileInput?.click();
    };

    // Drag and drop handlers
    const handleDragOver = (e) => {
        e.preventDefault();
        dragOver = true;
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        dragOver = false;
    };

    const handleDrop = (e) => {
        e.preventDefault();
        dragOver = false;
        handleUpload(e.dataTransfer.files);
    };

    // Close modal
    const handleClose = () => {
        isOpen = false;
        dispatch("close");
    };

    // Keyboard handler
    const handleKeydown = (e) => {
        if (!isOpen || confirmOpen || inputOpen) return;
        if (e.key === "Escape") {
            e.preventDefault();
            handleClose();
        }
    };

    // Click outside to close
    const handleOverlayClick = (e) => {
        if (e.target === e.currentTarget) {
            handleClose();
        }
    };

    // Toggle sort
    const toggleSort = (column) => {
        if (sortBy === column) {
            sortAsc = !sortAsc;
        } else {
            sortBy = column;
            sortAsc = true;
        }
    };

    // Format file size
    const formatSize = (bytes) => {
        if (!bytes) return "—";
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    };

    // Format date
    const formatDate = (timestamp) => {
        if (!timestamp) return "—";
        const date = new Date(timestamp * 1000);
        return (
            date.toLocaleDateString() +
            " " +
            date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        );
    };

    // Get estimated print time if available
    const getEstimatedTime = (file) => {
        if (file.estimated_time) {
            const hrs = Math.floor(file.estimated_time / 3600);
            const mins = Math.floor((file.estimated_time % 3600) / 60);
            if (hrs > 0) {
                return `${hrs}h ${mins}m`;
            }
            return `${mins}m`;
        }
        return null;
    };

    // One request per view/path/session, with stale response suppression.
    $: if (isOpen && isConnected && lastDirectoryKey !== getConnectionGeneration() + ':' + $filePickerPath) fetchDirectory($filePickerPath);
    $: if (!isOpen || !isConnected) { lastDirectoryKey = ''; directoryRequest++; detailRequest++; selectedItem = null; fileDetails = null; }
    $: if (!isConnected) { files = []; directories = []; confirmOpen = false; inputOpen = false; uploadRequest?.abort(); }
    const stopFiles = onNotification(method => { if (method === 'notify_filelist_changed' && isOpen && isConnected && !uploading) fetchDirectory(currentPath); });
    onDestroy(() => { stopFiles(); directoryRequest++; detailRequest++; uploadRequest?.abort(); });
</script>

<svelte:window on:keydown={handleKeydown} />

{#if isOpen}
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div
        class="modal-overlay"
        on:click={handleOverlayClick}
        on:dragover={handleDragOver}
        on:dragleave={handleDragLeave}
        on:drop={handleDrop}
        class:drag-over={dragOver}
        role="dialog"
        aria-modal="true"
        aria-label="File Browser"
        tabindex="-1"
    >
        <div class="modal-window" use:dialog={{label: "FilePicker", close: handleClose}}>
            <div class="modal-header">
                <span>▸ FILE BROWSER</span>
                <div class="header-actions">
                    <button
                        class="upload-btn"
                        on:click={triggerUpload}
                        disabled={batchUploading || uploading || import.meta.env.VITE_READ_ONLY === "true"}
                    >
                        {uploading ? "UPLOADING..." : "UPLOAD"}
                    </button>
                    <button class="close-btn" on:click={handleClose}>×</button>
                </div>
            </div>

            <div class="modal-content">
                <div class="file-tools"><input aria-label="Filter files" placeholder="Filter files…" bind:value={search} /><button on:click={() => fetchDirectory(currentPath)} disabled={loading}>REFRESH</button><span>{files.length} files {diskUsage ? ' · ' + formatSize(diskUsage.free) + ' free' : ''}</span></div>
                <!-- Breadcrumb Navigation -->
                <div class="breadcrumb">
                    <button
                        class="breadcrumb-item"
                        class:active={currentPath === ""}
                        on:click={() => navigateToBreadcrumb(-1)}
                    >
                        ROOT
                    </button>
                    {#each pathSegments as segment, i}
                        <span class="breadcrumb-separator">/</span>
                        <button
                            class="breadcrumb-item"
                            class:active={i === pathSegments.length - 1}
                            on:click={() => navigateToBreadcrumb(i)}
                        >
                            {segment.toUpperCase()}
                        </button>
                    {/each}
                </div>

                <!-- Error display -->
                {#if error}
                    <div class="error-msg">ERROR: {error}</div>
                {/if}

                <!-- Upload progress -->
                {#if uploading}
                    <div class="upload-progress">
                        <div
                            class="upload-bar"
                            style="width: {uploadProgress}%"
                        ></div>
                        <span class="upload-text"
                            >UPLOADING {uploadLabel} {uploadProgress}%</span
                        >
                    </div>
                {/if}

                <!-- File list header -->
                <div class="file-list-header">
                    <button
                        class="sort-btn name"
                        on:click={() => toggleSort("name")}
                    >
                        NAME {sortBy === "name" ? (sortAsc ? "▲" : "▼") : ""}
                    </button>
                    <button
                        class="sort-btn size"
                        on:click={() => toggleSort("size")}
                    >
                        SIZE {sortBy === "size" ? (sortAsc ? "▲" : "▼") : ""}
                    </button>
                    <button
                        class="sort-btn date"
                        on:click={() => toggleSort("date")}
                    >
                        MODIFIED {sortBy === "date"
                            ? sortAsc
                                ? "▲"
                                : "▼"
                            : ""}
                    </button>
                </div>

                <!-- File list -->
                <div class="file-list" class:loading>
                    {#if loading}
                        <div class="loading-indicator">LOADING...</div>
                    {:else if sortedDirs.length === 0 && sortedFiles.length === 0}
                        <div class="empty-message">
                            {#if dragOver}
                                DROP FILES HERE
                            {:else}
                                NO FILES FOUND
                            {/if}
                        </div>
                    {:else}
                        <!-- Parent directory -->
                        {#if currentPath}
                            <button
                                class="file-item directory"
                                on:click={navigateUp}
                            >
                                <span class="file-icon">📁</span>
                                <span class="file-name">..</span>
                                <span class="file-size">—</span>
                                <span class="file-date">—</span>
                            </button>
                        {/if}

                        <!-- Directories -->
                        {#each sortedDirs as dir}
                            <button
                                class="file-item directory"
                                class:selected={selectedItem === dir}
                                on:click={() => selectItem(dir)}
                                on:dblclick={() => navigateToDir(dir.dirname)}
                                on:keydown={e => {if(e.key === "Enter") navigateToDir(dir.dirname);}}
                            >
                                <span class="file-icon">📁</span>
                                <span class="file-name">{dir.dirname}</span>
                                <span class="file-size">—</span>
                                <span class="file-date"
                                    >{formatDate(dir.modified)}</span
                                >
                            </button>
                        {/each}

                        <!-- Files -->
                        {#each sortedFiles as file}
                            <button
                                class="file-item"
                                class:selected={selectedItem === file}
                                on:click={() => selectItem(file)}
                                on:dblclick={() => selectItem(file)}
                            >
                                <span class="file-icon">📄</span>
                                <span class="file-name">
                                    {file.filename}
                                    {#if getEstimatedTime(file)}
                                        <span class="file-meta"
                                            >({getEstimatedTime(file)})</span
                                        >
                                    {/if}
                                </span>
                                <span class="file-size"
                                    >{formatSize(file.size)}</span
                                >
                                <span class="file-date"
                                    >{formatDate(file.modified)}</span
                                >
                            </button>
                        {/each}
                    {/if}
                </div>

                {#if selectedPath}
                <div class="file-details" aria-live="polite">
                    {#if thumbnailUrl}<img src={thumbnailUrl} alt="Selected print preview" />{/if}
                    <div><strong>{selectedItem.filename}</strong><p>{detailsLoading ? 'Loading metadata…' : fileDetails ? `Print: ${getEstimatedTime(fileDetails) || 'Unknown'} · Filament: ${((fileDetails.filament_total || 0)/1000).toFixed(2)} m · Layers: ${fileDetails.layer_count || '—'} · Slicer: ${fileDetails.slicer || 'Unknown'}` : 'No metadata available'}</p>
                    <a href={baseUrl + '/server/files/gcodes/' + selectedPath.split('/').map(encodeURIComponent).join('/')} download target="_blank" rel="noopener noreferrer">DOWNLOAD G-CODE</a></div>
                </div>
                {/if}
                <!-- Actions -->
                <div class="actions">
                    <input
                        type="file"
                        accept=".gcode,.g,.gco,.ufp"
                        multiple
                        bind:this={fileInput}
                        on:change={onFileInputChange}
                        style="display: none;"
                    />
                    <ControlButton variant="standard" on:click={handleNewFolder}>
                        NEW FOLDER
                    </ControlButton>
                    <ControlButton
                        variant="action"
                        on:click={startPrint}
                        disabled={!selectedItem ||
                            !!selectedItem.dirname ||
                            !canStartPrint}
                    >
                        {isPrinting || isPaused ? "BUSY" : "PRINT"}
                    </ControlButton>

                    <ControlButton
                        variant="standard"
                        disabled={!selectedItem || selectedInUse}
                        on:click={handleRename}
                    >
                        RENAME
                    </ControlButton>
                    <ControlButton
                        variant="standard"
                        disabled={!selectedItem || selectedInUse}
                        on:click={handleMove}
                    >
                        MOVE
                    </ControlButton>
                    <ControlButton
                        variant="danger"
                        disabled={!selectedItem || selectedInUse}
                        on:click={handleDelete}
                    >
                        DELETE
                    </ControlButton>
                </div>
            </div>
        </div>
    </div>
{/if}

<!-- Confirm Dialog -->
<ConfirmDialog
    bind:isOpen={confirmOpen}
    message={confirmMessage}
    onConfirm={confirmCallback}
    onCancel={() => {}}
/>

<!-- Input Dialog -->
<InputDialog
    bind:isOpen={inputOpen}
    title={inputTitle}
    message={inputMessage}
    value={inputValue}
    placeholder={inputPlaceholder}
    onConfirm={inputCallback}
    onCancel={() => {}}
/>

<style>
.file-tools { display:flex; flex-wrap:wrap; gap:10px; align-items:center; } .file-tools input { flex:1; min-width:120px; background:#080c09; color:var(--retro-green); border:1px solid #405447; padding:8px; font:inherit; }.file-tools button { padding:8px; background:#080c09; color:var(--retro-green); border:1px solid #405447; cursor:pointer; }.file-tools span { color:#a0aba3; font-size:12px; }
.file-details { display:flex; align-items:center; gap:14px; padding:12px; background:#080e0b; border:1px solid #304236; overflow-wrap:anywhere; }.file-details img { width:100px; height:100px; object-fit:contain; }.file-details p { font-size:12px; color:#a1aca4; margin:8px 0; }.file-details a { color:var(--retro-green); font-size:12px; }

    .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.9);
        z-index: 2000;
        display: flex;
        justify-content: center;
        align-items: flex-start;
        padding-top: 50px;
        backdrop-filter: blur(4px);
    }

    .modal-overlay.drag-over {
        background: rgba(0, 100, 0, 0.9);
    }

    .modal-window {
        width: 1200px;
        max-width: 90vw;
        height: min(900px, 94dvh);
        max-height: 94dvh;
        background: var(--bg-module);
        border: 4px solid var(--border-color);
        box-shadow:
            0 0 50px rgba(0, 255, 0, 0.1),
            0 0 0 2px #000;
        display: flex;
        flex-direction: column;
    }

    .modal-header {
        font-family: "Orbitron", monospace;
        font-size: 20px;
        font-weight: 900;
        color: var(--retro-green);
        padding: 15px;
        background: #000;
        border-bottom: 2px solid var(--border-color);
        letter-spacing: 2px;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .header-actions {
        display: flex;
        align-items: center;
        gap: 15px;
    }

    .upload-btn {
        background: linear-gradient(
            180deg,
            var(--retro-orange) 0%,
            var(--retro-orange-dim) 100%
        );
        border: 1px solid #ff8833;
        color: #000;
        padding: 5px 15px;
        font-family: "Orbitron", monospace;
        font-size: 12px;
        font-weight: bold;
        cursor: pointer;
        letter-spacing: 1px;
    }

    .upload-btn:hover {
        background: linear-gradient(180deg, #ff7722 0%, #dd6611 100%);
        color: var(--green);
    }

    .upload-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .close-btn {
        background: none;
        border: none;
        color: var(--retro-green);
        font-size: 24px;
        cursor: pointer;
        padding: 0 5px;
        line-height: 1;
    }

    .close-btn:hover {
        color: var(--retro-red);
    }

    .modal-content {
        min-height: 0;
        flex: 1;
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 15px;
        overflow: hidden;
        flex: 1;
    }

    /* Breadcrumb */
    .breadcrumb {
        display: flex;
        align-items: center;
        gap: 5px;
        padding: 10px;
        background: #0a0a0a;
        border: 2px solid #333;
        overflow-x: auto;
    }

    .breadcrumb-item {
        background: none;
        border: none;
        color: #666;
        font-family: "Share Tech Mono", monospace;
        font-size: 12px;
        cursor: pointer;
        padding: 4px 8px;
    }

    .breadcrumb-item:hover {
        color: var(--retro-green);
    }

    .breadcrumb-item.active {
        color: var(--retro-orange);
    }

    .breadcrumb-separator {
        color: #444;
    }

    /* Error */
    .error-msg {
        color: var(--retro-red);
        background: rgba(255, 0, 0, 0.1);
        border: 1px solid var(--retro-red-dim);
        padding: 10px;
        font-size: 12px;
        font-family: "Share Tech Mono", monospace;
    }

    /* Upload progress */
    .upload-progress {
        position: relative;
        height: 24px;
        background: #1a1a1a;
        border: 2px solid #333;
        overflow: hidden;
    }

    .upload-bar {
        position: absolute;
        top: 0;
        left: 0;
        height: 100%;
        background: linear-gradient(
            90deg,
            var(--retro-green-dim) 0%,
            var(--retro-green) 100%
        );
        transition: width 0.2s ease;
    }

    .upload-text {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-family: "Share Tech Mono", monospace;
        font-size: 11px;
        color: var(--retro-green);
        text-shadow: 0 0 5px #000;
    }

    /* File list header */
    .file-list-header {
        display: grid;
        grid-template-columns: 1fr 100px 150px;
        gap: 10px;
        padding: 8px 15px;
        background: #111;
        border: 2px solid #333;
    }

    .sort-btn {
        background: none;
        border: none;
        color: #666;
        font-family: "Orbitron", monospace;
        font-size: 10px;
        letter-spacing: 1px;
        cursor: pointer;
        text-align: left;
        padding: 0;
    }

    .sort-btn:hover {
        color: var(--retro-green);
    }

    .sort-btn.size,
    .sort-btn.date {
        text-align: right;
    }

    /* File list */
    .file-list {
        flex: 1;
        overflow-y: auto;
        background: #0a0a0a;
        border: 2px solid #333;
        min-height: 160px;
        max-height: none;
    }

    .file-list.loading {
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .loading-indicator,
    .empty-message {
        font-family: "Share Tech Mono", monospace;
        font-size: 14px;
        color: #666;
        text-align: center;
        padding: 40px;
    }

    .loading-indicator {
        animation: blink 1s infinite;
    }

    /* File items */
    .file-item {
        display: grid;
        grid-template-columns: 24px 1fr 100px 150px;
        gap: 10px;
        align-items: center;
        padding: 8px 12px;
        background: none;
        border: none;
        border-bottom: 1px solid #222;
        cursor: pointer;
        width: 100%;
        text-align: left;
        transition: background 0.1s;
    }

    .file-item:hover {
        background: #1a1a1a;
    }

    .file-item.selected {
        background: rgba(0, 255, 0, 0.1);
        border-color: var(--retro-green-dim);
    }

    .file-item.directory {
        color: var(--retro-orange);
    }

    .file-icon {
        font-size: 16px;
    }

    .file-name {
        font-family: "Share Tech Mono", monospace;
        font-size: 13px;
        color: var(--retro-green);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .file-item.directory .file-name {
        color: var(--retro-orange);
    }

    .file-meta {
        color: #666;
        font-size: 11px;
        margin-left: 8px;
    }

    .file-size,
    .file-date {
        font-family: "Share Tech Mono", monospace;
        font-size: 11px;
        color: #666;
        text-align: right;
    }

    /* Actions */
    .actions {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 15px;
        margin-top: 5px;
    }

    @keyframes blink {
        50% {
            opacity: 0.5;
        }
    }

    /* Scrollbar styling */
    .file-list::-webkit-scrollbar {
        width: 8px;
    }

    .file-list::-webkit-scrollbar-track {
        background: #0a0a0a;
    }

    .file-list::-webkit-scrollbar-thumb {
        background: #333;
        border-radius: 0;
    }

    .file-list::-webkit-scrollbar-thumb:hover {
        background: #444;
    }
</style>
