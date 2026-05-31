/* ==========================================================================
   GENDER REVEAL APP - CORE CONTROLLER
   ========================================================================== */

// 1. App State
let currentSlide = 0;
const totalSlides = 12; // 0 to 12
let guestData = {
    name: '',
    relation: '',
    babyTitle: '',
    photo: ''
};
let answers = {};
let actualGender = 'boy'; // pre-configured result as hinted by the acrostic riddle ("LITTLE MAN")
let selectedTeam = '';     // guest's prediction: 'girl' or 'boy'
let confidence = 5;
let timing = 'On Time';
let puzzleBoard = [];
let puzzleSolved = false;
let isMuted = false;

// Final Reveal Smudge State
let finalRevealCanvas = null;
let finalRevealCtx = null;
let isFinalRevealing = false;
let finalRevealSmudgeSolved = false;
let flowingBalloonsInterval = null;
let flowingBalloonsContainer = null;

// PDF Printing Unlock State
let pdfSaved = false;

// Audio Context (Lazy loaded)
let audioCtx = null;
let musicInterval = null;

// Confetti Particle System
let canvas = null;
let ctx = null;
let particles = [];
let animationFrameId = null;

// 2. Questions Database
const part1Questions = [
    { id: 'look_like', question: 'Who will the baby look more like?', options: ['Ashwin', 'Ratty'] },
    { id: 'eyes', question: 'Whose eyes will the baby have?', options: ['Ashwin', 'Ratty'] },
    { id: 'smile', question: 'Whose smile will the baby inherit?', options: ['Ashwin', 'Ratty'] },
    { id: 'hair', question: "Will the baby have curly (Ash's) hair or straight (Ratty's) hair?", options: ['Ashwin', 'Ratty'] },
    { id: 'personality', question: 'Who will the baby take after more in personality?', options: ['Ashwin', 'Ratty'] },
    { id: 'first_words', question: "Will the baby's first words be 'Amma' or 'Appa'?", options: ['Appa', 'Amma'], mapping: { 'Appa': 'Ashwin', 'Amma': 'Ratty' } },
    { id: 'stricter', question: 'Which parent will be stricter?', options: ['Ashwin', 'Ratty'] }
];

const part2Questions = [
    { id: 'spoil', question: 'Which parent will spoil the baby more?', options: ['Ashwin', 'Ratty'] },
    { id: 'photos', question: 'Who will take the most baby photos?', options: ['Ashwin', 'Ratty'] },
    { id: 'storyteller', question: 'Who will be the better bedtime storyteller?', options: ['Ashwin', 'Ratty', 'Thatha', 'Paati'] },
    { id: 'sleep_loss', question: 'Who will lose the most sleep during the first year?', options: ['Ashwin', 'Ratty'] },
    { id: 'panic_3am', question: 'At 3 AM, who is more likely to panic over a baby crying?', options: ['Ashwin', 'Ratty'] },
    { id: 'runs', question: 'Who will be the one taking the baby out in a stroller for early morning runs?', options: ['Ashwin', 'Ratty'] },
    { id: 'matching_outfits', question: 'Who is more likely to dress the baby in matching outfits?', options: ['Ashwin', 'Ratty'] },
    { id: 'sweet_tooth', question: 'Who will pass down their sweet tooth?', options: ['Ashwin', 'Ratty'] },
    { id: 'public_meltdown', question: 'When the baby has a meltdown in a public place, who panics first?', options: ['Ashwin', 'Ratty'] },
    { id: 'diaper_bag', question: 'Who is more likely to overpack the diaper bag for a simple trip to the grocery store?', options: ['Ashwin', 'Ratty'] },
    { id: 'baby_proofing', question: "Who is going to take 'baby-proofing' way too far and bubble-wrap the coffee table?", options: ['Ashwin', 'Ratty'] },
    { id: 'sunscreen', question: 'Who is going to make sure the baby is fully lathered in TIRTIR sunscreen before their first beach trip?', options: ['Ashwin', 'Ratty'] },
    { id: 'monstera', question: 'Who is going to successfully teach the kid how to keep a Monstera plant alive?', options: ['Ashwin', 'Ratty'] }
];

// 3. Audio Engine (Synthesized sounds using Web Audio API)
function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playSynthesizedTone(freq, type, duration, delay = 0) {
    if (isMuted) return;
    initAudio();
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    setTimeout(() => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = type || 'sine';
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

        gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    }, delay * 1000);
}

function playClickSound() {
    playSynthesizedTone(600, 'triangle', 0.15);
}

function playPuzzleTick() {
    playSynthesizedTone(350, 'sine', 0.08);
}

function playPuzzleSuccess() {
    playSynthesizedTone(261.63, 'triangle', 0.2, 0);   // C4
    playSynthesizedTone(329.63, 'triangle', 0.2, 0.1); // E4
    playSynthesizedTone(392.00, 'triangle', 0.2, 0.2); // G4
    playSynthesizedTone(523.25, 'triangle', 0.5, 0.3); // C5
}

function playSynthesizedRevealChime() {
    const root = actualGender === 'girl' ? 349.23 : 293.66; // F4 for girl (bright), D4 for boy (warm)
    playSynthesizedTone(root, 'sine', 0.3, 0);
    playSynthesizedTone(root * 1.25, 'sine', 0.3, 0.15);
    playSynthesizedTone(root * 1.5, 'sine', 0.3, 0.3);
    playSynthesizedTone(root * 2.0, 'sine', 0.8, 0.45);
}

function playBalloonPopSound() {
    if (isMuted) return;
    initAudio();
    
    // Play an explosion of white noise for the pop
    const bufferSize = audioCtx.sampleRate * 0.35; // 0.35 seconds
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }

    const noiseNode = audioCtx.createBufferSource();
    noiseNode.buffer = buffer;

    const filterNode = audioCtx.createBiquadFilter();
    filterNode.type = 'lowpass';
    filterNode.frequency.setValueAtTime(800, audioCtx.currentTime);
    filterNode.frequency.exponentialRampToValueAtTime(10, audioCtx.currentTime + 0.35);

    const gainNode = audioCtx.createGain();
    gainNode.gain.setValueAtTime(0.35, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);

    noiseNode.connect(filterNode);
    filterNode.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    noiseNode.start();
    
    // Follow up with triumph chime
    playSynthesizedRevealChime();
}

