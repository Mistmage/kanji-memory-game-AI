import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Brain, Users, Shuffle, RotateCcw, Eye, Loader, CloudOff } from 'lucide-react';

// --- API Configuration ---
const API_BASE_URL = 'https://kanjiapi.dev/v1';

// Opponent Types for selection
const OpponentTypes = {
  PLAYER2: 'Player 2',
  RANDOMIZER: 'Randomizer (0% memory)',
  BOT0: 'Bot (Level 0: Low chance)',
  BOT1: 'Bot (Level 1: Basic memory)',
  BOT2: 'Bot (Level 2: Balanced strategy)',
  BOT3: 'Bot (Level 3: High memory)',
  BOT4: 'Bot (Level 4: Near perfect)',
};

export default function KanjiMemoryGame() {
  // --- API State ---
  // Stores the full list of kanji characters (strings) fetched from the API
  const [kanjiCharacters, setKanjiCharacters] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // --- Game State ---
  const [gridSize, setGridSize] = useState(6); // Default to 6x6
  // Cards now store the full fetched details
  const [cards, setCards] = useState([]);
  const [flippedIndices, setFlippedIndices] = useState([]);
  const [matchedPairs, setMatchedPairs] = useState(new Set());
  const [currentPlayer, setCurrentPlayer] = useState(1);
  const [scores, setScores] = useState({ player1: 0, player2: 0 });
  const [opponentType, setOpponentType] = useState(OpponentTypes.BOT1);
  const [gameStarted, setGameStarted] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previousKanjiData, setPreviousKanjiData] = useState(null); // Stores full data objects
  const [reuseKanji, setReuseKanji] = useState(false);
  const [showDebugMemory, setShowDebugMemory] = useState(false); // Debug feature

  // --- Bot Memory State ---
  // Stores the index of the card and its kanjiId: { index: kanjiId, ... }
  const [botMemory, setBotMemory] = useState({});

  // Memoized check for game over
  const isGameOver = useMemo(() => {
    return matchedPairs.size === cards.length / 2 && cards.length > 0;
  }, [matchedPairs, cards.length]);

  // --- API Fetching: Fetch initial list of Jōyō Kanji ---
  useEffect(() => {
    const fetchKanjiList = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Fetch the list of all common use (Jōyō) kanji strings
        const response = await fetch(`${API_BASE_URL}/kanji/joyo`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        if (data.length === 0) {
           throw new Error('API returned an empty list of kanji. Cannot start game.');
        }
        setKanjiCharacters(data);
      } catch (e) {
        console.error("Failed to fetch kanji list:", e);
        setError(`Failed to load Kanji data from API. Error: ${e.message}`);
      } finally {
        setIsLoading(false);
      }
    };
    fetchKanjiList();
  }, []);

  // --- Game Initialization ---
  const initializeGame = useCallback(async () => {
    if (kanjiCharacters.length === 0) {
      setError("Cannot start game: Kanji library is empty or failed to load.");
      return;
    }

    const totalCards = gridSize * gridSize;
    const pairsNeeded = totalCards / 2;

    if (pairsNeeded > kanjiCharacters.length) {
      setError(`Cannot create a ${gridSize}x${gridSize} grid. Need ${pairsNeeded} unique Kanji, but the available library only has ${kanjiCharacters.length}. Please choose a smaller grid.`);
      return;
    }

    setIsProcessing(true);
    let selectedKanjiDetails;

    if (reuseKanji && previousKanjiData && previousKanjiData.length >= pairsNeeded) {
      // Reuse existing detailed data
      selectedKanjiDetails = previousKanjiData.slice(0, pairsNeeded);
    } else {
      // 1. Select random kanji characters (strings)
      const shuffledKanjiList = [...kanjiCharacters].sort(() => Math.random() - 0.5);
      const selectedKanjiStrings = shuffledKanjiList.slice(0, pairsNeeded);

      // 2. Fetch detailed data for only the selected kanji
      try {
        const detailPromises = selectedKanjiStrings.map(kanji =>
          fetch(`${API_BASE_URL}/kanji/${kanji}`)
            .then(res => {
              if (!res.ok) throw new Error(`Failed to fetch details for ${kanji}`);
              return res.json();
            })
        );

        const apiResponses = await Promise.all(detailPromises);

        // 3. Map API response to the required card format
        selectedKanjiDetails = apiResponses.map((res, index) => ({
          kanji: res.kanji,
          meaning: res.meanings.join(', ') || 'No meaning available',
          kun: res.kun_readings.join(', ') || '—',
          on: res.on_readings.join(', ') || '—',
        }));

        setPreviousKanjiData(selectedKanjiDetails);
      } catch (e) {
        console.error("Failed to fetch detailed kanji data:", e);
        setError(`Failed to fetch detailed kanji data: ${e.message}.`);
        setIsProcessing(false);
        return;
      }
    }

    // 4. Create card pairs
    const cardPairs = selectedKanjiDetails.flatMap((k, idx) => [
      // kanjiId ties the two cards together for matching purposes
      { id: idx * 2, kanjiId: idx, ...k },
      { id: idx * 2 + 1, kanjiId: idx, ...k }
    ]);

    // Final shuffle
    const shuffled = cardPairs.sort(() => Math.random() - 0.5);

    // Reset all game states
    setCards(shuffled);
    setFlippedIndices([]);
    setMatchedPairs(new Set());
    setCurrentPlayer(1);
    setScores({ player1: 0, player2: 0 });
    setGameStarted(true);
    setBotMemory({});
    setReuseKanji(false);
    setIsProcessing(false);
  }, [gridSize, reuseKanji, previousKanjiData, kanjiCharacters]);

  // --- User Turn Logic ---
  const handleCardClick = (index) => {
    // Prevent interaction if processing, card is already flipped, or matched
    if (isProcessing || flippedIndices.includes(index) || matchedPairs.has(cards[index].kanjiId)) {
      return;
    }

    // Prevent Player 1 from playing when it's Player 2's turn against an AI
    if (currentPlayer === 2 && opponentType !== OpponentTypes.PLAYER2) {
      return;
    }

    // Only allow flipping up to 2 cards
    if (flippedIndices.length < 2) {
      setFlippedIndices(prev => [...prev, index]);

      // If this is the first card, update bot memory immediately for maximum information
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

  // --- Match/Turn Resolution Effect ---
  useEffect(() => {
    if (flippedIndices.length === 2) {
      setIsProcessing(true);
      const [idx1, idx2] = flippedIndices;
      const card1 = cards[idx1];
      const card2 = cards[idx2];

      setTimeout(() => {
        if (card1.kanjiId === card2.kanjiId) {
          // Match found - player gets another turn
          setMatchedPairs(prev => new Set([...prev, card1.kanjiId]));
          setScores(prev => ({
            ...prev,
            [`player${currentPlayer}`]: prev[`player${currentPlayer}`] + 1
          }));
          setFlippedIndices([]);
          setIsProcessing(false);
          // Current player keeps turn: No currentPlayer change

        } else {
          // No match - switch player
          setTimeout(() => {
            setFlippedIndices([]);
            setCurrentPlayer(currentPlayer === 1 ? 2 : 1);
            setIsProcessing(false);
          }, 1000); // Cards stay visible briefly for the opponent to "see" and "remember"

          // Update bot memory with the second flipped card (if it's not a match)
          if (opponentType !== OpponentTypes.PLAYER2) {
            setBotMemory(prev => ({
              ...prev,
              [idx2]: cards[idx2].kanjiId
            }));
          }
        }
      }, 1000); // Match check delay
    }
  }, [flippedIndices, cards, currentPlayer, opponentType]);


  // --- Bot Logic Helper Functions (Memoized for efficiency) ---
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
    // Find a card that is unmatched AND not in bot memory
    const unknown = getUnmatchedCards().filter(({ idx }) => !botMemory[idx]);
    return unknown[Math.floor(Math.random() * unknown.length)]?.idx;
  }, [getUnmatchedCards, botMemory]);

  const getRandomKnownCard = useCallback(() => {
    // Find a card that is unmatched AND IS in bot memory
    const known = getUnmatchedCards().filter(({ idx }) => botMemory[idx]);
    return known[Math.floor(Math.random() * known.length)]?.idx;
  }, [getUnmatchedCards, botMemory]);

  const getKnownPairIndices = useCallback(() => {
    // Check if the bot knows the location of a complete, unmatched pair
    const known = Object.keys(botMemory).map(k => parseInt(k));
    for (let idx1 of known) {
      if (matchedPairs.has(cards[idx1]?.kanjiId)) continue; // Skip if card is already matched

      const kanjiId = cards[idx1]?.kanjiId;
      if (kanjiId === undefined) continue;

      const pairIdx = cards.findIndex((c, i) =>
        c.kanjiId === kanjiId && // Same kanji ID
        i !== idx1 && // Not the same card index
        botMemory[i] === kanjiId && // Bot knows the location of the pair
        !matchedPairs.has(c.kanjiId) && // Pair is not matched
        !flippedIndices.includes(i) // Pair is not currently flipped
      );

      if (pairIdx !== -1) return [idx1, pairIdx];
    }
    return null; // No known pair found
  }, [botMemory, cards, matchedPairs, flippedIndices]);

  // --- Bot Turn Execution ---
  const performOpponentTurn = useCallback(() => {
    setIsProcessing(true);

    const botLevel = Object.keys(OpponentTypes).find(key => OpponentTypes[key] === opponentType);
    let firstCard = null;
    let secondCard = null;

    // --- Strategy for First Card ---
    const knownPair = getKnownPairIndices();
    const shouldGoForKnownPair = knownPair !== null && Math.random() < ({
      'BOT2': 0.5,
      'BOT3': 0.7,
      'BOT4': 0.95
    }[botLevel] || 0); // Probability of attempting to go for a known pair

    // If the bot decides to attempt a known pair, the first flip is the first index of that pair.
    if (shouldGoForKnownPair) {
      firstCard = knownPair[0];
    } else if (botLevel === 'RANDOMIZER') {
      firstCard = getRandomUnmatchedIndex();
    } else if (Math.random() < 0.8) {
      // 80% chance to flip a card the bot hasn't seen (exploration)
      firstCard = getRandomNewCard() ?? getRandomUnmatchedIndex();
    } else {
      // 20% chance to flip a card the bot has seen (revisiting memory)
      firstCard = getRandomKnownCard() ?? getRandomUnmatchedIndex();
    }

    // If no card can be selected (shouldn't happen unless game is over, but safety check)
    if (firstCard === null) {
      setIsProcessing(false);
      return;
    }

    // Flip the first card and update immediate memory
    setFlippedIndices([firstCard]);
    setBotMemory(prev => ({ ...prev, [firstCard]: cards[firstCard].kanjiId }));

    // --- Strategy for Second Card (after seeing the first) ---
    setTimeout(() => {
      const firstKanjiId = cards[firstCard].kanjiId;
      const confidence = { // Confidence/Accuracy of retrieving a matching card from memory
        'BOT0': 0.2,
        'BOT1': 0.3,
        'BOT2': 0.4,
        'BOT3': 0.7,
        'BOT4': 0.9
      }[botLevel] || 0;

      // Find the potential matching card in memory
      const matchIdx = cards.findIndex((c, i) =>
        c.kanjiId === firstKanjiId &&
        i !== firstCard &&
        botMemory[i] === firstKanjiId && // Must be in memory
        !matchedPairs.has(c.kanjiId)
      );

      // CRITICAL CHANGE: Even if a match is found in memory (matchIdx !== -1),
      // the bot must still pass the confidence check to successfully retrieve it.
      if (matchIdx !== -1 && Math.random() < confidence) {
        // High confidence match success
        secondCard = matchIdx;
      } else {
        // Fallback or strategic randomness (Missed the known match or it was an exploration flip)
        const rand = Math.random();
        if (rand < 0.75) { // Prioritize flipping a new, unknown card (exploration)
          secondCard = getRandomNewCard() ?? getRandomUnmatchedIndex();
        } else { // Or flip a known card (trying to pair up a different known card)
          secondCard = getRandomKnownCard() ?? getRandomUnmatchedIndex();
        }
      }

      // Safety check: ensure second card is not the same as the first card and is valid
      if (secondCard === firstCard || secondCard === null) {
        // Try to pick a new random unmatched card if the logic failed
        secondCard = getUnmatchedCards()
          .map(c => c.idx)
          .filter(idx => idx !== firstCard)
          [Math.floor(Math.random() * (getUnmatchedCards().length - 1))] ?? getRandomUnmatchedIndex();
      }

      // Flip the second card
      setFlippedIndices([firstCard, secondCard]);
      // Memory update for second card is handled in the main match useEffect
    }, 1000); // Short delay to simulate "thinking" after the first flip
  }, [opponentType, cards, getKnownPairIndices, getRandomNewCard, getRandomKnownCard, getRandomUnmatchedIndex, botMemory, matchedPairs, getUnmatchedCards]);

  // --- Bot Turn Trigger Effect ---
  useEffect(() => {
    const isBotTurn = currentPlayer === 2 && opponentType !== OpponentTypes.PLAYER2;
    if (isBotTurn && gameStarted && !isProcessing && !isGameOver) {
      // Delay before the bot's move starts
      const turnDelay = 1500;
      const timer = setTimeout(() => {
        performOpponentTurn();
      }, turnDelay);
      return () => clearTimeout(timer);
    }
  }, [currentPlayer, gameStarted, isProcessing, isGameOver, opponentType, performOpponentTurn]);

  // --- Presentation Components ---

  const Card = ({ card, index }) => {
    const flipped = isCardFlipped(index);
    const matched = matchedPairs.has(card.kanjiId);
    const isBotKnown = botMemory[index] !== undefined && opponentType !== OpponentTypes.PLAYER2;

    // Responsive font size logic: Kanji must shrink aggressively on high density grids (8x8)
    const kanjiTextSizeClasses = gridSize === 4 
      ? 'text-6xl sm:text-7xl' // Largest for 4x4
      : gridSize === 6 
        ? 'text-4xl sm:text-5xl' // Medium for 6x6
        : 'text-3xl sm:text-4xl'; // Smallest for 8x8

    return (
      <div
        onClick={() => handleCardClick(index)}
        className={`
          relative aspect-square rounded-xl shadow-lg transform transition-all duration-300 ease-in-out
          ${flipped || matched
            ? 'bg-white shadow-2xl scale-100'
            : 'bg-gradient-to-br from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 cursor-pointer hover:scale-[1.03]'
          }
          ${matched ? 'ring-4 ring-green-400 opacity-90' : 'opacity-100'}
        `}
      >
        {/* Card Content (Front or Back) */}
        <div className={`flex items-center justify-center h-full w-full p-2 absolute inset-0 backface-hidden ${flipped || matched ? 'opacity-100' : 'opacity-0'}`}>
          {flipped || matched ? (
            <div className={`text-center transition-all duration-300 ${matched ? 'text-gray-800' : 'text-gray-900'}`}>
              {/* Kanji Character (Responsive Font size scales with grid size) */}
              <div className={`font-bold transition-transform duration-300 ${kanjiTextSizeClasses}`}>
                {card.kanji}
              </div>

              {/* Meaning and Readings for matched cards */}
              {matched && (
                <div className="text-[10px] sm:text-xs mt-1 text-gray-500">
                  <div className="font-semibold text-indigo-600">{card.meaning}</div>
                  <div>Kun: {card.kun} | On: {card.on}</div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-white text-3xl font-bold select-none">?</div>
          )}
        </div>

        {/* Debug/Bot Known Indicator */}
        {showDebugMemory && isBotKnown && !matched && !flipped && (
          <div className="absolute top-1 right-1 bg-yellow-400 text-yellow-900 text-[10px] px-2 py-0.5 rounded-full font-semibold">
            BOT KNOWS
          </div>
        )}
      </div>
    );
  };

  const currentOpponentName = opponentType === OpponentTypes.PLAYER2 ? 'Player 2' : opponentType;

  // --- Main Render Block ---
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="flex items-center space-x-3 text-lg font-semibold text-indigo-600">
          <Loader size={24} className="animate-spin" />
          <span>Loading Kanji Library from API...</span>
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
             onClick={() => window.location.reload()}
             className="mt-4 bg-red-600 text-white px-4 py-2 rounded-full text-sm hover:bg-red-700 transition"
           >
             Try Reloading
           </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans p-4 sm:p-8">
      <div className="max-w-6xl mx-auto">
        {/* --- Header --- */}
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-800">
            <span className="text-indigo-600">漢字</span> Memory Game
          </h1>
          {gameStarted && (
            <button
              onClick={() => setGameStarted(false)}
              className="w-full sm:w-auto bg-indigo-600 text-white px-5 py-2 rounded-full font-semibold hover:bg-indigo-700 transition flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
            >
              <RotateCcw size={20} />
              New Game
            </button>
          )}
        </div>

        {/* --- Game Setup --- */}
        {!gameStarted ? (
          <div className="bg-white rounded-xl shadow-2xl p-6 sm:p-10 max-w-lg mx-auto border-t-4 border-indigo-500">
            <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Game Setup</h2>

            <div className="space-y-6">
              {/* Grid Size Slider */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-600">Grid Size: {gridSize}x{gridSize} ({gridSize * gridSize} cards)</label>
                <input
                  type="range"
                  min="4"
                  max="8"
                  step="2"
                  value={gridSize}
                  onChange={(e) => setGridSize(parseInt(e.target.value))}
                  className="w-full h-2 bg-indigo-100 rounded-lg appearance-none cursor-pointer range-lg"
                />
              </div>

              {/* Opponent Selector */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-600">Opponent</label>
                <select
                  value={opponentType}
                  onChange={(e) => setOpponentType(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                >
                  {Object.values(OpponentTypes).map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
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
              // Disable if currently fetching the initial list (though handled by the loader screen, good practice)
              disabled={kanjiCharacters.length === 0}
              className={`w-full mt-8 py-3 rounded-full font-bold text-lg transition shadow-lg hover:shadow-xl transform hover:scale-[1.01] ${
                kanjiCharacters.length === 0 
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-green-500 text-white hover:bg-green-600'
              }`}
            >
              Start Game
            </button>
             {kanjiCharacters.length > 0 && (
                <p className="text-xs text-center text-gray-500 mt-2">
                    Using a library of {kanjiCharacters.length} Jōyō Kanji from the API.
                </p>
            )}
          </div>
        ) : (
          <>
            {/* --- Game Status and Scoreboard --- */}
            <div className="bg-white rounded-xl shadow-2xl p-4 sm:p-6 mb-6 border-t-4 border-purple-500">
              <div className="flex flex-col sm:flex-row justify-between items-center text-center sm:text-left gap-4">

                {/* Player 1 Score */}
                <div className={`p-3 rounded-lg w-full sm:w-1/2 transition-all ${currentPlayer === 1 ? 'bg-indigo-100 ring-2 ring-indigo-500' : 'bg-gray-50'}`}>
                  <div className="text-sm font-medium text-gray-600 flex items-center justify-center sm:justify-start gap-2">
                    <Users size={18} className="text-indigo-600" /> Player 1 (You)
                  </div>
                  <h3 className="text-3xl font-extrabold text-gray-900 mt-1">{scores.player1} pairs</h3>
                  {currentPlayer === 1 && <span className="text-xs font-bold text-green-600 block mt-1">● YOUR TURN</span>}
                </div>

                {/* Opponent Score */}
                <div className={`p-3 rounded-lg w-full sm:w-1/2 transition-all ${currentPlayer === 2 ? 'bg-indigo-100 ring-2 ring-indigo-500' : 'bg-gray-50'}`}>
                  <div className="text-sm font-medium text-gray-600 flex items-center justify-center sm:justify-end gap-2">
                    {opponentType === OpponentTypes.PLAYER2 ? <Users size={18} className="text-purple-600" /> : <Brain size={18} className="text-purple-600" />}
                    {currentOpponentName}
                  </div>
                  <h3 className="text-3xl font-extrabold text-gray-900 mt-1">{scores.player2} pairs</h3>
                  {currentPlayer === 2 && <span className="text-xs font-bold text-green-600 block mt-1">● TURN</span>}
                </div>
              </div>
            </div>

            {/* --- Debug Toggle for Bot Memory (AI modes only) --- */}
            {opponentType !== OpponentTypes.PLAYER2 && opponentType !== OpponentTypes.RANDOMIZER && (
              <div className="text-center mb-4">
                <button
                  onClick={() => setShowDebugMemory(prev => !prev)}
                  className={`text-xs font-medium py-1 px-3 rounded-full transition flex items-center mx-auto gap-1 ${showDebugMemory ? 'bg-red-100 text-red-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                >
                  <Eye size={14} />
                  {showDebugMemory ? 'Hide Bot Memory (Cheat Mode ON)' : 'Show Bot Memory (Debug)'}
                </button>
              </div>
            )}

            {/* --- Game Grid --- */}
            <div
              className={`grid gap-3 transition-opacity duration-500 ${isProcessing && currentPlayer === 2 ? 'opacity-70 pointer-events-none' : 'opacity-100'}`}
              style={{
                gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`,
              }}
            >
              {cards.map((card, index) => (
                <Card key={card.id} card={card} index={index} />
              ))}
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
