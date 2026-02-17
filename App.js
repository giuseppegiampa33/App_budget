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
    BlurView, // Note: On web this might need a polyfill or fallback, we'll use a semi-transparent blur effect
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';

const STORAGE_KEYS = {
    TRANSACTIONS: '@mio_budget_transactions_v3',
    TOTAL_BUDGET: '@mio_budget_total_v3',
    HAS_ONBOARDED: '@mio_budget_onboarded_v3',
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

    const styles = createStyles(isLargeScreen, width);

    // --- Onboarding Screen ---
    if (!hasOnboarded) {
        return (
            <SafeAreaView style={styles.onboardingContainer}>
                <ExpoStatusBar style="light" />
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.centered}>
                    <View style={styles.glassOnboardingCard}>
                        <View style={styles.iconHole}>
                            <Ionicons name="sparkles" size={40} color="#007AFF" />
                        </View>
                        <Text style={styles.onboardingTitle}>Benvenuto</Text>
                        <Text style={styles.onboardingSubtitle}>Qual è il tuo punto di partenza?</Text>
                        <TextInput
                            style={styles.glassInput}
                            placeholder="0.00 €"
                            placeholderTextColor="rgba(255,255,255,0.3)"
                            keyboardType="numeric"
                            value={totalBudget}
                            onChangeText={setTotalBudget}
                            autoFocus
                        />
                        <TouchableOpacity style={styles.liquidButton} onPress={completeOnboarding}>
                            <Text style={styles.liquidButtonText}>Inizia ora</Text>
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </SafeAreaView>
        );
    }

    // --- Main App ---
    return (
        <SafeAreaView style={styles.container}>
            <ExpoStatusBar style="light" />

            <View style={styles.contentWrapper}>
                {/* Header */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.headerTitle}>Budget</Text>
                        <Text style={styles.headerSubtitle}>Analisi delle tue finanze</Text>
                    </View>
                    <TouchableOpacity
                        style={styles.headerAddButton}
                        onPress={() => setIsModalVisible(true)}
                    >
                        <Ionicons name="add" size={28} color="white" />
                    </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    {/* Main Glass Card */}
                    <View style={styles.liquidCard}>
                        <View style={styles.cardHeader}>
                            <Text style={styles.cardInfoLabel}>SALDO ATTUALE</Text>
                            <Ionicons name="card-outline" size={20} color="rgba(255,255,255,0.5)" />
                        </View>
                        <Text style={styles.balanceValue}>€ {currentBalance.toFixed(2)}</Text>

                        <View style={styles.progressContainer}>
                            <View style={styles.progressTrack}>
                                <View
                                    style={[
                                        styles.progressBar,
                                        { width: `${spendingPercentage}%`, backgroundColor: spendingPercentage > 85 ? '#FF3B30' : '#007AFF' }
                                    ]}
                                />
                            </View>
                            <Text style={styles.progressInfo}>{spendingPercentage.toFixed(0)}% utilizzato</Text>
                        </View>
                    </View>

                    {/* Activity Cards */}
                    <View style={styles.statsLayout}>
                        <View style={styles.liquidStatBox}>
                            <View style={[styles.statIcon, { backgroundColor: 'rgba(52, 199, 89, 0.1)' }]}>
                                <Ionicons name="arrow-up-circle" size={22} color="#34C759" />
                            </View>
                            <View>
                                <Text style={styles.statBoxLabel}>ENTRATE</Text>
                                <Text style={[styles.statBoxValue, { color: '#34C759' }]}>+ €{transactions.filter(t => t.type === 'income').reduce((a, b) => a + parseFloat(b.amount), 0).toFixed(0)}</Text>
                            </View>
                        </View>
                        <View style={styles.liquidStatBox}>
                            <View style={[styles.statIcon, { backgroundColor: 'rgba(255, 59, 48, 0.1)' }]}>
                                <Ionicons name="arrow-down-circle" size={22} color="#FF3B30" />
                            </View>
                            <View>
                                <Text style={styles.statBoxLabel}>USCITE</Text>
                                <Text style={[styles.statBoxValue, { color: '#FF3B30' }]}>- €{transactions.filter(t => t.type === 'expense').reduce((a, b) => a + parseFloat(b.amount), 0).toFixed(0)}</Text>
                            </View>
                        </View>
                    </View>

                    {/* History */}
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Transazioni Recenti</Text>
                        <TouchableOpacity><Text style={styles.seeAll}>Vedi tutte</Text></TouchableOpacity>
                    </View>

                    {transactions.length === 0 ? (
                        <View style={styles.glassEmptyCard}>
                            <Ionicons name="document-text-outline" size={40} color="rgba(255,255,255,0.2)" />
                            <Text style={styles.emptyText}>Ancora nessun movimento</Text>
                        </View>
                    ) : (
                        transactions.map((t) => (
                            <View key={t.id} style={styles.transactionGlassItem}>
                                <View style={[styles.trIconContainer, { backgroundColor: t.category.color + '20' }]}>
                                    <Ionicons name={t.category.icon} size={22} color={t.category.color} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.trDescriptionText}>{t.description}</Text>
                                    <Text style={styles.trMetaText}>{t.category.name} • {t.date}</Text>
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={[styles.trAmountText, { color: t.type === 'income' ? '#34C759' : '#FF3B30' }]}>
                                        {t.type === 'income' ? '+' : '-'}€{t.amount}
                                    </Text>
                                    <TouchableOpacity onPress={() => deleteTransaction(t.id)}>
                                        <Ionicons name="close-outline" size={16} color="rgba(255,255,255,0.4)" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))
                    )}
                </ScrollView>
            </View>

            {/* Modern Glass Modal */}
            <Modal visible={isModalVisible} animationType="fade" transparent={true}>
                <View style={styles.modalBackdrop}>
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.glassModal}>
                        <View style={styles.modalDragHandle} />
                        <View style={styles.glassModalHeader}>
                            <Text style={styles.glassModalTitle}>Nuova Operazione</Text>
                            <TouchableOpacity onPress={() => setIsModalVisible(false)} style={styles.modalCloseBtn}>
                                <Ionicons name="close" size={24} color="white" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.glassTypeSwitcher}>
                            <TouchableOpacity
                                style={[styles.glassTypeBtn, type === 'expense' && styles.glassTypeBtnActiveExpense]}
                                onPress={() => setType('expense')}
                            >
                                <Text style={[styles.glassTypeBtnText, type === 'expense' && styles.activeText]}>Uscita</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.glassTypeBtn, type === 'income' && styles.glassTypeBtnActiveIncome]}
                                onPress={() => setType('income')}
                            >
                                <Text style={[styles.glassTypeBtnText, type === 'income' && styles.activeText]}>Entrata</Text>
                            </TouchableOpacity>
                        </View>

                        <TextInput
                            style={styles.modalInput}
                            placeholder="0.00 €"
                            placeholderTextColor="rgba(255,255,255,0.2)"
                            keyboardType="decimal-pad"
                            value={amount}
                            onChangeText={setAmount}
                        />
                        <TextInput
                            style={styles.modalInput}
                            placeholder="Descrizione"
                            placeholderTextColor="rgba(255,255,255,0.2)"
                            value={description}
                            onChangeText={setDescription}
                        />

                        <Text style={styles.glassLabel}>Categoria</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.glassCatRow}>
                            {CATEGORIES.map(cat => (
                                <TouchableOpacity
                                    key={cat.id}
                                    style={[styles.glassCatItem, selectedCategory.id === cat.id && { backgroundColor: 'rgba(255,255,255,0.15)', borderColor: cat.color }]}
                                    onPress={() => setSelectedCategory(cat)}
                                >
                                    <Ionicons name={cat.icon} size={22} color={cat.color} />
                                    <Text style={styles.glassCatName}>{cat.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        <TouchableOpacity style={styles.glassSaveBtn} onPress={addTransaction}>
                            <Text style={styles.glassSaveBtnText}>Conferma operazione</Text>
                        </TouchableOpacity>
                    </KeyboardAvoidingView>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const createStyles = (isLargeScreen, width) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    onboardingContainer: {
        flex: 1,
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
    },
    contentWrapper: {
        flex: 1,
        width: '100%',
        maxWidth: 600,
        alignSelf: 'center',
        backgroundColor: '#000',
    },
    centered: {
        padding: 24,
        width: '100%',
        maxWidth: 400,
    },
    glassOnboardingCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 32,
        padding: 32,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        alignItems: 'center',
    },
    iconHole: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(0, 122, 255, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    onboardingTitle: { fontSize: 32, fontWeight: '700', color: '#FFF', marginBottom: 8 },
    onboardingSubtitle: { fontSize: 16, textAlign: 'center', marginBottom: 32, color: 'rgba(255,255,255,0.6)' },
    glassInput: {
        width: '100%',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 20,
        padding: 20,
        fontSize: 28,
        fontWeight: '600',
        color: '#FFF',
        textAlign: 'center',
        marginBottom: 32,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    liquidButton: {
        backgroundColor: '#007AFF',
        paddingVertical: 18,
        width: '100%',
        borderRadius: 20,
        alignItems: 'center',
        shadowColor: '#007AFF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
    },
    liquidButtonText: { fontSize: 18, fontWeight: '600', color: '#FFF' },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingTop: 32,
        paddingBottom: 16,
    },
    headerTitle: { fontSize: 34, fontWeight: '800', color: '#FFF' },
    headerSubtitle: { fontSize: 15, color: 'rgba(255,255,255,0.4)', marginTop: 4 },
    headerAddButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    scrollContent: { paddingHorizontal: 24, paddingBottom: 40 },
    liquidCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        padding: 24,
        borderRadius: 32,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        marginBottom: 24,
        marginTop: 8,
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    cardInfoLabel: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: 1 },
    balanceValue: { fontSize: 44, fontWeight: '800', color: '#FFF' },
    progressContainer: { marginTop: 24 },
    progressTrack: { height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' },
    progressBar: { height: '100%', borderRadius: 3 },
    progressInfo: { fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 8, textAlign: 'right' },
    statsLayout: { flexDirection: 'row', gap: 16, marginBottom: 32 },
    liquidStatBox: {
        flex: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        padding: 16,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    statIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
    statBoxLabel: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.4)' },
    statBoxValue: { fontSize: 16, fontWeight: '700' },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    sectionTitle: { fontSize: 20, fontWeight: '700', color: '#FFF' },
    seeAll: { color: '#007AFF', fontSize: 14, fontWeight: '600' },
    glassEmptyCard: {
        padding: 48,
        backgroundColor: 'rgba(255,255,255,0.02)',
        borderRadius: 24,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    emptyText: { color: 'rgba(255,255,255,0.2)', fontSize: 15, marginTop: 12 },
    transactionGlassItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        padding: 16,
        borderRadius: 24,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
    },
    trIconContainer: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    trDescriptionText: { fontSize: 16, fontWeight: '600', color: '#FFF' },
    trMetaText: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
    trAmountText: { fontSize: 16, fontWeight: '700' },
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
    glassModal: {
        backgroundColor: '#111',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        padding: 24,
        paddingBottom: 48,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        maxWidth: 600,
        width: '100%',
        alignSelf: 'center',
    },
    modalDragHandle: {
        width: 40,
        height: 4,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 24,
    },
    glassModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    glassModalTitle: { fontSize: 22, fontWeight: '700', color: '#FFF' },
    modalCloseBtn: { padding: 4 },
    glassTypeSwitcher: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.05)',
        padding: 4,
        borderRadius: 16,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    glassTypeBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 12 },
    glassTypeBtnActiveExpense: { backgroundColor: '#FF3B30' },
    glassTypeBtnActiveIncome: { backgroundColor: '#34C759' },
    glassTypeBtnText: { color: 'rgba(255,255,255,0.4)', fontWeight: '700', fontSize: 15 },
    activeText: { color: '#FFF' },
    modalInput: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 16,
        padding: 16,
        fontSize: 18,
        color: '#FFF',
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    glassLabel: { fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,0.4)', marginBottom: 12, letterSpacing: 1 },
    glassCatRow: { marginBottom: 32 },
    glassCatItem: {
        padding: 16,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.03)',
        marginRight: 10,
        alignItems: 'center',
        width: 100,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    glassCatName: { fontSize: 12, color: '#FFF', fontWeight: '600', marginTop: 8 },
    glassSaveBtn: {
        backgroundColor: '#007AFF',
        paddingVertical: 18,
        borderRadius: 20,
        alignItems: 'center',
    },
    glassSaveBtnText: { color: '#FFF', fontSize: 18, fontWeight: '700' },
});