// Background lullaby synth loop
function startBackgroundLullaby() {
    if (isMuted) return;
    initAudio();
    
    // Simple looping notes for nursery vibe: C4, E4, G4, F4, E4, D4, C4
    const notes = [261.63, 329.63, 392.00, 349.23, 329.63, 293.66, 261.63];
    let index = 0;

    if (musicInterval) clearInterval(musicInterval);

    musicInterval = setInterval(() => {
        if (isMuted) return;
        playSynthesizedTone(notes[index], 'sine', 0.8);
        index = (index + 1) % notes.length;
    }, 1200);
}

function toggleMusic() {
    isMuted = !isMuted;
    const btn = document.getElementById('musicToggleBtn');
    if (isMuted) {
        btn.textContent = '🔇 Mute';
        btn.style.background = '#FFD5D5';
        if (musicInterval) {
            clearInterval(musicInterval);
            musicInterval = null;
        }
    } else {
        btn.textContent = '🔊 FX';
        btn.style.background = 'white';
        initAudio();
        startBackgroundLullaby();
    }
}

// 4. Initial Document Ready Hooks
document.addEventListener('DOMContentLoaded', () => {
    // Check URL parameters for hash config
    const hash = window.location.hash;
    if (hash === '#reveal=girl') {
        actualGender = 'girl';
    } else if (hash === '#reveal=boy') {
        actualGender = 'boy';
    }

    // Dynamic MCQs Loading
    renderQuestions(part1Questions, 'quizContainerPart1');
    renderQuestions(part2Questions, 'quizContainerPart2');

    // Create jigsaw board matrix
    initPuzzle();
});

// 5. Questions Rendering Engine
function renderQuestions(questionsList, targetId) {
    const container = document.getElementById(targetId);
    container.innerHTML = '';

    questionsList.forEach(q => {
        const itemRow = document.createElement('div');
        itemRow.className = 'quiz-item-row';

        const qText = document.createElement('p');
        qText.className = 'quiz-question-lbl';
        qText.textContent = q.question;
        itemRow.appendChild(qText);

        const optionGrid = document.createElement('div');
        optionGrid.className = 'quiz-option-grid';
        if (q.options.length > 2) {
            optionGrid.className += ' four-columns';
        }

        q.options.forEach(opt => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'option-card-btn';
            btn.setAttribute('data-qid', q.id);
            btn.setAttribute('data-val', opt);
            btn.onclick = () => selectQuizAnswer(q.id, opt, btn);

            const emoji = document.createElement('span');
            emoji.className = 'option-avatar-placeholder';
            if (opt === 'Ashwin') emoji.textContent = '🦖';
            else if (opt === 'Ratty') emoji.textContent = '🐥';
            else if (opt === 'Thatha') emoji.textContent = '👴';
            else if (opt === 'Paati') emoji.textContent = '👵';
            else if (opt === 'Appa') emoji.textContent = '🦖';
            else if (opt === 'Amma') emoji.textContent = '🐥';
            else emoji.textContent = '🧸';

            const optLabel = document.createElement('span');
            optLabel.textContent = opt;

            btn.appendChild(emoji);
            btn.appendChild(optLabel);
            optionGrid.appendChild(btn);
        });

        itemRow.appendChild(optionGrid);
        container.appendChild(itemRow);
    });
}

function selectQuizAnswer(questionId, optionValue, clickedBtn) {
    playClickSound();
    
    // Save answer
    answers[questionId] = optionValue;

    // Deselect siblings
    const siblings = clickedBtn.parentNode.querySelectorAll('.option-card-btn');
    siblings.forEach(sib => {
        sib.classList.remove('selected-ashwin', 'selected-ratty', 'selected-thatha', 'selected-paati', 'selected-both');
    });

    // Select this card with custom style based on selection
    if (optionValue === 'Ashwin' || optionValue === 'Appa') {
        clickedBtn.classList.add('selected-ashwin');
    } else if (optionValue === 'Ratty' || optionValue === 'Amma') {
        clickedBtn.classList.add('selected-ratty');
    } else if (optionValue === 'Thatha') {
        clickedBtn.classList.add('selected-thatha');
    } else if (optionValue === 'Paati') {
        clickedBtn.classList.add('selected-paati');
    } else {
        clickedBtn.classList.add('selected-both');
    }
}

