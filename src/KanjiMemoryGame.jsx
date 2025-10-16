import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Brain, Users, Shuffle, RotateCcw, Eye, Loader, CloudOff, Settings, X, ChevronDown, ChevronUp, BookOpen, Volume2, List, Grid, Info, Check, CornerDownRight } from 'lucide-react';

// --- API Configuration ---
const API_BASE_URL = 'https://kanjiapi.dev/v1';

// --- Kanji Set Configuration ---
const KANJI_SETS = {
  'Jōyō (Standard)': 'joyo',
  'Jinmeiyō (Names)': 'jinmeiyo',
  'Heisig (Keywords)': 'heisig',
  'Kyōiku (School)': 'kyouiku',
  'Grade 1': 'grade-1',
  'Grade 2': 'grade-2',
  'Grade 3': 'grade-3',
  'Grade 4': 'grade-4',
  'Grade 5': 'grade-5',
  'Grade 6': 'grade-6',
  'Jōyō (excluding Kyōiku)': 'grade-8',
  'JLPT N5': 'jlpt-5',
  'JLPT N4': 'jlpt-4',
  'JLPT N3': 'jlpt-3',
  'JLPT N2': 'jlpt-2',
  'JLPT N1': 'jlpt-1',
  'All Kanji (13k+)': 'all',
};

// Opponent Types for selection (Custom Bot removed)
const OpponentTypes = {
  PLAYER2: 'Player 2',
  RANDOMIZER: 'Randomizer',
  BOT_NOVICE: 'Bot (Level 1: Novice)',
  BOT_CASUAL: 'Bot (Level 2: Casual)',
  BOT_SHREWD: 'Bot (Level 3: Shrewd)',
  BOT_MASTER: 'Bot (Level 4: Master)',
  BOT_ELITE: 'Bot (Level 5: Elite)',
};

// --- Bot Configuration Defaults (Array of 12 numbers: indices 0-11) ---
// Anti-Combo Debuff (index 12) has been removed from all arrays.
const BOT_CONFIGS = {
  [OpponentTypes.RANDOMIZER]: [0, 0, 0, 100, 0, 0, 100, 0, 0, 100, 0, 0, 0],
  [OpponentTypes.BOT_NOVICE]: [0, 40, 40, 20, 10, 30, 60, 20, 10, 60, 4, 6, 0],
  [OpponentTypes.BOT_CASUAL]: [10, 20, 70, 10, 25, 75, 0, 35, 15, 30, 15, 5, 0],
  [OpponentTypes.BOT_SHREWD]: [50, 20, 80, 0, 30, 60, 10, 40, 0, 0, 40, 20, 0],
  [OpponentTypes.BOT_MASTER]: [70, 15, 75, 10, 5, 75, 70, 70, 20, 0, 0, 10, 0],
  [OpponentTypes.BOT_ELITE]: [90, 5, 95, 0, 4, 95, 1, 80, 15, 1, 2, 2, 0],
};

// --- Helper to select an option based on weighted probabilities ---
const selectWeightedOption = (options) => {
    const totalWeight = options.reduce((sum, option) => sum + option.weight, 0);
    if (totalWeight <= 0) {
        return options[0]?.action || null;
    }

    let random = Math.random() * totalWeight;
    for (const option of options) {
        if (random < option.weight) {
            return option.action;
        }
        random -= option.weight;
    }
    return options[options.length - 1]?.action || null; 
};


