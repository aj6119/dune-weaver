// Global variables
let selectedFile = null;
let playlist = [];
let selectedPlaylistIndex = null;
let allFiles = [];

// Define constants for log message types
const LOG_TYPE = {
    SUCCESS: 'success',
    WARNING: 'warning',
    ERROR: 'error',
    INFO: 'info',
    DEBUG: 'debug'
};

// Enhanced logMessage with notification system
function logMessage(message, type = LOG_TYPE.DEBUG) {
    const log = document.getElementById('status_log');
    const header = document.querySelector('header');

    if (!header) {
        console.error('Error: <header> element not found');
        return;
    }

    // Debug messages only go to the status log
    if (type === LOG_TYPE.DEBUG) {
        if (!log) {
            console.error('Error: #status_log element not found');
            return;
        }
        const entry = document.createElement('p');
        entry.textContent = message;
        log.appendChild(entry);
        log.scrollTop = log.scrollHeight; // Scroll to the bottom of the log
        return;
    }

    // Clear any existing notifications
    const existingNotification = header.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }

    // Create a notification for other message types
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;

    // Add a close button
    const closeButton = document.createElement('button');
    closeButton.textContent = '×';
    closeButton.className = 'close-button';
    closeButton.onclick = () => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 250); // Match transition duration
    };
    notification.appendChild(closeButton);

    // Append the notification to the header
    header.appendChild(notification);

    // Trigger the transition
    requestAnimationFrame(() => {
        notification.classList.add('show');
    });

    // Auto-remove the notification after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 250); // Match transition duration
        }
    }, 5000);

    // Also log the message to the status log if available
    if (log) {
        const entry = document.createElement('p');
        entry.textContent = message;
        log.appendChild(entry);
        log.scrollTop = log.scrollHeight; // Scroll to the bottom of the log
    }
}

function toggleDebugLog() {
    const statusLog = document.getElementById('status_log');
    const debugButton = document.getElementById('debug_button');

    if (statusLog.style.display === 'block') {
        statusLog.style.display = 'none';
        debugButton.classList.remove('active');
    } else {
        statusLog.style.display = 'block';
        debugButton.classList.add( 'active');
        statusLog.scrollIntoView({ behavior: 'smooth', block: 'start' }); // Smooth scrolling to the log
    }
}

// File selection logic
async function selectFile(file, listItem) {
    selectedFile = file;

    // Highlight the selected file
    document.querySelectorAll('#theta_rho_files li').forEach(li => li.classList.remove('selected'));
    listItem.classList.add('selected');

    // Update the Remove button visibility
    const removeButton = document.querySelector('#pattern-preview-container .remove-button');
    if (file.startsWith('custom_patterns/')) {
        removeButton.classList.remove('hidden');
    } else {
        removeButton.classList.add('hidden');
    }

    logMessage(`Selected file: ${file}`);
    await previewPattern(file);

    // Populate the playlist dropdown after selecting a pattern
    await populatePlaylistDropdown();
}

// Fetch and display Theta-Rho files
async function loadThetaRhoFiles() {
    try {
        logMessage('Loading Theta-Rho files...');
        const response = await fetch('/list_theta_rho_files');
        let files = await response.json();

        files = files.filter(file => file.endsWith('.thr'));
        // Sort files with custom_patterns on top and all alphabetically sorted
        const sortedFiles = files.sort((a, b) => {
            const isCustomA = a.startsWith('custom_patterns/');
            const isCustomB = b.startsWith('custom_patterns/');

            if (isCustomA && !isCustomB) return -1; // a comes first
            if (!isCustomA && isCustomB) return 1;  // b comes first
            return a.localeCompare(b);             // Alphabetical comparison
        });

        allFiles = sortedFiles; // Update global files
        displayFiles(sortedFiles); // Display sorted files

        logMessage('Theta-Rho files loaded and sorted successfully.');
    } catch (error) {
        logMessage(`Error loading Theta-Rho files: ${error.message}`, 'error');
    }
}

// Display files in the UI
function displayFiles(files) {
    const ul = document.getElementById('theta_rho_files');
    if (!ul) {
        logMessage('Error: File list container not found');
        return;
    }
    ul.innerHTML = ''; // Clear existing list

    files.forEach(file => {
        const li = document.createElement('li');
        li.textContent = file;
        li.classList.add('file-item');

        // Attach file selection handler
        li.onclick = () => selectFile(file, li);

        ul.appendChild(li);
    });
}

// Filter files by search input
function searchPatternFiles() {
    const searchInput = document.getElementById('search_pattern').value.toLowerCase();
    const filteredFiles = allFiles.filter(file => file.toLowerCase().includes(searchInput));
    displayFiles(filteredFiles);
}

// Upload a new Theta-Rho file
async function uploadThetaRho() {
    const fileInput = document.getElementById('upload_file');
    const file = fileInput.files[0];
    if (!file) {
        logMessage('No file selected for upload.', LOG_TYPE.ERROR);
        return;
    }

    try {
        logMessage(`Uploading file: ${file.name}...`);
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/upload_theta_rho', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();
        if (result.success) {
            logMessage(`File uploaded successfully: ${file.name}`, LOG_TYPE.SUCCESS);
            fileInput.value = '';
            await loadThetaRhoFiles();
        } else {
            logMessage(`Failed to upload file: ${file.name}`, LOG_TYPE.ERROR);
        }
    } catch (error) {
        logMessage(`Error uploading file: ${error.message}`);
    }
}