// 6. Navigation Controls
function showSlide(index) {
    const slides = document.querySelectorAll('.slide-card');
    
    if (index < 0 || index >= slides.length) return;

    // Trigger music once guest starts
    if (currentSlide === 0 && index === 1) {
        initAudio();
        startBackgroundLullaby();
    }

    // Stop flowing balloons if navigating away from Slide 12
    if (index !== 12) {
        stopFlowingBalloons();
    }

    slides[currentSlide].classList.remove('active');
    currentSlide = index;
    slides[currentSlide].classList.add('active');

    // Update progress tracker
    const header = document.getElementById('appHeader');
    if (currentSlide > 0) {
        header.classList.remove('hidden');
        const percentage = (currentSlide / totalSlides) * 100;
        document.getElementById('progressLine').style.width = percentage + '%';
        document.getElementById('footprintTracker').style.left = percentage + '%';
        document.getElementById('slideIndicator').textContent = `${currentSlide} / ${totalSlides}`;
    } else {
        header.classList.add('hidden');
    }

    // Puzzle slide specific checks
    if (currentSlide === 4) {
        checkPuzzleLockState();
    }

    // Intermission 2 stats check
    if (currentSlide === 7) {
        renderLiveStats();
    }

    // Final slide specific checks
    if (currentSlide === 11) {
        populateCertificate();
        populateAnswersLog();
        checkRevealUnlockState();
    }

    if (currentSlide === 12) {
        initFinalRevealSmudge();
    }

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showValidationToast(message) {
    const toast = document.getElementById('validationToast');
    if (!toast) return;
    toast.textContent = message || '⚠️ Please answer all questions on this page first!';
    toast.classList.add('show');
    
    // Play a warning synth tone
    playSynthesizedTone(200, 'sawtooth', 0.15);
    playSynthesizedTone(150, 'sawtooth', 0.25, 0.08);

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function validateCurrentSlide() {
    if (currentSlide === 1) {
        const whoAreYou = document.getElementById('q_whoAreYou').value.trim();
        const babyCall = document.getElementById('q_babyCall').value.trim();
        if (!whoAreYou || !babyCall) {
            showValidationToast('⚠️ Please write down who you are and how the baby should call you!');
            return false;
        }
    } else if (currentSlide === 3) {
        for (let q of part1Questions) {
            if (!answers[q.id]) {
                showValidationToast('⚠️ Please guess all baby traits before continuing!');
                return false;
            }
        }
    } else if (currentSlide === 4) {
        if (!puzzleSolved) {
            showValidationToast('⚠️ Please solve the puzzle first!');
            return false;
        }
    } else if (currentSlide === 5) {
        for (let q of part2Questions) {
            if (!answers[q.id]) {
                showValidationToast('⚠️ Please answer all parenting scenarios before continuing!');
                return false;
            }
        }
    } else if (currentSlide === 6) {
        const fields = [
            { id: 'q_nickname', name: 'ridiculous nickname' },
            { id: 'q_favorite', name: 'favorite family member' },
            { id: 'q_superpower', name: 'superpower' },
            { id: 'q_wish', name: 'wish word' },
            { id: 'q_spoiling', name: 'how you plan to spoil the baby' },
            { id: 'q_lifeskill', name: 'most important life skill' }
        ];
        for (let field of fields) {
            const val = document.getElementById(field.id).value.trim();
            if (!val) {
                showValidationToast(`⚠️ Please fill out: "${field.name}"!`);
                return false;
            }
        }
    } else if (currentSlide === 8) {
        if (!selectedTeam) {
            showValidationToast('⚠️ Please select Team Girl or Team Boy!');
            return false;
        }
        const clue = document.getElementById('guessClue').value.trim();
        if (!clue) {
            showValidationToast('⚠️ Please write down what clue convinced you of your guess!');
            return false;
        }
        const boyName = document.getElementById('suggest_boy1').value.trim();
        const girlName = document.getElementById('suggest_girl1').value.trim();
        if (!boyName || !girlName) {
            showValidationToast('⚠️ Please suggest at least one Boy and one Girl name!');
            return false;
        }
    } else if (currentSlide === 10) {
        const riddleAns = document.getElementById('q_riddle_answer').value.trim().toLowerCase();
        if (!riddleAns) {
            showValidationToast('⚠️ Please solve the riddle and enter the secret message first!');
            return false;
        }
        
        const normalized = riddleAns.replace(/\s+/g, '');
        const isCorrect = normalized === 'littleman' || 
                          normalized === 'boy' || 
                          normalized === 'littleman!' || 
                          riddleAns.includes('little man') || 
                          riddleAns.includes('boy') || 
                          riddleAns.includes('man');
                          
        if (!isCorrect) {
            showValidationToast('⚠️ That is not the correct secret message! Clue: look at the first letter of each line.');
            return false;
        }
        
        playPuzzleSuccess();
    } else if (currentSlide === 11) {
        if (!pdfSaved) {
            showValidationToast('⚠️ Please print/save at least one PDF first to preserve your guesses!');
            return false;
        }
    }
    return true;
}

function nextSlide() {
    // Form verification for Slide 0 is handled separately inside handleGuestSubmit
    if (currentSlide === 0) return;

    // Block slide transition if validation fails
    if (!validateCurrentSlide()) return;

    showSlide(currentSlide + 1);
}

function prevSlide() {
    showSlide(currentSlide - 1);
}

// Welcome form handler
function handleGuestSubmit(e) {
    e.preventDefault();
    playClickSound();

    const name = document.getElementById('guestName').value.trim();

    if (!name) return;

    guestData.name = name;
    guestData.relation = 'Friend';
    guestData.babyTitle = 'Aunty/Uncle';

    showSlide(1);
}

// Photo upload methods
function triggerPhotoUpload() {
    document.getElementById('guestPhoto').click();
}

function previewGuestPhoto(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const preview = document.getElementById('photoPreview');
        const container = document.getElementById('photoPreviewContainer');
        const dropzone = document.getElementById('photoDropzone');
        
        preview.src = e.target.result;
        guestData.photo = e.target.result; // store base64 string

        container.classList.remove('hidden');
        dropzone.classList.add('hidden');
    };
    reader.readAsDataURL(file);
}

function removeGuestPhoto(event) {
    event.stopPropagation();
    document.getElementById('guestPhoto').value = '';
    guestData.photo = '';
    
    document.getElementById('photoPreviewContainer').classList.add('hidden');
    document.getElementById('photoDropzone').classList.remove('hidden');
}

// 7. Dynamic Stats Engine
function calculateAshwinVsRatty() {
    let ashwinCount = 0;
    let rattyCount = 0;
    let totalCount = 0;

    // Check quiz answers
    const allQuestions = [...part1Questions, ...part2Questions];
    allQuestions.forEach(q => {
        const ans = answers[q.id];
        if (ans) {
            totalCount++;
            if (ans === 'Ashwin' || ans === 'Appa') {
                ashwinCount++;
            } else if (ans === 'Ratty' || ans === 'Amma') {
                rattyCount++;
            } else if (ans === 'Ashwin/Ratty') {
                ashwinCount += 0.5;
                rattyCount += 0.5;
            }
        }
    });

    if (totalCount === 0) return { ashwin: 50, ratty: 50 };

    const rattyPct = Math.round((rattyCount / totalCount) * 100);
    const ashwinPct = 100 - rattyPct;

    return { ashwin: ashwinPct, ratty: rattyPct };
}

function renderLiveStats() {
    const stats = calculateAshwinVsRatty();
    
    const p = document.getElementById('statsParagraph');
    const barRatty = document.getElementById('statsBarRatty');
    const barAshwin = document.getElementById('statsBarAshwin');

    p.innerHTML = `You believe the baby will take after <strong>Ratty (Mom)</strong> in personality & features by <strong>${stats.ratty}%</strong> and <strong>Ashwin (Dad)</strong> by <strong>${stats.ashwin}%</strong>!`;

    barRatty.style.width = stats.ratty + '%';
    barRatty.textContent = `Ratty (${stats.ratty}%)`;

    barAshwin.style.width = stats.ashwin + '%';
    barAshwin.textContent = `Ashwin (${stats.ashwin}%)`;
}

let selectedTilePos = null;

// 8. Click-to-Swap Matching Puzzle Engine (3x4 Portrait Grid - 12 Pieces)
function initPuzzle() {
    puzzleBoard = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    puzzleSolved = false;
    selectedTilePos = null;
    
    // Start shuffled to prevent displaying the completed answer directly
    do {
        for (let i = puzzleBoard.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const temp = puzzleBoard[i];
            puzzleBoard[i] = puzzleBoard[j];
            puzzleBoard[j] = temp;
        }
    } while (puzzleBoard.every((val, index) => val === index));

    renderPuzzle();
    
    // Lock progress button by default
    setTimeout(() => {
        checkPuzzleLockState();
    }, 50);
}

function renderPuzzle() {
    const container = document.getElementById('puzzleContainer');
    container.innerHTML = '';
    
    // Set enlarged 3x4 grid structure and portrait size bounds (3:4 ratio) with absolute pixel sizes
    container.style.setProperty('box-sizing', 'content-box', 'important');
    container.style.setProperty('gap', '0px', 'important');
    container.style.setProperty('width', '330px', 'important');
    container.style.setProperty('height', '440px', 'important');
    container.style.setProperty('grid-template-columns', '110px 110px 110px', 'important');
    container.style.setProperty('grid-template-rows', '110px 110px 110px 110px', 'important');

    // Exclusively use cake memory picture for puzzle challenge
    const bgImg = 'assets/cake.jpg';

    puzzleBoard.forEach((tileVal, position) => {
        const tile = document.createElement('div');
        tile.className = 'puzzle-tile';
        
        // Enforce absolute tile sizes to prevent cuts or distortions
        tile.style.width = '110px';
        tile.style.height = '110px';
        tile.style.boxSizing = 'border-box';
        tile.style.backgroundRepeat = 'no-repeat';

        const row = Math.floor(tileVal / 3);
        const col = tileVal % 3;
        // Tile size is exactly 110px width by 110px height
        const posX = -col * 110;
        const posY = -row * 110;

        tile.style.backgroundImage = `url(${bgImg})`;
        tile.style.backgroundSize = '330px 440px'; // Matches container portrait dimensions
        tile.style.backgroundPosition = `${posX}px ${posY}px`;
        
        // Highlight if selected
        if (selectedTilePos === position) {
            tile.style.outline = '4px solid var(--color-accent)';
            tile.style.boxShadow = '0 0 15px var(--color-accent)';
            tile.style.transform = 'scale(0.96)';
        }

        tile.onclick = () => swapTile(position);
        container.appendChild(tile);
    });
}

function swapTile(position) {
    if (puzzleSolved) return;

    if (selectedTilePos === null) {
        // Select first tile
        selectedTilePos = position;
        playPuzzleTick();
        renderPuzzle();
    } else if (selectedTilePos === position) {
        // Deselect if clicked again
        selectedTilePos = null;
        playPuzzleTick();
        renderPuzzle();
    } else {
        // Swap values between selectedTilePos and position
        playClickSound();
        const temp = puzzleBoard[selectedTilePos];
        puzzleBoard[selectedTilePos] = puzzleBoard[position];
        puzzleBoard[position] = temp;
        
        selectedTilePos = null;
        renderPuzzle();
        checkPuzzleSolved();
    }
}

function shufflePuzzle() {
    playClickSound();
    puzzleSolved = false;
    selectedTilePos = null;
    
    document.getElementById('puzzleSuccessMessage').classList.add('hidden');

    // Shuffle the 12 positions randomly, making sure it isn't already solved
    do {
        for (let i = puzzleBoard.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const temp = puzzleBoard[i];
            puzzleBoard[i] = puzzleBoard[j];
            puzzleBoard[j] = temp;
        }
    } while (puzzleBoard.every((val, index) => val === index));

    renderPuzzle();
    checkPuzzleLockState();
}

function skipPuzzle() {
    playPuzzleSuccess();
    puzzleSolved = true;
    selectedTilePos = null;
    
    // Sort puzzle matrix so it displays as fully solved visually
    puzzleBoard = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    renderPuzzle();
    
    const msg = document.getElementById('puzzleSuccessMessage');
    if (msg) {
        msg.innerHTML = '✨ Puzzle skipped! You unlocked the <strong>"Expert Puzzle Solver"</strong> badge! 🧩';
        msg.classList.remove('hidden');
    }
    
    // Celebration confetti!
    initConfetti();
    checkPuzzleLockState();
}

function checkPuzzleSolved() {
    const isSorted = puzzleBoard.every((val, index) => val === index);
    if (isSorted) {
        puzzleSolved = true;
        playPuzzleSuccess();

        // Reveal complete visual
        document.getElementById('puzzleSuccessMessage').classList.remove('hidden');
        
        // Pop colours on solving!
        initConfetti();
        
        checkPuzzleLockState();
    }
}

function checkPuzzleLockState() {
    const nextBtn = document.getElementById('puzzleNextBtn');
    if (!nextBtn) return;
    if (puzzleSolved) {
        nextBtn.removeAttribute('disabled');
        nextBtn.classList.remove('disabled');
        nextBtn.textContent = 'Continue ➔';
    } else {
        nextBtn.setAttribute('disabled', 'true');
        nextBtn.classList.add('disabled');
        nextBtn.textContent = 'Solve to continue ➔';
    }
}

// 8. Final Guesses & Confidence
function selectTeam(team) {
    playClickSound();
    selectedTeam = team;
    
    const girlCard = document.getElementById('teamGirlCard');
    const boyCard = document.getElementById('teamBoyCard');

    if (team === 'girl') {
        girlCard.classList.add('active');
        boyCard.classList.remove('active');
    } else {
        boyCard.classList.add('active');
        girlCard.classList.remove('active');
    }
}

function updateConfidenceVal(val) {
    confidence = val;
    document.getElementById('confidenceValueDisplay').textContent = `${val} / 10`;
}

function selectTiming(timeVal) {
    playClickSound();
    timing = timeVal;

    document.getElementById('timingEarly').classList.remove('active');
    document.getElementById('timingOnTime').classList.remove('active');
    document.getElementById('timingLate').classList.remove('active');

    if (timeVal === 'Early') {
        document.getElementById('timingEarly').classList.add('active');
    } else if (timeVal === 'On Time') {
        document.getElementById('timingOnTime').classList.add('active');
    } else {
        document.getElementById('timingLate').classList.add('active');
    }
}



// 10. The Magic Balloon Pop Reveal (Particle Physics)
let balloonClicks = 0;
const maxBalloonClicks = 5;

function tapBalloon() {
    if (balloonClicks >= maxBalloonClicks) return;

    balloonClicks++;
    playSynthesizedTone(300 + (balloonClicks * 45), 'triangle', 0.15);

    const balloon = document.getElementById('revealBalloon');
    
    // Scale up
    const scale = 1 + (balloonClicks * 0.08);
    balloon.style.setProperty('--b-scale', scale);
    balloon.style.transform = `scale(${scale})`;

    // Shake faster
    if (balloonClicks >= 3) {
        balloon.classList.add('shake-fast');
    }

    if (balloonClicks === maxBalloonClicks) {
        popBalloon();
    }
}

function popBalloon() {
    playBalloonPopSound();

    const balloon = document.getElementById('revealBalloon');
    balloon.classList.add('hidden');
    document.getElementById('balloonTitle').textContent = '💫 REVEALED! 💫';
    document.getElementById('balloonInstruction').classList.add('hidden');
    document.getElementById('balloonNavBack').classList.add('hidden');

    // Create particle physics explosion
    initConfetti();

    // Show details
    setTimeout(() => {
        revealGenderAnnouncement();
    }, 1000);
}

function revealGenderAnnouncement() {
    const revealBox = document.getElementById('genderRevealBox');
    const announcement = document.getElementById('revealAnnouncement');
    const babyGraphic = document.getElementById('revealBabyGraphic');
    const desc = document.getElementById('revealDesc');

    revealBox.classList.remove('hidden');
    revealBox.className = 'gender-reveal-box prank-theme';

    announcement.textContent = "It's a... SURPRISE! 🤯";
    babyGraphic.innerHTML = `<img src="assets/babies.png" alt="Prank Graphic" class="reveal-baby-graphic-img animate-wobble" style="width: 140px; height: 140px; object-fit: contain; margin: 15px auto; display: block;">`;
    desc.innerHTML = `PRANKED! You thought we'd make it that easy?`;
}

// Confetti Particle Physics system
function initConfetti(colorType) {
    canvas = document.getElementById('revealCanvas');
    canvas.classList.remove('hidden');
    ctx = canvas.getContext('2d');

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    particles = [];
    
    // Choose colors based on theme type
    let colorTheme = [];
    if (colorType === 'blue') {
        colorTheme = ['#AEC6CF', '#7FB3D5', '#3498DB', '#2980B9', '#D6DBDF', '#EBF5FB'];
    } else if (colorType === 'pink') {
        colorTheme = ['#FFB7C5', '#FF85A1', '#F1948A', '#EC7063', '#FDEDEC', '#FEF9E7'];
    } else {
        // Prank Pop: Mix both Pink and Blue together!
        colorTheme = ['#FFB7C5', '#AEC6CF', '#FF85A1', '#7FB3D5', '#FFFDF6', '#F8C471'];
    }

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    // Create 150 particles
    for (let i = 0; i < 150; i++) {
        particles.push({
            x: centerX,
            y: centerY,
            radius: Math.random() * 5 + 3,
            color: colorTheme[Math.floor(Math.random() * colorTheme.length)],
            vx: (Math.random() - 0.5) * 15,
            vy: (Math.random() - 0.7) * 16 - 2, // burst upwards
            gravity: 0.28,
            fade: Math.random() * 0.01 + 0.005,
            alpha: 1.0,
            rotation: Math.random() * 360,
            rotationSpeed: (Math.random() - 0.5) * 8
        });
    }

    animateParticles();
}

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

function animateParticles() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let activeParticles = false;

    particles.forEach(p => {
        if (p.alpha <= 0) return;

        activeParticles = true;

        p.x += p.vx;
        p.vy += p.gravity;
        p.y += p.vy;
        p.alpha -= p.fade;
        p.rotation += p.rotationSpeed;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.fillStyle = p.color;

        // Draw circles or small rectangles (streamers)
        if (Math.random() > 0.5) {
            ctx.beginPath();
            ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.fillRect(-p.radius, -p.radius / 2, p.radius * 2, p.radius);
        }

        ctx.restore();
    });

    if (activeParticles) {
        animationFrameId = requestAnimationFrame(animateParticles);
    } else {
        cancelAnimationFrame(animationFrameId);
        canvas.classList.add('hidden');
    }
}

