import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { subscribeToRoom, submitVote, calculateResultsPhase } from '../services/gameService';
import { useToast } from '../context/ToastContext';
import { playSound } from '../services/audioService';
import { useState, useEffect } from 'react';

const Voting = () => {
    const { roomId } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { addToast } = useToast();
    const playerId = searchParams.get('playerId');
    const isHost = playerId === 'host';

    const [roomData, setRoomData] = useState(null);
    const [selectedPlayer, setSelectedPlayer] = useState(null);
    const [hasVoted, setHasVoted] = useState(false);

    useEffect(() => {
        if (!roomId) return;
        const unsub = subscribeToRoom(roomId, (data) => {
            if (!data) return navigate('/');
            setRoomData(data);
            if (data.status === 'results') {
                navigate(`/results/${roomId}?playerId=${playerId}`);
            }
        });
        return unsub;
    }, [roomId, navigate, playerId]);

    if (!roomData) return <div className="glass-panel text-center animate-pulse">جاري التحميل...</div>;

    const playersList = Object.values(roomData.players || {}).filter(p => p.id !== playerId); // Can't vote for self
    const currentVotes = roomData.gameState?.votes || {};
    const totalPlayers = Object.keys(roomData.players || {}).length;
    const totalVotesCast = Object.keys(currentVotes).length;

    const handleVote = async () => {
        playSound('click');
        if (!selectedPlayer) return addToast('يرجى اختيار لاعب أولاً', 'error');

        try {
            setHasVoted(true);
            await submitVote(roomId, playerId, selectedPlayer);
            playSound('success');
            addToast('تم التصويت!', 'success');
        } catch (e) {
            playSound('error');
            addToast("خطأ أثناء التصويت: " + e.message, 'error');
            setHasVoted(false);
        }
    };

    const handleRevealScores = async () => {
        try {
            await calculateResultsPhase(roomId, roomData);
        } catch (e) {
            addToast("خطأ: " + e.message, 'error');
        }
    };

    return (
        <div className="flex-col h-full justify-center">
            <div className="text-center mb-8">
                <h1 className="text-gradient">وقت التصويت!</h1>
                <p>من تعتقد أنه "برا السالفة"؟</p>
            </div>

            {!hasVoted ? (
                <>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                        gap: '1rem',
                        marginBottom: '2rem'
                    }}>
                        {playersList.map(p => (
                            <motion.div
                                key={p.id}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setSelectedPlayer(p.id)}
                                className="glass-panel text-center"
                                style={{
                                    cursor: 'pointer',
                                    border: selectedPlayer === p.id ? '2px solid var(--secondary-color)' : '1px solid var(--glass-border)',
                                    boxShadow: selectedPlayer === p.id ? '0 0 15px rgba(236, 72, 153, 0.5)' : 'none',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>👤</div>
                                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{p.name}</h3>
                            </motion.div>
                        ))}
                    </div>

                    <button
                        className="btn btn-primary btn-full"
                        onClick={handleVote}
                        disabled={!selectedPlayer}
                        style={{ opacity: !selectedPlayer ? 0.5 : 1 }}
                    >
                        تأكيد التصويت 🗳️
                    </button>
                </>
            ) : (
                <div className="glass-panel text-center flex-col items-center gap-4">
                    <div style={{ fontSize: '3rem' }} className="animate-spin">⏳</div>
                    <h2>تم تسجيل صوتك!</h2>
                    <p>تم التصويت: {totalVotesCast} / {totalPlayers}</p>

                    {isHost && totalVotesCast >= totalPlayers && (
                        <button className="btn btn-primary mt-4" onClick={handleRevealScores}>
                            إظهار النتائج 📊
                        </button>
                    )}

                    {isHost && totalVotesCast < totalPlayers && (
                        <button className="btn btn-danger mt-4" onClick={handleRevealScores}>
                            تخطي البقية وإظهار النتائج ⚠️
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default Voting;