async function runThetaRho() {
    if (!selectedFile) {
        logMessage("No file selected to run.");
        return;
    }

    // Get the selected pre-execution action
    const preExecutionAction = document.querySelector('input[name="pre_execution"]:checked').value;

    logMessage(`Running file: ${selectedFile} with pre-execution action: ${preExecutionAction}...`);
    const response = await fetch('/run_theta_rho', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_name: selectedFile, pre_execution: preExecutionAction })
    });

    const result = await response.json();
    if (result.success) {
        logMessage(`Pattern running: ${selectedFile}`, LOG_TYPE.SUCCESS);
    } else {
        logMessage(`Failed to run file: ${selectedFile}`,LOG_TYPE.ERROR);
    }
}

async function stopExecution() {
    logMessage('Stopping execution...');
    const response = await fetch('/stop_execution', { method: 'POST' });
    const result = await response.json();
    if (result.success) {
        logMessage('Execution stopped.',LOG_TYPE.SUCCESS);
    } else {
        logMessage('Failed to stop execution.',LOG_TYPE.ERROR);
    }
}

let isPaused = false;

function togglePausePlay() {
    const button = document.getElementById("pausePlayButton");

    if (isPaused) {
        // Resume execution
        fetch('/resume_execution', { method: 'POST' })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    isPaused = false;
                    button.innerHTML = "⏸"; // Change to pause icon
                }
            })
            .catch(error => console.error("Error resuming execution:", error));
    } else {
        // Pause execution
        fetch('/pause_execution', { method: 'POST' })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    isPaused = true;
                    button.innerHTML = "▶"; // Change to play icon
                }
            })
            .catch(error => console.error("Error pausing execution:", error));
    }
}

function removeCurrentPattern() {
    if (!selectedFile) {
        logMessage('No file selected to remove.', LOG_TYPE.ERROR);
        return;
    }

    if (!selectedFile.startsWith('custom_patterns/')) {
        logMessage('Only custom patterns can be removed.', LOG_TYPE.WARNING);
        return;
    }

    removeCustomPattern(selectedFile);
}

// Delete the selected file
async function removeCustomPattern(fileName) {
    const userConfirmed = confirm(`Are you sure you want to delete the pattern "${fileName}"?`);
    if (!userConfirmed) return;

    try {
        logMessage(`Deleting pattern: ${fileName}...`);
        const response = await fetch('/delete_theta_rho_file', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file_name: fileName })
        });

        const result = await response.json();
        if (result.success) {
            logMessage(`File deleted successfully: ${selectedFile}`, LOG_TYPE.SUCCESS);

            // Close the preview container
            const previewContainer = document.getElementById('pattern-preview-container');
            if (previewContainer) {
                previewContainer.classList.add('hidden');
                previewContainer.classList.remove('visible');
            }

            // Clear the selected file and refresh the file list
            selectedFile = null;
            await loadThetaRhoFiles(); // Refresh the file list
        } else {
            logMessage(`Failed to delete pattern "${fileName}": ${result.error}`, LOG_TYPE.ERROR);
        }
    } catch (error) {
        logMessage(`Error deleting pattern: ${error.message}`);
    }
}

// Preview a Theta-Rho file
async function previewPattern(fileName) {
    try {
        logMessage(`Fetching data to preview file: ${fileName}...`);
        const response = await fetch('/preview_thr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file_name: fileName })
        });

        const result = await response.json();
        if (result.success) {
            const coordinates = result.coordinates;
            renderPattern(coordinates);

            // Update coordinate display
            const firstCoord = coordinates[0];
            const lastCoord = coordinates[coordinates.length - 1];
            document.getElementById('first_coordinate').textContent = `First Coordinate: θ=${firstCoord[0]}, ρ=${firstCoord[1]}`;
            document.getElementById('last_coordinate').textContent = `Last Coordinate: θ=${lastCoord[0]}, ρ=${lastCoord[1]}`;

            // Show the preview container
            const previewContainer = document.getElementById('pattern-preview-container');
            if (previewContainer) {
                previewContainer.classList.remove('hidden');
                previewContainer.classList.add('visible');
            }

            // Close the "Add to Playlist" container if it is open
            const addToPlaylistContainer = document.getElementById('add-to-playlist-container');
            if (addToPlaylistContainer && !addToPlaylistContainer.classList.contains('hidden')) {
                toggleSecondaryButtons('add-to-playlist-container'); // Hide the container
            }

        } else {
            logMessage(`Failed to fetch preview for file: ${fileName}`, LOG_TYPE.WARNING);
        }
    } catch (error) {
        logMessage(`Error previewing pattern: ${error.message}`, LOG_TYPE.WARNING);
    }
}

