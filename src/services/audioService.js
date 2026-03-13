const SOUNDS = {
    click: 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3',
    success: 'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3',
    error: 'https://assets.mixkit.co/active_storage/sfx/2572/2572-preview.mp3',
    start: 'https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3',
    vote: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3'
};

const audioCache = {};

export const playSound = (soundKey) => {
    const url = SOUNDS[soundKey];
    if (!url) return;

    if (!audioCache[soundKey]) {
        audioCache[soundKey] = new Audio(url);
    }

    const audio = audioCache[soundKey];
    audio.currentTime = 0;
    audio.play().catch(e => console.log("Audio play blocked", e));
};
