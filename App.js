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

// --- STABLE STORAGE KEYS ---
const STORAGE_KEY = '@mio_budget_data_v4_final';

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
    const [type, setType] = useState('expense');
    const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[1]);
    const [tempBudget, setTempBudget] = useState('');

    // --- Data Management ---

    // Load everything on mount
    useEffect(() => {
        const init = async () => {
            try {
                const raw = await AsyncStorage.getItem(STORAGE_KEY);
                if (raw) {
                    const data = JSON.parse(raw);
                    setHasOnboarded(data.hasOnboarded || false);
                    setTotalBudget(parseFloat(data.totalBudget) || 0);
                    setTransactions(data.transactions || []);
                }
            } catch (e) {
                console.error('Error loading data:', e);
            } finally {
                setLoading(false);
            }
        };
        init();
    }, []);

    // Sync state to storage whenever it changes
    const syncToStorage = useCallback(async (newBudget, newTransactions, onboardedStatus) => {
        try {
            const data = {
                hasOnboarded: onboardedStatus,
                totalBudget: newBudget,
                transactions: newTransactions,
            };
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
            console.error('Error syncing data:', e);
        }
    }, []);

    // --- ACTIONS ---

    const handleCompleteOnboarding = async () => {
        const budgetNum = parseFloat(tempBudget.replace(',', '.'));
        if (isNaN(budgetNum) || budgetNum <= 0) return;

        setTotalBudget(budgetNum);
        setHasOnboarded(true);
        await syncToStorage(budgetNum, [], true);
    };

    const handleUpdateBudget = async () => {
        const budgetNum = parseFloat(tempBudget.replace(',', '.'));
        if (isNaN(budgetNum)) return;

        setTotalBudget(budgetNum);
        setIsEditBudgetVisible(false);
        await syncToStorage(budgetNum, transactions, true);
    };

    const handleAddTransaction = async () => {
        const amtNum = parseFloat(amount.replace(',', '.'));
        if (!description || isNaN(amtNum) || amtNum <= 0) return;

        const newTr = {
            id: Date.now().toString(),
            description,
            amount: amtNum.toFixed(2),
            type,
            category: selectedCategory,
            date: new Date().toLocaleDateString('it-IT'),
        };

        const updatedTransactions = [newTr, ...transactions];
        setTransactions(updatedTransactions);
        setIsTrModalVisible(false);

        // Reset Form
        setDescription('');
        setAmount('');
        setType('expense');
        setSelectedCategory(CATEGORIES[1]);

        await syncToStorage(totalBudget, updatedTransactions, true);
    };

    const handleDeleteTransaction = async (id) => {
        const updated = transactions.filter(t => t.id !== id);
        setTransactions(updated);
        await syncToStorage(totalBudget, updated, true);
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

    const totals = useMemo(() => {
        return transactions.reduce((acc, curr) => {
            const val = parseFloat(curr.amount) || 0;
            if (curr.type === 'income') acc.income += val;
            else acc.expense += val;
            return acc;
        }, { income: 0, expense: 0 });
    }, [transactions]);

    if (loading) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color="#007AFF" />
            </View>
        );
    }

    // --- VIEWS ---

    if (!hasOnboarded) {
        return (
            <SafeAreaView style={styles.container}>
                <ExpoStatusBar style="light" />
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.onboardingWrapper}>
                    <View style={styles.glassCardBig}>
                        <View style={styles.iconCircleOnboarding}>
                            <Ionicons name="wallet-outline" size={48} color="#007AFF" />
                        </View>
                        <Text style={styles.title}>Mio Budget</Text>
                        <Text style={styles.subtitle}>Inserisci il tuo budget attuale per cominciare</Text>
                        <TextInput
                            style={styles.onboardingInput}
                            placeholder="0.00 €"
                            placeholderTextColor="rgba(255,255,255,0.2)"
                            keyboardType="numeric"
                            value={tempBudget}
                            onChangeText={setTempBudget}
                            autoFocus
                        />
                        <TouchableOpacity style={styles.primaryBtn} onPress={handleCompleteOnboarding}>
                            <Text style={styles.primaryBtnText}>Configura</Text>
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <ExpoStatusBar style="light" />
            <View style={styles.contentWrapper}>

                {/* Header */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.headerTitle}>Dashboard</Text>
                        <Text style={styles.headerSub}>La tua cronologia finanziaria</Text>
                    </View>
                    <TouchableOpacity
                        style={styles.circleAddBtn}
                        onPress={() => setIsTrModalVisible(true)}
                    >
                        <Ionicons name="add" size={28} color="white" />
                    </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                    {/* MAIN GLASS CARD */}
                    <View style={styles.glassCardMain}>
                        <View style={styles.glassRow}>
                            <Text style={styles.labelTiny}>SALDO ATTUALE</Text>
                            <TouchableOpacity onPress={() => { setTempBudget(totalBudget.toString()); setIsEditBudgetVisible(true); }}>
                                <Ionicons name="settings-outline" size={18} color="rgba(255,255,255,0.4)" />
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.balanceText}>€ {currentBalance.toFixed(2)}</Text>

                        <View style={styles.progressContainer}>
                            <View style={styles.progressTrack}>
                                <View style={[styles.progressBar, { width: `${spendingPercentage}%`, backgroundColor: spendingPercentage > 85 ? '#FF3B30' : '#007AFF' }]} />
                            </View>
                            <Text style={styles.progressLabel}>{spendingPercentage.toFixed(0)}% del budget (€{totalBudget})</Text>
                        </View>
                    </View>

                    {/* STATS */}
                    <View style={styles.statsRow}>
                        <View style={styles.glassStatBox}>
                            <Ionicons name="arrow-up-outline" size={16} color="#34C759" />
                            <View>
                                <Text style={styles.statLabel}>ENTRATE</Text>
                                <Text style={[styles.statValue, { color: '#34C759' }]}>+€{totals.income.toFixed(0)}</Text>
                            </View>
                        </View>
                        <View style={styles.glassStatBox}>
                            <Ionicons name="arrow-down-outline" size={16} color="#FF3B30" />
                            <View>
                                <Text style={styles.statLabel}>USCITE</Text>
                                <Text style={[styles.statValue, { color: '#FF3B30' }]}>-€{totals.expense.toFixed(0)}</Text>
                            </View>
                        </View>
                    </View>

                    {/* TRANSACTIONS */}
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Cronologia</Text>
                        <Text style={styles.sectionSub}>Ultime operazioni</Text>
                    </View>

                    {transactions.length === 0 ? (
                        <View style={styles.emptyView}>
                            <Ionicons name="receipt-outline" size={40} color="rgba(255,255,255,0.1)" />
                            <Text style={styles.emptyText}>Nessuna transazione registrata</Text>
                        </View>
                    ) : (
                        transactions.map(item => (
                            <View key={item.id} style={styles.glassItem}>
                                <View style={[styles.iconBox, { backgroundColor: item.category.color + '20' }]}>
                                    <Ionicons name={item.category.icon} size={22} color={item.category.color} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.itemDesc}>{item.description}</Text>
                                    <Text style={styles.itemMeta}>{item.category.name} • {item.date}</Text>
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={[styles.itemAmount, { color: item.type === 'income' ? '#34C759' : '#FF3B30' }]}>
                                        {item.type === 'income' ? '+' : '-'}€{item.amount}
                                    </Text>
                                    <TouchableOpacity onPress={() => handleDeleteTransaction(item.id)}>
                                        <Ionicons name="remove-circle-outline" size={16} color="rgba(255,255,255,0.2)" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))
                    )}
                </ScrollView>
            </View>

            {/* MODAL: ADD TRANSACTION */}
            <Modal visible={isTrModalVisible} animationType="slide" transparent={true}>
                <View style={styles.modalOverlay}>
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Nuova Spesa/Entrata</Text>
                            <TouchableOpacity onPress={() => setIsTrModalVisible(false)}>
                                <Ionicons name="close" size={24} color="white" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.typeSwitcher}>
                            <TouchableOpacity
                                style={[styles.typeBtn, type === 'expense' && { backgroundColor: '#FF3B30' }]}
                                onPress={() => setType('expense')}
                            >
                                <Text style={styles.typeBtnText}>Uscita</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.typeBtn, type === 'income' && { backgroundColor: '#34C759' }]}
                                onPress={() => setType('income')}
                            >
                                <Text style={styles.typeBtnText}>Entrata</Text>
                            </TouchableOpacity>
                        </View>

                        <TextInput
                            style={styles.modalInput}
                            placeholder="Importo (es. 20.00)"
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

                        <Text style={styles.labelTiny}>Scegli Categoria</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catRow}>
                            {CATEGORIES.map(cat => (
                                <TouchableOpacity
                                    key={cat.id}
                                    style={[styles.catItem, selectedCategory.id === cat.id && { borderColor: cat.color, borderWidth: 1 }]}
                                    onPress={() => setSelectedCategory(cat)}
                                >
                                    <Ionicons name={cat.icon} size={22} color={cat.color} />
                                    <Text style={styles.catName}>{cat.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        <TouchableOpacity style={styles.actionBtn} onPress={handleAddTransaction}>
                            <Text style={styles.actionBtnText}>Conferma operazione</Text>
                        </TouchableOpacity>
                    </KeyboardAvoidingView>
                </View>
            </Modal>

            {/* MODAL: EDIT BUDGET */}
            <Modal visible={isEditBudgetVisible} animationType="fade" transparent={true}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContentSmall}>
                        <Text style={styles.modalTitle}>Modifica Budget</Text>
                        <Text style={styles.modalSub}>Aggiorna il tuo budget base</Text>
                        <TextInput
                            style={styles.modalInput}
                            placeholder="0.00 €"
                            placeholderTextColor="rgba(255,255,255,0.2)"
                            keyboardType="numeric"
                            value={tempBudget}
                            onChangeText={setTempBudget}
                            autoFocus
                        />
                        <View style={styles.btnRow}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsEditBudgetVisible(false)}>
                                <Text style={styles.cancelBtnText}>Annulla</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.confirmBtn} onPress={handleUpdateBudget}>
                                <Text style={styles.confirmBtnText}>Salva</Text>
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
    contentWrapper: { flex: 1, width: '100%', maxWidth: 600, alignSelf: 'center' },
    onboardingWrapper: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
    glassCardBig: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 32,
        padding: 32,
        width: '100%',
        maxWidth: 400,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    iconCircleOnboarding: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(0,122,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    title: { fontSize: 32, fontWeight: '800', color: '#FFF', marginBottom: 8 },
    subtitle: { fontSize: 16, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginBottom: 32 },
    onboardingInput: {
        width: '100%',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 16,
        padding: 20,
        fontSize: 28,
        color: '#FFF',
        textAlign: 'center',
        marginBottom: 32,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    primaryBtn: {
        backgroundColor: '#007AFF',
        width: '100%',
        padding: 18,
        borderRadius: 16,
        alignItems: 'center',
    },
    primaryBtnText: { color: '#FFF', fontSize: 18, fontWeight: '700' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, paddingTop: 40 },
    headerTitle: { fontSize: 34, fontWeight: '800', color: '#FFF' },
    headerSub: { fontSize: 14, color: 'rgba(255,255,255,0.3)', marginTop: 4 },
    circleAddBtn: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(255,255,255,0.08)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    scrollContent: { paddingHorizontal: 24, paddingBottom: 40 },
    glassCardMain: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 24,
        padding: 24,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        marginBottom: 24,
    },
    glassRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    labelTiny: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: 1 },
    balanceText: { fontSize: 48, fontWeight: '800', color: '#FFF' },
    progressContainer: { marginTop: 24 },
    progressTrack: { height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' },
    progressBar: { height: '100%', borderRadius: 3 },
    progressLabel: { fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 8, textAlign: 'right' },
    statsRow: { flexDirection: 'row', gap: 16, marginBottom: 32 },
    glassStatBox: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.05)',
        padding: 16,
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    statLabel: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.4)' },
    statValue: { fontSize: 16, fontWeight: '700' },
    sectionHeader: { marginBottom: 16 },
    sectionTitle: { fontSize: 22, fontWeight: '700', color: '#FFF' },
    sectionSub: { fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 2 },
    emptyView: { padding: 48, alignItems: 'center' },
    emptyText: { color: 'rgba(255,255,255,0.2)', fontSize: 14, marginTop: 12 },
    glassItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 20,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    iconBox: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    itemDesc: { fontSize: 16, fontWeight: '600', color: '#FFF' },
    itemMeta: { fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 2 },
    itemAmount: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 24 },
    modalContent: {
        backgroundColor: '#111',
        borderRadius: 32,
        padding: 24,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    modalContentSmall: {
        backgroundColor: '#111',
        borderRadius: 24,
        padding: 24,
        width: '100%',
        maxWidth: 350,
        alignSelf: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    modalTitle: { fontSize: 24, fontWeight: '700', color: '#FFF' },
    modalSub: { fontSize: 14, color: 'rgba(255,255,255,0.4)', marginBottom: 24 },
    typeSwitcher: { flexDirection: 'row', gap: 8, marginBottom: 24 },
    typeBtn: { flex: 1, padding: 12, borderRadius: 12, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)' },
    typeBtnText: { color: '#FFF', fontWeight: '700' },
    modalInput: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 16,
        padding: 16,
        fontSize: 18,
        color: '#FFF',
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    catRow: { marginTop: 12, marginBottom: 32 },
    catItem: {
        width: 90,
        padding: 16,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.03)',
        marginRight: 10,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'transparent',
    },
    catName: { fontSize: 11, color: '#FFF', fontWeight: '600', marginTop: 8 },
    actionBtn: { backgroundColor: '#007AFF', padding: 18, borderRadius: 16, alignItems: 'center' },
    actionBtnText: { color: '#FFF', fontSize: 18, fontWeight: '700' },
    btnRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
    cancelBtn: { flex: 1, padding: 16, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center' },
    cancelBtnText: { color: 'rgba(255,255,255,0.5)', fontWeight: '700' },
    confirmBtn: { flex: 1, padding: 16, borderRadius: 16, backgroundColor: '#007AFF', alignItems: 'center' },
    confirmBtnText: { color: '#FFF', fontWeight: '700' },
});