// 11. PDF Export / Print Certificate Generator
function populateCertificate() {
    document.getElementById('certGuestName').textContent = guestData.name;
    
    const babyCallVal = document.getElementById('q_babyCall').value.trim() || 'Aunty/Uncle';
    document.getElementById('certGuestTitle').innerHTML = `Official title for the baby: <strong>"${babyCallVal}"</strong>`;

    const guessDisplay = selectedTeam === 'girl' ? 'Team Girl 🎀' : selectedTeam === 'boy' ? 'Team Boy 🧸' : 'Undecided 🤷';
    const guessEl = document.getElementById('certOfficialGuess');
    guessEl.textContent = guessDisplay;
    guessEl.className = 'cert-val';
    if (selectedTeam === 'girl') guessEl.classList.add('pink-highlight');
    if (selectedTeam === 'boy') guessEl.classList.add('blue-highlight');

    document.getElementById('certConfidence').textContent = `${confidence} / 10`;
    document.getElementById('certArrival').textContent = timing;

    // Ashwin vs Ratty stats
    const stats = calculateAshwinVsRatty();
    document.getElementById('certMomPct').textContent = `Mom (Ratty): ${stats.ratty}%`;
    document.getElementById('certDadPct').textContent = `Dad (Ashwin): ${stats.ashwin}%`;
    document.getElementById('certBarFill').style.width = stats.ratty + '%';

    // Details Grid
    const bondVal = document.getElementById('q_whoAreYou').value.trim() || 'Wonderful Friend';
    document.getElementById('certBondText').textContent = bondVal;
    document.getElementById('certNicknameText').textContent = document.getElementById('q_nickname').value.trim() || 'Tiny Peanut';
    document.getElementById('certWishText').textContent = document.getElementById('q_wish').value.trim() || 'Joy & Laughter';
    document.getElementById('certClueText').textContent = document.getElementById('guessClue').value.trim() || 'Intuition';

    // Name suggestions compilation
    const boy1 = document.getElementById('suggest_boy1').value.trim();
    const boy2 = document.getElementById('suggest_boy2').value.trim();
    const girl1 = document.getElementById('suggest_girl1').value.trim();
    const girl2 = document.getElementById('suggest_girl2').value.trim();
    let suggestions = [];
    if (boy1 || boy2) suggestions.push(`Boy: ${[boy1, boy2].filter(Boolean).join(', ')}`);
    if (girl1 || girl2) suggestions.push(`Girl: ${[girl1, girl2].filter(Boolean).join(', ')}`);
    document.getElementById('certSuggestionsText').innerHTML = suggestions.length > 0 ? suggestions.join(' | ') : 'None';


    // Guest photo setup (Polaroid style)
    const certPhoto = document.getElementById('certGuestPhoto');
    if (guestData.photo) {
        certPhoto.src = guestData.photo;
    } else {
        certPhoto.src = 'assets/balloons.jpg'; // default fallback for memory Polaroid
    }
}