// Render the pattern on a canvas
function renderPattern(coordinates) {
    const canvas = document.getElementById('patternPreviewCanvas');
    if (!canvas) {
        logMessage('Error: Canvas not found');
        return;
    }

    const ctx = canvas.getContext('2d');

    // Account for device pixel ratio
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    canvas.width = rect.width * dpr;  // Scale canvas width for high DPI
    canvas.height = rect.height * dpr;  // Scale canvas height for high DPI

    ctx.scale(dpr, dpr);  // Scale drawing context

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const centerX = rect.width / 2;  // Use bounding client rect dimensions
    const centerY = rect.height / 2;
    const maxRho = Math.max(...coordinates.map(coord => coord[1]));
    const scale = Math.min(rect.width, rect.height) / (2 * maxRho); // Scale to fit

    ctx.beginPath();
    ctx.strokeStyle = 'white';
    coordinates.forEach(([theta, rho], index) => {
        const x = centerX + rho * Math.cos(theta) * scale;
        const y = centerY - rho * Math.sin(theta) * scale;
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();
    logMessage('Pattern preview rendered.');
}


async function moveToCenter() {
    logMessage('Moving to center...', LOG_TYPE.INFO);
    const response = await fetch('/move_to_center', { method: 'POST' });
    const result = await response.json();
    if (result.success) {
        logMessage('Moved to center successfully.', LOG_TYPE.SUCCESS);
    } else {
        logMessage(`Failed to move to center: ${result.error}`, LOG_TYPE.ERROR);
    }
}

async function moveToPerimeter() {
    logMessage('Moving to perimeter...', LOG_TYPE.INFO);
    const response = await fetch('/move_to_perimeter', { method: 'POST' });
    const result = await response.json();
    if (result.success) {
        logMessage('Moved to perimeter successfully.', LOG_TYPE.SUCCESS);
    } else {
        logMessage(`Failed to move to perimeter: ${result.error}`, LOG_TYPE.ERROR);
    }
}

async function sendCoordinate() {
    const theta = parseFloat(document.getElementById('theta_input').value);
    const rho = parseFloat(document.getElementById('rho_input').value);

    if (isNaN(theta) || isNaN(rho)) {
        logMessage('Invalid input: θ and ρ must be numbers.', LOG_TYPE.ERROR);
        return;
    }

    logMessage(`Sending coordinate: θ=${theta}, ρ=${rho}...`);
    const response = await fetch('/send_coordinate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theta, rho })
    });

    const result = await response.json();
    if (result.success) {
        logMessage(`Coordinate executed successfully: θ=${theta}, ρ=${rho}`, LOG_TYPE.SUCCESS);
    } else {
        logMessage(`Failed to execute coordinate: ${result.error}`, LOG_TYPE.ERROR);
    }
}

async function sendHomeCommand() {
    const response = await fetch('/send_home', { method: 'POST' });
    const result = await response.json();
    if (result.success) {
        logMessage('HOME command sent successfully.', LOG_TYPE.SUCCESS);
    } else {
        logMessage('Failed to send HOME command.', LOG_TYPE.ERROR);
    }
}

async function runClearIn() {
    await runFile('clear_from_in.thr');
}

async function runClearOut() {
    await runFile('clear_from_out.thr');
}

async function runFile(fileName) {
    const response = await fetch(`/run_theta_rho_file/${fileName}`, { method: 'POST' });
    const result = await response.json();
    if (result.success) {
        logMessage(`Running file: ${fileName}`, LOG_TYPE.SUCCESS);
    } else {
        logMessage(`Failed to run file: ${fileName}`, LOG_TYPE.ERROR);
    }
}

// Serial Connection Status
async function checkSerialStatus() {
    const response = await fetch('/serial_status');
    const status = await response.json();
    const statusElement = document.getElementById('serial_status');
    const statusHeaderElement = document.getElementById('serial_status_header');
    const serialPortsContainer = document.getElementById('serial_ports_container');

    const connectButton = document.querySelector('button[onclick="connectSerial()"]');
    const disconnectButton = document.querySelector('button[onclick="disconnectSerial()"]');
    const restartButton = document.querySelector('button[onclick="restartSerial()"]');

    if (status.connected) {
        const port = status.port || 'Unknown'; // Fallback if port is undefined
        statusElement.textContent = `Connected to ${port}`;
        statusElement.classList.add('connected');
        statusElement.classList.remove('not-connected');
        logMessage(`Reconnected to serial port: ${port}`);

        // Update header status
        statusHeaderElement.classList.add('connected');
        statusHeaderElement.classList.remove('not-connected');

        // Hide Available Ports and show disconnect/restart buttons
        serialPortsContainer.style.display = 'none';
        connectButton.style.display = 'none';
        disconnectButton.style.display = 'inline-block';
        restartButton.style.display = 'inline-block';
    } else {
        statusElement.textContent = 'Not connected';
        statusElement.classList.add('not-connected');
        statusElement.classList.remove('connected');
        logMessage('No active serial connection.');

        // Update header status
        statusHeaderElement.classList.add('not-connected');
        statusHeaderElement.classList.remove('connected');

        // Show Available Ports and the connect button
        serialPortsContainer.style.display = 'block';
        connectButton.style.display = 'inline-block';
        disconnectButton.style.display = 'none';
        restartButton.style.display = 'none';

        // Attempt to auto-load available ports
        await loadSerialPorts();
    }
}

async function loadSerialPorts() {
    const response = await fetch('/list_serial_ports');
    const ports = await response.json();
    const select = document.getElementById('serial_ports');
    select.innerHTML = '';
    ports.forEach(port => {
        const option = document.createElement('option');
        option.value = port;
        option.textContent = port;
        select.appendChild(option);
    });
    logMessage('Serial ports loaded.');
}

async function connectSerial() {
    const port = document.getElementById('serial_ports').value;
    const response = await fetch('/connect_serial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ port })
    });
    const result = await response.json();
    if (result.success) {
        logMessage(`Connected to serial port: ${port}`, LOG_TYPE.SUCCESS);
        // Refresh the status
        await checkSerialStatus();
    } else {
        logMessage(`Error connecting to serial port: ${result.error}`, LOG_TYPE.ERROR);
    }
}

