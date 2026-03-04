export const ACHIEVEMENTS = [
    {
        id: "first_word",
        title: "First Blood",
        description: "Save your first word to the Vault",
        icon: "🩸",
        condition: (userData) => userData.totalWords >= 1
    },
    {
        id: "novice_reader",
        title: "Novice Reader",
        description: "Save 10 words to your Vault",
        icon: "📖",
        condition: (userData) => userData.totalWords >= 10
    },
    {
        id: "scholar",
        title: "Scholar",
        description: "Save 50 words to your Vault",
        icon: "🎓",
        condition: (userData) => userData.totalWords >= 50
    },
    {
        id: "academic_focus",
        title: "Academic Focus",
        description: "Collect 5 Academic DNA words",
        icon: "🔬",
        condition: (userData) => (userData.dnaCounts?.Academic || 0) >= 5
    },
    {
        id: "streak_3",
        title: "Consistent Training",
        description: "Reach a 3-day streak",
        icon: "🔥",
        condition: (userData) => (userData.streak || 0) >= 3
    },
    {
        id: "polymath",
        title: "Polymath",
        description: "Collect words from 3 different DNA categories",
        icon: "🧬",
        condition: (userData) => Object.values(userData.dnaCounts || {}).filter(count => count > 0).length >= 3
    }
];
