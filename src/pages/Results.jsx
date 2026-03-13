import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { subscribeToRoom, submitImposterGuess } from '../services/gameService';
import { useToast } from '../context/ToastContext';
import { playSound } from '../services/audioService';
import { getPoints, addPoints } from '../services/pointsService';
import { useState, useEffect } from 'react';

const Results = () => {
    const { roomId } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { addToast } = useToast();
    const playerId = searchParams.get('playerId');
    const isHost = playerId === 'host';

    const [roomData, setRoomData] = useState(null);

    // Realtime subscription
    useEffect(() => {
        if (!roomId) return;
        const unsub = subscribeToRoom(roomId, (data) => {
            if (!data) return navigate('/');
            setRoomData(data);

            // Sync with host: If room status becomes 'waiting', it means a new round started
            if (data.status === 'waiting') {
                navigate(`/lobby/${roomId}?playerId=${playerId}`);
            }
        });
        return unsub;
    }, [roomId, navigate, playerId]);

    if (!roomData || !roomData.gameState) return <div className="glass-panel text-center">جاري استخراج النتائج...</div>;

    const { gameState, players, status } = roomData;
    const imposterId = gameState.imposterId;
    const isImposterClient = playerId === imposterId;

    const imposterPlayer = players[imposterId];
    const votedOutPlayer = gameState.mostVotedId ? players[gameState.mostVotedId] : null;
    const imposterCaught = gameState.imposterCaught;

    // Determine current phase based on game status
    // status: 'results' -> either 'reveal' (if not caught) or 'guess' (if caught)
    // status: 'scores_revealed' -> show 'scores' pane

    let phase = 'reveal';
    if (status === 'scores_revealed') {
        phase = 'scores';
    } else if (imposterCaught) {
        phase = 'guess';
    }

    // --- Mock logic for identifying "Best Detective" & "Most Innocent" ---
    // A real app would track who voted for whom specifically.
    const bestDetective = { name: "غير متوفر بالنسخة الحالية" };
    const mostInnocent = { name: "غير متوفر بالنسخة الحالية" };

    // --- Category Word list ---
    const mockCategoryWords = {
        'أكل': ['برجر', 'شاورما', 'بيتزا', 'كبسة', 'مكرونة', 'فلافل'],
        'شخصيات': ['باتمان', 'سبايدرمان', 'هاري بوتر', 'سوبرمان'],
        'ملابس': ['جينز', 'تي شيرت', 'دشداشة', 'فستان', 'حذاء رياضي'],
        'حيوانات': ['أسد', 'نمر', 'فيل', 'زرافة', 'قرد'],
        'دول ومناطق': ['السعودية', 'مصر', 'الرياض', 'لندن', 'باريس']
    };
    const categoryWords = mockCategoryWords[roomData?.settings?.category] || mockCategoryWords['أكل'];

    const handleGuess = async (word) => {
        playSound('click');
        try {
            await submitImposterGuess(roomId, roomData, word);
            // The roomData will be updated by the subscription, and then the UI will react.
            // This check should ideally happen after the roomData has been updated by the subscription
            // and the guess result is available in gameState.
            // However, if submitImposterGuess returns the result immediately, this can be placed here.
            // Assuming the instruction implies this logic should be here,
            // and roomData.gameState.isCorrectGuess will be updated by the service call.
            if (roomData.gameState.isCorrectGuess) { // This condition might need to check the *returned* result of submitImposterGuess
                // or rely on the useEffect subscription to update roomData.
                playSound('success');
                addPoints(20);
                addToast('أحسنت! فزت بـ 20 نقطة لتخمينك الصحيح! 💰', 'success');
            } else {
                playSound('error');
            }
        } catch (e) {
            playSound('error');
            addToast(e.message, 'error');
        }
    };

    const renderReveal = () => (
        <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center flex-col items-center justify-center gap-4"
        >
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>😱</div>
            <h3>قرر الأغلبية التصويت ضد...</h3>
            <h1 className="text-gradient" style={{ fontSize: '3rem', margin: '1rem 0' }}>{votedOutPlayer?.name || 'لا أحد'}</h1>

            {imposterCaught ? (
                <p style={{ color: 'var(--success-color)', fontWeight: 'bold' }}>وكان تصويتكم في محله! تم كشف برا السالفة.</p>
            ) : (
                <p style={{ color: 'var(--danger-color)', fontWeight: 'bold' }}>للأسف، لقد ظلمتموه! برا السالفة الحقيقي هو {imposterPlayer?.name}.</p>
            )}

            {/* If imposter wasn't caught, they automatically won, go directly to scores */}
            {!imposterCaught && isHost && (
                <div className="mt-8">
                    <button className="btn btn-primary" onClick={() => submitImposterGuess(roomId, roomData, 'force_skip_correct')}>
                        متابعة للنتائج ➡️
                    </button>
                </div>
            )}
        </motion.div>
    );

    const renderGuess = () => (
        <div className="text-center flex-col items-center gap-6">
            <h2>مرحلة التخمين 🕵️</h2>
            <p>يحاول {imposterPlayer.name} الآن تخمين الكلمة لسرقة النقاط!</p>

            {isImposterClient ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', width: '100%' }}>
                    {categoryWords.map((word, idx) => (
                        <button key={idx} className="btn btn-secondary" onClick={() => handleGuess(word)}>
                            {word}
                        </button>
                    ))}
                </div>
            ) : (
                <div className="glass-panel text-center animate-pulse">
                    <p>ننتظر تخمين {imposterPlayer.name}...</p>
                </div>
            )}
        </div>
    );

    const renderScores = () => (
        <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="flex-col gap-6"
        >
            <div className="text-center">
                <h2 className="text-gradient">نتائج الجولة</h2>
                <p>الكلمة السرية كانت: <strong style={{ color: 'var(--success-color)' }}>{gameState.secretWord}</strong></p>
                {gameState.guessResult !== undefined && (
                    <p style={{ fontWeight: 'bold' }}>
                        {gameState.guessResult ? 'لقد خمن الكلمة بشكل صحيح وسرق النقاط!' : 'أخطأ برا السالفة في التخمين!'}
                    </p>
                )}
            </div>

            <div className="glass-panel mt-4">
                <h3 style={{ textAlign: 'center', marginBottom: '1rem' }}>لوحة النقاط المتراكمة</h3>

                {Object.values(players)
                    .sort((a, b) => b.score - a.score)
                    .map((p, idx) => (
                        <div key={p.id} className="flex justify-between" style={{ padding: '0.5rem', borderBottom: '1px solid var(--glass-border)' }}>
                            <span>{idx + 1}. {p.name} {p.id === imposterId ? '🕵️' : ''}</span>
                            <strong>{p.score} نقطة</strong>
                        </div>
                    ))}
            </div>

            <div className="flex gap-4 mt-4">
                {isHost && (
                    <button className="btn btn-primary flex-1" onClick={() => navigate(`/lobby/${roomId}?playerId=host`)}>
                        العودة للغرفة (جولة جديدة)
                    </button>
                )}
                <button className="btn btn-secondary flex-1" onClick={async () => {
                    const { leaveRoom } = await import('../services/gameService');
                    await leaveRoom(roomId, playerId);
                    navigate('/');
                }}>
                    إنهاء اللعبة
                </button>
            </div>
        </motion.div>
    );

    return (
        <div className="h-full flex-col justify-center">
            <AnimatePresence mode="wait">
                <motion.div
                    key={phase}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    style={{ width: '100%' }}
                >
                    {phase === 'reveal' && renderReveal()}
                    {phase === 'guess' && renderGuess()}
                    {phase === 'scores' && renderScores()}
                </motion.div>
            </AnimatePresence>
        </div>
    );
};

export default Results;
