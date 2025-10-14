import React, { useState, useEffect } from 'react';
import { Brain, Users, Shuffle, RotateCcw } from 'lucide-react';

const OpponentTypes = {
  PLAYER2: 'Player 2',
  RANDOMIZER: 'Randomizer',
  BOT0: 'Bot (Level 0)',
  BOT1: 'Bot (Level 1)',
  BOT2: 'Bot (Level 2)',
  BOT3: 'Bot (Level 3)',
  BOT4: 'Bot (Level 4)',
};

// Comprehensive kanji library with authentic data
const KANJI_LIBRARY = [
  { kanji: '日', meaning: 'sun, day', kun: 'ひ、か', on: 'ニチ、ジツ' },
  { kanji: '月', meaning: 'moon, month', kun: 'つき', on: 'ゲツ、ガツ' },
  { kanji: '火', meaning: 'fire', kun: 'ひ', on: 'カ' },
  { kanji: '水', meaning: 'water', kun: 'みず', on: 'スイ' },
  { kanji: '木', meaning: 'tree, wood', kun: 'き、こ', on: 'モク、ボク' },
  { kanji: '金', meaning: 'gold, metal', kun: 'かね、かな', on: 'キン、コン' },
  { kanji: '土', meaning: 'earth, soil', kun: 'つち', on: 'ド、ト' },
  { kanji: '山', meaning: 'mountain', kun: 'やま', on: 'サン、セン' },
  { kanji: '川', meaning: 'river', kun: 'かわ', on: 'セン' },
  { kanji: '森', meaning: 'forest', kun: 'もり', on: 'シン' },
  { kanji: '海', meaning: 'sea, ocean', kun: 'うみ', on: 'カイ' },
  { kanji: '空', meaning: 'sky, empty', kun: 'そら、あ-く', on: 'クウ' },
  { kanji: '花', meaning: 'flower', kun: 'はな', on: 'カ' },
  { kanji: '雨', meaning: 'rain', kun: 'あめ、あま', on: 'ウ' },
  { kanji: '雪', meaning: 'snow', kun: 'ゆき', on: 'セツ' },
  { kanji: '風', meaning: 'wind', kun: 'かぜ、かざ', on: 'フウ、フ' },
  { kanji: '石', meaning: 'stone', kun: 'いし', on: 'セキ、シャク' },
  { kanji: '竹', meaning: 'bamboo', kun: 'たけ', on: 'チク' },
  { kanji: '犬', meaning: 'dog', kun: 'いぬ', on: 'ケン' },
  { kanji: '猫', meaning: 'cat', kun: 'ねこ', on: 'ビョウ' },
  { kanji: '鳥', meaning: 'bird', kun: 'とり', on: 'チョウ' },
  { kanji: '魚', meaning: 'fish', kun: 'さかな、うお', on: 'ギョ' },
  { kanji: '人', meaning: 'person', kun: 'ひと', on: 'ジン、ニン' },
  { kanji: '子', meaning: 'child', kun: 'こ', on: 'シ、ス' },
  { kanji: '男', meaning: 'man, male', kun: 'おとこ', on: 'ダン、ナン' },
  { kanji: '女', meaning: 'woman, female', kun: 'おんな、め', on: 'ジョ、ニョ' },
  { kanji: '手', meaning: 'hand', kun: 'て、た', on: 'シュ' },
  { kanji: '足', meaning: 'foot, leg', kun: 'あし、た-りる', on: 'ソク' },
  { kanji: '目', meaning: 'eye', kun: 'め、ま', on: 'モク、ボク' },
  { kanji: '口', meaning: 'mouth', kun: 'くち', on: 'コウ、ク' },
  { kanji: '心', meaning: 'heart, mind', kun: 'こころ', on: 'シン' },
  { kanji: '力', meaning: 'power, strength', kun: 'ちから', on: 'リョク、リキ' },
  { kanji: '田', meaning: 'rice field', kun: 'た', on: 'デン' },
  { kanji: '草', meaning: 'grass', kun: 'くさ', on: 'ソウ' },
  { kanji: '虫', meaning: 'insect', kun: 'むし', on: 'チュウ' },
  { kanji: '星', meaning: 'star', kun: 'ほし', on: 'セイ、ショウ' },
  { kanji: '光', meaning: 'light', kun: 'ひかり、ひか-る', on: 'コウ' },
  { kanji: '雲', meaning: 'cloud', kun: 'くも', on: 'ウン' },
  { kanji: '池', meaning: 'pond', kun: 'いけ', on: 'チ' },
  { kanji: '門', meaning: 'gate', kun: 'かど', on: 'モン' },
  { kanji: '音', meaning: 'sound', kun: 'おと、ね', on: 'オン、イン' },
  { kanji: '色', meaning: 'color', kun: 'いろ', on: 'シキ、ショク' },
  { kanji: '形', meaning: 'shape, form', kun: 'かたち、かた', on: 'ケイ、ギョウ' },
  { kanji: '糸', meaning: 'thread', kun: 'いと', on: 'シ' },
  { kanji: '紙', meaning: 'paper', kun: 'かみ', on: 'シ' },
  { kanji: '本', meaning: 'book, origin', kun: 'もと', on: 'ホン' },
  { kanji: '字', meaning: 'character', kun: 'あざ', on: 'ジ' },
  { kanji: '言', meaning: 'say, word', kun: 'い-う、こと', on: 'ゲン、ゴン' },
  { kanji: '話', meaning: 'talk, story', kun: 'はな-す、はなし', on: 'ワ' },
  { kanji: '文', meaning: 'sentence, text', kun: 'ふみ', on: 'ブン、モン' },
  { kanji: '読', meaning: 'read', kun: 'よ-む', on: 'ドク、トク' },
  { kanji: '書', meaning: 'write', kun: 'か-く', on: 'ショ' },
  { kanji: '学', meaning: 'study, learning', kun: 'まな-ぶ', on: 'ガク' },
  { kanji: '校', meaning: 'school', kun: '', on: 'コウ' },
  { kanji: '先', meaning: 'before, ahead', kun: 'さき', on: 'セン' },
  { kanji: '生', meaning: 'life, birth', kun: 'い-きる、う-まれる', on: 'セイ、ショウ' },
  { kanji: '今', meaning: 'now', kun: 'いま', on: 'コン、キン' },
  { kanji: '明', meaning: 'bright', kun: 'あか-るい、あ-ける', on: 'メイ、ミョウ' },
  { kanji: '暗', meaning: 'dark', kun: 'くら-い', on: 'アン' },
  { kanji: '早', meaning: 'early', kun: 'はや-い', on: 'ソウ、サッ' },
  { kanji: '遅', meaning: 'late, slow', kun: 'おそ-い、おく-れる', on: 'チ' },
  { kanji: '長', meaning: 'long, leader', kun: 'なが-い', on: 'チョウ' },
  { kanji: '短', meaning: 'short', kun: 'みじか-い', on: 'タン' },
  { kanji: '高', meaning: 'high, tall', kun: 'たか-い', on: 'コウ' },
  { kanji: '低', meaning: 'low', kun: 'ひく-い', on: 'テイ' },
  { kanji: '大', meaning: 'big, large', kun: 'おお-きい', on: 'ダイ、タイ' },
  { kanji: '小', meaning: 'small, little', kun: 'ちい-さい、こ', on: 'ショウ' },
  { kanji: '多', meaning: 'many, much', kun: 'おお-い', on: 'タ' },
  { kanji: '少', meaning: 'few, little', kun: 'すく-ない、すこ-し', on: 'ショウ' },
  { kanji: '古', meaning: 'old', kun: 'ふる-い', on: 'コ' },
];