async function disconnectSerial() {
    const response = await fetch('/disconnect_serial', { method: 'POST' });
    const result = await response.json();
    if (result.success) {
        logMessage('Serial port disconnected.', LOG_TYPE.SUCCESS);
        // Refresh the status
        await checkSerialStatus();
    } else {
        logMessage(`Error disconnecting: ${result.error}`, LOG_TYPE.ERROR);
    }
}

async function restartSerial() {
    const port = document.getElementById('serial_ports').value;
    const response = await fetch('/restart_serial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ port })
    });
    const result = await response.json();
    if (result.success) {
        document.getElementById('serial_status').textContent = `Restarted connection to ${port}`;
        logMessage('Serial connection restarted.', LOG_TYPE.SUCCESS);

        // No need to change visibility for restart
    } else {
        logMessage(`Error restarting serial connection: ${result.error}`, LOG_TYPE.ERROR);
    }
}


// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//  PART A: Loading / listing playlists from the server
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

async function loadAllPlaylists() {
    try {
        const response = await fetch('/list_all_playlists'); // GET
        const allPlaylists = await response.json();          // e.g. ["My Playlist", "Summer", ...]
        displayAllPlaylists(allPlaylists);
    } catch (err) {
        logMessage(`Error loading playlists: ${err}`, LOG_TYPE.ERROR);
    }
}

// Function to display all playlists with Load, Run, and Delete buttons
function displayAllPlaylists(playlists) {
    const ul = document.getElementById('all_playlists');
    ul.innerHTML = ''; // Clear current list

    playlists.forEach(playlistName => {
        const li = document.createElement('li');
        li.textContent = playlistName;
        li.classList.add('playlist-item'); // Add a class for styling

        // Attach click event to handle selection
        li.onclick = () => {
            // Remove 'selected' class from all items
            document.querySelectorAll('#all_playlists li').forEach(item => {
                item.classList.remove('selected');
            });

            // Add 'selected' class to the clicked item
            li.classList.add('selected');

            // Open the playlist editor for the selected playlist
            openPlaylistEditor(playlistName);
        };

        ul.appendChild(li);
    });
}

// Cancel changes and close the editor
function cancelPlaylistChanges() {
    playlist = [...originalPlaylist]; // Revert to the original playlist
    isPlaylistChanged = false;
    toggleSaveCancelButtons(false); // Hide the save and cancel buttons
    refreshPlaylistUI(); // Refresh the UI with the original state
    closeStickySection('playlist-editor'); // Close the editor
}

// Open the playlist editor
function openPlaylistEditor(playlistName) {
    logMessage(`Opening editor for playlist: ${playlistName}`);
    const editorSection = document.getElementById('playlist-editor');

    // Update the displayed playlist name
    document.getElementById('playlist_name_display').textContent = playlistName;

    // Store the current playlist name for renaming
    document.getElementById('playlist_name_input').value = playlistName;

    editorSection.classList.remove('hidden');
    editorSection.classList.add('visible');

    loadPlaylist(playlistName);
}

function clearSchedule() {
    document.getElementById("start_time").value = "";
    document.getElementById("end_time").value = "";
}

// Function to run the selected playlist with specified parameters
async function runPlaylist() {
    const playlistName = document.getElementById('playlist_name_display').textContent;

    if (!playlistName) {
        logMessage("No playlist selected to run.");
        return;
    }

    const pauseTimeInput = document.getElementById('pause_time').value;
    const clearPatternSelect = document.getElementById('clear_pattern').value;
    const runMode = document.querySelector('input[name="run_mode"]:checked').value;
    const shuffle = document.getElementById('shuffle_playlist').checked;
    const startTimeInput = document.getElementById('start_time').value.trim();
    const endTimeInput = document.getElementById('end_time').value.trim();

    const pauseTime = parseFloat(pauseTimeInput);
    if (isNaN(pauseTime) || pauseTime < 0) {
        logMessage("Invalid pause time. Please enter a non-negative number.", LOG_TYPE.WARNING);
        return;
    }

    // Validate start and end time format and logic
    let startTime = startTimeInput || null;
    let endTime = endTimeInput || null;

    // Ensure that if one time is filled, the other must be as well
    if ((startTime && !endTime) || (!startTime && endTime)) {
        logMessage("Both start and end times must be provided together or left blank.", LOG_TYPE.WARNING);
        return;
    }

    // If both are provided, validate format and ensure start_time < end_time
    if (startTime && endTime) {
        try {
            const startDateTime = new Date(`1970-01-01T${startTime}:00`);
            const endDateTime = new Date(`1970-01-01T${endTime}:00`);

            if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
                logMessage("Invalid time format. Please use HH:MM format (e.g., 09:30).", LOG_TYPE.WARNING);
                return;
            }

            if (startDateTime >= endDateTime) {
                logMessage("Start time must be earlier than end time.", LOG_TYPE.WARNING);
                return;
            }
        } catch (error) {
            logMessage("Error parsing start or end time. Ensure correct HH:MM format.", LOG_TYPE.ERROR);
            return;
        }
    }

    logMessage(`Running playlist: ${playlistName} with pause_time=${pauseTime}, clear_pattern=${clearPatternSelect}, run_mode=${runMode}, shuffle=${shuffle}.`);

    try {
        const response = await fetch('/run_playlist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                playlist_name: playlistName,
                pause_time: pauseTime,
                clear_pattern: clearPatternSelect,
                run_mode: runMode,
                shuffle: shuffle,
                start_time: startTimeInput,
                end_time: endTimeInput
            })
        });

        const result = await response.json();

        if (result.success) {
            logMessage(`Playlist "${playlistName}" is now running.`, LOG_TYPE.SUCCESS);
        } else {
            logMessage(`Failed to run playlist "${playlistName}": ${result.error}`, LOG_TYPE.ERROR);
        }
    } catch (error) {
        logMessage(`Error running playlist "${playlistName}": ${error.message}`, LOG_TYPE.ERROR);
    }
}

