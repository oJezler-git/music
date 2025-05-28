const backgrounds = {
  "deep-work": "bg-deep-work",
  creativity: "bg-creativity",
  learning: "bg-learning",
};

const activityLabels = {
  "deep-work": "25 MINUTES OF WORK",
  creativity: "25 MINUTES OF CREATIVITY",
  learning: "25 MINUTES OF LEARNING",
};

const playlistTitles = {
  "deep-work": "Deep Work Playlist",
  creativity: "Creativity Playlist",
  learning: "Learning Playlist",
};

let currentActivity = "chill";
let isPlaying = false;
let timeLeft = 25 * 60;
let timerInterval;
let currentTracks = [];
let currentTrackIndex = -1;
let isSelectingTrack = false;
let audioContext = null;

// Timer system
let timerMode = "interval"; // 'infinite', 'timer', or 'interval'
let currentTimerMode = "interval";
let isTimerRunning = false;
let isWorkPhase = true;
let pendingTimerModeChange = null;
let fadeInterval;
let originalVolume = 1;
let isFading = false;
let globalVolume = parseFloat(localStorage.getItem("playerVolume")) || 1;
let timerEndSound = new Audio("../sounds/workintervalend.wav");
let breakEndSound = new Audio("../sounds/breakintervalend.wav");

timerEndSound.volume = globalVolume;
breakEndSound.volume = globalVolume;

timerEndSound.preload = "auto";
breakEndSound.preload = "auto";

// DOM elements
const dropdownBtn = document.getElementById("dropdown-btn");
const dropdownContent = document.getElementById("dropdown-content");
const currentIcon = document.getElementById("current-icon");
const currentActivityEl = document.getElementById("current-activity");
const timerLabel = document.getElementById("timer-label");
const timerDisplay = document.getElementById("timer-display");
const intervalBtn = document.getElementById("interval-btn");
const bottomPlayer = document.getElementById("bottom-player");
const playPauseBtn = document.getElementById("play-pause-btn");
const prevBtn = document.getElementById("prev-btn");
const nextBtn = document.getElementById("next-btn");
const volumeBtn = document.getElementById("volume-btn");
const volumeSlider = document.getElementById("volume-slider");
const volumeRange = document.getElementById("volume-range");
const progressBar = document.getElementById("progress-bar");
const progressRange = document.getElementById("progress-range");
const progress = document.getElementById("progress");
const tracksBtn = document.getElementById("tracks-btn");
const trackListOverlay = document.getElementById("track-list-overlay");
const closeTracksBtn = document.getElementById("close-tracks-btn");
const trackList = document.getElementById("track-list");
const playlistTitle = document.getElementById("playlist-title");
const trackTitle = document.getElementById("track-title");
const audioPlayer = document.getElementById("audio-player");
const timerModeOverlay = document.getElementById("timer-mode-overlay");
const closeTimerBtn = document.getElementById("close-timer-btn");
const confirmTimerBtn = document.getElementById("confirm-timer-btn");
const timerModeOptions = document.querySelectorAll(".timer-mode-option");
const timerMinutesInput = document.getElementById("timer-minutes");
const workMinutesInput = document.getElementById("work-minutes");
const breakMinutesInput = document.getElementById("break-minutes");
const warningModal = document.getElementById("warning-modal");
const cancelWarningBtn = document.getElementById("cancel-warning-btn");
const confirmWarningBtn = document.getElementById("confirm-warning-btn");
const timeOptionBtns = document.querySelectorAll(".time-option-btn");
const workTimeColumn = document.querySelectorAll(".time-option-column")[0];
const breakTimeColumn = document.querySelectorAll(".time-option-column")[1];
const timerSettings = document.getElementById("timer-settings");
const body = document.body;

// Initialize volume
const savedVolume = localStorage.getItem("playerVolume") || "1";
audioPlayer.volume = parseFloat(savedVolume);
volumeRange.value = savedVolume;
volumeBtn.textContent =
  savedVolume === "0" ? "🔇" : savedVolume <= 0.5 ? "🔉" : "🔊";