function printCertificate() {
    playClickSound();
    populateCertificate();
    
    // Set PDF save status to true and check unlock triggers
    pdfSaved = true;
    checkRevealUnlockState();
    
    // Add print certificate selector to body, remove answers print selector
    document.body.classList.add('print-certificate');
    document.body.classList.remove('print-answers');
    
    window.print();
}

function printAllAnswers() {
    playClickSound();
    populateAnswersLog();
    
    // Set PDF save status to true and check unlock triggers
    pdfSaved = true;
    checkRevealUnlockState();
    
    // Add print answers selector to body, remove certificate print selector
    document.body.classList.add('print-answers');
    document.body.classList.remove('print-certificate');
    
    window.print();
}

function populateAnswersLog() {
    document.getElementById('ansGuestName').textContent = `Predictions logged by: ${guestData.name}`;
    
    document.getElementById('ans_whoAreYou').textContent = document.getElementById('q_whoAreYou').value.trim() || 'Undecided';
    document.getElementById('ans_babyCall').textContent = document.getElementById('q_babyCall').value.trim() || 'Undecided';
    
    // Part 1 Traits Grid
    const grid1 = document.getElementById('ansGridPart1');
    grid1.innerHTML = '';
    part1Questions.forEach(q => {
        const row = document.createElement('div');
        row.className = 'ans-row';
        row.innerHTML = `<strong>${q.question}</strong> <span>${answers[q.id] || 'Not Guessing'}</span>`;
        grid1.appendChild(row);
    });
    
    // Part 2 Parenting Grid
    const grid2 = document.getElementById('ansGridPart2');
    grid2.innerHTML = '';
    part2Questions.forEach(q => {
        const row = document.createElement('div');
        row.className = 'ans-row';
        row.innerHTML = `<strong>${q.question}</strong> <span>${answers[q.id] || 'Not Guessing'}</span>`;
        grid2.appendChild(row);
    });
    
    // Messages Grid
    const gridMsg = document.getElementById('ansGridMessages');
    gridMsg.innerHTML = '';
    const msgFields = [
        { id: 'q_nickname', label: 'Ridiculous nickname:' },
        { id: 'q_favorite', label: 'Favorite family member:' },
        { id: 'q_superpower', label: 'Baby superpower:' },
        { id: 'q_wish', label: 'Wish for baby:' },
        { id: 'q_spoiling', label: 'How you plan to spoil them:' },
        { id: 'q_lifeskill', label: 'Life skill you will teach:' }
    ];
    msgFields.forEach(f => {
        const row = document.createElement('div');
        row.className = 'ans-row';
        const val = document.getElementById(f.id).value.trim() || 'Not Answered';
        row.innerHTML = `<strong>${f.label}</strong> <span>${val}</span>`;
        gridMsg.appendChild(row);
    });
    
    // Final Guess
    const guessDisplay = selectedTeam === 'girl' ? 'Team Girl 🎀' : selectedTeam === 'boy' ? 'Team Boy 🧸' : 'Undecided';
    document.getElementById('ans_officialGuess').textContent = guessDisplay;
    document.getElementById('ans_confidence').textContent = `${confidence} / 10`;
    document.getElementById('ans_clue').textContent = document.getElementById('guessClue').value.trim() || 'None';
    document.getElementById('ans_arrival').textContent = timing;

    // Guest photo setup (Polaroid style)
    const ansPhoto = document.getElementById('ansGuestPhoto');
    if (guestData.photo) {
        ansPhoto.src = guestData.photo;
    } else {
        ansPhoto.src = 'assets/balloons.jpg'; // default fallback for memory Polaroid
    }
}

