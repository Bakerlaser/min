import { db } from './firebase';
import { ref, set, get, update, onValue, remove } from 'firebase/database';

// Helper to generate a random 6-character room code
export const generateRoomCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
};

/**
 * Creates a new game room in Firebase.
 * @param {string} hostName Name of the player creating the room
 * @param {number} rounds Number of rounds for the game
 * @param {string} category The chosen category for words
 * @returns {string} The generated room ID
 */
export const createRoom = async (hostName, rounds, category) => {
    const roomId = generateRoomCode();
    const roomRef = ref(db, `rooms/${roomId}`);

    const initialData = {
        status: 'waiting', // waiting, playing, voting, guessing, results
        settings: {
            rounds,
            category
        },
        players: {
            host: {
                id: 'host', // The host gets a specific fixed ID 
                name: hostName,
                isHost: true,
                score: 0
            }
        },
        currentRound: 0,
        gameState: null
    };

    await set(roomRef, initialData);
    return roomId;
};

/**
 * Joins an existing room in Firebase.
 */
export const joinRoom = async (roomId, playerName) => {
    const roomRef = ref(db, `rooms/${roomId}`);
    const snapshot = await get(roomRef);

    if (!snapshot.exists()) {
        throw new Error('الغرفة غير موجودة. تأكد من الكود.');
    }

    const roomData = snapshot.val();

    if (roomData.status !== 'waiting' && roomData.status !== 'results') {
        throw new Error('اللعبة قيد التشغيل حالياً.');
    }

    const players = roomData.players || {};
    if (Object.keys(players).length >= 12) {
        throw new Error('الغرفة ممتلئة (الحد الأقصى 12 لاعب).');
    }

    const nameExists = Object.values(players).some(p => p.name === playerName);
    if (nameExists) throw new Error('هذا الاسم مستخدم بالفعل.');

    const playerId = `player_${Date.now()}`;

    await update(ref(db, `rooms/${roomId}/players`), {
        [playerId]: {
            id: playerId,
            name: playerName,
            isHost: false,
            score: 0
        }
    });

    return playerId;
};

/**
 * Listens to room data changes in real-time.
 */
export const subscribeToRoom = (roomId, callback) => {
    const roomRef = ref(db, `rooms/${roomId}`);
    return onValue(roomRef, (snapshot) => {
        if (snapshot.exists()) {
            callback(snapshot.val());
        } else {
            callback(null);
        }
    });
};

/**
 * Starts the game, assigns roles, and generates question sequence.
 */
export const startGame = async (roomId, roomData, secretWord) => {
    const ObjectIds = Object.keys(roomData.players);
    if (ObjectIds.length < 3) throw new Error("يجب تواجد 3 لاعبين على الأقل");

    const prevImposter = roomData.gameState?.previousImposterId;
    const eligibleImposters = prevImposter && ObjectIds.length > 3
        ? ObjectIds.filter(id => id !== prevImposter)
        : ObjectIds;

    const imposterId = eligibleImposters[Math.floor(Math.random() * eligibleImposters.length)];

    const questionsQueue = [];
    let lastAsker = null;
    let lastResponder = null;

    for (let i = 0; i < 20; i++) {
        let availableAskers = ObjectIds.filter(id => id !== lastAsker);
        if (availableAskers.length === 0) availableAskers = ObjectIds;
        const askerId = availableAskers[Math.floor(Math.random() * availableAskers.length)];

        let availableResponders = ObjectIds.filter(id => id !== askerId && id !== lastResponder);
        if (availableResponders.length === 0) availableResponders = ObjectIds.filter(id => id !== askerId);
        const responderId = availableResponders[Math.floor(Math.random() * availableResponders.length)];

        questionsQueue.push({
            askerId,
            askerName: roomData.players[askerId].name,
            responderId,
            responderName: roomData.players[responderId].name,
        });

        lastAsker = askerId;
        lastResponder = responderId;
    }

    const updates = {
        [`rooms/${roomId}/status`]: 'playing',
        [`rooms/${roomId}/currentRound`]: (roomData.currentRound || 0) + 1,
        [`rooms/${roomId}/gameState`]: {
            imposterId,
            secretWord,
            questions: questionsQueue,
            currentQuestionIndex: 0,
            votes: {}
        }
    };

    await update(ref(db), updates);
};

// ==========================================
// NEW LOGIC: Voting and Scoring
// ==========================================

export const submitVote = async (roomId, voterId, targetId) => {
    const updates = {};
    updates[`rooms/${roomId}/gameState/votes/${voterId}`] = targetId;
    await update(ref(db), updates);
};

export const calculateResultsPhase = async (roomId, roomData) => {
    // If everyone voted, host calls this to calculate results
    const votes = roomData.gameState.votes || {};
    const voteCounts = {};
    const imposterId = roomData.gameState.imposterId;

    Object.values(votes).forEach(targetId => {
        voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
    });

    // Find who got the max votes
    let maxVotes = 0;
    let votedOutId = null;
    Object.entries(voteCounts).forEach(([id, count]) => {
        if (count > maxVotes) {
            maxVotes = count;
            votedOutId = id;
        }
    });

    // Check if they caught the imposter
    const imposterCaught = (votedOutId === imposterId);

    await update(ref(db, `rooms/${roomId}`), {
        status: 'results',
        'gameState/imposterCaught': imposterCaught,
        'gameState/mostVotedId': votedOutId,
        'gameState/voteCounts': voteCounts
    });
};

export const submitImposterGuess = async (roomId, roomData, guessedWord) => {
    const secretWord = roomData.gameState.secretWord;
    const isCorrect = guessedWord === secretWord;
    const imposterId = roomData.gameState.imposterId;
    const players = roomData.players;

    const updates = {};

    if (isCorrect) {
        // Imposter guessed correctly! Steal all points.
        updates[`rooms/${roomId}/players/${imposterId}/score`] = players[imposterId].score + (Object.keys(players).length - 1);
    } else {
        // Imposter failed. Everyone else gets 1 point.
        Object.keys(players).forEach(id => {
            if (id !== imposterId) {
                updates[`rooms/${roomId}/players/${id}/score`] = players[id].score + 1;
            }
        });
    }

    updates[`rooms/${roomId}/gameState/guessResult`] = isCorrect;
    updates[`rooms/${roomId}/status`] = 'scores_revealed';

    await update(ref(db), updates);
    return isCorrect;
};

/**
 * Removes a player from the room.
 */
export const leaveRoom = async (roomId, playerId) => {
    const playerRef = ref(db, `rooms/${roomId}/players/${playerId}`);
    await remove(playerRef);
};
