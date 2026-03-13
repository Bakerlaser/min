import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import categoriesData from '../utils/categories.json';
import { useToast } from '../context/ToastContext';
import { playSound } from '../services/audioService';
import { addPoints } from '../services/pointsService';

const LocalGame = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { addToast } = useToast();

    const category = searchParams.get('category') || 'أكل';
    const totalRounds = parseInt(searchParams.get('rounds')) || 3;

    const [players, setPlayers] = useState([]);
    const [newPlayerName, setNewPlayerName] = useState('');
    const [phase, setPhase] = useState('setup'); // setup, pass_role, playing, pass_vote, results
    const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);

    // Game State
    const [secretWord, setSecretWord] = useState('');
    const [imposterIndex, setImposterIndex] = useState(-1);
    const [questions, setQuestions] = useState([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [votes, setVotes] = useState({}); // { voterIndex: votedTargetIndex }
    const [votingPlayerIndex, setVotingPlayerIndex] = useState(0);

    // New states for fixes and features
    const [showingImposterGuess, setShowingImposterGuess] = useState(false);
    const [guessResult, setGuessResult] = useState('');
    const [showSecretWord, setShowSecretWord] = useState(false);
    const [currentRound, setCurrentRound] = useState(1);
    const [scores, setScores] = useState({}); // { playerIndex: score }

    const isImposterCaught = () => {
        const voteCounts = {};
        Object.values(votes).forEach(targetIdx => {
            voteCounts[targetIdx] = (voteCounts[targetIdx] || 0) + 1;
        });

        let maxVotes = 0;
        let votedOutIdx = -1;
        Object.entries(voteCounts).forEach(([idx, count]) => {
            if (count > maxVotes) {
                maxVotes = count;
                votedOutIdx = parseInt(idx);
            }
        });

        return votedOutIdx === imposterIndex;
    };

    const getGuessOptions = () => {
        const wordList = categoriesData[category] || categoriesData['أكل'];
        // Return 6 random words including the secret word
        const options = [secretWord];
        const others = wordList.filter(w => w !== secretWord);
        for (let i = 0; i < 5; i++) {
            const randomIdx = Math.floor(Math.random() * others.length);
            options.push(others.splice(randomIdx, 1)[0]);
        }
        return options.sort(() => Math.random() - 0.5);
    };

    const handleAddPlayer = () => {
        playSound('click');
        if (!newPlayerName.trim()) return;
        if (players.includes(newPlayerName.trim())) {
            playSound('error');
            return addToast('الاسم موجود مسبقاً', 'error');
        }
        if (players.length >= 12) {
            playSound('error');
            return addToast('الحد الأقصى 12 لاعب', 'error');
        }
        setPlayers([...players, newPlayerName.trim()]);
        setNewPlayerName('');
    };

    const handleRemovePlayer = (name) => {
        setPlayers(players.filter(p => p !== name));
    };

    const handleImposterGuess = (word) => {
        playSound('click');
        if (word === secretWord) {
            playSound('success');
            addPoints(20);
            setScores(prev => ({ ...prev, [imposterIndex]: (prev[imposterIndex] || 0) + 1 }));
            setGuessResult('correct');
        } else {
            playSound('error');
            // Give points to everyone else
            const newScores = { ...scores };
            players.forEach((_, idx) => {
                if (idx !== imposterIndex) {
                    newScores[idx] = (newScores[idx] || 0) + 1;
                }
            });
            setScores(newScores);
            setGuessResult('wrong');
        }
    };
    const startGame = () => {
        playSound('click');
        if (players.length < 3) {
            playSound('error');
            return addToast('تحتاج 3 لاعبين على الأقل', 'error');
        }
        setupRound(1);
    };

    const setupRound = (roundNum) => {
        // Reset states for new round
        setShowingImposterGuess(false);
        setGuessResult('');
        setShowSecretWord(false);
        setVotes({});
        setCurrentRound(roundNum);

        // Choose word
        const wordList = categoriesData[category] || categoriesData['أكل'];
        const word = wordList[Math.floor(Math.random() * wordList.length)];
        setSecretWord(word);

        // Choose imposter - Completely random selection
        const impIndex = Math.floor(Math.random() * players.length);
        setImposterIndex(impIndex);

        // Generate 20 varied questions
        const allPossiblePairs = [];
        for (let i = 0; i < players.length; i++) {
            for (let j = 0; j < players.length; j++) {
                if (i !== j) {
                    allPossiblePairs.push({ asker: i, responder: j });
                }
            }
        }

        // Shuffle pairs
        for (let i = allPossiblePairs.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allPossiblePairs[i], allPossiblePairs[j]] = [allPossiblePairs[j], allPossiblePairs[i]];
        }

        // Select 20 questions (repeat if necessary but shuffles ensure variety)
        let generatedQuestions = [];
        for (let i = 0; i < 20; i++) {
            generatedQuestions.push(allPossiblePairs[i % allPossiblePairs.length]);
        }

        // Proper Fisher-Yates Shuffle for the 20 questions
        for (let i = generatedQuestions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [generatedQuestions[i], generatedQuestions[j]] = [generatedQuestions[j], generatedQuestions[i]];
        }

        // Prevent consecutive same-asker (if possible)
        for (let i = 1; i < generatedQuestions.length; i++) {
            if (generatedQuestions[i].asker === generatedQuestions[i - 1].asker) {
                // Try to find a later question with a different asker to swap with
                for (let k = i + 1; k < generatedQuestions.length; k++) {
                    if (generatedQuestions[k].asker !== generatedQuestions[i - 1].asker) {
                        [generatedQuestions[i], generatedQuestions[k]] = [generatedQuestions[k], generatedQuestions[i]];
                        break;
                    }
                }
            }
        }

        setQuestions(generatedQuestions);

        playSound('start');
        setPhase('pass_role');
        setCurrentPlayerIndex(0);
    };

    const finishRoles = () => {
        setPhase('playing');
        setCurrentQuestionIndex(0);
    };

    const nextQuestion = () => {
        playSound('click');
        if (currentQuestionIndex + 1 < questions.length) {
            setCurrentQuestionIndex(prev => prev + 1);
        } else {
            playSound('vote');
            setPhase('pass_vote');
            setVotingPlayerIndex(0);
        }
    };

    const handleVote = (targetIndex) => {
        playSound('click');
        setVotes(prev => ({ ...prev, [votingPlayerIndex]: targetIndex }));
        if (votingPlayerIndex + 1 < players.length) {
            setCurrentPlayerIndex(prev => prev + 1); // Not really used but good to increment
            setPhase('pass_vote');
            setVotingPlayerIndex(prev => prev + 1);
        } else {
            playSound('start');
            setPhase('results');
        }
    };

    return (
        <div className="flex-col h-full justify-center">
            <AnimatePresence mode="wait">
                <motion.div
                    key={phase}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="w-full flex-col gap-4"
                >
                    {/* 1. SETUP */}
                    {phase === 'setup' && (
                        <div className="glass-panel text-center">
                            <h2 className="text-gradient">لعب محلي (جهاز واحد)</h2>
                            <p>القسم: {category} | الجولة: {currentRound} من {totalRounds}</p>

                            <div className="input-group mt-4">
                                <label>أضف أسماء اللاعبين:</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text" className="input-field"
                                        value={newPlayerName}
                                        onChange={(e) => setNewPlayerName(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && handleAddPlayer()}
                                        placeholder="اسم اللاعب..."
                                    />
                                    <button className="btn btn-secondary" onClick={handleAddPlayer}>+</button>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2 mt-4 justify-center">
                                {players.map(p => (
                                    <div key={p} className="glass-panel flex items-center gap-2" style={{ padding: '0.5rem 1rem' }}>
                                        <span>{p}</span>
                                        <button onClick={() => handleRemovePlayer(p)} style={{ background: 'none', border: 'none', color: 'var(--danger-color)' }}>✖</button>
                                    </div>
                                ))}
                            </div>

                            <button className="btn btn-primary mt-8 btn-full" onClick={startGame}>
                                بدء توزيع الأدوار 🎭
                            </button>
                        </div>
                    )}

                    {/* 2. PASS ROLE */}
                    {phase === 'pass_role' && (
                        <div className="glass-panel text-center py-12 flex-col items-center">
                            <div style={{ fontSize: '4rem' }}>🎭</div>
                            <h2>مرر الجهاز إلى <span className="text-gradient">{players[currentPlayerIndex]}</span></h2>
                            <p>اكشف دورك سراً ولا تظهره لأحد!</p>

                            {showSecretWord ? (
                                <motion.div
                                    initial={{ scale: 0.5, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    className="glass-panel mt-8"
                                    style={{ padding: '2rem', background: 'rgba(255,255,255,0.1)', border: '2px solid var(--primary-color)' }}
                                >
                                    <h3 style={{ marginBottom: '1rem' }}>دورك هو:</h3>
                                    <h1 className="text-gradient" style={{ fontSize: '2.5rem' }}>
                                        {currentPlayerIndex === imposterIndex ? 'أنت برا السالفة! 👀' : secretWord}
                                    </h1>
                                    <button className="btn btn-secondary mt-6" onClick={() => setShowSecretWord(false)}>إخفاء ✅</button>
                                </motion.div>
                            ) : (
                                <button className="btn btn-secondary mt-8" onClick={() => setShowSecretWord(true)}>
                                    كشف الدور 👀
                                </button>
                            )}

                            {!showSecretWord && (
                                <button className="btn btn-primary mt-4 btn-full" onClick={() => {
                                    if (currentPlayerIndex + 1 < players.length) {
                                        setCurrentPlayerIndex(prev => prev + 1);
                                    } else {
                                        finishRoles();
                                    }
                                }}>
                                    {currentPlayerIndex + 1 < players.length ? 'اللاعب التالي ➡' : 'بدء اللعب 🚀'}
                                </button>
                            )}
                        </div>
                    )}

                    {/* 3. PLAYING (Questions) */}
                    {phase === 'playing' && questions[currentQuestionIndex] && (
                        <div className="flex-col gap-4">
                            <div className="glass-panel text-center py-8">
                                <p>السؤال {currentQuestionIndex + 1} من {questions.length}</p>
                                <h2 className="text-gradient mt-4">
                                    {players[questions[currentQuestionIndex].asker]} يسأل {players[questions[currentQuestionIndex].responder]}
                                </h2>
                                <div style={{ padding: '1.5rem', background: 'rgba(0,0,0,0.3)', borderRadius: '12px', margin: '1.5rem 0' }}>
                                    <p style={{ fontStyle: 'italic' }}>"اسأل سؤالاً ذكياً لتكشف أو تتويه الآخرين"</p>
                                </div>
                                <button className="btn btn-primary btn-full" onClick={nextQuestion}>
                                    {currentQuestionIndex + 1 < questions.length ? 'السؤال التالي ⏭️' : 'بدء التصويت السري 🗳️'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* 4. PASS VOTE (Individual Secret Voting) */}
                    {phase === 'pass_vote' && (
                        <div className="glass-panel text-center py-12 flex-col items-center">
                            <div style={{ fontSize: '4rem' }}>🗳️</div>
                            <h2>مرر الجهاز إلى <span className="text-gradient">{players[votingPlayerIndex]}</span></h2>
                            <p>اختر الشخص الذي تعتقد أنه "برا السالفة" سراً</p>

                            <div className="flex-col gap-2 w-full mt-8">
                                {players.map((p, idx) => (
                                    idx !== votingPlayerIndex && (
                                        <button key={p} className="btn btn-secondary" onClick={() => handleVote(idx)}>
                                            {p}
                                        </button>
                                    )
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 5. RESULTS AND GUESSING */}
                    {phase === 'results' && (
                        <div className="glass-panel text-center py-8">
                            {!showingImposterGuess ? (
                                <>
                                    <div className="flex justify-between items-center mb-4">
                                        <h2 className="text-gradient">نتائج الجولة {currentRound}</h2>
                                        <span className="glass-panel" style={{ padding: '0.2rem 0.6rem' }}>الجولة {currentRound}/{totalRounds}</span>
                                    </div>
                                    <div style={{ margin: '1rem 0', padding: '1.5rem', background: 'rgba(0,0,0,0.3)', borderRadius: '12px' }}>
                                        <p>اللاعب الذي كان "برا السالفة" هو:</p>
                                        <h1 style={{ color: 'var(--danger-color)', fontSize: '2.5rem' }}>{players[imposterIndex]}</h1>
                                    </div>

                                    {isImposterCaught() ? (
                                        <div className="flex-col gap-4">
                                            <p className="text-gradient" style={{ fontWeight: 'bold' }}>لقد تم كشفك! يا {players[imposterIndex]}</p>
                                            <p>لديك فرصة واحدة لتخمين الكلمة السرية والفوز بالجولة:</p>
                                            <div className="flex flex-wrap gap-2 justify-center mt-4">
                                                {getGuessOptions().map(word => (
                                                    <button key={word} className="btn btn-secondary" onClick={() => {
                                                        handleImposterGuess(word);
                                                        setShowingImposterGuess(true);
                                                    }}>
                                                        {word}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex-col gap-4">
                                            <p style={{ color: 'var(--danger-color)', fontWeight: 'bold' }}>لقد فاز "برا السالفة"! لم يتم كشفه.</p>
                                            <p>الكلمة السرية كانت: <strong>{secretWord}</strong></p>

                                            {currentRound < totalRounds ? (
                                                <button className="btn btn-primary btn-full mt-8" onClick={() => {
                                                    // Update scores if not already done
                                                    const newScores = { ...scores };
                                                    newScores[imposterIndex] = (newScores[imposterIndex] || 0) + 1;
                                                    setScores(newScores);
                                                    setupRound(currentRound + 1);
                                                }}>
                                                    الجولة التالية ⏭️
                                                </button>
                                            ) : (
                                                <button className="btn btn-primary btn-full mt-8" onClick={() => navigate('/')}>
                                                    نهاية اللعبة - العودة للرئيسية
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="flex-col gap-6">
                                    <h2 className="text-gradient">النتيجة النهائية للجولة</h2>
                                    {guessResult === 'correct' ? (
                                        <div style={{ padding: '2rem', background: 'rgba(16, 185, 129, 0.2)', borderRadius: '12px' }}>
                                            <h1 style={{ color: 'var(--success-color)' }}>تخمين صحيح! ✅</h1>
                                            <p>رغم كشفك، استطعت معرفة السالفة والفوز!</p>
                                        </div>
                                    ) : (
                                        <div style={{ padding: '2rem', background: 'rgba(239, 68, 68, 0.2)', borderRadius: '12px' }}>
                                            <h1 style={{ color: 'var(--danger-color)' }}>تخمين خاطئ! ❌</h1>
                                            <p>الكلمة كانت: {secretWord}</p>
                                            <p>فاز بقية اللاعبين بالجولة!</p>
                                        </div>
                                    )}

                                    <div className="glass-panel mt-4">
                                        <h3>جدول النقاط الحالي:</h3>
                                        <div className="flex flex-wrap gap-2 justify-center mt-2">
                                            {players.map((p, idx) => (
                                                <div key={p} className="glass-panel" style={{ padding: '0.3rem 0.6rem', fontSize: '0.9rem' }}>
                                                    {p}: {scores[idx] || 0}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {currentRound < totalRounds ? (
                                        <button className="btn btn-primary btn-full mt-8" onClick={() => setupRound(currentRound + 1)}>
                                            الجولة التالية ⏭️
                                        </button>
                                    ) : (
                                        <button className="btn btn-primary btn-full mt-8" onClick={() => navigate('/')}>
                                            نهاية اللعبة - العودة للرئيسية
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                </motion.div>
            </AnimatePresence>
        </div>
    );
};

export default LocalGame;