// Load tracks
async function loadTracks(activity) {
  trackList.innerHTML = "<div>Loading...</div>";
  try {
    const response = await fetch(`../songs/relax/${activity}.json`);
    const tracks = await response.json();
    currentTracks = tracks;
    renderTrackList(tracks);
    playlistTitle.textContent = playlistTitles[activity] || "Playlist";
    if (currentTrackIndex !== -1) {
      document.querySelectorAll(".track-item").forEach((item) => {
        item.classList.remove("active");
        if (parseInt(item.dataset.index) === currentTrackIndex) {
          item.classList.add("active");
        }
      });
    }
  } catch (e) {
    trackList.innerHTML = "<div>Error loading tracks</div>";
    console.error("Error loading tracks:", e);
  }
}

function renderTrackList(tracks) {
  trackList.innerHTML = "";
  tracks.forEach((track, index) => {
    const div = document.createElement("div");
    div.className = "track-item";
    div.textContent = track.name;
    div.dataset.index = index;
    div.addEventListener("click", () => selectTrack(index));
    trackList.appendChild(div);
  });
}

// Modify the selectTrack function to lazy load audio
async function selectTrack(index) {
  if (isSelectingTrack || index < 0 || index >= currentTracks.length) return;
  isSelectingTrack = true;

  try {
    currentTrackIndex = index;
    const track = currentTracks[index];

    // Update UI first
    document.querySelectorAll(".track-item").forEach((item) => {
      item.classList.remove("active");
      if (parseInt(item.dataset.index) === index) {
        item.classList.add("active");
      }
    });

    trackTitle.textContent = track.name;
    bottomPlayer.classList.add("show");

    // Only load audio when actually needed
    if (isPlaying) {
      audioPlayer.src = track.url;
      await audioPlayer.play();
      playPauseBtn.textContent = "⏸";
      startTimer();
    } else {
      // Just prepare the player but don't load yet
      audioPlayer.src = track.url;
      playPauseBtn.textContent = "▶";
    }

    trackListOverlay.classList.remove("show");
  } catch (error) {
    console.error("Error selecting track:", error);
  } finally {
    isSelectingTrack = false;
  }
}

// Activity dropdown
dropdownBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  dropdownContent.classList.toggle("show");
});
document.addEventListener("click", () =>
  dropdownContent.classList.remove("show")
);

document.querySelectorAll(".activity-option").forEach((option) => {
  option.addEventListener("click", () => {
    const value = option.dataset.value;
    const icon = option.dataset.icon;
    const name = option.textContent.trim();

    document
      .querySelectorAll(".activity-option")
      .forEach((opt) => opt.classList.remove("selected"));
    option.classList.add("selected");

    currentIcon.textContent = icon;
    currentActivityEl.textContent = name;
    timerLabel.textContent = activityLabels[value];

    Object.values(backgrounds).forEach((bg) => body.classList.remove(bg));
    body.classList.add(backgrounds[value]);

    currentActivity = value;
    loadTracks(value);
    dropdownContent.classList.remove("show");
  });
});

// Timer interface
intervalBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  timerModeOverlay.classList.add("show");
  timerModeOverlay.style.visibility = "visible";
  timerModeOverlay.style.opacity = "1";
});

function handleTimerModeChange() {
  timerModeOptions.forEach((opt) => opt.classList.remove("selected"));
  this.classList.add("selected");
  timerMode = this.dataset.mode;

  document.querySelector(".interval-settings").style.display =
    timerMode === "interval" ? "block" : "none";
  timerSettings.style.display = timerMode === "timer" ? "block" : "none";
}

function handleTimeOptionClick() {
  const column = this.closest(".time-option-column");
  column
    .querySelectorAll(".time-option-btn")
    .forEach((b) => b.classList.remove("active"));
  this.classList.add("active");

  const timeValue = parseInt(this.textContent);
  if (column === workTimeColumn) {
    workMinutesInput.value = timeValue;
  } else {
    breakMinutesInput.value = timeValue;
  }
}

timerModeOptions.forEach((option) => {
  option.addEventListener("click", handleTimerModeChange);
});

timeOptionBtns.forEach((btn) => {
  btn.addEventListener("click", handleTimeOptionClick);
});