// Restart app helper
function restartApp() {
    playClickSound();
    // Reset balloon popping states
    balloonClicks = 0;
    const balloon = document.getElementById('revealBalloon');
    balloon.style.transform = 'scale(1)';
    balloon.style.removeProperty('--b-scale');
    balloon.classList.remove('shake-fast', 'hidden');
    document.getElementById('balloonTitle').textContent = 'The Giant Black Reveal Balloon';
    document.getElementById('balloonInstruction').classList.remove('hidden');
    document.getElementById('balloonNavBack').classList.remove('hidden');
    document.getElementById('genderRevealBox').classList.add('hidden');

    // Clear outputs
    answers = {};
    selectedTeam = '';
    confidence = 5;
    timing = 'On Time';
    
    // Clear text inputs & suggestions
    document.getElementById('guestName').value = '';
    document.getElementById('q_whoAreYou').value = '';
    document.getElementById('q_babyCall').value = '';
    document.getElementById('suggest_boy1').value = '';
    document.getElementById('suggest_boy2').value = '';
    document.getElementById('suggest_girl1').value = '';
    document.getElementById('suggest_girl2').value = '';
    document.getElementById('q_riddle_answer').value = '';
    document.getElementById('q_nickname').value = '';
    document.getElementById('q_favorite').value = '';
    document.getElementById('q_superpower').value = '';
    document.getElementById('q_wish').value = '';
    document.getElementById('q_spoiling').value = '';
    document.getElementById('q_lifeskill').value = '';
    document.getElementById('guessClue').value = '';
    
    // Reset PDF print lock status
    pdfSaved = false;
    checkRevealUnlockState();
    
    // Reset final reveal smudge state
    finalRevealSmudgeSolved = false;
    const finalCanvas = document.getElementById('finalRevealSmudgeCanvas');
    if (finalCanvas) {
        finalCanvas.style.opacity = '1';
        finalCanvas.style.removeProperty('transition');
    }
    
    // Stop and remove flowing balloons
    stopFlowingBalloons();

    // Hide final blue balloon
    const finalBalloon = document.getElementById('finalBlueBalloon');
    if (finalBalloon) {
        finalBalloon.classList.add('hidden');
    }

    // Reset instruction text
    const instruction = document.getElementById('finalRevealInstruction');
    if (instruction) {
        instruction.textContent = 'Smudge the blurred picture below with your finger or mouse!';
        instruction.classList.remove('hidden');
    }
    
    // Clear styles
    document.getElementById('teamGirlCard').classList.remove('active');
    document.getElementById('teamBoyCard').classList.remove('active');
    document.getElementById('guessConfidence').value = 5;
    document.getElementById('confidenceValueDisplay').textContent = '5 / 10';
    document.getElementById('timingEarly').classList.remove('active');
    document.getElementById('timingOnTime').classList.add('active');
    document.getElementById('timingLate').classList.remove('active');

    // Deselect questions
    document.querySelectorAll('.option-card-btn').forEach(btn => {
        btn.classList.remove('selected-ashwin', 'selected-ratty', 'selected-thatha', 'selected-paati', 'selected-both');
    });

    initPuzzle();
    showSlide(0);
}