// Track changes in the playlist
let originalPlaylist = [];
let isPlaylistChanged = false;

// Load playlist and set the original state
async function loadPlaylist(playlistName) {
    try {
        logMessage(`Loading playlist: ${playlistName}`);
        const response = await fetch(`/get_playlist?name=${encodeURIComponent(playlistName)}`);

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();

        if (!data.name) {
            throw new Error('Playlist name is missing in the response.');
        }

        // Populate playlist items and set original state
        playlist = data.files || [];
        originalPlaylist = [...playlist]; // Clone the playlist as the original
        isPlaylistChanged = false; // Reset change tracking
        toggleSaveCancelButtons(false); // Hide the save and cancel buttons initially
        refreshPlaylistUI();
        logMessage(`Loaded playlist: "${playlistName}" with ${playlist.length} file(s).`);
    } catch (err) {
        logMessage(`Error loading playlist: ${err.message}`, LOG_TYPE.ERROR);
        console.error('Error details:', err);
    }
}

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//  PART B: Creating or Saving (Overwriting) a Playlist
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

// Instead of separate create/modify functions, we’ll unify them:
async function savePlaylist() {
    const name =  document.getElementById('playlist_name_display').textContent
    if (!name) {
        logMessage("Please enter a playlist name.");
        return;
    }
    if (playlist.length === 0) {
        logMessage("No files in this playlist. Add files first.");
        return;
    }

    logMessage(`Saving playlist "${name}" with ${playlist.length} file(s)...`);

    try {
        // We can use /create_playlist or /modify_playlist. They do roughly the same in our single-file approach.
        // Let's use /create_playlist to always overwrite or create anew.
        const response = await fetch('/create_playlist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: name,
                files: playlist
            })
        });
        const result = await response.json();
        if (result.success) {
            logMessage(`Playlist "${name}" with ${playlist.length} patterns saved`, LOG_TYPE.SUCCESS);
            // Reload the entire list of playlists to reflect changes
            // Check for changes and refresh the UI
            detectPlaylistChanges();
            refreshPlaylistUI();

            // Restore default action buttons
            toggleSaveCancelButtons(false);
        } else {
            logMessage(`Failed to save playlist: ${result.error}`, LOG_TYPE.ERROR);
        }
    } catch (err) {
        logMessage(`Error saving playlist: ${err}`);
    }
}

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//  PART C: Renaming and Deleting a playlist
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Toggle the rename playlist input
function populatePlaylistDropdown() {
    return fetch('/list_all_playlists')
        .then(response => response.json())
        .then(playlists => {
            const select = document.getElementById('select-playlist');
            select.innerHTML = ''; // Clear existing options

            // Retrieve the saved playlist from the cookie
            const savedPlaylist = getCookie('selected_playlist');

            playlists.forEach(playlist => {
                const option = document.createElement('option');
                option.value = playlist;
                option.textContent = playlist;

                // Mark the saved playlist as selected
                if (playlist === savedPlaylist) {
                    option.selected = true;
                }

                select.appendChild(option);
            });

            // Attach the onchange event listener after populating the dropdown
            select.addEventListener('change', function () {
                const selectedPlaylist = this.value;
                setCookie('selected_playlist', selectedPlaylist, 7); // Save to cookie
                logMessage(`Selected playlist saved: ${selectedPlaylist}`);
            });

            logMessage('Playlist dropdown populated, event listener attached, and saved playlist restored.');
        })
        .catch(error => logMessage(`Error fetching playlists: ${error.message}`, LOG_TYPE.ERROR));
}
populatePlaylistDropdown().then(() => {
    loadSettingsFromCookies(); // Restore selected playlist after populating the dropdown
});