function closeTimerOverlay() {
  timerModeOverlay.classList.remove("show");
  timerModeOverlay.style.visibility = "hidden";
  timerModeOverlay.style.opacity = "0";

  // Clean up timer mode options
  document.querySelectorAll(".timer-mode-option").forEach((opt) => {
    opt.removeEventListener("click", handleTimerModeChange);
  });

  // Clean up time option buttons
  document.querySelectorAll(".time-option-btn").forEach((btn) => {
    btn.removeEventListener("click", handleTimeOptionClick);
  });
}

closeTimerBtn.addEventListener("click", closeTimerOverlay);

// Add cleanup when closing overlays
function closeTrackListOverlay() {
  trackListOverlay.classList.remove("show");

  // Clean up scroll listener
  trackList.removeEventListener("scroll", updateVisibleTracks);

  // Clean up track items
  trackList.innerHTML = "";
}

// Update the close button event listener
closeTracksBtn.addEventListener("click", closeTrackListOverlay);

timerModeOverlay.addEventListener("click", (e) => {
  if (e.target === timerModeOverlay) {
    closeTimerOverlay();
  }
});

timerModeOptions.forEach((option) => {
  option.addEventListener("click", () => {
    timerModeOptions.forEach((opt) => opt.classList.remove("selected"));
    option.classList.add("selected");
    timerMode = option.dataset.mode;

    // Show/hide appropriate sections
    document.querySelector(".interval-settings").style.display =
      timerMode === "interval" ? "block" : "none";
    timerSettings.style.display = timerMode === "timer" ? "block" : "none";
  });
});

// handle timer option button clicks:
document.querySelectorAll("#timer-settings .time-option-btn").forEach((btn) => {
  btn.addEventListener("click", function () {
    // Remove active class from all buttons in timer settings
    document
      .querySelectorAll("#timer-settings .time-option-btn")
      .forEach((b) => b.classList.remove("active"));

    // Add active class to clicked button
    this.classList.add("active");

    // Update the timer input field
    timerMinutesInput.value = parseInt(this.textContent);
  });
});

// Update the timerMinutesInput change handler:
timerMinutesInput.addEventListener("change", function () {
  if (this.value < 1) this.value = 1;
  if (this.value > 120) this.value = 120;

  // Remove active class from all timer option buttons
  document
    .querySelectorAll("#timer-settings .time-option-btn")
    .forEach((b) => b.classList.remove("active"));
});

// Handle time option button clicks
timeOptionBtns.forEach((btn) => {
  btn.addEventListener("click", function () {
    // Remove active class from all buttons in the same column
    const column = this.closest(".time-option-column");
    column
      .querySelectorAll(".time-option-btn")
      .forEach((b) => b.classList.remove("active"));

    // Add active class to clicked button
    this.classList.add("active");

    // Update the corresponding input field
    const timeValue = parseInt(this.textContent);
    if (column === workTimeColumn) {
      workMinutesInput.value = timeValue;
    } else {
      breakMinutesInput.value = timeValue;
    }
  });
});

// Handle custom time inputs
workMinutesInput.addEventListener("change", function () {
  if (this.value < 1) this.value = 1;
  if (this.value > 120) this.value = 120;
});

breakMinutesInput.addEventListener("change", function () {
  if (this.value < 1) this.value = 1;
  if (this.value > 30) this.value = 30;
});

confirmTimerBtn.addEventListener("click", () => {
  // If timer is running and we're changing to a different mode, show warning
  if (isTimerRunning && currentTimerMode !== timerMode) {
    pendingTimerModeChange = timerMode; // Set this BEFORE showing warning
    warningModal.classList.add("show");
    return;
  }

  // Set the pending change to current selection
  pendingTimerModeChange = timerMode;
  applyTimerModeChange();
});

