<script>
    import { createEventDispatcher, onMount, onDestroy } from "svelte";
    import CncButton from "./CncButton.svelte";
    import { send, connectionState } from "../../../stores/websocket.js";
    import { machineState } from "../../../stores/machineStore.js";
    import { configStore } from "../../../stores/configStore.js";

    export let isOpen = false;

    const dispatch = createEventDispatcher();

    // State
    let currentPath = "";
    let files = [];
    let directories = [];
    let loading = false;
    let error = null;
    let selectedFile = null;
    let sortBy = "name"; // name, date, size
    let sortAsc = true;

    // Upload state
    let uploading = false;
    let uploadProgress = 0;
    let dragOver = false;
    let fileInput;

    // Reactive state from stores
    $: isPrinting = $machineState.status === 'PRINTING';
    $: isPaused = $machineState.status === 'PAUSED';
    $: canStartPrint = !isPrinting && !isPaused;
    $: isConnected = $connectionState === 'connected';

    // Build breadcrumb path segments
    $: pathSegments = currentPath ? currentPath.split('/').filter(Boolean) : [];

    // Sorted files
    $: sortedFiles = [...files].sort((a, b) => {
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
    $: sortedDirs = [...directories].sort((a, b) => a.dirname.localeCompare(b.dirname));

    // Fetch directory contents using server.files.get_directory
    const fetchDirectory = async (path = "") => {
        if (!isConnected) return;
        
        loading = true;
        error = null;
        selectedFile = null;

        try {
            // Moonraker expects path to include the root prefix (e.g., "gcodes/subdir")
            const fullPath = path ? `gcodes/${path}` : "gcodes";
            const result = await send("server.files.get_directory", {
                path: fullPath,
                extended: true
            });
            
            // The API returns { dirs: [...], files: [...], disk_usage: {...}, root_info: {...} }
            // Filter files to only show gcode files
            files = (result.files || []).filter(item => {
                const name = item.filename || "";
                const ext = name.split('.').pop().toLowerCase();
                return ext === 'gcode' || ext === 'g';
            });
            
            directories = result.dirs || [];
            currentPath = path;
        } catch (e) {
            console.error("Failed to fetch directory:", e);
            error = e.message || "Failed to load files";
            files = [];
            directories = [];
        } finally {
            loading = false;
        }
    };

    // Navigate to a subdirectory
    const navigateToDir = (dirName) => {
        const newPath = currentPath ? `${currentPath}/${dirName}` : dirName;
        fetchDirectory(newPath);
    };

    // Navigate to parent directory
    const navigateUp = () => {
        if (!currentPath) return;
        const parts = currentPath.split('/');
        parts.pop();
        fetchDirectory(parts.join('/'));
    };

    // Navigate to a specific breadcrumb segment
    const navigateToBreadcrumb = (index) => {
        if (index < 0) {
            fetchDirectory("");
        } else {
            const newPath = pathSegments.slice(0, index + 1).join('/');
            fetchDirectory(newPath);
        }
    };

    // Select a file
    const selectFile = (file) => {
        selectedFile = selectedFile === file ? null : file;
    };

    // Start print immediately
    const startPrint = async () => {
        if (!selectedFile || !canStartPrint) return;
        
        const filePath = currentPath 
            ? `${currentPath}/${selectedFile.filename}` 
            : selectedFile.filename;
        
        try {
            await send("printer.print.start", { filename: filePath });
            dispatch("printStarted", { path: filePath, file: selectedFile });
            handleClose();
        } catch (e) {
            console.error("Failed to start print:", e);
            error = e.message || "Failed to start print";
        }
    };

    // Handle file upload
    const handleUpload = async (fileList) => {
        if (!fileList || fileList.length === 0) return;
        
        const file = fileList[0];
        const ext = file.name.split('.').pop().toLowerCase();
        
        if (ext !== 'gcode' && ext !== 'g') {
            error = "Only .gcode and .g files are supported";
            return;
        }

        uploading = true;
        uploadProgress = 0;
        error = null;

        try {
            // Get the server URL from config
            const serverConfig = $configStore.server;
            const baseUrl = `http://${serverConfig.ip}:${serverConfig.port}`;
            
            const formData = new FormData();
            formData.append("file", file);
            if (currentPath) {
                formData.append("path", currentPath);
            }

            const xhr = new XMLHttpRequest();
            
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
                xhr.onerror = () => reject(new Error("Upload failed"));
                xhr.open("POST", `${baseUrl}/server/files/upload`);
                xhr.send(formData);
            });

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
        if (!isOpen) return;
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
        return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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

    // Load directory when modal opens
    $: if (isOpen && isConnected) {
        fetchDirectory(currentPath);
    }

    onMount(() => {
        // Initial fetch will happen via reactive statement
    });
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
        <div class="modal-window">
            <div class="modal-header">
                <span>▸ FILE BROWSER</span>
                <button class="close-btn" on:click={handleClose}>×</button>
            </div>

            <div class="modal-content">
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
                        <div class="upload-bar" style="width: {uploadProgress}%"></div>
                        <span class="upload-text">UPLOADING... {uploadProgress}%</span>
                    </div>
                {/if}

                <!-- File list header -->
                <div class="file-list-header">
                    <button class="sort-btn name" on:click={() => toggleSort("name")}>
                        NAME {sortBy === "name" ? (sortAsc ? "▲" : "▼") : ""}
                    </button>
                    <button class="sort-btn size" on:click={() => toggleSort("size")}>
                        SIZE {sortBy === "size" ? (sortAsc ? "▲" : "▼") : ""}
                    </button>
                    <button class="sort-btn date" on:click={() => toggleSort("date")}>
                        MODIFIED {sortBy === "date" ? (sortAsc ? "▲" : "▼") : ""}
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
                            <button class="file-item directory" on:click={navigateUp}>
                                <span class="file-icon">📁</span>
                                <span class="file-name">..</span>
                                <span class="file-size">—</span>
                                <span class="file-date">—</span>
                            </button>
                        {/if}

                        <!-- Directories -->
                        {#each sortedDirs as dir}
                            <button class="file-item directory" on:click={() => navigateToDir(dir.dirname)}>
                                <span class="file-icon">📁</span>
                                <span class="file-name">{dir.dirname}</span>
                                <span class="file-size">—</span>
                                <span class="file-date">{formatDate(dir.modified)}</span>
                            </button>
                        {/each}

                        <!-- Files -->
                        {#each sortedFiles as file}
                            <button 
                                class="file-item" 
                                class:selected={selectedFile === file}
                                on:click={() => selectFile(file)}
                                on:dblclick={startPrint}
                            >
                                <span class="file-icon">📄</span>
                                <span class="file-name">
                                    {file.filename}
                                    {#if getEstimatedTime(file)}
                                        <span class="file-meta">({getEstimatedTime(file)})</span>
                                    {/if}
                                </span>
                                <span class="file-size">{formatSize(file.size)}</span>
                                <span class="file-date">{formatDate(file.modified)}</span>
                            </button>
                        {/each}
                    {/if}
                </div>

                <!-- Actions -->
                <div class="actions">
                    <input 
                        type="file" 
                        accept=".gcode,.g"
                        bind:this={fileInput}
                        on:change={onFileInputChange}
                        style="display: none;"
                    />
                    <CncButton variant="home" on:click={triggerUpload} disabled={uploading}>
                        UPLOAD
                    </CncButton>
                    <CncButton 
                        variant="action" 
                        on:click={startPrint} 
                        disabled={!selectedFile || !canStartPrint}
                    >
                        {isPrinting || isPaused ? "BUSY" : "PRINT"}
                    </CncButton>
                </div>
            </div>
        </div>
    </div>
{/if}

<style>
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
        align-items: center;
        backdrop-filter: blur(4px);
    }

    .modal-overlay.drag-over {
        background: rgba(0, 100, 0, 0.9);
    }

    .modal-window {
        width: 700px;
        max-width: 90vw;
        max-height: 80vh;
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
        background: linear-gradient(90deg, var(--retro-green-dim) 0%, var(--retro-green) 100%);
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
        min-height: 200px;
        max-height: 350px;
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
        padding: 10px 15px;
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