function checkRevealUnlockState() {
    const nextBtn = document.getElementById('revealNextBtn');
    if (!nextBtn) return;
    if (pdfSaved) {
        nextBtn.removeAttribute('disabled');
        nextBtn.classList.remove('disabled');
        nextBtn.textContent = 'Are you ready for the Reveal? ➔';
    } else {
        nextBtn.setAttribute('disabled', 'true');
        nextBtn.classList.add('disabled');
        nextBtn.textContent = 'Save PDFs to reveal actual gender ➔';
    }
}

// Overwrite first slide click handler to initialize audio
window.onclick = function() {
    initAudio();
}

// ==========================================================================
// 13. Final Reveal Smudge Logic (Slide 12)
// ==========================================================================
function initFinalRevealSmudge() {
    // Reset balloon states
    const finalBalloon = document.getElementById('finalBlueBalloon');
    if (finalBalloon) {
        finalBalloon.classList.add('hidden');
    }
    const instruction = document.getElementById('finalRevealInstruction');
    if (instruction) {
        instruction.textContent = 'Smudge the blurred picture below with your finger or mouse!';
        instruction.classList.remove('hidden');
    }

    // Start flowing balloons background before smudging
    startFlowingBalloons();

    finalRevealCanvas = document.getElementById('finalRevealSmudgeCanvas');
    if (!finalRevealCanvas) return;

    finalRevealCtx = finalRevealCanvas.getContext('2d');
    
    // Set internal size to match physical dimensions
    finalRevealCanvas.width = 320;
    finalRevealCanvas.height = 426;
    
    // Draw a blurred colored placeholder or watercolor mask on the canvas
    const img = new Image();
    img.src = 'assets/couple_reveal.png';
    img.onload = function() {
        // Blur filter to keep the final babies graphic hidden initially
        finalRevealCtx.filter = 'blur(15px) saturate(1.1)';
        finalRevealCtx.drawImage(img, 0, 0, 320, 426);
        finalRevealCtx.filter = 'none';
        
        // Translucent overlay
        finalRevealCtx.fillStyle = 'rgba(255, 255, 255, 0.75)';
        finalRevealCtx.fillRect(0, 0, 320, 426);
        
        // Instruction text
        finalRevealCtx.font = 'bold 20px Quicksand, Outfit, sans-serif';
        finalRevealCtx.fillStyle = '#2B2D42';
        finalRevealCtx.textAlign = 'center';
        finalRevealCtx.textBaseline = 'middle';
        finalRevealCtx.fillText('👋 Smudge to Reveal!', 160, 213);
    };
    
    img.onerror = function() {
        finalRevealCtx.fillStyle = '#E2E8F0';
        finalRevealCtx.fillRect(0, 0, 320, 426);
        finalRevealCtx.font = 'bold 20px Quicksand, Outfit, sans-serif';
        finalRevealCtx.fillStyle = '#2B2D42';
        finalRevealCtx.textAlign = 'center';
        finalRevealCtx.textBaseline = 'middle';
        finalRevealCtx.fillText('👋 Smudge to Reveal!', 160, 213);
    };
    
    // Bind mouse and touch events
    finalRevealCanvas.addEventListener('mousedown', startFinalReveal);
    finalRevealCanvas.addEventListener('mousemove', drawFinalReveal);
    finalRevealCanvas.addEventListener('mouseup', stopFinalReveal);
    finalRevealCanvas.addEventListener('mouseleave', stopFinalReveal);
    
    finalRevealCanvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        startFinalReveal(e.touches[0]);
    }, { passive: false });
    
    finalRevealCanvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        drawFinalReveal(e.touches[0]);
    }, { passive: false });
    
    finalRevealCanvas.addEventListener('touchend', (e) => {
        e.preventDefault();
        stopFinalReveal();
    }, { passive: false });
}