function applyTimerModeChange() {
  closeTimerOverlay();
  if (timerInterval) clearInterval(timerInterval);

  // Update the current mode - this is the key fix
  currentTimerMode = pendingTimerModeChange || timerMode;

  // Reset Pomodoro state when changing modes
  isWorkPhase = true;

  switch (currentTimerMode) {
    case "infinite":
      timeLeft = 0;
      timerLabel.textContent = "INFINITE PLAY";
      break;
    case "timer":
      const timerMinutes = parseInt(timerMinutesInput.value || 25);
      timeLeft = timerMinutes * 60;
      timerLabel.textContent = `${timerMinutes} MINUTE TIMER`;
      break;
    case "interval":
      // Make sure we get the work time from the input or default to 25
      const workMinutes = parseInt(workMinutesInput.value) || 25;
      timeLeft = workMinutes * 60; // This should be the work time in seconds
      timerLabel.textContent = `WORK: ${workMinutes} MINUTES`;
      break;
  }

  updateTimerDisplay();
  isTimerRunning = false; // Reset timer running state
  updateIntervalButtonText();

  // Only start timer if audio is playing
  if (isPlaying) {
    startTimer();
  }

  pendingTimerModeChange = null;
}

document.addEventListener("DOMContentLoaded", function () {
  // Set default values for inputs if they're empty
  if (!workMinutesInput.value) workMinutesInput.value = 25;
  if (!breakMinutesInput.value) breakMinutesInput.value = 5;
  if (!timerMinutesInput.value) timerMinutesInput.value = 25;
});

// Add warning modal handlers
cancelWarningBtn.addEventListener("click", () => {
  warningModal.classList.remove("show");
  pendingTimerModeChange = currentTimerMode; // Reset to current mode
});

confirmWarningBtn.addEventListener("click", () => {
  warningModal.classList.remove("show");
  applyTimerModeChange();
});

warningModal.addEventListener("click", (e) => {
  if (e.target === warningModal) {
    warningModal.classList.remove("show");
    pendingTimerModeChange = null;
  }
});

function startTimer() {
  if (!isPlaying) return; // Only run if audio is playing
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(updateTimer, 1000);
  isTimerRunning = true;
  updateIntervalButtonText();
}

function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
  isTimerRunning = false;
  updateIntervalButtonText();
}

function updateTimer() {
  if (!isPlaying) {
    stopTimer();
    return;
  }

  if (currentTimerMode === "infinite") {
    timeLeft++;
  } else if (currentTimerMode === "timer" || currentTimerMode === "interval") {
    if (timeLeft > 0) {
      timeLeft--;

      // Check if we're 6 seconds from transition (for interval mode)
      if (currentTimerMode === "interval" && timeLeft === 6 && !isFading) {
        handleTimerCompletion();
      }
    } else {
      // This will now be handled by the fade system
      return;
    }
  }
  updateTimerDisplay();
}

function updateTimerDisplay() {
  const minutes = Math.floor(Math.abs(timeLeft) / 60);
  const seconds = Math.abs(timeLeft) % 60;
  timerDisplay.textContent = `${minutes}:${seconds
    .toString()
    .padStart(2, "0")}`;
}

function handleTimerCompletion() {
  if (currentTimerMode === "interval") {
    if (isWorkPhase) {
      // Work phase ending - transition to break
      startAudioTransition(timerEndSound, () => {
        const breakMinutes = parseInt(breakMinutesInput.value || 10);
        timeLeft = breakMinutes * 60;
        isWorkPhase = false;
        timerLabel.textContent = `BREAK: ${breakMinutes} MINUTES`;
      });
    } else {
      // Break phase ending - transition to work
      startAudioTransition(breakEndSound, () => {
        const workMinutes = parseInt(workMinutesInput.value || 25);
        timeLeft = workMinutes * 60;
        isWorkPhase = true;
        timerLabel.textContent = `WORK: ${workMinutes} MINUTES`;
      });
    }
  } else {
    timerEndSound.play();
    stopTimer();
  }
}