// Confirm and save the renamed playlist
async function confirmAddPlaylist() {
    const playlistNameInput = document.getElementById('new_playlist_name');
    const playlistName = playlistNameInput.value.trim();

    if (!playlistName) {
        logMessage('Playlist name cannot be empty.', LOG_TYPE.ERROR);
        return;
    }

    try {
        logMessage(`Adding new playlist: "${playlistName}"...`);
        const response = await fetch('/create_playlist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: playlistName,
                files: [] // New playlist starts empty
            })
        });

        const result = await response.json();
        if (result.success) {
            logMessage(`Playlist "${playlistName}" created successfully.`,  LOG_TYPE.SUCCESS);

            // Clear the input field
            playlistNameInput.value = '';

            // Refresh the playlist list
            loadAllPlaylists();

            // Hide the add playlist container
            toggleSecondaryButtons('add-playlist-container');
        } else {
            logMessage(`Failed to create playlist: ${result.error}`, LOG_TYPE.ERROR);
        }
    } catch (error) {
        logMessage(`Error creating playlist: ${error.message}`);
    }
}


async function confirmRenamePlaylist() {
    const newName = document.getElementById('playlist_name_input').value.trim();
    const currentName = document.getElementById('playlist_name_display').textContent;

    if (!newName) {
        logMessage("New playlist name cannot be empty.", LOG_TYPE.ERROR);
        return;
    }

    if (newName === currentName) {
        logMessage("New playlist name is the same as the current name. No changes made.",  LOG_TYPE.WARNING);
        toggleSecondaryButtons('rename-playlist-container'); // Close the rename container
        return;
    }

    try {
        // Step 1: Create/Modify the playlist with the new name
        const createResponse = await fetch('/modify_playlist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: newName,
                files: playlist // Ensure `playlist` contains the current list of files
            })
        });

        const createResult = await createResponse.json();
        if (createResult.success) {
            logMessage(createResult.message, LOG_TYPE.SUCCESS);

            // Step 2: Delete the old playlist
            const deleteResponse = await fetch('/delete_playlist', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: currentName })
            });

            const deleteResult = await deleteResponse.json();
            if (deleteResult.success) {
                logMessage(deleteResult.message);

                // Update the UI with the new name
                document.getElementById('playlist_name_display').textContent = newName;

                // Refresh playlists list
                loadAllPlaylists();

                // Close the rename container and restore original action buttons
                toggleSecondaryButtons('rename-playlist-container');
            } else {
                logMessage(`Failed to delete old playlist: ${deleteResult.error}`, LOG_TYPE.ERROR);
            }
        } else {
            logMessage(`Failed to rename playlist: ${createResult.error}`, LOG_TYPE.ERROR);
        }
    } catch (error) {
        logMessage(`Error renaming playlist: ${error.message}`);
    }
}

// Delete the currently opened playlist
async function deleteCurrentPlaylist() {
    const playlistName = document.getElementById('playlist_name_display').textContent;

    if (!confirm(`Are you sure you want to delete the playlist "${playlistName}"? This action cannot be undone.`)) {
        return;
    }

    try {
        const response = await fetch('/delete_playlist', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: playlistName })
        });

        const result = await response.json();
        if (result.success) {
            logMessage(`Playlist "${playlistName}" deleted.`, LOG_TYPE.INFO);
            closeStickySection('playlist-editor');
            loadAllPlaylists();
        } else {
            logMessage(`Failed to delete playlist: ${result.error}`,  LOG_TYPE.ERROR);
        }
    } catch (error) {
        logMessage(`Error deleting playlist: ${error.message}`);
    }
}

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//  PART D: Local playlist array UI
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

// Refresh the playlist UI and detect changes
function refreshPlaylistUI() {
    const ul = document.getElementById('playlist_items');
    if (!ul) {
        logMessage('Error: Playlist container not found');
        return;
    }
    ul.innerHTML = ''; // Clear existing items

    if (playlist.length === 0) {
        // Add a placeholder if the playlist is empty
        const emptyLi = document.createElement('li');
        emptyLi.textContent = 'No items in the playlist.';
        emptyLi.classList.add('empty-placeholder'); // Optional: Add a class for styling
        ul.appendChild(emptyLi);
        return;
    }

    playlist.forEach((file, index) => {
        const li = document.createElement('li');

        // Add filename in a span
        const filenameSpan = document.createElement('span');
        filenameSpan.textContent = file;
        filenameSpan.classList.add('filename'); // Add a class for styling
        li.appendChild(filenameSpan);

        // Move Up button
        const moveUpBtn = document.createElement('button');
        moveUpBtn.textContent = '▲'; // Up arrow symbol
        moveUpBtn.classList.add('move-button');
        moveUpBtn.onclick = () => {
            if (index > 0) {
                const temp = playlist[index - 1];
                playlist[index - 1] = playlist[index];
                playlist[index] = temp;
                detectPlaylistChanges(); // Check for changes
                refreshPlaylistUI();
            }
        };
        li.appendChild(moveUpBtn);

        // Move Down button
        const moveDownBtn = document.createElement('button');
        moveDownBtn.textContent = '▼'; // Down arrow symbol
        moveDownBtn.classList.add('move-button');
        moveDownBtn.onclick = () => {
            if (index < playlist.length - 1) {
                const temp = playlist[index + 1];
                playlist[index + 1] = playlist[index];
                playlist[index] = temp;
                detectPlaylistChanges(); // Check for changes
                refreshPlaylistUI();
            }
        };
        li.appendChild(moveDownBtn);

        // Remove button
        const removeBtn = document.createElement('button');
        removeBtn.textContent = '✖';
        removeBtn.classList.add('remove-button');
        removeBtn.onclick = () => {
            playlist.splice(index, 1);
            detectPlaylistChanges(); // Check for changes
            refreshPlaylistUI();
        };
        li.appendChild(removeBtn);

        ul.appendChild(li);
    });
}

