import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createRoom, joinRoom } from '../services/gameService';
import categoriesData from '../utils/categories.json';
import { useToast } from '../context/ToastContext';
import { playSound } from '../services/audioService';
import { getPoints, addPoints, generateReferralLink, isCategoryOwned, buyCategory } from '../services/pointsService';

const StartScreen = () => {
    const [playerName, setPlayerName] = useState('');
    const [rounds, setRounds] = useState(5);
    const [category, setCategory] = useState('أكل');
    const [loading, setLoading] = useState(false);
    const [points, setPoints] = useState(getPoints());
    const navigate = useNavigate();
    const { addToast } = useToast();

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const ref = urlParams.get('ref');
        if (ref) {
            const hasBeenReferred = localStorage.getItem('referred_by');
            if (!hasBeenReferred) {
                addPoints(50);
                setPoints(getPoints());
                localStorage.setItem('referred_by', ref);
                addToast('حصلت على 50 نقطة من رابط الإحالة! 🎁', 'success');
            }
        }
    }, []);

    const handleCopyReferral = () => {
        const link = generateReferralLink(playerName || 'لاعب');
        navigator.clipboard.writeText(link);
        playSound('success');
        addToast('تم نسخ رابط الإحالة! شاركه مع أصدقائك للحصول على نقاط. 🔗', 'success');
    };

    const [showJoinInput, setShowJoinInput] = useState(false);
    const [roomCode, setRoomCode] = useState('');

    const handleStartLocal = () => {
        playSound('click');
        if (!playerName) {
            playSound('error');
            return addToast('يرجى إدخل اسمك أولاً', 'error');
        }
        navigate(`/game/local?host=${playerName}&playerId=host&category=${category}&rounds=${rounds}`);
    };

    const handleCreateOnline = async () => {
        playSound('click');
        if (!playerName) {
            playSound('error');
            return addToast('يرجى إدخال اسمك أولاً', 'error');
        }
        try {
            setLoading(true);
            const roomId = await createRoom(playerName, rounds, category);
            playSound('start');
            addToast('تم إنشاء الغرفة بنجاح!', 'success');
            navigate(`/lobby/${roomId}?host=${playerName}&playerId=host`);
        } catch (err) {
            playSound('error');
            addToast("رسالة من النظام: تأكد من تفعيل قواعد القراءة/الكتابة في Firebase ثم أعد المحاولة. " + err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleJoinOnline = async () => {
        playSound('click');
        if (!playerName) {
            playSound('error');
            return addToast('يرجى إدخال اسمك أولاً', 'error');
        }
        if (!showJoinInput) {
            setShowJoinInput(true);
            return;
        }
        if (!roomCode) {
            playSound('error');
            return addToast('يرجى إدخال كود الغرفة', 'error');
        }

        try {
            setLoading(true);
            const playerId = await joinRoom(roomCode.trim().toUpperCase(), playerName);
            playSound('start');
            addToast('تم الانضمام للغرفة بنجاح!', 'success');
            navigate(`/lobby/${roomCode.trim().toUpperCase()}?player=${playerName}&playerId=${playerId}`);
        } catch (err) {
            playSound('error');
            addToast(err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="glass-panel text-center flex-col h-full justify-center">
            <div className="flex justify-between items-center mb-4">
                <div className="glass-panel" style={{ padding: '0.4rem 0.8rem', background: 'rgba(245, 158, 11, 0.1)', borderColor: 'var(--accent-color)' }}>
                    <span style={{ color: 'var(--accent-color)', fontWeight: 'bold' }}>💰 {points} نقطة</span>
                </div>
                <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={handleCopyReferral}>
                    دعوة صديق 🤝
                </button>
            </div>

            <h1 className="text-gradient" style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>مين برا السالفة</h1>
            <p style={{ marginBottom: '2rem' }}>لعبة كشف الكذاب والضحك الجماعي</p>

            <div className="input-group">
                <label>اسمك المستعار:</label>
                <input
                    type="text"
                    className="input-field"
                    placeholder="مثال: باتمان، أبوسعيد..."
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                />
            </div>

            {!showJoinInput ? (
                <>
                    <div className="input-group">
                        <label>عدد الجولات:</label>
                        <select
                            className="input-field"
                            value={rounds}
                            onChange={(e) => setRounds(Number(e.target.value))}
                        >
                            <option value={3}>3 جولات</option>
                            <option value={5}>5 جولات</option>
                            <option value={10}>10 جولات</option>
                        </select>
                    </div>

                    <div className="input-group">
                        <label>القسم (الفئة):</label>
                        <select
                            className="input-field"
                            value={category}
                            onChange={(e) => {
                                const val = e.target.value;
                                if (!isCategoryOwned(val)) {
                                    if (window.confirm(`هذا القسم مغلق. هل تريد فتحه مقابل 200 نقطة؟`)) {
                                        if (buyCategory(val)) {
                                            playSound('success');
                                            addToast('تم فتح القسم بنجاح!', 'success');
                                            setPoints(getPoints());
                                            setCategory(val);
                                        } else {
                                            playSound('error');
                                            addToast('ليس لديك نقاط كافية!', 'error');
                                        }
                                    }
                                } else {
                                    setCategory(val);
                                }
                            }}
                        >
                            {Object.keys(categoriesData).map((catName) => (
                                <option key={catName} value={catName}>
                                    {catName} {!isCategoryOwned(catName) ? '🔒 (200💰)' : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                </>
            ) : (
                <div className="input-group">
                    <label>كود الغرفة:</label>
                    <input
                        type="text"
                        className="input-field"
                        placeholder="أدخل الكود المكون من 6 أرقام/حروف"
                        value={roomCode}
                        onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                        autoFocus
                    />
                    <button className="btn btn-secondary mt-2" onClick={() => setShowJoinInput(false)}>إلغاء</button>
                </div>
            )}

            <div className="flex-col gap-4 mt-8">
                {!showJoinInput && (
                    <button className="btn btn-primary" onClick={handleStartLocal} disabled={loading}>
                        لعب محلي 🕹️
                    </button>
                )}
                <div className="flex gap-4">
                    {!showJoinInput && (
                        <button className="btn btn-secondary flex-1" onClick={handleCreateOnline} disabled={loading}>
                            {loading ? 'انتظر...' : 'إنشاء غرفة 🌐'}
                        </button>
                    )}
                    <button className="btn btn-secondary flex-1" onClick={handleJoinOnline} disabled={loading}>
                        {loading ? 'انتظر...' : showJoinInput ? 'دخول 🚪' : 'انضمام 🚪'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default StartScreen;