function startAudioTransition(transitionSound, completionCallback) {
  console.log("Starting audio transition");

  // Store original volume
  originalVolume = audioPlayer.volume;
  const fadeDuration = 6000; // 6 seconds total
  const soundPlayTime = 3000; // Play sound at 3 seconds (midway)
  const fadeStartTime = Date.now();
  isFading = true;

  if (fadeInterval) clearInterval(fadeInterval);

  fadeInterval = setInterval(() => {
    const elapsed = Date.now() - fadeStartTime;
    const remaining = fadeDuration - elapsed;

    // 1. Fade out over first 6 seconds
    if (elapsed <= fadeDuration) {
      const fadeProgress = elapsed / fadeDuration;
      audioPlayer.volume = originalVolume * (1 - fadeProgress);
    }

    // 2. Play sound at 3 seconds (midway through fade)
    if (elapsed >= soundPlayTime && elapsed < soundPlayTime + 100) {
      // Small window to prevent multiple plays
      transitionSound.currentTime = 0;
      transitionSound.play();
    }

    // 3. When fade completes (6 seconds)
    if (elapsed >= fadeDuration) {
      clearInterval(fadeInterval);

      // 4. Fade volume back up over 3 seconds
      const fadeBackDuration = 3000;
      const fadeBackStart = Date.now();
      const fadeBackInterval = setInterval(() => {
        const fadeBackElapsed = Date.now() - fadeBackStart;
        const fadeBackProgress = Math.min(
          fadeBackElapsed / fadeBackDuration,
          1
        );

        audioPlayer.volume = originalVolume * fadeBackProgress;

        if (fadeBackProgress >= 1) {
          clearInterval(fadeBackInterval);
          isFading = false;
          completionCallback();
        }
      }, 50);
    }
  }, 50);
}

function updateIntervalButtonText() {
  let label;
  switch (currentTimerMode) {
    case "infinite":
      label = isTimerRunning ? "Change" : "Infinite";
      break;
    case "timer":
      label = isTimerRunning ? "Change" : "Timer";
      break;
    case "interval":
      label = isTimerRunning ? "Change" : "Pomodoro";
      break;
  }
  intervalBtn.innerHTML = `<span>⏱</span><span>${label}</span>`;
}

// Adjust dropdown positioning on mobile
function positionDropdown() {
  if (window.innerWidth <= 400) {
    dropdownContent.style.right = "auto";
    dropdownContent.style.left = "16px";
    dropdownContent.style.width = "calc(100% - 32px)";
  } else {
    dropdownContent.style.right = "0";
    dropdownContent.style.left = "auto";
    dropdownContent.style.width = "auto";
  }
}

// Call on load and resize
window.addEventListener("load", positionDropdown);
window.addEventListener("resize", positionDropdown);

// Also call when opening dropdown
dropdownBtn.addEventListener("click", function () {
  setTimeout(positionDropdown, 10);
});

// Audio controls
playPauseBtn.addEventListener("click", async () => {
  try {
    if (currentTrackIndex === -1 && currentTracks.length > 0) {
      await selectTrack(0);
      return;
    }

    if (audioPlayer.paused) {
      await audioPlayer.play();
      isPlaying = true;
      playPauseBtn.textContent = "⏸";
      startTimer();
    } else {
      audioPlayer.pause();
      isPlaying = false;
      playPauseBtn.textContent = "▶";
      stopTimer();
    }
    bottomPlayer.classList.add("show");
  } catch (error) {
    console.error("Play/Pause failed:", error);
    trackTitle.textContent = `${
      currentTracks[currentTrackIndex]?.name || "Track"
    } (Error - try again)`;
  }
});

prevBtn.addEventListener("click", () => {
  if (currentTrackIndex > 0) {
    stopTimer(); // Stop current timer
    selectTrack(currentTrackIndex - 1); // Will auto-start timer
  }
});

nextBtn.addEventListener("click", () => {
  if (currentTrackIndex < currentTracks.length - 1) {
    stopTimer(); // Stop current timer
    selectTrack(currentTrackIndex + 1); // Will auto-start timer
  }
});

// Auto-scroll to top when opening timer settings
intervalBtn.addEventListener("click", function () {
  setTimeout(() => {
    timerModeOverlay.scrollTo(0, 0);
  }, 50);
});

volumeRange.addEventListener("input", function () {
  const newVolume = parseFloat(this.value);
  globalVolume = newVolume;

  // Update main player volume
  audioPlayer.volume = newVolume;
  audioPlayer.muted = newVolume === 0;

  // Update notification sounds volume
  timerEndSound.volume = newVolume;
  breakEndSound.volume = newVolume;

  // Update UI
  volumeSlider.style.setProperty("--volume-percent", newVolume * 100);
  const thumb = volumeSlider.querySelector(".volume-thumb");
  thumb.style.left = `${newVolume * 100}%`;

  volumeBtn.textContent =
    newVolume === 0 ? "🔇" : newVolume <= 0.5 ? "🔉" : "🔊";

  localStorage.setItem("playerVolume", newVolume);
});

