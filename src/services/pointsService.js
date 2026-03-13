const POINTS_KEY = 'minbra_points';

export const getPoints = () => {
    return parseInt(localStorage.getItem(POINTS_KEY) || '0', 10); // Start with 100
};

export const addPoints = (amount) => {
    const current = getPoints();
    localStorage.setItem(POINTS_KEY, (current + amount).toString());
    return current + amount;
};

export const deductPoints = (amount) => {
    const current = getPoints();
    if (current < amount) return false;
    localStorage.setItem(POINTS_KEY, (current - amount).toString());
    return true;
};

export const generateReferralLink = (playerName) => {
    const code = btoa(playerName).substring(0, 6).toUpperCase();
    return `${window.location.origin}/?ref=${code}`;
};

const OWNED_CATEGORIES_KEY = 'minbra_owned_categories';

export const isCategoryOwned = (catName) => {
    // First 5 categories are free
    const freeCategories = ["أكل", "شخصيات خيالية", "ملابس", "حيوانات", "دول ومناطق"];
    if (freeCategories.includes(catName)) return true;

    const owned = JSON.parse(localStorage.getItem(OWNED_CATEGORIES_KEY) || '[]');
    return owned.includes(catName);
};

export const buyCategory = (catName, price = 200) => {
    if (isCategoryOwned(catName)) return true;
    if (deductPoints(price)) {
        const owned = JSON.parse(localStorage.getItem(OWNED_CATEGORIES_KEY) || '[]');
        owned.push(catName);
        localStorage.setItem(OWNED_CATEGORIES_KEY, JSON.stringify(owned));
        return true;
    }
    return false;
};