function getFinalRevealCoords(e) {
    const rect = finalRevealCanvas.getBoundingClientRect();
    return {
        x: (e.clientX - rect.left) * (finalRevealCanvas.width / rect.width),
        y: (e.clientY - rect.top) * (finalRevealCanvas.height / rect.height)
    };
}

function startFinalReveal(e) {
    if (finalRevealSmudgeSolved) return;
    isFinalRevealing = true;
    const coords = getFinalRevealCoords(e);
    
    finalRevealCtx.globalCompositeOperation = 'destination-out';
    finalRevealCtx.fillStyle = 'rgba(0,0,0,1)';
    finalRevealCtx.beginPath();
    finalRevealCtx.arc(coords.x, coords.y, 20, 0, Math.PI * 2);
    finalRevealCtx.fill();
}

function drawFinalReveal(e) {
    if (!isFinalRevealing || finalRevealSmudgeSolved) return;
    const coords = getFinalRevealCoords(e);
    
    finalRevealCtx.globalCompositeOperation = 'destination-out';
    finalRevealCtx.beginPath();
    finalRevealCtx.arc(coords.x, coords.y, 20, 0, Math.PI * 2);
    finalRevealCtx.fill();
    
    if (Math.random() < 0.15) {
        checkFinalRevealPercentage();
    }
}

function stopFinalReveal() {
    isFinalRevealing = false;
    checkFinalRevealPercentage();
}

function checkFinalRevealPercentage() {
    if (finalRevealSmudgeSolved) return;
    
    const imgData = finalRevealCtx.getImageData(0, 0, finalRevealCanvas.width, finalRevealCanvas.height);
    const pixels = imgData.data;
    let transparentCount = 0;
    
    const stride = 16;
    let checkedCount = 0;
    
    for (let i = 0; i < pixels.length; i += 4 * stride) {
        checkedCount++;
        if (pixels[i + 3] === 0) {
            transparentCount++;
        }
    }
    
    const percentage = transparentCount / checkedCount;
    if (percentage >= 0.50) {
        finalRevealSmudgeSolved = true;
        
        // Smoothly fade out canvas overlay
        finalRevealCanvas.style.transition = 'opacity 0.6s ease';
        finalRevealCanvas.style.opacity = '0';
        
        // Stop flowing balloons once smudging is complete
        stopFlowingBalloons();
        
        // Show the interactive blue balloon!
        const finalBalloon = document.getElementById('finalBlueBalloon');
        if (finalBalloon) {
            finalBalloon.classList.remove('hidden');
        }
        
        // Update instructions to pop!
        const instruction = document.getElementById('finalRevealInstruction');
        if (instruction) {
            instruction.innerHTML = '🎈 Now TAP the blue balloon to pop it! 💥';
        }
    }
}

// Final blue balloon popping logic
function popFinalBlueBalloon() {
    const finalBalloon = document.getElementById('finalBlueBalloon');
    if (!finalBalloon || finalBalloon.classList.contains('hidden')) return;

    // Pop sound and blue confetti
    playBalloonPopSound();
    initConfetti('blue');

    // Hide the blue balloon
    finalBalloon.classList.add('hidden');

    // Hide the instruction text to reveal couple reveal image cleanly
    const instruction = document.getElementById('finalRevealInstruction');
    if (instruction) {
        instruction.classList.add('hidden');
    }
}

// Flowing balloons background logic
function startFlowingBalloons() {
    // If container already exists, remove it first
    stopFlowingBalloons();

    flowingBalloonsContainer = document.createElement('div');
    flowingBalloonsContainer.className = 'flowing-balloons-container';
    document.body.appendChild(flowingBalloonsContainer);

    const colors = [
        '#FFB7C5', // soft pink
        '#AEC6CF', // soft blue
        '#FFFDF6', // soft cream
        '#F9D77E'  // pastel gold
    ];

    flowingBalloonsInterval = setInterval(() => {
        if (!flowingBalloonsContainer) return;

        const balloon = document.createElement('div');
        balloon.className = 'flowing-balloon';

        // Set random size (35px to 55px)
        const size = Math.floor(Math.random() * 20) + 35;
        balloon.style.width = size + 'px';
        balloon.style.height = (size * 1.3) + 'px';

        // Set random horizontal spawn position
        balloon.style.left = Math.random() * 100 + 'vw';

        // Set custom sway and rotation animations
        const swayX = (Math.random() * 80 - 40) + 'px';
        const swayRot = (Math.random() * 20 - 10) + 'deg';
        const duration = (Math.random() * 4 + 5) + 's'; // 5s to 9s
        const delay = Math.random() * 0.5 + 's';

        balloon.style.setProperty('--sway-x', swayX);
        balloon.style.setProperty('--sway-rot', swayRot);
        balloon.style.animationDuration = duration;
        balloon.style.animationDelay = delay;

        // Custom balloon skin color
        const skinColor = colors[Math.floor(Math.random() * colors.length)];
        const skinGrad = `radial-gradient(circle at 35% 30%, #FFFFFF -20%, ${skinColor} 70%, #000000 160%)`;

        const skin = document.createElement('div');
        skin.className = 'flowing-balloon-skin';
        skin.style.background = skinGrad;

        const knot = document.createElement('div');
        knot.className = 'flowing-balloon-knot';
        knot.style.background = skinColor;

        const string = document.createElement('div');
        string.className = 'flowing-balloon-string';

        balloon.appendChild(skin);
        balloon.appendChild(knot);
        balloon.appendChild(string);

        flowingBalloonsContainer.appendChild(balloon);

        // Auto remove element after animation completes
        setTimeout(() => {
            if (balloon.parentNode === flowingBalloonsContainer) {
                flowingBalloonsContainer.removeChild(balloon);
            }
        }, parseFloat(duration) * 1000 + 1000);

    }, 450); // spawn rate: every 450ms
}

function stopFlowingBalloons() {
    if (flowingBalloonsInterval) {
        clearInterval(flowingBalloonsInterval);
        flowingBalloonsInterval = null;
    }
    if (flowingBalloonsContainer) {
        const container = flowingBalloonsContainer;
        flowingBalloonsContainer = null;
        container.style.opacity = '0';
        setTimeout(() => {
            if (container.parentNode) {
                container.parentNode.removeChild(container);
            }
        }, 1000);
    }
}