// Initialize the volume fill and thumb position on load
const initialVolume = volumeRange.value * 100;
volumeSlider.style.setProperty("--volume-percent", initialVolume);
const thumb = volumeSlider.querySelector(".volume-thumb");
thumb.style.left = `${initialVolume}%`;

volumeBtn.addEventListener("click", () => {
  const isMuted = audioPlayer.muted || globalVolume === 0;
  const newVolume = isMuted
    ? parseFloat(localStorage.getItem("playerVolume")) || 0.7
    : 0;

  globalVolume = newVolume;
  audioPlayer.volume = newVolume;
  audioPlayer.muted = newVolume === 0;
  timerEndSound.volume = newVolume;
  breakEndSound.volume = newVolume;
  volumeRange.value = newVolume;

  // Update UI
  volumeSlider.style.setProperty("--volume-percent", newVolume * 100);
  const thumb = volumeSlider.querySelector(".volume-thumb");
  thumb.style.left = `${newVolume * 100}%`;

  volumeBtn.textContent =
    newVolume === 0 ? "🔇" : newVolume <= 0.5 ? "🔉" : "🔊";

  localStorage.setItem("playerVolume", newVolume);
});

volumeRange.addEventListener("input", () => {
  audioPlayer.volume = volumeRange.value;
  audioPlayer.muted = volumeRange.value === "0";
  volumeBtn.textContent =
    volumeRange.value === "0" ? "🔇" : volumeRange.value <= 0.5 ? "🔉" : "🔊";
  localStorage.setItem("playerVolume", volumeRange.value);
});

audioPlayer.addEventListener("timeupdate", () => {
  if (audioPlayer.duration) {
    const progressPercent =
      (audioPlayer.currentTime / audioPlayer.duration) * 100;
    progress.style.width = `${progressPercent}%`;
    progressRange.value = progressPercent;
  }
});

progressRange.addEventListener("input", () => {
  if (audioPlayer.duration) {
    const newTime = (progressRange.value / 100) * audioPlayer.duration;
    audioPlayer.currentTime = newTime;
    progress.style.width = `${progressRange.value}%`;
  }
});

tracksBtn.addEventListener("click", () =>
  trackListOverlay.classList.add("show")
);
closeTracksBtn.addEventListener("click", () =>
  trackListOverlay.classList.remove("show")
);

audioPlayer.addEventListener("ended", () => {
  if (currentTrackIndex < currentTracks.length - 1) {
    selectTrack(currentTrackIndex + 1);
  } else {
    isPlaying = false;
    playPauseBtn.textContent = "▶";
    stopTimer(); // Stop timer when playlist ends
  }
});

// // Debug volume display toggle
// document.addEventListener("keydown", (e) => {
//   if (e.key === "D" && e.shiftKey) {
//     // Shift+D to toggle debug
//     const debug = document.getElementById("volume-debug");
//     debug.style.display =
//       debug.style.display === "none" ? "block" : "none";
//   }
// });

// // Update debug display continuously
// setInterval(() => {
//   const debug = document.getElementById("volume-debug");
//   if (debug.style.display !== "none") {
//     debug.textContent =
//       `Vol: ${(audioPlayer.volume * 100).toFixed(1)}% ` +
//       `(Muted: ${audioPlayer.muted}) ` +
//       `(Fading: ${isFading})`;
//   }
// }, 100);

async function init() {
  bottomPlayer.classList.add("show");
  await loadTracks(currentActivity);
  if (currentTracks.length > 0) {
    currentTrackIndex = 0;
    trackTitle.textContent = currentTracks[0].name;
    audioPlayer.src = currentTracks[0].url;
    document.querySelectorAll(".track-item")[0].classList.add("active");
  }

  // Initialize timer based on current mode
  if (currentTimerMode === "interval") {
    const workMinutes = parseInt(workMinutesInput.value) || 25;
    timeLeft = workMinutes * 60;
    timerLabel.textContent = `WORK: ${workMinutes} MINUTES`;
  }

  updateTimerDisplay();
  updateIntervalButtonText();
}

init();
