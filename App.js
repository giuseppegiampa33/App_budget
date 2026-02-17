import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    StyleSheet,
    Text,
    View,
    ScrollView,
    TouchableOpacity,
    Modal,
    TextInput,
    SafeAreaView,
    Platform,
    KeyboardAvoidingView,
    useWindowDimensions,
    ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';

// --- STABLE STORAGE KEY ---
const STORAGE_KEY = '@mio_budget_app_v4_stable';

const CATEGORIES = [
    { id: 'salary', name: 'Stipendio', icon: 'cash-outline', color: '#34C759' },
    { id: 'food', name: 'Cibo', icon: 'restaurant-outline', color: '#FF9500' },
    { id: 'transport', name: 'Trasporti', icon: 'bus-outline', color: '#5856D6' },
    { id: 'shopping', name: 'Shopping', icon: 'cart-outline', color: '#FF2D55' },
    { id: 'leisure', name: 'Svago', icon: 'game-controller-outline', color: '#AF52DE' },
    { id: 'other', name: 'Altro', icon: 'ellipsis-horizontal-outline', color: '#8E8E93' },
];

export default function App() {
    const { width } = useWindowDimensions();
    const isLargeScreen = width > 768;

    // --- State ---
    const [loading, setLoading] = useState(true);
    const [hasOnboarded, setHasOnboarded] = useState(false);
    const [totalBudget, setTotalBudget] = useState(0);
    const [transactions, setTransactions] = useState([]);

    // Modals Visibility
    const [isTrModalVisible, setIsTrModalVisible] = useState(false);
    const [isEditBudgetVisible, setIsEditBudgetVisible] = useState(false);

    // Form States
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [type, setType] = useState('expense'); // 'income' or 'expense'
    const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[1]);
    const [tempBudget, setTempBudget] = useState('');

    // --- Data Management ---

    const initData = async () => {
        try {
            console.log('Loading data from AsyncStorage...');
            const raw = await AsyncStorage.getItem(STORAGE_KEY);
            if (raw) {
                const data = JSON.parse(raw);
                console.log('Data loaded:', data);
                if (data.hasOnboarded) setHasOnboarded(true);
                if (data.totalBudget) setTotalBudget(parseFloat(data.totalBudget));
                if (data.transactions) setTransactions(data.transactions);
            } else {
                console.log('No data found in storage.');
            }
        } catch (e) {
            console.error('Error loading data:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        initData();
    }, []);

    const syncData = async (onboarded, budget, list) => {
        try {
            const data = {
                hasOnboarded: onboarded,
                totalBudget: budget,
                transactions: list,
            };
            console.log('Syncing to storage:', data);
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
            console.error('Error saving data:', e);
        }
    };

    // --- ACTIONS ---

    const handleOnboarding = async () => {
        console.log('Completing onboarding with budget:', tempBudget);
        const budgetNum = parseFloat(String(tempBudget).replace(',', '.'));
        if (isNaN(budgetNum) || budgetNum <= 0) {
            console.log('Invalid budget in onboarding.');
            return;
        }

        setTotalBudget(budgetNum);
        setHasOnboarded(true);
        await syncData(true, budgetNum, []);
    };

    const handleUpdateBudget = async () => {
        console.log('Updating total budget to:', tempBudget);
        const budgetNum = parseFloat(String(tempBudget).replace(',', '.'));
        if (isNaN(budgetNum)) return;

        setTotalBudget(budgetNum);
        setIsEditBudgetVisible(false);
        await syncData(true, budgetNum, transactions);
    };

    const handleAddTransaction = async () => {
        console.log('Adding transaction:', { description, amount, type, selectedCategory });
        const amtNum = parseFloat(String(amount).replace(',', '.'));

        if (isNaN(amtNum) || amtNum <= 0) {
            console.log('Invalid amount.');
            return;
        }

        const newTr = {
            id: Date.now().toString(),
            description: description || 'Senza descrizione',
            amount: amtNum.toFixed(2),
            type: type,
            category: selectedCategory,
            date: new Date().toLocaleDateString('it-IT'),
        };

        const newList = [newTr, ...transactions];
        console.log('New transaction list:', newList);

        setTransactions(newList);
        setIsTrModalVisible(false);

        // Reset Form
        setDescription('');
        setAmount('');
        setType('expense');
        setSelectedCategory(CATEGORIES[1]);

        await syncData(true, totalBudget, newList);
    };

    const handleDeleteTransaction = async (id) => {
        console.log('Deleting transaction:', id);
        const newList = transactions.filter(t => t.id !== id);
        setTransactions(newList);
        await syncData(true, totalBudget, newList);
    };

    const handleReset = async () => {
        console.log('Resetting all data...');
        await AsyncStorage.removeItem(STORAGE_KEY);
        setHasOnboarded(false);
        setTotalBudget(0);
        setTransactions([]);
    };

    // --- CALCULATIONS ---
    const currentBalance = useMemo(() => {
        const totalTr = transactions.reduce((acc, curr) => {
            const val = parseFloat(curr.amount) || 0;
            return curr.type === 'income' ? acc + val : acc - val;
        }, 0);
        return totalBudget + totalTr;
    }, [transactions, totalBudget]);

    const spendingPercentage = useMemo(() => {
        const totalExpenses = transactions
            .filter(t => t.type === 'expense')
            .reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);
        const budgetNum = totalBudget || 1;
        return Math.min((totalExpenses / budgetNum) * 100, 100);
    }, [transactions, totalBudget]);

    if (loading) {
        return (
            <View style={[styles.container, styles.centeredContent]}>
                <ActivityIndicator size="large" color="#007AFF" />
            </View>
        );
    }

    // --- VIEWS ---

    if (!hasOnboarded) {
        return (
            <View style={styles.container}>
                <ExpoStatusBar style="light" />
                <View style={styles.onboardingOverlay}>
                    <View style={styles.onboardingCard}>
                        <Ionicons name="sparkles" size={50} color="#007AFF" style={{ marginBottom: 20 }} />
                        <Text style={styles.title}>Ciao!</Text>
                        <Text style={styles.subtitle}>Inserisci il tuo budget iniziale</Text>
                        <TextInput
                            style={styles.onboardingInput}
                            placeholder="0.00"
                            placeholderTextColor="rgba(255,255,255,0.2)"
                            keyboardType="decimal-pad"
                            value={tempBudget}
                            onChangeText={setTempBudget}
                        />
                        <TouchableOpacity style={styles.primaryBtn} onPress={handleOnboarding}>
                            <Text style={styles.primaryBtnText}>Configura Tutto</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <ExpoStatusBar style="light" />
            <View style={styles.contentWrapper}>

                {/* Header */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.headerTitle}>Budget</Text>
                        <Text style={styles.headerSub}>Dashboard Finanziaria</Text>
                    </View>
                    <TouchableOpacity
                        style={styles.headerBtn}
                        onPress={() => setIsTrModalVisible(true)}
                    >
                        <Ionicons name="add" size={28} color="white" />
                    </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={styles.scrollContent}>

                    {/* GLASS CARD */}
                    <View style={styles.glassCardMain}>
                        <View style={styles.glassRow}>
                            <Text style={styles.labelTiny}>SALDO ATTUALE</Text>
                            <TouchableOpacity onPress={() => { setTempBudget(totalBudget.toString()); setIsEditBudgetVisible(true); }}>
                                <Ionicons name="pencil-outline" size={16} color="rgba(255,255,255,0.4)" />
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.balanceText}>€ {currentBalance.toFixed(2)}</Text>

                        <View style={styles.progressBox}>
                            <View style={styles.progressTrack}>
                                <View style={[styles.progressBar, { width: `${spendingPercentage}%`, backgroundColor: spendingPercentage > 85 ? '#FF3B30' : '#007AFF' }]} />
                            </View>
                            <Text style={styles.progressLabel}>{spendingPercentage.toFixed(0)}% del budget base (€{totalBudget})</Text>
                        </View>
                    </View>

                    {/* TOTALS */}
                    <View style={styles.statsRow}>
                        <View style={styles.statCard}>
                            <Ionicons name="caret-up-outline" size={18} color="#34C759" />
                            <View>
                                <Text style={styles.statLabel}>ENTRATE</Text>
                                <Text style={[styles.statValue, { color: '#34C759' }]}>
                                    +€{transactions.filter(t => t.type === 'income').reduce((a, b) => a + parseFloat(b.amount), 0).toFixed(0)}
                                </Text>
                            </View>
                        </View>
                        <View style={styles.statCard}>
                            <Ionicons name="caret-down-outline" size={18} color="#FF3B30" />
                            <View>
                                <Text style={styles.statLabel}>USCITE</Text>
                                <Text style={[styles.statValue, { color: '#FF3B30' }]}>
                                    -€{transactions.filter(t => t.type === 'expense').reduce((a, b) => a + parseFloat(b.amount), 0).toFixed(0)}
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* HISTORY */}
                    <Text style={styles.sectionTitle}>Cronologia</Text>
                    {transactions.length === 0 ? (
                        <View style={styles.emptyCard}>
                            <Ionicons name="receipt-outline" size={40} color="rgba(255,255,255,0.1)" />
                            <Text style={styles.emptyText}>Ancora nulla da mostrare</Text>
                        </View>
                    ) : (
                        transactions.map(t => (
                            <View key={t.id} style={styles.transactionCard}>
                                <View style={[styles.iconContainer, { backgroundColor: t.category.color + '20' }]}>
                                    <Ionicons name={t.category.icon} size={22} color={t.category.color} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.itemTitle}>{t.description}</Text>
                                    <Text style={styles.itemSubtitle}>{t.category.name} • {t.date}</Text>
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={[styles.itemAmt, { color: t.type === 'income' ? '#34C759' : '#FF3B30' }]}>
                                        {t.type === 'income' ? '+' : '-'}€{t.amount}
                                    </Text>
                                    <TouchableOpacity onPress={() => handleDeleteTransaction(t.id)}>
                                        <Ionicons name="trash-outline" size={16} color="rgba(255,255,255,0.2)" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))
                    )}

                    <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
                        <Text style={styles.resetBtnText}>Resetta tutti i dati</Text>
                    </TouchableOpacity>

                </ScrollView>
            </View>

            {/* ADD TRANSACTION MODAL */}
            <Modal visible={isTrModalVisible} animationType="slide" transparent={true}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContainer}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Nuova Operazione</Text>
                            <TouchableOpacity onPress={() => setIsTrModalVisible(false)} style={styles.closeBtn}>
                                <Ionicons name="close" size={24} color="white" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.typeSwitcher}>
                            <TouchableOpacity
                                style={[styles.typeButton, type === 'expense' && { backgroundColor: '#FF3B30' }]}
                                onPress={() => setType('expense')}
                            >
                                <Text style={styles.typeButtonText}>Uscita</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.typeButton, type === 'income' && { backgroundColor: '#34C759' }]}
                                onPress={() => setType('income')}
                            >
                                <Text style={styles.typeButtonText}>Entrata</Text>
                            </TouchableOpacity>
                        </View>

                        <TextInput
                            style={styles.modalInput}
                            placeholder="0.00"
                            placeholderTextColor="rgba(255,255,255,0.2)"
                            keyboardType="decimal-pad"
                            value={amount}
                            onChangeText={setAmount}
                        />
                        <TextInput
                            style={styles.modalInput}
                            placeholder="Descrizione (es. Spesa Esselunga)"
                            placeholderTextColor="rgba(255,255,255,0.2)"
                            value={description}
                            onChangeText={setDescription}
                        />

                        <Text style={styles.labelTiny}>CATEGORIA</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
                            {CATEGORIES.map(cat => (
                                <TouchableOpacity
                                    key={cat.id}
                                    style={[styles.catCard, selectedCategory.id === cat.id && { borderColor: cat.color, borderWidth: 1 }]}
                                    onPress={() => setSelectedCategory(cat)}
                                >
                                    <Ionicons name={cat.icon} size={22} color={cat.color} />
                                    <Text style={styles.catCardName}>{cat.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        <TouchableOpacity style={styles.confirmActionBtn} onPress={handleAddTransaction}>
                            <Text style={styles.confirmActionBtnText}>Salva Operazione</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* EDIT BUDGET MODAL */}
            <Modal visible={isEditBudgetVisible} animationType="fade" transparent={true}>
                <View style={styles.modalOverlay}>
                    <View style={styles.smallModal}>
                        <Text style={styles.modalTitle}>Specifica Budget</Text>
                        <TextInput
                            style={styles.modalInput}
                            placeholder="Es. 1500"
                            placeholderTextColor="rgba(255,255,255,0.2)"
                            keyboardType="decimal-pad"
                            value={tempBudget}
                            onChangeText={setTempBudget}
                            autoFocus
                        />
                        <View style={styles.modalBtnRow}>
                            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setIsEditBudgetVisible(false)}>
                                <Text style={styles.modalCancelBtnText}>Annulla</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleUpdateBudget}>
                                <Text style={styles.modalConfirmBtnText}>Salva</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    centeredContent: { justifyContent: 'center', alignItems: 'center' },
    contentWrapper: { flex: 1, width: '100%', maxWidth: 600, alignSelf: 'center' },
    onboardingOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
    onboardingCard: {
        padding: 32,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 30,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        width: '100%',
        maxWidth: 400,
        alignItems: 'center',
    },
    title: { fontSize: 32, fontWeight: '800', color: '#FFF', marginBottom: 5 },
    subtitle: { fontSize: 16, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginBottom: 30 },
    onboardingInput: {
        width: '100%',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 16,
        padding: 20,
        fontSize: 28,
        color: '#FFF',
        textAlign: 'center',
        marginBottom: 30,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    primaryBtn: { backgroundColor: '#007AFF', padding: 18, borderRadius: 16, width: '100%', alignItems: 'center' },
    primaryBtnText: { color: '#FFF', fontSize: 18, fontWeight: '700' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, paddingTop: 40 },
    headerTitle: { fontSize: 32, fontWeight: '800', color: '#FFF' },
    headerSub: { fontSize: 14, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
    headerBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.08)', justifyContent: 'center', alignItems: 'center' },
    scrollContent: { paddingHorizontal: 24, paddingBottom: 40 },
    glassCardMain: { backgroundColor: 'rgba(255,255,255,0.05)', padding: 24, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginBottom: 24 },
    glassRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    labelTiny: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: 1 },
    balanceText: { fontSize: 44, fontWeight: '800', color: '#FFF' },
    progressBox: { marginTop: 20 },
    progressTrack: { height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' },
    progressBar: { height: '100%', borderRadius: 3 },
    progressLabel: { fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 8, textAlign: 'right' },
    statsRow: { flexDirection: 'row', gap: 12, marginBottom: 30 },
    statCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', padding: 16, borderRadius: 18, flexDirection: 'row', alignItems: 'center', gap: 10 },
    statLabel: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.4)' },
    statValue: { fontSize: 16, fontWeight: '700' },
    sectionTitle: { fontSize: 22, fontWeight: '700', color: '#FFF', marginBottom: 16 },
    emptyCard: { padding: 40, alignItems: 'center' },
    emptyText: { color: 'rgba(255,255,255,0.2)', fontSize: 14, marginTop: 10 },
    transactionCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 20, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    iconContainer: { width: 42, height: 42, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    itemTitle: { fontSize: 16, fontWeight: '600', color: '#FFF' },
    itemSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 2 },
    itemAmt: { fontSize: 16, fontWeight: '700' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 20 },
    modalContainer: { backgroundColor: '#111', borderRadius: 30, padding: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    smallModal: { backgroundColor: '#111', borderRadius: 24, padding: 24, width: '100%', maxWidth: 350, alignSelf: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 24, fontWeight: '700', color: '#FFF' },
    closeBtn: { padding: 4 },
    typeSwitcher: { flexDirection: 'row', gap: 8, marginBottom: 20 },
    typeButton: { flex: 1, padding: 12, borderRadius: 12, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)' },
    typeButtonText: { color: '#FFF', fontWeight: '700' },
    modalInput: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 16, fontSize: 18, color: '#FFF', marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    catScroll: { marginTop: 10, marginBottom: 30 },
    catCard: { width: 90, padding: 16, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.03)', marginRight: 10, alignItems: 'center', borderWidth: 1, borderColor: 'transparent' },
    catCardName: { fontSize: 11, color: '#FFF', fontWeight: '600', marginTop: 8 },
    confirmActionBtn: { backgroundColor: '#007AFF', padding: 18, borderRadius: 16, alignItems: 'center' },
    confirmActionBtnText: { color: '#FFF', fontSize: 18, fontWeight: '700' },
    modalBtnRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
    modalCancelBtn: { flex: 1, padding: 16, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center' },
    modalCancelBtnText: { color: 'rgba(255,255,255,0.4)', fontWeight: '700' },
    modalConfirmBtn: { flex: 1, padding: 16, borderRadius: 16, backgroundColor: '#007AFF', alignItems: 'center' },
    modalConfirmBtnText: { color: '#FFF', fontWeight: '700' },
    resetBtn: { marginTop: 40, alignSelf: 'center', padding: 10 },
    resetBtnText: { color: 'rgba(255,0,0,0.4)', fontSize: 12, textDecorationLine: 'underline' },
});
