import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Brain, Users, Shuffle, RotateCcw, Eye, Loader, CloudOff, Settings, X, ChevronDown, ChevronUp, BookOpen, Volume2, List, Grid, Info, Check, CornerDownRight } from 'lucide-react';
import * as wanakana from 'wanakana';

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

// Opponent Types for selection
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
const BOT_CONFIGS = {
  [OpponentTypes.RANDOMIZER]: [0, 0, 0, 100, 0, 0, 100, 0, 0, 100, 0, 0],
  [OpponentTypes.BOT_NOVICE]: [0, 5, 90, 5, 0, 0, 100, 20, 0, 80, 0, 0],
  [OpponentTypes.BOT_CASUAL]: [0, 20, 70, 10, 25, 75, 0, 30, 0, 70, 0, 0],
  [OpponentTypes.BOT_SHREWD]: [50, 20, 80, 0, 25, 75, 0, 40, 0, 0, 30, 30],
  [OpponentTypes.BOT_MASTER]: [75, 30, 60, 10, 25, 75, 0, 70, 0, 0, 5, 25],
  [OpponentTypes.BOT_ELITE]: [100, 5, 95, 0, 25, 75, 0, 80, 0, 20, 0, 0],
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

// --- Constants for the Unified 4-State Visibility System (PER FEATURE) ---

const VISIBILITY_STATES = ['NEVER', 'BOTH', 'FIRST_ONLY', 'SECOND_ONLY'];
const VISIBILITY_LABELS = {
    'NEVER': 'Never Show',
    'BOTH': 'Show on Both Flips', // Simplified label
    'FIRST_ONLY': 'Show on 1st Flip Only',
    'SECOND_ONLY': 'Show on 2nd Flip Only',
};
const VISIBILITY_COLORS = {
    'BOTH': 'bg-green-600 hover:bg-green-700',
    'NEVER': 'bg-gray-400 hover:bg-gray-500',
    'FIRST_ONLY': 'bg-yellow-600 hover:bg-yellow-700',
    'SECOND_ONLY': 'bg-blue-600 hover:bg-blue-700',
};

// Card Order Assignment Modes
const CARD_ORDER_MODES = {
  FLIP_ORDER: 'Flip Order (Reset on Fail)',
  FIRST_FLIP_STICKY: 'First Flip Sticky (Permanent)',
  RANDOM_PER_PAIR: 'Random per Pair (50/50 Split)',
  RANDOM_GLOBAL: 'Random Global (True 50/50)',
};

const FEATURE_LABELS = {
    kanji: 'Kanji Character (Main)',
    frequency: 'Frequency Rank',
    meaning: 'English Meaning',
    heisig: 'Heisig Keyword',
    on: 'On-Yomi Reading',
    kun: 'Kun-Yomi Reading',
    kunRomaji: 'Kun-Yomi Reading (Romaji)',
    onRomaji: 'On-Yomi Reading (Romaji)',
    strokeCount: 'Stroke Count',
    unicode: 'Unicode',
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

  // --- Content Visibility State (Updated to use 4-state for both matched and flipped) ---

  const [contentVisibility, setContentVisibility] = useState({
    kanji: { matched: 'BOTH', flipped: 'BOTH' },
    frequency: { matched: 'NEVER', flipped: 'NEVER' },
    meaning: { matched: 'BOTH', flipped: 'NEVER' },
    heisig: { matched: 'NEVER', flipped: 'NEVER' },
    on: { matched: 'FIRST_ONLY', flipped: 'NEVER' },
    kun: { matched: 'SECOND_ONLY', flipped: 'NEVER' },
    kunRomaji: { matched: 'NEVER', flipped: 'NEVER' },
    onRomaji: { matched: 'NEVER', flipped: 'NEVER' },
    strokeCount: { matched: 'NEVER', flipped: 'NEVER' },
    unicode: { matched: 'NEVER', flipped: 'NEVER' },
  });




  const [cardOrderMode, setCardOrderMode] = useState('FLIP_ORDER');
  const [cardOrderAssignments, setCardOrderAssignments] = useState({}); // Stores permanent assignments


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

  }, [setCards]);



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
          wordData: null, 
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
    
    // Initialize card order assignments based on mode
    const newAssignments = {};
    if (cardOrderMode === 'RANDOM_PER_PAIR') {
      // Assign each pair randomly: one card gets 1, the other gets 2
      selectedKanjiDetails.forEach((_, kanjiId) => {
        const pairCards = shuffled.filter(c => c.kanjiId === kanjiId);
        const first = Math.random() < 0.5 ? 0 : 1;
        newAssignments[pairCards[0].id] = first === 0 ? 1 : 2;
        newAssignments[pairCards[1].id] = first === 0 ? 2 : 1;
      });
    } else if (cardOrderMode === 'RANDOM_GLOBAL') {
      // Randomly assign 50% as first, 50% as second (no pair awareness)
      const indices = shuffled.map((_, i) => i);
      const shuffledIndices = [...indices].sort(() => Math.random() - 0.5);
      const halfPoint = Math.floor(shuffledIndices.length / 2);
      
      shuffledIndices.forEach((cardIdx, i) => {
        newAssignments[shuffled[cardIdx].id] = i < halfPoint ? 1 : 2;
      });
    }
    setCardOrderAssignments(newAssignments);
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
    
        // Pop-up modal if a scored card is clicked and no match is in progress
    if (matchedPairs.has(cards[index]?.kanjiId) && flippedIndices.length === 0) {
        const cardData = cards[index];
        
        // If word data is not cached, fetch it before showing modal
        if (cardData.wordData === null) {
            setIsModalLoading(true);
            fetchAndCacheWordData(cardData).then(updatedData => {
                setModalKanjiData(updatedData);
                setShowKanjiModal(true);
                setIsModalLoading(false);
            });
        } else {
            // Data already cached, show modal immediately
            setModalKanjiData(cardData);
            setShowKanjiModal(true);
        }
        return;
    }

    
    // Only allow flip if it's not matched and not already flipped
    if (flippedIndices.includes(index) || matchedPairs.has(cards[index].kanjiId)) {
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
          
          // Save card order assignments for FLIP_ORDER mode on successful match
          if (cardOrderMode === 'FLIP_ORDER') {
            setCardOrderAssignments(prev => ({
              ...prev,
              [card1.id]: 1, // First flipped card (by card.id)
              [card2.id]: 2  // Second flipped card (by card.id)
            }));
          }
          
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
  
  // Helper to cycle the content visibility level for a specific feature and type
  const toggleContentVisibility = (featureKey, type) => {
    setContentVisibility(prev => {
        const currentLevel = prev[featureKey][type];
        const currentIndex = VISIBILITY_STATES.indexOf(currentLevel);
        const nextIndex = (currentIndex + 1) % VISIBILITY_STATES.length;
        return {
            ...prev,
            [featureKey]: {
                ...prev[featureKey],
                [type]: VISIBILITY_STATES[nextIndex]
            }
        };
    });
  };

  const ContentSettingsModal = ({ onClose }) => {
    
    // Feature keys in a logical display order
    const featureKeys = ['kanji', 'frequency', 'meaning', 'heisig', 'on', 'kun', 'kunRomaji', 'onRomaji', 'strokeCount', 'unicode'];

    return (
        <SettingsModalWrapper title="Card Content Settings" onClose={onClose}>
            <p className="text-gray-600 mb-6">
                Set an independent display mode for each piece of content. Both **Matched Cards** (permanent visibility) and **Unmatched Flips** (temporary visibility) use the same 4-state logic.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                {featureKeys.map(key => (
                    <div key={key} className={`p-4 rounded-xl shadow-lg border border-indigo-100 ${key === 'kanji' ? 'bg-indigo-50' : 'bg-white'}`}>
                        <label className="block text-base font-extrabold mb-3 text-indigo-800 flex items-center gap-2">
                            {FEATURE_LABELS[key]}
                        </label>
                        <div className="flex flex-col gap-3">
                            {/* MATCHED VISIBILITY BUTTON */}
                            <div className="flex items-center gap-3">
                                <span className="text-xs font-semibold w-1/4 text-gray-600">MATCHED:</span>
                                <button
                                    onClick={() => toggleContentVisibility(key, 'matched')}
                                    className={`w-3/4 p-2 rounded-full font-bold text-sm text-white transition-colors duration-200 shadow ${VISIBILITY_COLORS[contentVisibility[key].matched]} flex items-center justify-center gap-2`}
                                >
                                    <Check size={16}/>
                                    {VISIBILITY_LABELS[contentVisibility[key].matched]}
                                </button>
                            </div>
                            
                            {/* FLIPPED VISIBILITY BUTTON */}
                            <div className="flex items-center gap-3">
                                <span className="text-xs font-semibold w-1/4 text-gray-600">FLIPPED:</span>
                                <button
                                    onClick={() => toggleContentVisibility(key, 'flipped')}
                                    className={`w-3/4 p-2 rounded-full font-bold text-sm transition-colors duration-200 shadow ${VISIBILITY_COLORS[contentVisibility[key].flipped]} flex items-center justify-center gap-2`}
                                >
                                    <Shuffle size={16}/>
                                    {VISIBILITY_LABELS[contentVisibility[key].flipped]}
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
                        <h3 className="text-lg font-bold mt-8 mb-3 text-indigo-700 flex items-center gap-2 border-t pt-4">
                <Shuffle size={20} /> Card Order Assignment
            </h3>
            <div className="mb-6 bg-purple-50 p-4 rounded-lg">
                <label className="block text-sm font-medium mb-2 text-gray-700">
                    How to determine which card is "1st" vs "2nd"
                </label>
                <select
                    value={cardOrderMode}
                    onChange={(e) => setCardOrderMode(e.target.value)}
                    className="w-full p-3 border border-purple-300 rounded-lg shadow-sm focus:ring-purple-500 focus:border-purple-500 bg-white"
                >
                    {Object.entries(CARD_ORDER_MODES).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                    ))}
                </select>
                <div className="mt-3 text-xs text-gray-600 space-y-2">
                    <p><strong>Flip Order:</strong> Card flipped first = 1st, second = 2nd. Resets after each mismatch.</p>
                    <p><strong>First Flip Sticky:</strong> Assignment saved on first flip permanently (even after mismatch).</p>
                    <p><strong>Random per Pair:</strong> Each pair gets one 1st and one 2nd randomly at game start.</p>
                    <p><strong>Random Global:</strong> 50% of all cards assigned as 1st, 50% as 2nd (ignores pairs).</p>
                </div>
            </div>
            <h3 className="text-lg font-bold mt-8 mb-3 text-indigo-700 flex items-center gap-2 border-t pt-4">
                <Info size={20} /> Visibility Modes Explained
            </h3>
            <div className="space-y-2 text-sm text-gray-700 bg-gray-50 p-4 rounded-lg">
                <div className="font-bold text-gray-900 flex items-center"><Check size={16} className="text-green-500 mr-2"/> Show on Both Flips:</div>
                <p className="ml-6 text-gray-600">Visible for both the 1st and 2nd card during an Unmatched Flip.</p>
                
                <div className="font-bold text-gray-900 mt-3 flex items-center"><ChevronDown size={16} className="text-yellow-500 mr-2"/> Show on 1st Flip Only:</div>
                <p className="ml-6 text-gray-600">Visible when the card is Matched, or when it is the **first** card flipped in an unmatched pair.</p>

                <div className="font-bold text-gray-900 mt-3 flex items-center"><ChevronUp size={16} className="text-blue-500 mr-2"/> Show on 2nd Flip Only:</div>
                <p className="ml-6 text-gray-600">Visible when the card is Matched, or when it is the **second** card flipped in an unmatched pair.</p>

                <div className="font-bold text-gray-900 mt-3 flex items-center"><X size={16} className="text-red-500 mr-2"/> Never Show:</div>
                <p className="ml-6 text-gray-600">Content is hidden regardless of whether the card is Matched or Flipped.</p>
            </div>
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
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl p-6 transform scale-100 animate-in fade-in zoom-in-50 max-h-[90vh] overflow-y-auto">
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

  // --- Card Component (Updated to use complex visibility logic) ---
  const Card = ({ card, index }) => {
    // Access cardOrderMode and cardOrderAssignments from parent scope
    const matched = matchedPairs.has(card.kanjiId);
    const isBotKnown = botMemory[index] !== undefined && opponentType !== OpponentTypes.PLAYER2;
    const owner = matchOwners[card.kanjiId];
    
// Determine if card is currently flipped (in flippedIndices array) or matched
    const isCurrentlyFlipped = flippedIndices.includes(index);
    const flipped = isCurrentlyFlipped || matched; // Card is 'open' if flipped or matched
    
    // Determine the card's ROLE (1st or 2nd) based on card order mode
    let isFirstFlipped = false;
    let isSecondFlipped = false;
    
    // Only determine role if the card is actually visible (flipped or matched)
    if (flipped) {
      if (cardOrderMode === 'FLIP_ORDER') {
        // MODE ONE: Based on current flip order, resets each turn
        isFirstFlipped = flippedIndices.length > 0 && flippedIndices[0] === index;
        isSecondFlipped = flippedIndices.length === 2 && flippedIndices[1] === index;
        
      } else if (cardOrderMode === 'FIRST_FLIP_STICKY') {
        // MODE TWO: First flip is sticky, saved permanently
        if (cardOrderAssignments[card.id] !== undefined) {
          // Use saved assignment
          isFirstFlipped = cardOrderAssignments[card.id] === 1;
          isSecondFlipped = cardOrderAssignments[card.id] === 2;
        } else if (isCurrentlyFlipped) {
          // First time flipping - assign based on current flip order
          const isCurrentlyFirst = flippedIndices[0] === index;
          isFirstFlipped = isCurrentlyFirst;
          isSecondFlipped = !isCurrentlyFirst;
          
          // Save this assignment permanently
          setCardOrderAssignments(prev => ({
            ...prev,
            [card.id]: isCurrentlyFirst ? 1 : 2
          }));
        }
        
      } else if (cardOrderMode === 'RANDOM_PER_PAIR' || cardOrderMode === 'RANDOM_GLOBAL') {
        // MODE THREE & FOUR: Use pre-assigned values from game initialization
        isFirstFlipped = cardOrderAssignments[card.id] === 1;
        isSecondFlipped = cardOrderAssignments[card.id] === 2;
      }
    }

    // Card Content Scaling
    const kanjiFontSize = `${4 * cardContentScale}rem`;
    const auxFontSize = `${0.6 * cardContentScale}rem`; 

    const matchedClasses = owner === 1
        ? 'ring-4 ring-green-500 bg-green-50 opacity-100' 
        : owner === 2
            ? 'ring-4 ring-red-500 bg-red-50 opacity-100' 
            : 'ring-4 ring-gray-300 opacity-90'; 

    
    // --- New Unified Visibility Logic Function (Based on 4 states for both types) ---
    const shouldShowFeature = (featureKey) => {
        const visibility = contentVisibility[featureKey];

        // 1. Matched State Check: If matched, use the 'matched' setting
        if (matched) {
            const level = visibility.matched;
            // For a matched card, any state other than 'NEVER' means SHOW
            return level !== 'NEVER'; 
        }
        
        // 2. Unmatched Flipped State Check: If currently flipping (and unmatched)
        if (isCurrentlyFlipped) {
            const level = visibility.flipped;

            if (level === 'BOTH') return true;
            if (level === 'FIRST_ONLY' && isFirstFlipped) return true;
            if (level === 'SECOND_ONLY' && isSecondFlipped) return true;
            // level === 'NEVER' returns false
        }
        
        return false;
    };
    
// --- Assemble Content Lines ---
    const contentLines = [];
    
    // 1. Frequency Rank
    if (shouldShowFeature('frequency')) {
        const freqText = card.freq_mainichi_shinbun ? `#${card.freq_mainichi_shinbun}` : 'N/A';
        contentLines.push(<div key="frequency" className="text-purple-600 font-bold leading-tight">Freq: {freqText}</div>);
    }
    
    // 2. Meaning
    if (shouldShowFeature('meaning')) {
        contentLines.push(<div key="meaning" className="text-gray-700 font-semibold leading-tight">{card.meaning}</div>);
    }
    
    // 3. Heisig Keyword
    if (shouldShowFeature('heisig')) {
        contentLines.push(<div key="heisig" className="text-indigo-600 font-semibold leading-tight italic">Heisig: {card.heisig_en}</div>);
    }
    
    // 4. On-Yomi
    if (shouldShowFeature('on')) {
        contentLines.push(<div key="on" className="text-gray-500 leading-tight">On: {card.on}</div>);
    }

    // 5. Kun-Yomi
    if (shouldShowFeature('kun')) {
        contentLines.push(<div key="kun" className="text-gray-500 leading-tight">Kun: {card.kun}</div>);
    }
    
    // 6. Kun-Yomi (Romaji)
    if (shouldShowFeature('kunRomaji')) {
        const kunRomaji = card.kun !== '—' ? wanakana.toRomaji(card.kun) : '—';
        contentLines.push(<div key="kunRomaji" className="text-blue-500 leading-tight">Kun (R): {kunRomaji}</div>);
    }
    
    // 7. On-Yomi (Romaji)
    if (shouldShowFeature('onRomaji')) {
        const onRomaji = card.on !== '—' ? wanakana.toRomaji(card.on) : '—';
        contentLines.push(<div key="onRomaji" className="text-blue-500 leading-tight">On (R): {onRomaji}</div>);
    }
    
    // 8. Stroke Count
    if (shouldShowFeature('strokeCount')) {
        contentLines.push(<div key="strokes" className="text-gray-500 leading-tight">Strokes: {card.stroke_count}</div>);
    }
    
    // 9. Unicode
    if (shouldShowFeature('unicode')) {
        contentLines.push(<div key="unicode" className="text-gray-400 text-xs leading-tight">U+{card.unicode}</div>);
    }


    return (
      <div
        onClick={() => handleCardClick(index)}
        // Added minWidth/minHeight to respect the cardBaseWidth setting
        style={{ minWidth: `${cardBaseWidth}px`, minHeight: `${cardBaseWidth}px` }}
        className={`
          relative aspect-square rounded-xl shadow-lg transform transition-all duration-300 ease-in-out
          ${flipped
            ? 'bg-white shadow-2xl scale-100 cursor-pointer' 
            : 'bg-gradient-to-br from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 cursor-pointer hover:scale-[1.03]'
          }
          ${matched ? matchedClasses : 'opacity-100'}
        `}
      >
        <div className={`flex items-center justify-center h-full w-full p-1 absolute inset-0 backface-hidden ${flipped ? 'opacity-100' : 'opacity-0'}`}>
          {flipped ? (
            <div className="text-center transition-all duration-300 text-gray-900">
                {/* 10. Kanji Character Display */}
                {shouldShowFeature('kanji') ? (
                    <div 
                        style={{ fontSize: kanjiFontSize }}
                        className="font-bold leading-none transition-transform duration-300"
                    >
                        {card.kanji}
                    </div>
                ) : (
                    // Display a placeholder if Kanji itself is hidden, but the card is flipped
                    <div 
                        style={{ fontSize: kanjiFontSize }}
                        className="font-bold leading-none transition-transform duration-300 text-gray-300"
                    >
                        ?
                    </div>
                )}
              
              {/* Auxiliary content is now conditionally rendered */}
              {contentLines.length > 0 && (
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
    // wordData is initialized from the cached data, which is usually null initially
    const [wordData, setWordData] = useState(data.wordData); 
    const [isWordsLoading, setIsWordsLoading] = useState(data.wordData === null); // Start loading if not cached
    const [wordError, setWordError] = useState(null);
    const [visibleWordCount, setVisibleWordCount] = useState(10); // NEW: State for pagination

    const handleLoadMore = () => {
        setVisibleWordCount(prev => prev + 10);
    };

    const WordSkeleton = () => (
        <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
                <div key={i} className="p-4 border border-gray-200 rounded-lg bg-gray-100 animate-pulse">
                    <div className="h-5 w-2/3 bg-gray-200 rounded mb-2"></div>
                    <div className="h-4 w-1/4 bg-gray-200 rounded mb-3 ml-3"></div>
                    <div className="h-3 w-4/5 bg-gray-300 rounded ml-8"></div>
                    <div className="h-3 w-3/4 bg-gray-300 rounded ml-8 mt-1"></div>
                </div>
            ))}
        </div>
    );

    // Fetch word data on mount if not already present
    useEffect(() => {
        // Only run if kanji is valid and word data hasn't been fetched/cached yet
        if (!data.kanji || wordData) return;

        const fetchWordData = async () => {
            setIsWordsLoading(true);
            setWordError(null);
            try {
                const response = await fetch(`${API_BASE_URL}/words/${data.kanji}`);
                
                // Handle 404 specifically as "No Words Found"
                if (response.status === 404) {
                    setWordData([]); // Set to empty array to indicate successful fetch but no words
                    // Caching the empty array to prevent re-fetch
                    setCards(prevCards => prevCards.map(c => 
                        c.kanji === data.kanji ? { ...c, wordData: [] } : c
                    ));
                    setIsWordsLoading(false);
                    return;
                }
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const responseData = await response.json();
                setWordData(responseData);

                // Update the card data in the main state to cache the word data
                setCards(prevCards => prevCards.map(c => 
                    c.kanji === data.kanji ? { ...c, wordData: responseData } : c
                ));

            } catch (e) {
                console.error("Failed to fetch word data:", e);
                setWordError("Could not load associated dictionary words. (Network/Server Error)");
                // FIX: On error, update wordData to an empty array to satisfy the useEffect dependency check
                // and prevent the infinite loading loop on subsequent renders.
                setWordData([]); 
            } finally {
                setIsWordsLoading(false);
            }
        };

        fetchWordData();
    }, [data.kanji, wordData, setCards]); // wordData in dependency array prevents re-fetch once data is set

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
                                <p className="text-blue-600 ml-3 p-2 bg-blue-50 rounded-lg text-xs mt-1 italic">
                                    {data.on !== '—' ? wanakana.toRomaji(data.on) : '—'}
                                </p>
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-700 mb-1">Kun-yomi (訓)</h3>
                                <p className="text-gray-900 ml-3 p-2 bg-purple-50 rounded-lg text-sm">{data.kun}</p>
                                <p className="text-blue-600 ml-3 p-2 bg-blue-50 rounded-lg text-xs mt-1 italic">
                                    {data.kun !== '—' ? wanakana.toRomaji(data.kun) : '—'}
                                </p>
                            </div>
                        </div>

                        {data.name_readings !== '—' && (
                            <div className="mt-4">
                                <h3 className="text-lg font-bold text-gray-700 mb-1">Name Readings (名乗り)</h3>
                                <p className="text-gray-900 ml-3 p-2 bg-purple-50 rounded-lg text-sm">{data.name_readings}</p>
                                <p className="text-blue-600 ml-3 p-2 bg-blue-50 rounded-lg text-xs mt-1 italic">
                                    {wanakana.toRomaji(data.name_readings)}
                                </p>
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
                    
                    {/* 1. Loading State: Show Skeleton */}
                    {isWordsLoading && <WordSkeleton />}

                    {/* 2. Error State */}
                    {wordError && <p className="text-red-500 p-4 bg-red-50 rounded-lg">{wordError}</p>}
                    
                    {/* 3. Success State: Words Found */}
                    {!isWordsLoading && wordData && wordData.length > 0 && (
                        <>
                            <div className="space-y-4 max-h-80 overflow-y-auto pr-2">
                                {/* Use visibleWordCount for slicing */}
{wordData.slice(0, visibleWordCount).map((word, index) => (
                                    <div key={index} className="p-4 border border-gray-200 rounded-lg bg-gray-50 shadow-sm">
                                        {word.variants.map((variant, vIndex) => (
                                            <div key={vIndex} className="flex items-baseline mb-2 flex-wrap">
                                                <span className="text-xl font-bold text-gray-900 mr-3">{variant.written}</span>
                                                <span className="text-lg text-indigo-600">
                                                    ({variant.pronounced})
                                                </span>
                                                <span className="text-sm text-blue-500 ml-2 italic">
                                                    ({wanakana.toRomaji(variant.pronounced)})
                                                </span>
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
                            {wordData.length > visibleWordCount && (
                                <div className="text-center mt-4">
                                    <button
                                        onClick={handleLoadMore}
                                        className="bg-purple-100 text-purple-700 py-2 px-4 rounded-full font-bold hover:bg-purple-200 transition text-sm flex items-center justify-center gap-2 mx-auto"
                                    >
                                        <ChevronDown size={18} /> Load Next 10 Words ({visibleWordCount} of {wordData.length} shown)
                                    </button>
                                </div>
                            )}
                            
                            {/* "All words shown" message */}
                            {wordData.length <= visibleWordCount && (
                                <p className="text-sm text-center text-gray-500 mt-4">
                                    All {wordData.length} associated words are shown.
                                </p>
                            )}
                        </>
                    )}
                    
                    {/* 4. No Words Found State (handles 404 and error fallback) */}
                    {!isWordsLoading && wordData && wordData.length === 0 && !wordError && (
                        <p className="p-4 bg-yellow-50 rounded-lg text-gray-700">No common dictionary entries found for this kanji.</p>
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
                        <Grid size={18} /> Visual
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