// --- Main Component ---
export default function KanjiMemoryGame() {
  // --- API State ---
  const [kanjiSetEndpoint, setKanjiSetEndpoint] = useState('joyo'); 
  const [kanjiCharacters, setKanjiCharacters] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // --- Game State ---
  const [gridSize, setGridSize] = useState(6); 
  const [cards, setCards] = useState([]);
  const [flippedIndices, setFlippedIndices] = useState([]);
  // FIX: Syntax error on this line. Changed `new Set())` to `new Set()`
  const [matchedPairs, setMatchedPairs] = useState(new Set()); 
  const [matchOwners, setMatchOwners] = useState({}); 
  const [currentPlayer, setCurrentPlayer] = useState(1);
  const [scores, setScores] = useState({ player1: 0, player2: 0 });
  const [opponentType, setOpponentType] = useState(OpponentTypes.BOT_CASUAL); 
  const [gameStarted, setGameStarted] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isModalLoading, setIsModalLoading] = useState(false); // NEW: For pre-modal word fetching
  const [previousKanjiData, setPreviousKanjiData] = useState(null); 
  const [reuseKanji, setReuseKanji] = useState(false);
  
  // --- Bot/Customization State ---
  const [botMemory, setBotMemory] = useState({});
  
  // --- Modal State (Settings & Kanji Details) ---
  const [showVisualSettingsModal, setShowVisualSettingsModal] = useState(false);
  const [showContentSettingsModal, setShowContentSettingsModal] = useState(false); 
  const [showKanjiModal, setShowKanjiModal] = useState(false);
  const [modalKanjiData, setModalKanjiData] = useState(null);

  // --- Visual Settings State ---
  const [flipDuration, setFlipDuration] = useState(1500); 
  const [cardContentScale, setCardContentScale] = useState(1.0); 
  const [showDebugMemory, setShowDebugMemory] = useState(false); 
  const [cardBaseWidth, setCardBaseWidth] = useState(100); 

  // --- Content Visibility State ---
  const [contentVisibility, setContentVisibility] = useState({
    meaning: true,
    romaji: false, // Master toggle for On/Kun readings
    on: false,
    kun: false,
    strokeCount: false,
  });

  const currentBotConfig = useMemo(() => {
    return BOT_CONFIGS[opponentType] || BOT_CONFIGS[OpponentTypes.RANDOMIZER];
  }, [opponentType]);

  const isGameOver = useMemo(() => {
    return matchedPairs.size === cards.length / 2 && cards.length > 0;
  }, [matchedPairs, cards.length]);

  // --- API Fetching: Fetch list of Kanji based on selection ---
  const fetchKanjiList = useCallback(async (endpoint) => {
    if (gameStarted) return; 
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/kanji/${endpoint}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (data.length === 0) {
         throw new Error('API returned an empty list of kanji for this set.');
      }
      setKanjiCharacters(data);
    } catch (e) {
      console.error("Failed to fetch kanji list:", e);
      setError(`Failed to load Kanji data from API (Set: ${endpoint}). Error: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [gameStarted]);

  // --- Effect to trigger fetch when kanjiSetEndpoint changes or on mount ---
  useEffect(() => {
    fetchKanjiList(kanjiSetEndpoint);
  }, [kanjiSetEndpoint, fetchKanjiList]);
  
  // --- Dictionary Word Data Fetcher and Cacher (NEW FUNCTION) ---
  const fetchAndCacheWordData = useCallback(async (kanjiData) => {
    // If wordData is already present (cached), return immediately.
    if (kanjiData.wordData !== null) {
        return kanjiData; 
    }

    try {
        const response = await fetch(`${API_BASE_URL}/words/${kanjiData.kanji}`);
        let responseData = [];

        if (response.status === 404) {
            responseData = []; // No words found
        } else if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        } else {
            responseData = await response.json();
        }

        // Cache the result in the main cards state
        setCards(prevCards => prevCards.map(c => 
            c.kanji === kanjiData.kanji ? { ...c, wordData: responseData } : c
        ));
        
        return { ...kanjiData, wordData: responseData };

    } catch (e) {
        console.error("Failed to fetch word data:", e);
        // On error, cache an empty array to prevent re-fetching endlessly
        setCards(prevCards => prevCards.map(c => 
            c.kanji === kanjiData.kanji ? { ...c, wordData: [] } : c
        ));
        // We will still pass the data through to open the modal, it will just show 'no words'.
        return { ...kanjiData, wordData: [] };
    }
  }, []);


  // --- Game Initialization ---
  const initializeGame = useCallback(async () => {
    if (kanjiCharacters.length === 0) {
      const setName = Object.keys(KANJI_SETS).find(key => KANJI_SETS[key] === kanjiSetEndpoint) || 'Selected';
      setError(`Cannot start game: ${setName} set is empty or failed to load.`);
      return;
    }

    const totalCards = gridSize * gridSize;
    const pairsNeeded = totalCards / 2;

    if (pairsNeeded > kanjiCharacters.length) {
      setError(`Cannot create a ${gridSize}x${gridSize} grid. Need ${pairsNeeded} unique Kanji, but the available library only has ${kanjiCharacters.length}. Please choose a smaller grid or a larger kanji set.`);
      return;
    }

    setIsProcessing(true);
    let selectedKanjiDetails;

    if (reuseKanji && previousKanjiData && previousKanjiData.length >= pairsNeeded) {
      selectedKanjiDetails = previousKanjiData.slice(0, pairsNeeded);
    } else {
      const shuffledKanjiList = [...kanjiCharacters].sort(() => Math.random() - 0.5);
      const selectedKanjiStrings = shuffledKanjiList.slice(0, pairsNeeded);

      try {
        // Fetch details for the selected characters
        const detailPromises = selectedKanjiStrings.map(kanji =>
          fetch(`${API_BASE_URL}/kanji/${kanji}`)
            .then(res => {
              if (!res.ok) throw new Error(`Failed to fetch details for ${kanji}`);
              return res.json();
            })
        );
        const apiResponses = await Promise.all(detailPromises);
        
        // Extract all required details (including new fields for modal)
        selectedKanjiDetails = apiResponses.map((res, index) => ({
          kanji: res.kanji,
          meaning: res.meanings.join(', ') || '—',
          kun: res.kun_readings.join(', ') || '—',
          on: res.on_readings.join(', ') || '—',
          name_readings: res.name_readings.join(', ') || '—',
          stroke_count: res.stroke_count,
          grade: res.grade,
          jlpt: res.jlpt,
          heisig_en: res.heisig_en || '—',
          freq_mainichi_shinbun: res.freq_mainichi_shinbun,
          unicode: res.unicode,
          unihan_cjk_compatibility_variant: res.unihan_cjk_compatibility_variant,
          notes: res.notes || [],
          wordData: null, // Placeholder for dictionary data - MUST be null initially
        }));
        setPreviousKanjiData(selectedKanjiDetails);
      } catch (e) {
        console.error("Failed to fetch detailed kanji data:", e);
        setError(`Failed to fetch detailed kanji data: ${e.message}.`);
        setIsProcessing(false);
        return;
      }
    }

    const cardPairs = selectedKanjiDetails.flatMap((k, idx) => [
      { id: idx * 2, kanjiId: idx, ...k },
      { id: idx * 2 + 1, kanjiId: idx, ...k }
    ]);

    const shuffled = cardPairs.sort(() => Math.random() - 0.5);

    setCards(shuffled);
    setFlippedIndices([]);
    setMatchedPairs(new Set()); 
    setMatchOwners({}); 
    setCurrentPlayer(1);
    setScores({ player1: 0, player2: 0 });
    setGameStarted(true);
    setBotMemory({});
    setReuseKanji(false);
    setIsProcessing(false);
    setShowVisualSettingsModal(false); 
    setShowContentSettingsModal(false); 
  }, [gridSize, reuseKanji, previousKanjiData, kanjiCharacters, kanjiSetEndpoint]);

  // --- User Turn Logic ---
  const handleCardClick = async (index) => { // Make async
    if (isProcessing || isModalLoading) { // Check for modal loading state
      return;
    }
    
    const card = cards[index]; // Get the card here for easier reference
    
    // Safety check for empty card object (shouldn't happen, but good practice)
    if (!card) return; 

    const isRevealed = flippedIndices.includes(index) || matchedPairs.has(card.kanjiId);
    
    // Pop-up modal if a scored card is clicked and no match is in progress
    if (matchedPairs.has(card.kanjiId) && flippedIndices.length === 0) {
        setIsModalLoading(true); // Start loading state

        try {
            // Fetch and cache data before opening the modal
            const updatedKanjiData = await fetchAndCacheWordData(card); 
            
            setModalKanjiData(updatedKanjiData);
            setShowKanjiModal(true);
        } catch (e) {
            // Error logged in fetchAndCacheWordData, we allow the modal to open 
            // even on error, it will just show cached 'no words' or empty array.
        } finally {
            setIsModalLoading(false); // End loading state
        }
        return;
    }
    
    // Only allow flip if it's not matched and not already flipped
    if (flippedIndices.includes(index) || matchedPairs.has(card.kanjiId)) {
      return;
    }

    if (currentPlayer === 2 && opponentType !== OpponentTypes.PLAYER2) {
      return;
    }

    if (flippedIndices.length < 2) {
      setFlippedIndices(prev => [...prev, index]);

      // Bot memory update on first user flip
      if (flippedIndices.length === 0 && opponentType !== OpponentTypes.PLAYER2) {
        setBotMemory(prev => ({
          ...prev,
          [index]: cards[index].kanjiId
        }));
      }
    }
  };

  const isCardFlipped = (index) => {
    return flippedIndices.includes(index) || matchedPairs.has(cards[index]?.kanjiId);
  };

  // --- Match/Turn Resolution Effect (Updated to use flipDuration) ---
  useEffect(() => {
    if (flippedIndices.length === 2) {
      setIsProcessing(true);
      const [idx1, idx2] = flippedIndices;
      const card1 = cards[idx1];
      const card2 = cards[idx2];
      
      // Safety check in case cards are undefined (shouldn't happen if game is initialized correctly)
      if (!card1 || !card2) {
        setFlippedIndices([]);
        setIsProcessing(false);
        return;
      }
      
      // Wait for 1 second so the user/bot can see both cards before processing the result
      setTimeout(() => {
        if (card1.kanjiId === card2.kanjiId) {
          // Match found
          setMatchedPairs(prev => new Set([...prev, card1.kanjiId]));
          setMatchOwners(prev => ({
              ...prev,
              [card1.kanjiId]: currentPlayer
          }));
          setScores(prev => ({
            ...prev,
            [`player${currentPlayer}`]: prev[`player${currentPlayer}`] + 1
          }));
          setFlippedIndices([]);
          setIsProcessing(false); // Ready for next turn (same player)
          
        } else {
          // Mismatch found, wait for flipDuration before cleanup
          setTimeout(() => {
            setFlippedIndices([]);
            setCurrentPlayer(currentPlayer === 1 ? 2 : 1);
            setIsProcessing(false); // Released after the cards flip back
            
          }, flipDuration); 

          // Bot memory update on second flip of mismatch
          if (opponentType !== OpponentTypes.PLAYER2) {
            setBotMemory(prev => ({
              ...prev,
              [idx2]: cards[idx2].kanjiId
            }));
          }
        }
      }, 1000); // Initial visibility delay
    }
  }, [flippedIndices, cards, currentPlayer, opponentType, flipDuration]);


  // --- Bot Logic Helper Functions (Unchanged) ---
  const getUnmatchedCards = useCallback(() => {
    return cards
      .map((c, idx) => ({ card: c, idx }))
      .filter(({ card, idx }) => !matchedPairs.has(card.kanjiId) && !flippedIndices.includes(idx));
  }, [cards, matchedPairs, flippedIndices]);

  const getRandomUnmatchedIndex = useCallback(() => {
    const unmatched = getUnmatchedCards();
    return unmatched[Math.floor(Math.random() * unmatched.length)]?.idx;
  }, [getUnmatchedCards]);

  const getRandomNewCard = useCallback(() => {
    const unknown = getUnmatchedCards().filter(({ idx }) => !botMemory[idx]);
    return unknown[Math.floor(Math.random() * unknown.length)]?.idx;
  }, [getUnmatchedCards, botMemory]);

  const getRandomKnownCard = useCallback(() => {
    const known = getUnmatchedCards().filter(({ idx }) => botMemory[idx]);
    return known[Math.floor(Math.random() * known.length)]?.idx;
  }, [getUnmatchedCards, botMemory]);

  const getKnownPairIndices = useCallback(() => {
    const known = Object.keys(botMemory).map(k => parseInt(k));
    for (let idx1 of known) {
      if (matchedPairs.has(cards[idx1]?.kanjiId)) continue; 

      const kanjiId = cards[idx1]?.kanjiId;
      if (kanjiId === undefined) continue;

      const pairIdx = cards.findIndex((c, i) =>
        c.kanjiId === kanjiId && 
        i !== idx1 && 
        botMemory[i] === kanjiId && 
        !matchedPairs.has(c.kanjiId) &&
        !flippedIndices.includes(i) 
      );

      if (pairIdx !== -1) return [idx1, pairIdx];
    }
    return null; 
  }, [botMemory, cards, matchedPairs, flippedIndices]);


  // --- Bot Turn Execution ---
  const performOpponentTurn = useCallback(() => {
    setIsProcessing(true); // Ensure processing stays true throughout
    const config = currentBotConfig;
    let firstCard = null;
    let secondCard = null;

    // --- 1. Strategy for First Card ---
    const knownPair = getKnownPairIndices();
    const shouldGoForKnownPair = knownPair !== null && (Math.random() * 100 < config[0]);

    if (shouldGoForKnownPair) {
      firstCard = knownPair[0];
    } else {
      const options = [
        { weight: config[1], action: 'known' }, 
        { weight: config[2], action: 'new' },   
        { weight: config[3], action: 'random' }, 
      ];
      const action = selectWeightedOption(options);

      if (action === 'known') {
        firstCard = getRandomKnownCard() ?? getRandomUnmatchedIndex();
      } else if (action === 'new') {
        firstCard = getRandomNewCard() ?? getRandomUnmatchedIndex();
      } else { 
        firstCard = getRandomUnmatchedIndex();
      }
    }

    if (firstCard === null) {
      setIsProcessing(false);
      return;
    }

    // Flip the first card and update immediate memory
    setFlippedIndices([firstCard]);
    setBotMemory(prev => ({ ...prev, [firstCard]: cards[firstCard].kanjiId }));

    // Delay before picking the second card (Bot "thinking" time)
    setTimeout(() => {
      const firstKanjiId = cards[firstCard].kanjiId;
      const matchIdx = cards.findIndex((c, i) =>
        c.kanjiId === firstKanjiId && i !== firstCard && botMemory[i] === firstKanjiId && !matchedPairs.has(c.kanjiId)
      );

      const isMatchKnown = matchIdx !== -1;
      let secondCardAction;
      let options;

      if (isMatchKnown) {
        
        options = [
          { weight: config[7], action: 'match' },         
          { weight: config[8], action: 'random_close' }, 
          { weight: config[9], action: 'random' },        
          { weight: config[10], action: 'new' },          
          { weight: config[11], action: 'known' },         
        ];
        
        secondCardAction = selectWeightedOption(options);
        
      } else {
        options = [
          { weight: config[4], action: 'known' },  
          { weight: config[5], action: 'new' },    
          { weight: config[6], action: 'random' }, 
        ];
        secondCardAction = selectWeightedOption(options);
      }

      // 3. Resolve the selected action to an actual card index
      if (secondCardAction === 'match') {
        secondCard = matchIdx; 
      } else if (secondCardAction === 'random_close' || secondCardAction === 'random') {
        secondCard = getRandomUnmatchedIndex();
      } else if (secondCardAction === 'known') {
        secondCard = getRandomKnownCard() ?? getRandomUnmatchedIndex();
      } else if (secondCardAction === 'new') {
        secondCard = getRandomNewCard() ?? getRandomUnmatchedIndex();
      }

      // Final Safety Check
      const availableUnmatched = getUnmatchedCards().map(c => c.idx).filter(idx => idx !== firstCard);
      
      if (secondCard === null || secondCard === firstCard || !availableUnmatched.includes(secondCard)) {
        secondCard = availableUnmatched[Math.floor(Math.random() * availableUnmatched.length)] ?? getRandomUnmatchedIndex();
      }
      
      // Flip the second card (This immediately triggers the match resolution useEffect)
      setFlippedIndices([firstCard, secondCard]);
      // isProcessing remains true, the match resolution useEffect will release it.

    }, 1000); // Bot's "thinking" delay
  }, [currentBotConfig, cards, getKnownPairIndices, getRandomNewCard, getRandomKnownCard, getRandomUnmatchedIndex, botMemory, matchedPairs]);


  // --- Bot Turn Trigger Effect ---
  useEffect(() => {
    const isBotTurn = currentPlayer === 2 && opponentType !== OpponentTypes.PLAYER2;
    if (isBotTurn && gameStarted && !isProcessing && !isGameOver) {
      const turnDelay = 500; // Shorter delay before the bot's *first* move
      const timer = setTimeout(() => {
        performOpponentTurn();
      }, turnDelay);
      return () => clearTimeout(timer);
    }
  }, [currentPlayer, gameStarted, isProcessing, isGameOver, opponentType, performOpponentTurn]);

  // --- Modal Components ---

  const ContentSettingsModal = ({ onClose }) => {
    const settingsMap = {
      meaning: { label: 'Meaning', key: 'meaning' },
      romaji: { label: 'Romaji Readings (On & Kun)', key: 'romaji' }, // Master Toggle
      on: { label: 'On-Yomi (Individual)', key: 'on' },
      kun: { label: 'Kun-Yomi (Individual)', key: 'kun' },
      strokeCount: { label: 'Stroke Count', key: 'strokeCount' },
    };

    const toggleSetting = (key) => {
      setContentVisibility(prev => {
          const newState = { ...prev };
          const newValue = !prev[key];
          newState[key] = newValue;

          if (key === 'romaji') {
              // Master toggle: set both individual readings to the new romaji state
              newState.on = newValue;
              newState.kun = newValue;
          } else if (key === 'on' || key === 'kun') {
              // If an individual reading is toggled, ensure 'romaji' master toggle is unchecked if both become false
              if (prev.romaji) {
                  newState.romaji = false;
              }
          }
          return newState;
      });
    };

    return (
        <SettingsModalWrapper title="Card Content Settings" onClose={onClose}>
            <p className="text-gray-600 mb-6">
                Use these buttons to define what auxiliary information is displayed on the face of a **matched (scored) card**.
            </p>
            <div className="grid grid-cols-2 gap-4">
                {Object.values(settingsMap).map(({ label, key }) => {
                    // Simpler isActive determination: use the stored value
                    const isActive = contentVisibility[key];

                    return (
                        <button
                            key={key}
                            onClick={() => toggleSetting(key)}
                            className={`
                                p-3 rounded-lg font-bold text-sm transition-colors duration-200 shadow-md flex items-center justify-center gap-2
                                ${isActive 
                                    ? 'bg-purple-600 text-white hover:bg-purple-700' 
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }
                            `}
                        >
                            {isActive ? <Check size={18}/> : <X size={18}/>}
                            {label}
                        </button>
                    );
                })}
            </div>
            <p className="text-xs text-gray-500 mt-4 text-center">
                The full Kanji Details (including Name Readings, Heisig, and Word Lists) are always available by clicking on any matched card.
            </p>
        </SettingsModalWrapper>
    );
  };

  const VisualSettingsModal = ({ isBot, onClose }) => (
    <SettingsModalWrapper title="Visual & Timing Settings" onClose={onClose}>
      <h3 className="text-lg font-bold mb-3 text-indigo-700 flex items-center gap-2">
        <Grid size={20} /> Card & Board Sizing
      </h3>

      {/* Card Base Width */}
      <div className="mb-4 bg-indigo-50 p-3 rounded-lg">
        <label className="block text-sm font-medium mb-1 text-gray-700">
          Card Base Width: **{cardBaseWidth}px**
        </label>
        <input
          type="range"
          min="80"
          max="150"
          step="10"
          value={cardBaseWidth}
          onChange={(e) => setCardBaseWidth(parseInt(e.target.value))}
          className="w-full h-2 bg-indigo-200 rounded-lg appearance-none cursor-pointer range-sm"
        />
        <p className="text-xs text-gray-500 mt-1">Adjusts the minimum size of each card in the grid.</p>
      </div>

      {/* Card Content Scale */}
      <div className="mb-6 bg-indigo-50 p-3 rounded-lg">
        <label className="block text-sm font-medium mb-1 text-gray-700">
          Card Content Scale: **{cardContentScale.toFixed(1)}x**
        </label>
        <input
          type="range"
          min="0.5"
          max="1.5"
          step="0.1"
          value={cardContentScale}
          onChange={(e) => setCardContentScale(parseFloat(e.target.value))}
          className="w-full h-2 bg-indigo-200 rounded-lg appearance-none cursor-pointer range-sm"
        />
        <p className="text-xs text-gray-500 mt-1">Adjusts the size of the Kanji and text inside the card.</p>
      </div>
      
      <h3 className="text-lg font-bold mb-3 text-indigo-700 flex items-center gap-2">
        <Info size={20} /> Timing & Debug
      </h3>

      {/* Flip Duration */}
      <div className="mb-4 bg-indigo-50 p-3 rounded-lg">
        <label className="block text-sm font-medium mb-1 text-gray-700">
          Wrong Match Display Duration: **{(flipDuration / 1000).toFixed(1)}s**
        </label>
        <input
          type="range"
          min="500"
          max="3000"
          step="100"
          value={flipDuration}
          onChange={(e) => setFlipDuration(parseInt(e.target.value))}
          className="w-full h-2 bg-indigo-200 rounded-lg appearance-none cursor-pointer range-sm"
        />
        <p className="text-xs text-gray-500 mt-1">How long mismatched cards stay flipped before closing.</p>
      </div>

      {/* Bot Debug Toggle (Only show if opponent is a bot) */}
      {isBot && (
        <div className="pt-2 bg-yellow-50 p-3 rounded-lg border border-yellow-200">
            <label className="flex items-center gap-2 cursor-pointer text-gray-700">
                <input
                    type="checkbox"
                    checked={showDebugMemory}
                    onChange={(e) => setShowDebugMemory(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 bg-gray-100 border-gray-300 rounded focus:ring-indigo-500"
                />
                <span className="text-sm font-medium">Show Bot Memory (Debug Mode)</span>
            </label>
            <p className="text-xs text-gray-500 mt-1 pl-6">Reveals the cards the bot has memorized during its turn.</p>
        </div>
      )}
    </SettingsModalWrapper>
  );

  const SettingsModalWrapper = ({ title, children, onClose }) => (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 transition-opacity duration-300">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 transform scale-100 animate-in fade-in zoom-in-50 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4 border-b pb-3">
                <h2 className="text-2xl font-extrabold text-gray-800 flex items-center gap-2">
                    <Settings size={24} className="text-purple-600"/> {title}
                </h2>
                <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 transition text-gray-500">
                    <X size={24} />
                </button>
            </div>
            {children}
        </div>
    </div>
  );

  // --- Card Component (Updated to fix Romaji rendering logic) ---
  const Card = ({ card, index }) => {
    const flipped = isCardFlipped(index);
    const matched = matchedPairs.has(card.kanjiId);
    const isBotKnown = botMemory[index] !== undefined && opponentType !== OpponentTypes.PLAYER2;
    const owner = matchOwners[card.kanjiId];

    // Card Content Scaling
    const kanjiFontSize = `${4 * cardContentScale}rem`;
    const auxFontSize = `${0.6 * cardContentScale}rem`; 

    // Updated match colors: Green for Player 1, Red for Player 2/Bot
    const matchedClasses = owner === 1
        ? 'ring-4 ring-green-500 bg-green-50 opacity-100' // Player 1 (Green)
        : owner === 2
            ? 'ring-4 ring-red-500 bg-red-50 opacity-100' // Player 2/Bot (Red)
            : 'ring-4 ring-gray-300 opacity-90'; // Safety fallback

    // Content lines to display based on visibility settings
    const contentLines = [];
    if (contentVisibility.meaning) {
        contentLines.push(<div key="meaning" className="text-gray-700 font-semibold leading-tight">{card.meaning}</div>);
    }
    
    // FIX: Only check the individual 'on' and 'kun' states for rendering
    if (contentVisibility.on) {
        contentLines.push(<div key="on" className="text-gray-500 leading-tight">On: {card.on}</div>);
    }
    if (contentVisibility.kun) {
        contentLines.push(<div key="kun" className="text-gray-500 leading-tight">Kun: {card.kun}</div>);
    }
    
    if (contentVisibility.strokeCount) {
         contentLines.push(<div key="strokes" className="text-gray-500 leading-tight">Strokes: {card.stroke_count}</div>);
    }

    return (
      <div
        onClick={() => handleCardClick(index)}
        // Added minWidth/minHeight to respect the cardBaseWidth setting
        style={{ minWidth: `${cardBaseWidth}px`, minHeight: `${cardBaseWidth}px` }}
        className={`
          relative aspect-square rounded-xl shadow-lg transform transition-all duration-300 ease-in-out
          ${flipped || matched
            ? 'bg-white shadow-2xl scale-100 cursor-pointer' // Allow clicking revealed cards for modal
            : 'bg-gradient-to-br from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 cursor-pointer hover:scale-[1.03]'
          }
          ${matched ? matchedClasses : 'opacity-100'}
        `}
      >
        <div className={`flex items-center justify-center h-full w-full p-1 absolute inset-0 backface-hidden ${flipped || matched ? 'opacity-100' : 'opacity-0'}`}>
          {flipped || matched ? (
            <div className="text-center transition-all duration-300 text-gray-900">
              <div 
                style={{ fontSize: kanjiFontSize }}
                className="font-bold leading-none transition-transform duration-300"
              >
                {card.kanji}
              </div>
              {/* Auxiliary content is now conditionally rendered */}
              {matched && contentLines.length > 0 && (
                <div style={{ fontSize: auxFontSize }} className="mt-1 hidden sm:block">
                    {contentLines.map(line => line)}
                </div>
              )}
            </div>
          ) : (
            <div className="text-white text-3xl font-bold select-none">?</div>
          )}
        </div>
        {showDebugMemory && isBotKnown && !matched && !flipped && (
          <div className="absolute top-1 right-1 bg-yellow-400 text-yellow-900 text-[10px] px-2 py-0.5 rounded-full font-semibold z-10">
            MEM
          </div>
        )}
      </div>
    );
  };

  // --- Kanji Detail Modal Component (EXTENDED) ---
  const KanjiDetailModal = ({ data, onClose }) => {
    // Data is guaranteed to be present and wordData will be cached ([] for 404/error/fetch error)
    const words = data.wordData || []; 
    const [visibleWordCount, setVisibleWordCount] = useState(10); 

    const handleLoadMore = () => {
        setVisibleWordCount(prev => prev + 10);
    };

    if (!data) return null;

    const gradeLabel = data.grade ? `Grade ${data.grade}` : 'N/A';
    const jlptLabel = data.jlpt ? `N${data.jlpt}` : 'N/A';
    const freqLabel = data.freq_mainichi_shinbun ? `#${data.freq_mainichi_shinbun}` : 'N/A';

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 transition-opacity duration-300">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl p-6 transform scale-100 animate-in fade-in zoom-in-50 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-start mb-4 border-b pb-3">
                    <h2 className="text-2xl font-extrabold text-gray-800 flex items-center gap-2">
                        <BookOpen size={24} className="text-indigo-600"/> Kanji Details: {data.kanji}
                    </h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 transition text-gray-500">
                        <X size={24} />
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Column 1: Core Readings & Meanings */}
                    <div className="md:col-span-2">
                        <div className="text-center mb-6 border-b pb-4">
                            <p className="text-[6rem] sm:text-[8rem] font-black text-indigo-700 leading-none">{data.kanji}</p>
                            <p className="text-2xl font-bold text-gray-700 mt-2">{data.meaning}</p>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <h3 className="text-lg font-bold text-gray-700 mb-1">On-yomi (音)</h3>
                                <p className="text-gray-900 ml-3 p-2 bg-purple-50 rounded-lg text-sm">{data.on}</p>
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-700 mb-1">Kun-yomi (訓)</h3>
                                <p className="text-gray-900 ml-3 p-2 bg-purple-50 rounded-lg text-sm">{data.kun}</p>
                            </div>
                        </div>

                        {data.name_readings !== '—' && (
                            <div className="mt-4">
                                <h3 className="text-lg font-bold text-gray-700 mb-1">Name Readings (名乗り)</h3>
                                <p className="text-gray-900 ml-3 p-2 bg-purple-50 rounded-lg text-sm">{data.name_readings}</p>
                            </div>
                        )}
                        
                        {data.notes.length > 0 && (
                            <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                                <h3 className="text-lg font-bold text-yellow-700 flex items-center gap-2 mb-1">
                                    <Info size={18} /> Notes
                                </h3>
                                <ul className="list-disc list-inside text-gray-800 text-sm ml-3">
                                    {data.notes.map((note, i) => <li key={i}>{note}</li>)}
                                </ul>
                            </div>
                        )}
                    </div>

                    {/* Column 2: Metadata and Heisig */}
                    <div className="md:col-span-1 border-l pl-6 border-gray-100">
                        <h3 className="text-xl font-bold text-gray-700 mb-3">Classification</h3>
                        <div className="space-y-3">
                            <MetadataItem label="Stroke Count" value={data.stroke_count} />
                            <MetadataItem label="School Grade" value={gradeLabel} />
                            <MetadataItem label="JLPT Level" value={jlptLabel} />
                            <MetadataItem label="Frequency Rank" value={freqLabel} help="Ranked out of 2,501 most-used characters." />
                            <MetadataItem label="Heisig Keyword" value={data.heisig_en} />
                            <MetadataItem label="Unicode" value={`U+${data.unicode}`} />
                            {data.unihan_cjk_compatibility_variant && (
                                <MetadataItem label="Variant" value={data.unihan_cjk_compatibility_variant} help="CJK Compatibility Variant" />
                            )}
                        </div>
                    </div>
                </div>

                {/* Dictionary Words Section */}
                <div className="mt-6 pt-6 border-t border-gray-200">
                    <h2 className="text-2xl font-extrabold text-gray-800 flex items-center gap-2 mb-4">
                        <List size={24} className="text-indigo-600"/> Associated Words
                    </h2>
                    
                    {words.length > 0 ? (
                        <>
                            <div className="space-y-4 max-h-80 overflow-y-auto pr-2">
                                {/* Use visibleWordCount for slicing */}
                                {words.slice(0, visibleWordCount).map((word, index) => (
                                    <div key={index} className="p-4 border border-gray-200 rounded-lg bg-gray-50 shadow-sm">
                                        {word.variants.map((variant, vIndex) => (
                                            <div key={vIndex} className="flex items-baseline mb-2">
                                                <span className="text-xl font-bold text-gray-900 mr-3">{variant.written}</span>
                                                <span className="text-lg text-indigo-600">({variant.pronounced})</span>
                                            </div>
                                        ))}
                                        <ul className="list-none space-y-1 ml-4 text-sm text-gray-700">
                                            {word.meanings.map((meaning, mIndex) => (
                                                <li key={mIndex} className="flex items-start">
                                                    <CornerDownRight size={16} className="text-gray-400 mr-2 flex-shrink-0 mt-1"/>
                                                    {meaning.glosses.join('; ')}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ))}
                            </div>
                            
                            {/* Load More Button */}
                            {words.length > visibleWordCount && (
                                <div className="text-center mt-4">
                                    <button
                                        onClick={handleLoadMore}
                                        className="bg-purple-100 text-purple-700 py-2 px-4 rounded-full font-bold hover:bg-purple-200 transition text-sm flex items-center justify-center gap-2 mx-auto"
                                    >
                                        <ChevronDown size={18} /> Load Next 10 Words ({visibleWordCount} of {words.length} shown)
                                    </button>
                                </div>
                            )}
                            
                            {/* "All words shown" message */}
                            {words.length <= visibleWordCount && (
                                <p className="text-sm text-center text-gray-500 mt-4">
                                    All {words.length} associated words are shown.
                                </p>
                            )}
                        </>
                    ) : (
                        <p className="p-4 bg-yellow-50 rounded-lg text-gray-700">
                            No common dictionary entries found for this kanji.
                        </p>
                    )}
                </div>

                <button
                    onClick={onClose}
                    className="w-full mt-6 bg-indigo-600 text-white py-3 rounded-full font-bold hover:bg-indigo-700 transition shadow-md"
                >
                    Close Kanji Details
                </button>
            </div>
        </div>
    );
  };

  // Simple component for modal metadata
  const MetadataItem = ({ label, value, help = '' }) => (
    <div className="flex justify-between items-center p-2 bg-gray-50 rounded-lg">
        <div>
            <p className="text-sm font-semibold text-gray-500">{label}</p>
            {help && <p className="text-[10px] text-gray-400">{help}</p>}
        </div>
        <p className="text-lg font-extrabold text-gray-800">{value}</p>
    </div>
  );


  const currentOpponentName = opponentType === OpponentTypes.PLAYER2 ? 'Player 2' : opponentType.split(': ')[1] || opponentType;

  // Find the user-friendly name of the current kanji set for display
  const currentKanjiSetName = useMemo(() => {
    return Object.keys(KANJI_SETS).find(key => KANJI_SETS[key] === kanjiSetEndpoint) || kanjiSetEndpoint;
  }, [kanjiSetEndpoint]);
  
  // Calculate grid maximum width based on settings (assuming 12px gap for gap-3)
  const totalGridWidth = gridSize * cardBaseWidth + (gridSize - 1) * 12; 


  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="flex items-center space-x-3 text-lg font-semibold text-indigo-600">
          <Loader size={24} className="animate-spin" />
          <span>Loading **{currentKanjiSetName}** Kanji Set...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl shadow-lg max-w-lg">
          <div className="flex items-center gap-3">
            <CloudOff size={24} />
            <span className="font-bold">Error Loading Game Data</span>
          </div>
          <p className="mt-2 text-sm">{error}</p>
          <button
             onClick={() => { setError(null); fetchKanjiList(kanjiSetEndpoint); }}
             className="mt-4 bg-red-600 text-white px-4 py-2 rounded-full text-sm hover:bg-red-700 transition"
           >
             Try Reloading Set
           </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans p-2 sm:p-4 md:p-6 flex flex-col">
      <div className="max-w-6xl mx-auto w-full flex-grow flex flex-col">
        
        {/* --- Modals --- */}
        {showKanjiModal && <KanjiDetailModal data={modalKanjiData} onClose={() => setShowKanjiModal(false)} />}
        {showContentSettingsModal && <ContentSettingsModal onClose={() => setShowContentSettingsModal(false)} />}
        {showVisualSettingsModal && (
            <VisualSettingsModal 
                isBot={opponentType !== OpponentTypes.PLAYER2 && opponentType !== OpponentTypes.RANDOMIZER}
                onClose={() => setShowVisualSettingsModal(false)}
            />
        )}
        
        {/* --- MODAL PRE-LOADER (NEW) --- */}
        {isModalLoading && (
            <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-40">
                <div className="flex items-center space-x-3 text-lg font-semibold text-white bg-indigo-600 p-4 rounded-full shadow-xl">
                    <Loader size={24} className="animate-spin" />
                    <span>Loading Kanji Dictionary Data...</span>
                </div>
            </div>
        )}

        {/* --- Header --- */}
        <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-2">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-800">
            <span className="text-indigo-600">漢字</span> Memory Game
          </h1>
          {gameStarted && (
            <div className="flex gap-3 w-full sm:w-auto">
                {/* Content Settings Modal Button (Left) */}
              <button
                  onClick={() => setShowContentSettingsModal(true)}
                  className="w-1/2 sm:w-auto bg-gray-200 text-gray-800 px-4 py-2 rounded-full font-semibold hover:bg-gray-300 transition flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
              >
                  <List size={20} /> Content
              </button>
                {/* Visual Settings Modal Button (Right) */}
              <button
                  onClick={() => setShowVisualSettingsModal(true)}
                  className="w-1/2 sm:w-auto bg-gray-200 text-gray-800 px-4 py-2 rounded-full font-semibold hover:bg-gray-300 transition flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
              >
                  <Grid size={20} /> Visual
              </button>
              <button
                onClick={() => setGameStarted(false)}
                className="w-full sm:w-auto bg-indigo-600 text-white px-5 py-2 rounded-full font-semibold hover:bg-indigo-700 transition flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
              >
                <RotateCcw size={20} />
                New Game
              </button>
            </div>
          )}
        </div>
        
        {/* --- Game Setup --- */}
        {!gameStarted ? (
          <div className="bg-white rounded-xl shadow-2xl p-6 sm:p-10 max-w-2xl mx-auto border-t-4 border-indigo-500 w-full">
            <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Game Setup</h2>

            <div className="space-y-6">
              
              {/* Kanji Set Selector */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-600">Select Kanji Set</label>
                <select
                  value={kanjiSetEndpoint}
                  onChange={(e) => {
                    setKanjiSetEndpoint(e.target.value);
                    setPreviousKanjiData(null); 
                  }}
                  className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  disabled={isLoading}
                >
                  {Object.entries(KANJI_SETS).map(([name, endpoint]) => (
                    <option key={endpoint} value={endpoint}>{name}</option>
                  ))}
                </select>
              </div>

              {/* Grid Size Slider */}
              <div className="pt-2">
                <label className="block text-sm font-medium mb-2 text-gray-600">
                    Board Size (Controls Card Count): **{gridSize}x{gridSize}** ({gridSize * gridSize} cards)
                </label>
                <input
                  type="range"
                  min="4"
                  max="8"
                  step="2"
                  value={gridSize}
                  onChange={(e) => setGridSize(parseInt(e.target.value))}
                  className="w-full h-2 bg-indigo-100 rounded-lg appearance-none cursor-pointer range-lg"
                />
                <p className="text-xs text-gray-500 mt-1">Larger grids require more unique kanji and result in smaller cards to fit the screen.</p>
              </div>

              {/* Opponent Selector */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-600">Opponent</label>
                <select
                  value={opponentType}
                  onChange={(e) => setOpponentType(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                >
                  {Object.values(OpponentTypes)
                    .map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              {/* Quick Settings Access */}
              <div className="pt-4 border-t border-gray-200">
                <h3 className="text-lg font-bold mb-3 text-gray-700">Quick Settings Access:</h3>
                <div className="flex gap-4">
                    <button
                        onClick={() => setShowContentSettingsModal(true)}
                        className="flex-1 bg-purple-100 text-purple-700 px-4 py-2 rounded-full font-semibold hover:bg-purple-200 transition flex items-center justify-center gap-2"
                    >
                        <List size={18} /> Card Content
                    </button>
                    <button
                        onClick={() => setShowVisualSettingsModal(true)}
                        className="flex-1 bg-indigo-100 text-indigo-700 px-4 py-2 rounded-full font-semibold hover:bg-indigo-200 transition flex items-center justify-center gap-2"
                    >
                        <Grid size={18} /> Visuals
                    </button>
                </div>
              </div>

              {/* Reuse Kanji Option */}
              {previousKanjiData && (
                <div className="pt-2">
                  <label className="flex items-center gap-2 cursor-pointer text-gray-700">
                    <input
                      type="checkbox"
                      checked={reuseKanji}
                      onChange={(e) => setReuseKanji(e.target.checked)}
                      className="w-4 h-4 text-indigo-600 bg-gray-100 border-gray-300 rounded focus:ring-indigo-500"
                    />
                    <span className="text-sm font-medium">Use kanji from previous game (Same set)</span>
                  </label>
                </div>
              )}
            </div>

            <button
              onClick={initializeGame}
              disabled={kanjiCharacters.length === 0 || isLoading}
              className={`w-full mt-8 py-3 rounded-full font-bold text-lg transition shadow-lg hover:shadow-xl transform hover:scale-[1.01] ${
                kanjiCharacters.length === 0 || isLoading 
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-green-500 text-white hover:bg-green-600'
              }`}
            >
              {isLoading ? 'Loading...' : 'Start Game'}
            </button>
             {kanjiCharacters.length > 0 && (
                <p className="text-xs text-center text-gray-500 mt-2">
                    **{currentKanjiSetName}** set loaded: **{kanjiCharacters.length}** unique kanji available.
                </p>
            )}
          </div>
        ) : (
          <>
            {/* --- Game Status and Scoreboard --- */}
            <div className="bg-white rounded-xl shadow-2xl p-4 sm:p-6 mb-4 border-t-4 border-purple-500">
              <div className="flex flex-col sm:flex-row justify-between items-center text-center sm:text-left gap-4">

                {/* Player 1 Score (Green Highlight) */}
                <div className={`p-3 rounded-lg w-full sm:w-1/2 transition-all ${currentPlayer === 1 ? 'bg-green-100 ring-2 ring-green-500' : 'bg-gray-50'}`}>
                  <div className="text-sm font-medium text-gray-600 flex items-center justify-center sm:justify-start gap-2">
                    <Users size={18} className="text-green-600" /> Player 1 (You)
                  </div>
                  <h3 className="text-3xl font-extrabold text-gray-900 mt-1">{scores.player1} pairs</h3>
                  {currentPlayer === 1 && <span className="text-xs font-bold text-green-600 block mt-1">● YOUR TURN</span>}
                </div>

                {/* Opponent Score (Red Highlight) */}
                <div className={`p-3 rounded-lg w-full sm:w-1/2 transition-all ${currentPlayer === 2 ? 'bg-red-100 ring-2 ring-red-500' : 'bg-gray-50'}`}>
                  <div className="text-sm font-medium text-gray-600 flex items-center justify-center sm:justify-end gap-2">
                    {opponentType === OpponentTypes.PLAYER2 ? <Users size={18} className="text-red-600" /> : <Brain size={18} className="text-red-600" />}
                    {currentOpponentName}
                  </div>
                  <h3 className="text-3xl font-extrabold text-gray-900 mt-1">{scores.player2} pairs</h3>
                  {currentPlayer === 2 && <span className="text-xs font-bold text-red-600 block mt-1">● TURN</span>}
                </div>
              </div>
            </div>

            {/* --- Debug Indicator --- */}
            {opponentType !== OpponentTypes.PLAYER2 && opponentType !== OpponentTypes.RANDOMIZER && showDebugMemory && (
              <div className="text-center mb-4">
                 <span className="text-xs font-medium py-1 px-3 rounded-full bg-yellow-100 text-yellow-800 flex items-center mx-auto gap-1 w-fit">
                    <Eye size={14} /> Bot Memory Visible (Debug Mode)
                </span>
              </div>
            )}

            {/* --- Game Grid (Responsive container to fit on screen) --- */}
            <div className="flex-grow flex items-center justify-center min-h-0 overflow-hidden p-1">
                <div
                    // Set max width dynamically to control card size
                    style={{
                        gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
                        maxWidth: `${totalGridWidth}px`, 
                        maxHeight: '90vh',
                    }}
                    className={`grid gap-3 w-full transition-opacity duration-500 ${isProcessing && currentPlayer === 2 ? 'opacity-70 pointer-events-none' : 'opacity-100'}`}
                >
                    {cards.map((card, index) => (
                        <Card key={card.id} card={card} index={index} />
                    ))}
                </div>
            </div>


            {/* --- Game Over Modal --- */}
            {isGameOver && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-xl shadow-2xl p-8 text-center border-t-8 border-green-500 transform scale-100 animate-in fade-in zoom-in-50">
                  <h2 className="text-4xl font-extrabold text-green-600 mb-4">Game Over!</h2>
                  <p className="text-xl text-gray-800 mb-6">
                    {scores.player1 > scores.player2
                      ? 'Player 1 Wins! 🎉 Congratulations!'
                      : scores.player2 > scores.player1
                        ? `${currentOpponentName} Wins! 🤖 Try a lower difficulty!`
                        : "It's a Tie! 🤝 Well played."}
                  </p>
                  <div className="flex justify-center gap-4">
                    <button
                      onClick={initializeGame}
                      className="bg-indigo-600 text-white py-3 px-6 rounded-full font-bold hover:bg-indigo-700 transition shadow-md"
                    >
                      Play Again
                    </button>
                    <button
                      onClick={() => setGameStarted(false)}
                      className="bg-gray-200 text-gray-800 py-3 px-6 rounded-full font-bold hover:bg-gray-300 transition shadow-md"
                    >
                      Change Settings
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