export default function KanjiMemoryGame() {
  const [gridSize, setGridSize] = useState(8);
  const [cards, setCards] = useState([]);
  const [flippedIndices, setFlippedIndices] = useState([]);
  const [matchedPairs, setMatchedPairs] = useState(new Set());
  const [currentPlayer, setCurrentPlayer] = useState(1);
  const [scores, setScores] = useState({ player1: 0, player2: 0 });
  const [opponentType, setOpponentType] = useState(OpponentTypes.BOT1);
  const [gameStarted, setGameStarted] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [botMemory, setBotMemory] = useState({});
  const [previousKanji, setPreviousKanji] = useState(null);
  const [reuseKanji, setReuseKanji] = useState(false);

  const initializeGame = () => {
    const totalCards = gridSize * gridSize;
    const pairsNeeded = totalCards / 2;
    
    let selectedKanji;
    
    if (reuseKanji && previousKanji && previousKanji.length >= pairsNeeded) {
      selectedKanji = previousKanji.slice(0, pairsNeeded);
    } else {
      const shuffledLibrary = [...KANJI_LIBRARY].sort(() => Math.random() - 0.5);
      selectedKanji = shuffledLibrary.slice(0, pairsNeeded);
      setPreviousKanji(selectedKanji);
    }
    
    const cardPairs = selectedKanji.flatMap((k, idx) => [
      { id: idx * 2, kanjiId: idx, ...k },
      { id: idx * 2 + 1, kanjiId: idx, ...k }
    ]);
    
    const shuffled = cardPairs.sort(() => Math.random() - 0.5);
    setCards(shuffled);
    setFlippedIndices([]);
    setMatchedPairs(new Set());
    setCurrentPlayer(1);
    setScores({ player1: 0, player2: 0 });
    setGameStarted(true);
    setBotMemory({});
    setReuseKanji(false);
  };

  const handleCardClick = (index) => {
    if (isProcessing || flippedIndices.includes(index) || matchedPairs.has(cards[index].kanjiId)) {
      return;
    }
    
    if (currentPlayer === 2 && opponentType !== OpponentTypes.PLAYER2) {
      return;
    }
    
    if (flippedIndices.length < 2) {
      setFlippedIndices([...flippedIndices, index]);
    }
  };

  useEffect(() => {
    if (flippedIndices.length === 2) {
      setIsProcessing(true);
      const [idx1, idx2] = flippedIndices;
      const card1 = cards[idx1];
      const card2 = cards[idx2];
      
      setTimeout(() => {
        if (card1.kanjiId === card2.kanjiId) {
          setMatchedPairs(prev => new Set([...prev, card1.kanjiId]));
          setScores(prev => ({
            ...prev,
            [`player${currentPlayer}`]: prev[`player${currentPlayer}`] + 1
          }));
          setFlippedIndices([]);
          setIsProcessing(false);
        } else {
          setTimeout(() => {
            setFlippedIndices([]);
            setCurrentPlayer(currentPlayer === 1 ? 2 : 1);
            setIsProcessing(false);
          }, 1000);
        }
      }, 1000);
    }
  }, [flippedIndices]);

  useEffect(() => {
    if (currentPlayer === 2 && gameStarted && !isProcessing && opponentType !== OpponentTypes.PLAYER2) {
      setTimeout(() => {
        performOpponentTurn();
      }, 1000);
    }
  }, [currentPlayer, gameStarted, isProcessing]);

  const getRandomUnmatchedIndex = () => {
    const unmatched = cards
      .map((c, idx) => ({ card: c, idx }))
      .filter(({ card, idx }) => !matchedPairs.has(card.kanjiId) && !flippedIndices.includes(idx));
    return unmatched[Math.floor(Math.random() * unmatched.length)]?.idx;
  };

  const getRandomNewCard = () => {
    const unknown = cards
      .map((c, idx) => ({ card: c, idx }))
      .filter(({ card, idx }) => !matchedPairs.has(card.kanjiId) && !botMemory[idx] && !flippedIndices.includes(idx));
    return unknown[Math.floor(Math.random() * unknown.length)]?.idx;
  };

  const getRandomKnownCard = () => {
    const known = cards
      .map((c, idx) => ({ card: c, idx }))
      .filter(({ card, idx }) => !matchedPairs.has(card.kanjiId) && botMemory[idx] && !flippedIndices.includes(idx));
    return known[Math.floor(Math.random() * known.length)]?.idx;
  };

  const getKnownPairCard = () => {
    const known = Object.keys(botMemory).map(k => parseInt(k));
    for (let idx of known) {
      if (matchedPairs.has(cards[idx].kanjiId) || flippedIndices.includes(idx)) continue;
      const kanjiId = cards[idx].kanjiId;
      const pairIdx = cards.findIndex((c, i) => c.kanjiId === kanjiId && i !== idx && botMemory[i] && !matchedPairs.has(c.kanjiId) && !flippedIndices.includes(i));
      if (pairIdx !== -1) return idx;
    }
    return null;
  };

  const performOpponentTurn = () => {
    setIsProcessing(true);
    
    let firstCard, secondCard;

    if (opponentType === OpponentTypes.RANDOMIZER) {
      firstCard = getRandomUnmatchedIndex();
      setFlippedIndices([firstCard]);
      
      setTimeout(() => {
        secondCard = getRandomUnmatchedIndex();
        setFlippedIndices([firstCard, secondCard]);
        updateBotMemory(firstCard, secondCard);
      }, 800);
      return;
    }

    if (opponentType === OpponentTypes.BOT0) {
      firstCard = getRandomNewCard() ?? getRandomUnmatchedIndex();
      setFlippedIndices([firstCard]);
      
      setTimeout(() => {
        const firstKanjiId = cards[firstCard].kanjiId;
        const matchIdx = cards.findIndex((c, i) => c.kanjiId === firstKanjiId && i !== firstCard && botMemory[i]);
        
        if (matchIdx !== -1 && Math.random() < 0.2) {
          secondCard = matchIdx;
        } else {
          secondCard = getRandomUnmatchedIndex();
        }
        setFlippedIndices([firstCard, secondCard]);
        updateBotMemory(firstCard, secondCard);
      }, 800);
      return;
    }

    if (opponentType === OpponentTypes.BOT1) {
      firstCard = getRandomNewCard() ?? getRandomUnmatchedIndex();
      setFlippedIndices([firstCard]);
      
      setTimeout(() => {
        const firstKanjiId = cards[firstCard].kanjiId;
        const matchIdx = cards.findIndex((c, i) => c.kanjiId === firstKanjiId && i !== firstCard && botMemory[i]);
        
        if (matchIdx !== -1 && Math.random() < 0.3) {
          secondCard = matchIdx;
        } else {
          const rand = Math.random();
          if (rand < 0.75) {
            secondCard = getRandomNewCard() ?? getRandomUnmatchedIndex();
          } else {
            secondCard = getRandomKnownCard() ?? getRandomUnmatchedIndex();
          }
        }
        setFlippedIndices([firstCard, secondCard]);
        updateBotMemory(firstCard, secondCard);
      }, 800);
      return;
    }

    if (opponentType === OpponentTypes.BOT2) {
      const rand = Math.random();
      const pairCard = getKnownPairCard();
      
      if (pairCard !== null && rand < 0.5) {
        firstCard = pairCard;
      } else if (rand < 0.9) {
        firstCard = getRandomNewCard() ?? getRandomUnmatchedIndex();
      } else {
        firstCard = getRandomKnownCard() ?? getRandomUnmatchedIndex();
      }
      
      setFlippedIndices([firstCard]);
      
      setTimeout(() => {
        const firstKanjiId = cards[firstCard].kanjiId;
        const matchIdx = cards.findIndex((c, i) => c.kanjiId === firstKanjiId && i !== firstCard && botMemory[i]);
        
        if (matchIdx !== -1 && Math.random() < 0.4) {
          secondCard = matchIdx;
        } else {
          const rand2 = Math.random();
          if (rand2 < 0.3) {
            secondCard = getRandomKnownCard() ?? getRandomUnmatchedIndex();
          } else if (rand2 < 0.6) {
            secondCard = getRandomNewCard() ?? getRandomUnmatchedIndex();
          } else {
            secondCard = getRandomNewCard() ?? getRandomUnmatchedIndex();
          }
        }
        setFlippedIndices([firstCard, secondCard]);
        updateBotMemory(firstCard, secondCard);
      }, 800);
      return;
    }

    if (opponentType === OpponentTypes.BOT3) {
      const rand = Math.random();
      const pairCard = getKnownPairCard();
      
      if (pairCard !== null && rand < 0.5) {
        firstCard = pairCard;
      } else if (rand < 0.9) {
        firstCard = getRandomNewCard() ?? getRandomUnmatchedIndex();
      } else {
        firstCard = getRandomKnownCard() ?? getRandomUnmatchedIndex();
      }
      
      setFlippedIndices([firstCard]);
      
      setTimeout(() => {
        const firstKanjiId = cards[firstCard].kanjiId;
        const matchIdx = cards.findIndex((c, i) => c.kanjiId === firstKanjiId && i !== firstCard && botMemory[i]);
        
        if (matchIdx !== -1 && Math.random() < 0.7) {
          secondCard = matchIdx;
        } else {
          const rand2 = Math.random();
          if (rand2 < 0.25) {
            secondCard = getRandomKnownCard() ?? getRandomUnmatchedIndex();
          } else if (rand2 < 0.3) {
            secondCard = getRandomNewCard() ?? getRandomUnmatchedIndex();
          } else {
            secondCard = getRandomNewCard() ?? getRandomUnmatchedIndex();
          }
        }
        setFlippedIndices([firstCard, secondCard]);
        updateBotMemory(firstCard, secondCard);
      }, 800);
      return;
    }

    if (opponentType === OpponentTypes.BOT4) {
      const pairCard = getKnownPairCard();
      
      if (pairCard !== null) {
        firstCard = pairCard;
      } else if (Math.random() < 0.95) {
        firstCard = getRandomNewCard() ?? getRandomUnmatchedIndex();
      } else {
        firstCard = getRandomKnownCard() ?? getRandomUnmatchedIndex();
      }
      
      setFlippedIndices([firstCard]);
      
      setTimeout(() => {
        const firstKanjiId = cards[firstCard].kanjiId;
        const matchIdx = cards.findIndex((c, i) => c.kanjiId === firstKanjiId && i !== firstCard && botMemory[i]);
        
        if (matchIdx !== -1 && Math.random() < 0.8) {
          secondCard = matchIdx;
        } else {
          const rand2 = Math.random();
          if (rand2 < 0.75) {
            secondCard = getRandomNewCard() ?? getRandomUnmatchedIndex();
          } else {
            secondCard = getRandomKnownCard() ?? getRandomUnmatchedIndex();
          }
        }
        setFlippedIndices([firstCard, secondCard]);
        updateBotMemory(firstCard, secondCard);
      }, 800);
      return;
    }
  };

  const updateBotMemory = (idx1, idx2) => {
    setBotMemory(prev => ({
      ...prev,
      [idx1]: cards[idx1].kanjiId,
      [idx2]: cards[idx2].kanjiId
    }));
  };

  const isCardFlipped = (index) => {
    return flippedIndices.includes(index) || matchedPairs.has(cards[index]?.kanjiId);
  };

  const isGameOver = matchedPairs.size === cards.length / 2 && cards.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 to-purple-100 p-8">
      
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-indigo-900">漢字 Memory Game</h1>
          {gameStarted && (
            <button
              onClick={() => setGameStarted(false)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-indigo-700 transition flex items-center gap-2"
            >
              <RotateCcw size={20} />
              New Game
            </button>
          )}
        </div>
        
        {!gameStarted ? (
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-md mx-auto">
            <h2 className="text-2xl font-semibold mb-6 text-center">Game Setup</h2>
            
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">Grid Size: {gridSize}x{gridSize}</label>
              <input
                type="range"
                min="4"
                max="8"
                step="2"
                value={gridSize}
                onChange={(e) => setGridSize(parseInt(e.target.value))}
                className="w-full"
              />
            </div>
            
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">Opponent</label>
              <select
                value={opponentType}
                onChange={(e) => setOpponentType(e.target.value)}
                className="w-full p-2 border rounded"
              >
                {Object.values(OpponentTypes).map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            
            {previousKanji && (
              <div className="mb-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={reuseKanji}
                    onChange={(e) => setReuseKanji(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium">Use kanji from previous game</span>
                </label>
              </div>
            )}
            
            <button
              onClick={initializeGame}
              className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition"
            >
              Start Game
            </button>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold">Player 1: {scores.player1}</h3>
                  {currentPlayer === 1 && <span className="text-sm text-green-600">● Your Turn</span>}
                </div>
                <div className="text-right">
                  <h3 className="text-lg font-semibold">{opponentType}: {scores.player2}</h3>
                  {currentPlayer === 2 && <span className="text-sm text-green-600">● Turn</span>}
                </div>
              </div>
            </div>
            
            <div 
              className="grid gap-3 mb-6"
              style={{
                gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`
              }}
            >
              {cards.map((card, index) => (
                <div
                  key={card.id}
                  onClick={() => handleCardClick(index)}
                  className={`aspect-square rounded-lg shadow-md flex items-center justify-center cursor-pointer transition-all ${
                    isCardFlipped(index)
                      ? 'bg-white'
                      : 'bg-gradient-to-br from-indigo-400 to-purple-500 hover:from-indigo-500 hover:to-purple-600'
                  }`}
                >
                  {isCardFlipped(index) ? (
                    <div className="text-center p-2">
                      <div className="text-4xl mb-1">{card.kanji}</div>
                      {matchedPairs.has(card.kanjiId) && (
                        <div className="text-xs">
                          <div className="font-semibold">{card.meaning}</div>
                          <div className="text-gray-600">{card.kun}</div>
                          <div className="text-gray-500">{card.on}</div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-white text-2xl">?</div>
                  )}
                </div>
              ))}
            </div>
            
            {isGameOver && (
              <div className="bg-white rounded-lg shadow-lg p-8 text-center mb-6">
                <h2 className="text-3xl font-bold mb-4">Game Over!</h2>
                <p className="text-xl mb-6">
                  {scores.player1 > scores.player2
                    ? 'Player 1 Wins! 🎉'
                    : scores.player2 > scores.player1
                    ? `${opponentType} Wins! 🎉`
                    : "It's a Tie! 🤝"}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}