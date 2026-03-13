import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { subscribeToRoom, startGame } from '../services/gameService';
import categoriesData from '../utils/categories.json';
import { useToast } from '../context/ToastContext';
import { playSound } from '../services/audioService';

const Lobby = () => {
    const { roomId } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { addToast } = useToast();

    const playerId = searchParams.get('playerId');
    const isHost = playerId === 'host';

    const [roomData, setRoomData] = useState(null);
    const [error, setError] = useState('');

    // Listen to Firebase room
    useEffect(() => {
        if (!roomId) return;
        const unsubscribe = subscribeToRoom(roomId, (data) => {
            if (!data) {
                setError('الغرفة تم إغلاقها أو لم تعد موجودة.');
                setRoomData(null);
                return;
            }
            setRoomData(data);

            // If host started the game, auto-navigate everyone
            if (data.status === 'playing') {
                navigate(`/game/${roomId}?playerId=${playerId}`);
            }
        });

        return () => unsubscribe();
    }, [roomId, navigate, playerId]);

    const handleStartGame = async () => {
        if (!roomData) return;
        const playersCount = Object.keys(roomData.players || {}).length;

        if (playersCount < 3) {
            return addToast('يجب أن يكون هناك 3 لاعبين على الأقل للبدء', 'error');
        }

        try {
            const cat = roomData.settings.category;
            // Fallback to "أكل" if category is somehow missing in json
            const wordList = categoriesData[cat] || categoriesData['أكل'];
            const secretWord = wordList[Math.floor(Math.random() * wordList.length)];

            playSound('start');
            await startGame(roomId, roomData, secretWord);
            // Navigation happens automatically via useEffect listening to status === 'playing'
        } catch (err) {
            playSound('error');
            addToast("خطأ أثناء بدء اللعبة: " + err.message, 'error');
        }
    };

    if (error) {
        return <div className="glass-panel text-center"><h2>{error}</h2><button className="btn btn-primary mt-4" onClick={() => navigate('/')}>عودة للرئيسية</button></div>;
    }

    if (!roomData) {
        return <div className="glass-panel text-center"><p className="animate-pulse">جاري التحميل...</p></div>;
    }

    const playersList = Object.values(roomData.players || {});

    return (
        <div className="glass-panel text-center flex-col h-full">
            <h2 className="text-gradient">غرفة الانتظار</h2>

            <div className="glass-panel mt-4" style={{ background: 'rgba(0,0,0,0.2)' }}>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>كود الغرفة</p>
                <h1 style={{ letterSpacing: '4px', margin: '0.5rem 0' }}>{roomId}</h1>
                <p style={{ fontSize: '0.8rem' }}>شارك هذا الكود مع أصدقائك للانضمام</p>
            </div>

            <div className="mt-8 flex-col gap-4">
                <h3>اللاعبون المتصلون ({playersList.length}/12)</h3>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                    gap: '1rem',
                    marginTop: '1rem'
                }}>
                    {playersList.map((p) => (
                        <div key={p.id} className="glass-panel" style={{ padding: '0.75rem', paddingBottom: '0.5rem', borderColor: p.id === playerId ? 'var(--primary-color)' : '' }}>
                            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
                                {p.isHost ? '👑' : '👤'}
                            </div>
                            <p style={{ fontWeight: 'bold' }}>{p.name}</p>
                            {p.id === playerId && <span style={{ fontSize: '0.7rem', color: 'var(--success-color)' }}>أنت</span>}
                        </div>
                    ))}
                </div>
            </div>

            <div className="mt-8" style={{ marginTop: 'auto', paddingTop: '2rem' }}>
                {isHost ? (
                    <button
                        className="btn btn-primary btn-full"
                        onClick={handleStartGame}
                        disabled={playersList.length < 3}
                        style={{ opacity: playersList.length < 3 ? 0.5 : 1 }}
                    >
                        {playersList.length < 3 ? 'ننتظر المزيد من اللاعبين...' : 'ابدأ اللعبة 🚀'}
                    </button>
                ) : (
                    <div className="glass-panel text-center flex-col gap-4">
                        <p className="animate-pulse">في انتظار المضيف لبدء اللعبة...</p>
                        <button
                            className="btn btn-danger"
                            style={{ alignSelf: 'center' }}
                            onClick={async () => {
                                const { leaveRoom } = await import('../services/gameService');
                                await leaveRoom(roomId, playerId);
                                navigate('/');
                            }}
                        >
                            مغادرة الغرفة 🚪
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Lobby;
