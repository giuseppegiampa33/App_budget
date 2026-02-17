import React, { useState, useEffect, useMemo } from 'react';
import {
    StyleSheet,
    Text,
    View,
    ScrollView,
    TouchableOpacity,
    Modal,
    TextInput,
    useColorScheme,
    SafeAreaView,
    Dimensions,
    Platform,
    KeyboardAvoidingView,
    useWindowDimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';

const STORAGE_KEYS = {
    TRANSACTIONS: '@mio_budget_transactions_v2',
    TOTAL_BUDGET: '@mio_budget_total_v2',
    HAS_ONBOARDED: '@mio_budget_onboarded_v2',
};

const CATEGORIES = [
    { id: 'salary', name: 'Stipendio', icon: 'cash-outline', color: '#34C759' },
    { id: 'food', name: 'Cibo', icon: 'restaurant-outline', color: '#FF9500' },
    { id: 'transport', name: 'Trasporti', icon: 'bus-outline', color: '#5856D6' },
    { id: 'shopping', name: 'Shopping', icon: 'cart-outline', color: '#FF2D55' },
    { id: 'leisure', name: 'Svago', icon: 'game-controller-outline', color: '#AF52DE' },
    { id: 'other', name: 'Altro', icon: 'ellipsis-horizontal-outline', color: '#8E8E93' },
];

export default function App() {
    const { width, height } = useWindowDimensions();
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const isLargeScreen = width > 768;

    // --- State ---
    const [hasOnboarded, setHasOnboarded] = useState(null);
    const [totalBudget, setTotalBudget] = useState('0');
    const [transactions, setTransactions] = useState([]);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [loading, setLoading] = useState(true);

    // Form State
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [type, setType] = useState('expense');
    const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[1]);

    // --- Persistence ---
    useEffect(() => {
        loadInitialData();
    }, []);

    const loadInitialData = async () => {
        try {
            const onboarded = await AsyncStorage.getItem(STORAGE_KEYS.HAS_ONBOARDED);
            const storedBudget = await AsyncStorage.getItem(STORAGE_KEYS.TOTAL_BUDGET);
            const storedTransactions = await AsyncStorage.getItem(STORAGE_KEYS.TRANSACTIONS);

            if (onboarded === 'true') {
                setHasOnboarded(true);
            } else {
                setHasOnboarded(false);
            }

            if (storedBudget) setTotalBudget(storedBudget);
            if (storedTransactions) setTransactions(JSON.parse(storedTransactions));
        } catch (e) {
            console.error('Failed to load data', e);
        } finally {
            setLoading(false);
        }
    };

    const saveBudget = async (val) => {
        try {
            await AsyncStorage.setItem(STORAGE_KEYS.TOTAL_BUDGET, val);
            setTotalBudget(val);
        } catch (e) {
            console.error(e);
        }
    };

    const saveTransactions = async (newTransactions) => {
        try {
            await AsyncStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(newTransactions));
            setTransactions(newTransactions);
        } catch (e) {
            console.error(e);
        }
    };

    const completeOnboarding = async () => {
        if (!totalBudget || parseFloat(totalBudget) <= 0) return;
        try {
            await AsyncStorage.setItem(STORAGE_KEYS.HAS_ONBOARDED, 'true');
            setHasOnboarded(true);
        } catch (e) {
            console.error(e);
        }
    };

    // --- Logic ---
    const currentBalance = useMemo(() => {
        const totalTr = transactions.reduce((acc, curr) => {
            const val = parseFloat(curr.amount) || 0;
            return curr.type === 'income' ? acc + val : acc - val;
        }, 0);
        return parseFloat(totalBudget) + totalTr;
    }, [transactions, totalBudget]);

    const spendingPercentage = useMemo(() => {
        const totalExpenses = transactions
            .filter(t => t.type === 'expense')
            .reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);
        const budgetNum = parseFloat(totalBudget) || 1;
        return Math.min((totalExpenses / budgetNum) * 100, 100);
    }, [transactions, totalBudget]);

    const addTransaction = () => {
        if (!description || !amount) return;

        const newTr = {
            id: Date.now().toString(),
            description,
            amount: parseFloat(amount).toFixed(2),
            type,
            category: selectedCategory,
            date: new Date().toLocaleDateString('it-IT'),
        };

        const updated = [newTr, ...transactions];
        saveTransactions(updated);
        setIsModalVisible(false);
        resetForm();
    };

    const deleteTransaction = (id) => {
        const updated = transactions.filter(t => t.id !== id);
        saveTransactions(updated);
    };

    const resetForm = () => {
        setDescription('');
        setAmount('');
        setType('expense');
        setSelectedCategory(CATEGORIES[1]);
    };

    // --- UI Components ---
    if (loading || hasOnboarded === null) return null;

    const styles = createStyles(isDark, isLargeScreen);

    // --- Onboarding Screen ---
    if (!hasOnboarded) {
        return (
            <SafeAreaView style={styles.onboardingContainer}>
                <ExpoStatusBar style={isDark ? 'light' : 'dark'} />
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.centered}>
                    <View style={styles.onboardingCard}>
                        <Text style={styles.emojiTitle}>💰</Text>
                        <Text style={styles.onboardingTitle}>Benvenuto!</Text>
                        <Text style={styles.onboardingSubtitle}>Qual è il tuo budget attuale per iniziare a risparmiare?</Text>
                        <TextInput
                            style={styles.onboardingInput}
                            placeholder="es. 1000"
                            keyboardType="numeric"
                            value={totalBudget}
                            onChangeText={setTotalBudget}
                            autoFocus
                        />
                        <TouchableOpacity style={styles.cartoonButton} onPress={completeOnboarding}>
                            <Text style={styles.cartoonButtonText}>Iniziamo! 🚀</Text>
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </SafeAreaView>
        );
    }

    // --- Main App ---
    return (
        <SafeAreaView style={styles.container}>
            <ExpoStatusBar style={isDark ? 'light' : 'dark'} />

            <View style={styles.contentWrapper}>
                {/* Header */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.headerTitle}>Il Mio Budget</Text>
                        <Text style={styles.headerSubtitle}>Tieni d'occhio i tuoi soldi</Text>
                    </View>
                    <TouchableOpacity
                        style={styles.headerAddButton}
                        onPress={() => setIsModalVisible(true)}
                    >
                        <Ionicons name="add" size={30} color="black" />
                    </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    {/* Summary Card */}
                    <View style={[styles.mainCard, { backgroundColor: '#FFD93D' }]}>
                        <Text style={styles.cardLabel}>SALDO ATTUALE</Text>
                        <Text style={styles.balanceValue}>€ {currentBalance.toFixed(2)}</Text>
                        <View style={styles.progressTrack}>
                            <View
                                style={[
                                    styles.progressBar,
                                    { width: `${spendingPercentage}%`, backgroundColor: spendingPercentage > 80 ? '#FF3B30' : '#4D96FF' }
                                ]}
                            />
                        </View>
                        <Text style={styles.cardInfo}>Hai usato il {spendingPercentage.toFixed(0)}% del tuo budget di €{totalBudget}</Text>
                    </View>

                    {/* Quick Stats */}
                    <View style={styles.statsRow}>
                        <View style={[styles.statBox, { backgroundColor: '#6BCB77' }]}>
                            <Text style={styles.statLabel}>ENTRATE</Text>
                            <Text style={styles.statValue}>+ €{transactions.filter(t => t.type === 'income').reduce((a, b) => a + parseFloat(b.amount), 0).toFixed(0)}</Text>
                        </View>
                        <View style={[styles.statBox, { backgroundColor: '#FF6B6B' }]}>
                            <Text style={styles.statLabel}>USCITE</Text>
                            <Text style={styles.statValue}>- €{transactions.filter(t => t.type === 'expense').reduce((a, b) => a + parseFloat(b.amount), 0).toFixed(0)}</Text>
                        </View>
                    </View>

                    {/* History */}
                    <Text style={styles.sectionTitle}>Ultime Movimentazioni ✏️</Text>
                    {transactions.length === 0 ? (
                        <View style={styles.emptyCard}>
                            <Text style={styles.emptyText}>Ancora niente qui fuori...</Text>
                            <Text style={styles.emptySub}>Aggiungi la tua prima spesa!</Text>
                        </View>
                    ) : (
                        transactions.map((t) => (
                            <View key={t.id} style={styles.transactionLine}>
                                <View style={[styles.categoryIconCircle, { backgroundColor: t.category.color }]}>
                                    <Ionicons name={t.category.icon} size={20} color="white" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.trDesc}>{t.description}</Text>
                                    <Text style={styles.trDate}>{t.category.name} • {t.date}</Text>
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={[styles.trAmount, { color: t.type === 'income' ? '#2D5E2E' : '#A02020' }]}>
                                        {t.type === 'income' ? '+' : '-'}€{t.amount}
                                    </Text>
                                    <TouchableOpacity onPress={() => deleteTransaction(t.id)}>
                                        <Ionicons name="trash-outline" size={16} color="#444" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))
                    )}
                </ScrollView>
            </View>

            {/* Add Modal */}
            <Modal visible={isModalVisible} animationType="fade" transparent={true}>
                <View style={styles.modalOverlay}>
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Nuova Operazione</Text>
                            <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                                <Ionicons name="close-circle" size={32} color="black" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.typeSwitcher}>
                            <TouchableOpacity
                                style={[styles.typeBtn, type === 'expense' && { backgroundColor: '#FF6B6B' }]}
                                onPress={() => setType('expense')}
                            >
                                <Text style={styles.typeBtnText}>Uscita</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.typeBtn, type === 'income' && { backgroundColor: '#6BCB77' }]}
                                onPress={() => setType('income')}
                            >
                                <Text style={styles.typeBtnText}>Entrata</Text>
                            </TouchableOpacity>
                        </View>

                        <TextInput
                            style={styles.cartoonInput}
                            placeholder="Quanto? (es. 25.00)"
                            keyboardType="decimal-pad"
                            value={amount}
                            onChangeText={setAmount}
                        />
                        <TextInput
                            style={styles.cartoonInput}
                            placeholder="Per cosa?"
                            value={description}
                            onChangeText={setDescription}
                        />

                        <Text style={styles.label}>Scegli Categoria:</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
                            {CATEGORIES.map(cat => (
                                <TouchableOpacity
                                    key={cat.id}
                                    style={[styles.catItem, selectedCategory.id === cat.id && { borderColor: 'black', borderWidth: 3 }]}
                                    onPress={() => setSelectedCategory(cat)}
                                >
                                    <Ionicons name={cat.icon} size={24} color={cat.color} />
                                    <Text style={styles.catText}>{cat.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        <TouchableOpacity style={styles.saveBtn} onPress={addTransaction}>
                            <Text style={styles.saveBtnText}>Salva nel Libro! 📔</Text>
                        </TouchableOpacity>
                    </KeyboardAvoidingView>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const createStyles = (isDark, isLargeScreen) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9F9F9',
    },
    onboardingContainer: {
        flex: 1,
        backgroundColor: '#4D96FF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    contentWrapper: {
        flex: 1,
        width: '100%',
        maxWidth: 600,
        alignSelf: 'center',
        backgroundColor: '#FFF',
        borderLeftWidth: isLargeScreen ? 4 : 0,
        borderRightWidth: isLargeScreen ? 4 : 0,
        borderColor: '#000',
    },
    centered: {
        padding: 20,
        width: '100%',
        maxWidth: 400,
    },
    onboardingCard: {
        backgroundColor: '#FFF',
        borderRadius: 30,
        padding: 30,
        borderWidth: 4,
        borderColor: '#000',
        shadowColor: '#000',
        shadowOffset: { width: 8, height: 8 },
        shadowOpacity: 1,
        shadowRadius: 0,
        alignItems: 'center',
    },
    emojiTitle: { fontSize: 60, marginBottom: 10 },
    onboardingTitle: { fontSize: 32, fontWeight: '900', marginBottom: 10, textAlign: 'center' },
    onboardingSubtitle: { fontSize: 18, textAlign: 'center', marginBottom: 20, color: '#555' },
    onboardingInput: {
        width: '100%',
        backgroundColor: '#F0F0F0',
        borderWidth: 3,
        borderColor: '#000',
        borderRadius: 15,
        padding: 15,
        fontSize: 24,
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: 25,
    },
    cartoonButton: {
        backgroundColor: '#6BCB77',
        paddingVertical: 15,
        paddingHorizontal: 40,
        borderRadius: 20,
        borderWidth: 4,
        borderColor: '#000',
        shadowColor: '#000',
        shadowOffset: { width: 4, height: 4 },
        shadowOpacity: 1,
        shadowRadius: 0,
    },
    cartoonButtonText: { fontSize: 20, fontWeight: '900', color: '#000' },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 25,
        borderBottomWidth: 4,
        borderColor: '#000',
    },
    headerTitle: { fontSize: 32, fontWeight: '900', letterSpacing: -1 },
    headerSubtitle: { fontSize: 16, color: '#666', fontWeight: '600' },
    headerAddButton: {
        backgroundColor: '#FFD93D',
        width: 60,
        height: 60,
        borderRadius: 30,
        borderWidth: 3,
        borderColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 4, height: 4 },
        shadowOpacity: 1,
    },
    scrollContent: { padding: 20 },
    mainCard: {
        padding: 25,
        borderRadius: 25,
        borderWidth: 4,
        borderColor: '#000',
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 6, height: 6 },
        shadowOpacity: 1,
    },
    cardLabel: { fontSize: 14, fontWeight: '900', color: '#000', opacity: 0.6, marginBottom: 5 },
    balanceValue: { fontSize: 48, fontWeight: '900', color: '#000' },
    progressTrack: {
        height: 15,
        backgroundColor: '#000',
        borderRadius: 10,
        marginTop: 15,
        overflow: 'hidden',
    },
    progressBar: { height: '100%', borderRadius: 10 },
    cardInfo: { marginTop: 10, fontSize: 14, fontWeight: '700' },
    statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 25 },
    statBox: {
        width: '48%',
        padding: 15,
        borderRadius: 20,
        borderWidth: 3,
        borderColor: '#000',
        shadowColor: '#000',
        shadowOffset: { width: 4, height: 4 },
        shadowOpacity: 1,
    },
    statLabel: { fontSize: 12, fontWeight: '900', opacity: 0.7 },
    statValue: { fontSize: 18, fontWeight: '900' },
    sectionTitle: { fontSize: 22, fontWeight: '900', marginBottom: 15 },
    emptyCard: {
        padding: 40,
        alignItems: 'center',
        borderWidth: 3,
        borderColor: '#DDD',
        borderStyle: 'dashed',
        borderRadius: 20,
    },
    emptyText: { fontSize: 18, fontWeight: '700' },
    emptySub: { fontSize: 14, color: '#999' },
    transactionLine: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        padding: 15,
        borderRadius: 20,
        borderWidth: 3,
        borderColor: '#000',
        marginBottom: 12,
    },
    categoryIconCircle: {
        width: 45,
        height: 45,
        borderRadius: 22.5,
        borderWidth: 2,
        borderColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    trDesc: { fontSize: 18, fontWeight: '800' },
    trDate: { fontSize: 13, color: '#666' },
    trAmount: { fontSize: 18, fontWeight: '900' },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(77, 150, 255, 0.9)',
        justifyContent: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: '#FFF',
        borderRadius: 30,
        padding: 25,
        borderWidth: 4,
        borderColor: '#000',
        shadowColor: '#000',
        shadowOffset: { width: 10, height: 10 },
        shadowOpacity: 1,
        maxWidth: 500,
        alignSelf: 'center',
        width: '100%',
    },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 24, fontWeight: '900' },
    typeSwitcher: { flexDirection: 'row', gap: 10, marginBottom: 20 },
    typeBtn: {
        flex: 1,
        padding: 12,
        borderRadius: 15,
        borderWidth: 3,
        borderColor: '#000',
        alignItems: 'center',
        backgroundColor: '#F0F0F0',
    },
    typeBtnText: { fontWeight: '900', fontSize: 16 },
    cartoonInput: {
        backgroundColor: '#F0F0F0',
        borderWidth: 3,
        borderColor: '#000',
        borderRadius: 15,
        padding: 15,
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 15,
    },
    label: { fontSize: 16, fontWeight: '900', marginBottom: 10 },
    catScroll: { marginBottom: 20 },
    catItem: {
        padding: 15,
        backgroundColor: '#EEE',
        borderRadius: 15,
        borderWidth: 3,
        borderColor: 'transparent',
        alignItems: 'center',
        marginRight: 10,
        width: 100,
    },
    catText: { fontSize: 12, fontWeight: '800', marginTop: 5 },
    saveBtn: {
        backgroundColor: '#FFD93D',
        padding: 18,
        borderRadius: 20,
        borderWidth: 4,
        borderColor: '#000',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 4, height: 4 },
        shadowOpacity: 1,
    },
    saveBtnText: { fontSize: 20, fontWeight: '900' },
});