// Toggle the visibility of the save and cancel buttons
function toggleSaveCancelButtons(show) {
    const actionButtons = document.querySelector('#playlist-editor .action-buttons');
    if (actionButtons) {
        // Show/hide all buttons except Save and Cancel
        actionButtons.querySelectorAll('button:not(.save-cancel)').forEach(button => {
            button.style.display = show ? 'none' : 'inline-block';
        });

        // Show/hide Save and Cancel buttons
        actionButtons.querySelectorAll('.save-cancel').forEach(button => {
            button.style.display = show ? 'inline-block' : 'none';
        });
    } else {
        logMessage('Error: Action buttons container not found.', LOG_TYPE.ERROR);
    }
}

// Detect changes in the playlist
function detectPlaylistChanges() {
    isPlaylistChanged = JSON.stringify(originalPlaylist) !== JSON.stringify(playlist);
    toggleSaveCancelButtons(isPlaylistChanged);
}


// Toggle the "Add to Playlist" section
function toggleSecondaryButtons(containerId, onShowCallback = null) {
    const container = document.getElementById(containerId);
    if (!container) {
        logMessage(`Error: Element with ID "${containerId}" not found`);
        return;
    }

    // Find the .action-buttons element preceding the container
    const previousActionButtons = container.previousElementSibling?.classList.contains('action-buttons')
        ? container.previousElementSibling
        : null;

    if (container.classList.contains('hidden')) {
        // Show the container
        container.classList.remove('hidden');

        // Hide the previous .action-buttons element
        if (previousActionButtons) {
            previousActionButtons.style.display = 'none';
        }

        // Optional callback for custom logic when showing the container
        if (onShowCallback) {
            onShowCallback();
        }
    } else {
        // Hide the container
        container.classList.add('hidden');

        // Restore the previous .action-buttons element
        if (previousActionButtons) {
            previousActionButtons.style.display = 'flex';
        }
    }
}

// Add the selected pattern to the selected playlist
async function saveToPlaylist() {
    const playlist = document.getElementById('select-playlist').value;
    if (!playlist) {
        logMessage('No playlist selected.', LOG_TYPE.ERROR);
        return;
    }
    if (!selectedFile) {
        logMessage('No pattern selected to add.', LOG_TYPE.ERROR);
        return;
    }

    try {
        logMessage(`Adding pattern "${selectedFile}" to playlist "${playlist}"...`);
        const response = await fetch('/add_to_playlist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playlist_name: playlist, pattern: selectedFile })
        });

        const result = await response.json();
        if (result.success) {
            logMessage(`Pattern "${selectedFile}" successfully added to playlist "${playlist}".`, LOG_TYPE.SUCCESS);

            // Reset the UI state via toggleSecondaryButtons
            toggleSecondaryButtons('add-to-playlist-container', () => {
                const selectPlaylist = document.getElementById('select-playlist');
                selectPlaylist.value = ''; // Clear the selection
            });
        } else {
            logMessage(`Failed to add pattern to playlist: ${result.error}`, LOG_TYPE.ERROR);
        }
    } catch (error) {
        logMessage(`Error adding pattern to playlist: ${error.message}`);
    }
}

async function changeSpeed() {
    const speedInput = document.getElementById('speed_input');
    const speed = parseFloat(speedInput.value);

    if (isNaN(speed) || speed <= 0) {
        logMessage('Invalid speed. Please enter a positive number.');
        return;
    }

    logMessage(`Setting speed to: ${speed}...`);
    const response = await fetch('/set_speed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ speed })
    });

    const result = await response.json();
    if (result.success) {
        document.getElementById('speed_status').textContent = `Current Speed: ${speed}`;
        logMessage(`Speed set to: ${speed}`, LOG_TYPE.SUCCESS);
    } else {
        logMessage(`Failed to set speed: ${result.error}`, LOG_TYPE.ERROR);
    }
}

// Function to close any sticky section
function closeStickySection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        section.classList.remove('visible');
        section.classList.remove('fullscreen');
        section.classList.add('hidden');
        // Reset the fullscreen button text if it exists
        const fullscreenButton = section.querySelector('.fullscreen-button');
        if (fullscreenButton) {
            fullscreenButton.textContent = '⛶'; // Reset to enter fullscreen icon/text
        }

        logMessage(`Closed section: ${sectionId}`);

        if(sectionId === 'playlist-editor') {
            document.querySelectorAll('#all_playlists .playlist-item').forEach(item => {
                item.classList.remove('selected');
            });
        }

        if(sectionId === 'pattern-preview-container') {
            document.querySelectorAll('#theta_rho_files .file-item').forEach(item => {
                item.classList.remove('selected');
            });
        }

    } else {
        logMessage(`Error: Section with ID "${sectionId}" not found`);
    }
}

