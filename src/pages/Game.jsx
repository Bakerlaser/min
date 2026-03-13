import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { subscribeToRoom } from '../services/gameService';
import { ref, update, getDatabase, onValue } from 'firebase/database';
import { playSound } from '../services/audioService';
import { getPoints, deductPoints } from '../services/pointsService';
import { useToast } from '../context/ToastContext';

const Game = () => {
    const { roomId } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const playerId = searchParams.get('playerId');
    const isHost = playerId === 'host';

    const [roomData, setRoomData] = useState(null);
    const [timeLeft, setTimeLeft] = useState(30);
    const [questionText, setQuestionText] = useState('');
    const [answerText, setAnswerText] = useState('');
    const { addToast } = useToast();
    const points = getPoints();

    // Sync with Firebase
    useEffect(() => {
        if (!roomId) return;
        const unsub = subscribeToRoom(roomId, (data) => {
            if (!data) return navigate('/');
            setRoomData(data);
            if (data.status === 'voting') {
                navigate(`/vote/${roomId}?playerId=${playerId}`);
            }
        });
        return unsub;
    }, [roomId, navigate, playerId]);

    // Local Timer (simplified: host purely drives the index down, but for visual we just use local decrement based on index)
    // In a robust app, we'd store exact timestamp in Firebase and calculate difference.
    useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeft(prev => prev > 0 ? prev - 1 : 0);
        }, 1000);
        return () => clearInterval(timer);
    }, [roomData?.gameState?.currentQuestionIndex]); // Reset timer on new question

    if (!roomData || !roomData.gameState) {
        return <div className="glass-panel text-center animate-pulse">جاري تحميل اللعبة...</div>;
    }

    const { gameState, settings } = roomData;
    const isImposter = gameState.imposterId === playerId;
    const secretWord = gameState.secretWord;
    const category = settings.category;

    const questionIndex = gameState.currentQuestionIndex || 0;
    const questionsList = gameState.questions || [];
    const currentQuestion = questionsList[questionIndex];
    const totalQuestions = questionsList.length;

    const handleNextQuestion = async () => {
        if (!isHost) return;
        const db = getDatabase();

        if (questionIndex + 1 < totalQuestions) {
            playSound('click');
            await update(ref(db, `rooms/${roomId}/gameState`), {
                currentQuestionIndex: questionIndex + 1,
                lastQuestion: null,
                lastAnswer: null,
                isPrivate: false
            });
            setTimeLeft(30);
        } else {
            playSound('vote');
            await update(ref(db, `rooms/${roomId}`), {
                status: 'voting'
            });
        }
    };

    const submitQuestion = async (isPrivate = false) => {
        if (!questionText.trim()) return;
        if (isPrivate) {
            if (!deductPoints(30)) {
                return addToast('ليس لديك نقاط كافية للسؤال الخاص (30 نقطة)', 'error');
            }
        }

        const db = getDatabase();
        await update(ref(db, `rooms/${roomId}/gameState`), {
            lastQuestion: questionText,
            isPrivate: isPrivate
        });
        setQuestionText('');
        playSound('success');
    };

    const submitAnswer = async () => {
        if (!answerText.trim()) return;
        const db = getDatabase();
        await update(ref(db, `rooms/${roomId}/gameState`), {
            lastAnswer: answerText
        });
        setAnswerText('');
        playSound('success');
    };

    return (
        <div className="flex-col h-full">
            {/* Top Bar Status */}
            <div className="flex justify-between items-center mb-4">
                <div className="glass-panel" style={{ padding: '0.5rem 1rem' }}>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>القسم</p>
                    <h3 style={{ margin: 0 }}>{category}</h3>
                </div>

                <div className="glass-panel text-center" style={{ padding: '0.5rem 1rem', borderColor: isImposter ? 'var(--danger-color)' : 'var(--primary-color)' }}>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>الكلمة السرية</p>
                    <h3 style={{ margin: 0, color: isImposter ? 'var(--danger-color)' : 'var(--success-color)' }}>
                        {isImposter ? "أنت برا السالفة! 👀" : secretWord}
                    </h3>
                </div>
            </div>

            {/* Progress Bar */}
            <div style={{ marginBottom: '2rem' }}>
                <div className="flex justify-between" style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                    <span>السؤال {questionIndex + 1}</span>
                    <span>المتبقي {totalQuestions - (questionIndex + 1)}</span>
                </div>
                <div style={{ width: '100%', height: '8px', background: 'var(--glass-bg)', borderRadius: '4px', overflow: 'hidden' }}>
                    <motion.div
                        style={{ height: '100%', background: 'linear-gradient(90deg, var(--primary-color), var(--secondary-color))' }}
                        initial={{ width: `${(questionIndex / totalQuestions) * 100}%` }}
                        animate={{ width: `${((questionIndex + 1) / totalQuestions) * 100}%` }}
                        transition={{ duration: 0.5 }}
                    />
                </div>
            </div>

            {/* Main Question Card Area */}
            {currentQuestion && (
                <div className="flex-col justify-center gap-4" style={{ flexGrow: 1 }}>
                    <AnimatePresence mode="popLayout">
                        <motion.div
                            key={questionIndex}
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: -20 }}
                            className="glass-panel text-center"
                            style={{
                                padding: '2rem',
                                boxShadow: timeLeft < 10 ? '0 0 20px rgba(239, 68, 68, 0.4)' : 'var(--glass-shadow)',
                                transition: 'box-shadow 0.3s'
                            }}
                        >
                            <div className="flex justify-between items-center mb-4">
                                <div style={{
                                    width: '50px', height: '50px',
                                    borderRadius: '50%', border: '3px solid var(--primary-color)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '1.2rem', fontWeight: 'bold',
                                    color: timeLeft < 10 ? 'var(--danger-color)' : 'white'
                                }}>
                                    {timeLeft}
                                </div>
                                {gameState.isPrivate && <span className="glass-panel" style={{ padding: '0.3rem 0.6rem', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger-color)', fontSize: '0.8rem' }}>🔒 سؤال خاص</span>}
                            </div>

                            <h2 className="text-gradient">السائل: {currentQuestion.askerName}</h2>
                            <p style={{ fontSize: '1.1rem' }}>إلى: <strong>{currentQuestion.responderName}</strong></p>

                            <div className="mt-6">
                                {/* ASKER VIEW */}
                                {playerId === currentQuestion.askerId && !gameState.lastQuestion && (
                                    <div className="flex-col gap-2">
                                        <input
                                            type="text" className="input-field" placeholder="اكتب سؤالك هنا..."
                                            value={questionText} onChange={(e) => setQuestionText(e.target.value)}
                                        />
                                        <div className="flex gap-2">
                                            <button className="btn btn-primary flex-1" onClick={() => submitQuestion(false)}>إرسال (مجاني)</button>
                                            <button className="btn btn-secondary flex-1" onClick={() => submitQuestion(true)} style={{ fontSize: '0.9rem' }}>سؤال خاص (30💰)</button>
                                        </div>
                                    </div>
                                )}

                                {/* RESPONDER VIEW AND RESULTS */}
                                {gameState.lastQuestion && (
                                    <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.3)', borderRadius: '8px' }}>
                                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>السؤال:</p>
                                        <p style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
                                            {gameState.isPrivate && (playerId !== currentQuestion.askerId && playerId !== currentQuestion.responderId)
                                                ? "🤐 سؤال سري لا يراه إلا المجيب..."
                                                : gameState.lastQuestion}
                                        </p>

                                        {/* Answer input for responder */}
                                        {playerId === currentQuestion.responderId && !gameState.lastAnswer && (
                                            <div className="flex-col gap-2 mt-4">
                                                <input
                                                    type="text" className="input-field" placeholder="اكتب إجابتك..."
                                                    value={answerText} onChange={(e) => setAnswerText(e.target.value)}
                                                />
                                                <button className="btn btn-primary btn-full" onClick={submitAnswer}>إرسال الإجابة</button>
                                            </div>
                                        )}

                                        {/* Display answer to everyone */}
                                        {gameState.lastAnswer && (
                                            <div className="mt-4" style={{ paddingTop: '1rem', borderTop: '1px solid var(--glass-border)' }}>
                                                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>الإجابة:</p>
                                                <p style={{ fontSize: '1.1rem', color: 'var(--success-color)', fontWeight: 'bold' }}>{gameState.lastAnswer}</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {!gameState.lastQuestion && playerId !== currentQuestion.askerId && (
                                    <p className="animate-pulse">ننتظر السائل لكتابة سؤاله...</p>
                                )}
                            </div>
                        </motion.div>
                    </AnimatePresence>
                </div>
            )}

            {/* Controls */}
            <div className="mt-8">
                {isHost ? (
                    <button className="btn btn-primary btn-full" onClick={handleNextQuestion}>
                        {questionIndex + 1 < totalQuestions ? 'السؤال التالي ⏭️' : 'انهاء وبدء التصويت 🗳️'}
                    </button>
                ) : (
                    <div className="glass-panel text-center">
                        <p className="animate-pulse" style={{ margin: 0 }}>ننتظر المضيف للانتقال للسؤال التالي...</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Game;