function attachFullScreenListeners() {
    // Add event listener to all fullscreen buttons
    document.querySelectorAll('.fullscreen-button').forEach(button => {
        button.addEventListener('click', function () {
            const stickySection = this.closest('.sticky'); // Find the closest sticky section
            if (stickySection) {
                stickySection.classList.toggle('fullscreen'); // Toggle fullscreen class

                // Update button icon or text
                if (stickySection.classList.contains('fullscreen')) {
                    this.textContent = '-'; // Exit fullscreen icon/text
                } else {
                    this.textContent = '⛶'; // Enter fullscreen icon/text
                }
            } else {
                console.error('Error: Fullscreen button is not inside a sticky section.');
            }
        });
    });
}


// Utility function to manage cookies
function setCookie(name, value, days) {
    const date = new Date();
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
    document.cookie = `${name}=${value};expires=${date.toUTCString()};path=/`;
}

function getCookie(name) {
    const nameEQ = `${name}=`;
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
        let cookie = cookies[i].trim();
        if (cookie.startsWith(nameEQ)) {
            return cookie.substring(nameEQ.length);
        }
    }
    return null;
}


// Save settings to cookies
function saveSettingsToCookies() {
    // Save the pause time
    const pauseTime = document.getElementById('pause_time').value;
    setCookie('pause_time', pauseTime, 7);

    // Save the clear pattern
    const clearPattern = document.getElementById('clear_pattern').value;
    setCookie('clear_pattern', clearPattern, 7);

    // Save the run mode
    const runMode = document.querySelector('input[name="run_mode"]:checked').value;
    setCookie('run_mode', runMode, 7);

    // Save shuffle playlist checkbox state
    const shufflePlaylist = document.getElementById('shuffle_playlist').checked;
    setCookie('shuffle_playlist', shufflePlaylist, 7);

    // Save pre-execution action
    const preExecution = document.querySelector('input[name="pre_execution"]:checked').value;
    setCookie('pre_execution', preExecution, 7);

    logMessage('Settings saved.');
}

// Load settings from cookies
function loadSettingsFromCookies() {
    // Load the pause time
    const pauseTime = getCookie('pause_time');
    if (pauseTime !== null) {
        document.getElementById('pause_time').value = pauseTime;
    }

    // Load the clear pattern
    const clearPattern = getCookie('clear_pattern');
    if (clearPattern !== null) {
        document.getElementById('clear_pattern').value = clearPattern;
    }

    // Load the run mode
    const runMode = getCookie('run_mode');
    if (runMode !== null) {
        document.querySelector(`input[name="run_mode"][value="${runMode}"]`).checked = true;
    }

    // Load the shuffle playlist checkbox state
    const shufflePlaylist = getCookie('shuffle_playlist');
    if (shufflePlaylist !== null) {
        document.getElementById('shuffle_playlist').checked = shufflePlaylist === 'true';
    }

    // Load the pre-execution action
    const preExecution = getCookie('pre_execution');
    if (preExecution !== null) {
        document.querySelector(`input[name="pre_execution"][value="${preExecution}"]`).checked = true;
    }

    // Load the selected playlist
    const selectedPlaylist = getCookie('selected_playlist');
    if (selectedPlaylist !== null) {
        const playlistDropdown = document.getElementById('select-playlist');
        if (playlistDropdown && [...playlistDropdown.options].some(option => option.value === selectedPlaylist)) {
            playlistDropdown.value = selectedPlaylist;
        }
    }

    logMessage('Settings loaded from cookies.');
}

// Call this function to save settings when a value is changed
function attachSettingsSaveListeners() {
    // Add event listeners to inputs
    document.getElementById('pause_time').addEventListener('input', saveSettingsToCookies);
    document.getElementById('clear_pattern').addEventListener('change', saveSettingsToCookies);
    document.querySelectorAll('input[name="run_mode"]').forEach(input => {
        input.addEventListener('change', saveSettingsToCookies);
    });
    document.getElementById('shuffle_playlist').addEventListener('change', saveSettingsToCookies);
    document.querySelectorAll('input[name="pre_execution"]').forEach(input => {
        input.addEventListener('change', saveSettingsToCookies);
    });
}


// Tab switching logic with cookie storage
function switchTab(tabName) {
    // Store the active tab in a cookie
    setCookie('activeTab', tabName, 7); // Store for 7 days

    // Deactivate all tab content
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });

    // Activate the selected tab content
    const activeTab = document.getElementById(`${tabName}-tab`);
    if (activeTab) {
        activeTab.classList.add('active');
    } else {
        console.error(`Error: Tab "${tabName}" not found.`);
    }

    // Deactivate all nav buttons
    document.querySelectorAll('.bottom-nav .tab-button').forEach(button => {
        button.classList.remove('active');
    });

    // Activate the selected nav button
    const activeNavButton = document.getElementById(`nav-${tabName}`);
    if (activeNavButton) {
        activeNavButton.classList.add('active');
    } else {
        console.error(`Error: Nav button for "${tabName}" not found.`);
    }
}

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    const activeTab = getCookie('activeTab') || 'patterns'; // Default to 'patterns' tab
    switchTab(activeTab); // Load the active tab
    checkSerialStatus(); // Check serial connection status
    loadThetaRhoFiles(); // Load files on page load
    loadAllPlaylists(); // Load all playlists on page load
    loadSettingsFromCookies(); // Load saved settings
    attachSettingsSaveListeners(); // Attach event listeners to save changes
    attachFullScreenListeners();
});