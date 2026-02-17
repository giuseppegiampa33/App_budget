import React, { useState, useEffect, useMemo } from 'react';
import {
    StyleSheet,
    Text,
    View,
    ScrollView,
    TouchableOpacity,
    Modal,
    TextInput,
    Alert,
    useColorScheme,
    SafeAreaView,
    StatusBar,
    Dimensions,
    Platform,
    KeyboardAvoidingView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, Feather } from '@expo/vector-icons';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';

const { width } = Dimensions.get('window');

// --- Tipi & Costanti ---
const CATEGORIES = [
    { id: 'salary', name: 'Stipendio', icon: 'cash-outline', color: '#34C759' },
    { id: 'food', name: 'Cibo', icon: 'restaurant-outline', color: '#FF9500' },
    { id: 'transport', name: 'Trasporti', icon: 'bus-outline', color: '#5856D6' },
    { id: 'shopping', name: 'Shopping', icon: 'cart-outline', color: '#FF2D55' },
    { id: 'leisure', name: 'Svago', icon: 'game-controller-outline', color: '#AF52DE' },
    { id: 'other', name: 'Altro', icon: 'ellipsis-horizontal-outline', color: '#8E8E93' },
];

const STORAGE_KEYS = {
    TRANSACTIONS: '@mio_budget_transactions',
    TOTAL_BUDGET: '@mio_budget_total',
};

export default function App() {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';

    // --- State ---
    const [transactions, setTransactions] = useState([]);
    const [totalBudget, setTotalBudget] = useState('1000');
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [isEditingBudget, setIsEditingBudget] = useState(false);
    const [tempBudget, setTempBudget] = useState(totalBudget);

    // Form State
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [type, setType] = useState('expense'); // 'income' o 'expense'
    const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[1]);

    // --- Persistence ---
    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        saveData();
    }, [transactions, totalBudget]);

    const loadData = async () => {
        try {
            const storedTransactions = await AsyncStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
            const storedBudget = await AsyncStorage.getItem(STORAGE_KEYS.TOTAL_BUDGET);

            if (storedTransactions) setTransactions(JSON.parse(storedTransactions));
            if (storedBudget) {
                setTotalBudget(storedBudget);
                setTempBudget(storedBudget);
            }
        } catch (e) {
            console.error('Failed to load data', e);
        }
    };

    const saveData = async () => {
        try {
            await AsyncStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
            await AsyncStorage.setItem(STORAGE_KEYS.TOTAL_BUDGET, totalBudget);
        } catch (e) {
            console.error('Failed to save data', e);
        }
    };

    // --- Calcoli ---
    const currentBalance = useMemo(() => {
        return transactions.reduce((acc, curr) => {
            const val = parseFloat(curr.amount);
            return curr.type === 'income' ? acc + val : acc - val;
        }, parseFloat(totalBudget));
    }, [transactions, totalBudget]);

    const spendingPercentage = useMemo(() => {
        const totalExpenses = transactions
            .filter(t => t.type === 'expense')
            .reduce((acc, curr) => acc + parseFloat(curr.amount), 0);

        const budgetNum = parseFloat(totalBudget);
        if (budgetNum === 0) return 100;
        return Math.min((totalExpenses / budgetNum) * 100, 100);
    }, [transactions, totalBudget]);

    const getProgressColor = () => {
        if (spendingPercentage < 50) return '#34C759'; // Green
        if (spendingPercentage < 80) return '#FF9500'; // Orange
        return '#FF3B30'; // Red
    };

    // --- Actions ---
    const addTransaction = () => {
        if (!description || !amount) {
            Alert.alert('Errore', 'Inserisci descrizione e importo');
            return;
        }

        const newTransaction = {
            id: Date.now().toString(),
            description,
            amount: parseFloat(amount).toFixed(2),
            type,
            category: selectedCategory,
            date: new Date().toLocaleDateString('it-IT'),
        };

        setTransactions([newTransaction, ...transactions]);
        resetForm();
        setIsModalVisible(false);
    };

    const deleteTransaction = (id) => {
        setTransactions(transactions.filter(t => t.id !== id));
    };

    const resetForm = () => {
        setDescription('');
        setAmount('');
        setType('expense');
        setSelectedCategory(CATEGORIES[1]);
    };

    const toggleBudgetEdit = () => {
        if (isEditingBudget) {
            setTotalBudget(tempBudget || '0');
        }
        setIsEditingBudget(!isEditingBudget);
    };

    // --- Styles Dinamici ---
    const styles = createStyles(isDark);

    return (
        <SafeAreaView style={styles.container}>
            <ExpoStatusBar style={isDark ? 'light' : 'dark'} />

            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Il Mio Budget</Text>
                <TouchableOpacity onPress={() => setIsModalVisible(true)}>
                    <Ionicons name="add-circle" size={32} color="#007AFF" />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                {/* Summary Card */}
                <View style={styles.card}>
                    <View style={styles.budgetRow}>
                        <View>
                            <Text style={styles.cardLabel}>Budget Totale</Text>
                            {isEditingBudget ? (
                                <TextInput
                                    style={styles.budgetInput}
                                    value={tempBudget}
                                    onChangeText={setTempBudget}
                                    keyboardType="numeric"
                                    autoFocus
                                    onBlur={toggleBudgetEdit}
                                />
                            ) : (
                                <TouchableOpacity onPress={() => setIsEditingBudget(true)}>
                                    <Text style={styles.cardValue}>€ {totalBudget}</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                            <Text style={styles.cardLabel}>Saldo Attuale</Text>
                            <Text style={[styles.cardValue, { color: currentBalance < 0 ? '#FF3B30' : (isDark ? '#FFF' : '#000') }]}>
                                € {currentBalance.toFixed(2)}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.progressContainer}>
                        <View style={[styles.progressBar, { width: `${spendingPercentage}%`, backgroundColor: getProgressColor() }]} />
                    </View>
                    <Text style={styles.progressText}>{spendingPercentage.toFixed(0)}% del budget utilizzato</Text>
                </View>

                {/* Quick Actions */}
                <View style={styles.actionRow}>
                    <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: '#34C759' }]}
                        onPress={() => { setType('income'); setIsModalVisible(true); }}
                    >
                        <Feather name="plus-circle" size={20} color="white" />
                        <Text style={styles.actionButtonText}>Entrata</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: '#FF3B30' }]}
                        onPress={() => { setType('expense'); setIsModalVisible(true); }}
                    >
                        <Feather name="minus-circle" size={20} color="white" />
                        <Text style={styles.actionButtonText}>Uscita</Text>
                    </TouchableOpacity>
                </View>

                {/* History */}
                <Text style={styles.sectionTitle}>Cronologia Recente</Text>
                {transactions.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="receipt-outline" size={48} color={isDark ? '#444' : '#CCC'} />
                        <Text style={styles.emptyText}>Nessuna transazione ancora.</Text>
                    </View>
                ) : (
                    transactions.map((item) => (
                        <View key={item.id} style={styles.transactionItem}>
                            <View style={[styles.iconContainer, { backgroundColor: item.category.color + '20' }]}>
                                <Ionicons name={item.category.icon} size={24} color={item.category.color} />
                            </View>
                            <View style={styles.transactionInfo}>
                                <Text style={styles.transactionDesc}>{item.description}</Text>
                                <Text style={styles.transactionMeta}>{item.category.name} • {item.date}</Text>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                                <Text style={[styles.transactionAmount, { color: item.type === 'income' ? '#34C759' : '#FF3B30' }]}>
                                    {item.type === 'income' ? '+' : '-'} €{item.amount}
                                </Text>
                                <TouchableOpacity onPress={() => deleteTransaction(item.id)}>
                                    <Ionicons name="trash-outline" size={18} color="#8E8E93" style={{ marginTop: 4 }} />
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))
                )}
            </ScrollView>

            {/* Add Transaction Modal */}
            <Modal visible={isModalVisible} animationType="slide" transparent={true}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.modalOverlay}
                >
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Nuova Transazione</Text>
                            <TouchableOpacity onPress={() => { setIsModalVisible(false); resetForm(); }}>
                                <Ionicons name="close" size={24} color={isDark ? '#FFF' : '#000'} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.typeSwitcher}>
                            <TouchableOpacity
                                style={[styles.typeButton, type === 'expense' && styles.typeButtonActive]}
                                onPress={() => setType('expense')}
                            >
                                <Text style={[styles.typeButtonText, type === 'expense' && styles.typeButtonTextActive]}>Uscita</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.typeButton, type === 'income' && styles.typeButtonActive]}
                                onPress={() => setType('income')}
                            >
                                <Text style={[styles.typeButtonText, type === 'income' && styles.typeButtonTextActive]}>Entrata</Text>
                            </TouchableOpacity>
                        </View>

                        <TextInput
                            style={styles.input}
                            placeholder="Importo (es. 12.50)"
                            placeholderTextColor="#8E8E93"
                            keyboardType="decimal-pad"
                            value={amount}
                            onChangeText={setAmount}
                        />
                        <TextInput
                            style={styles.input}
                            placeholder="Descrizione"
                            placeholderTextColor="#8E8E93"
                            value={description}
                            onChangeText={setDescription}
                        />

                        <Text style={styles.label}>Categoria</Text>
                        <View style={styles.categoryGrid}>
                            {CATEGORIES.map((cat) => (
                                <TouchableOpacity
                                    key={cat.id}
                                    style={[styles.categoryItem, selectedCategory.id === cat.id && { borderColor: cat.color, borderWidth: 2 }]}
                                    onPress={() => setSelectedCategory(cat)}
                                >
                                    <Ionicons name={cat.icon} size={20} color={cat.color} />
                                    <Text style={styles.categoryLabel}>{cat.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <TouchableOpacity style={styles.saveButton} onPress={addTransaction}>
                            <Text style={styles.saveButtonText}>Salva Transazione</Text>
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </SafeAreaView>
    );
}

const createStyles = (isDark) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: isDark ? '#000000' : '#F2F2F7',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'web' ? 20 : 10,
        paddingBottom: 10,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: isDark ? '#FFFFFF' : '#000000',
        letterSpacing: -0.5,
    },
    scrollContent: {
        padding: 20,
    },
    card: {
        backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
        borderRadius: 20,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 5,
        marginBottom: 20,
    },
    cardLabel: {
        fontSize: 14,
        color: '#8E8E93',
        marginBottom: 4,
    },
    cardValue: {
        fontSize: 24,
        fontWeight: '700',
        color: isDark ? '#FFFFFF' : '#000000',
    },
    budgetRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    budgetInput: {
        fontSize: 24,
        fontWeight: '700',
        color: '#007AFF',
        borderBottomWidth: 1,
        borderBottomColor: '#007AFF',
        minWidth: 100,
    },
    progressContainer: {
        height: 12,
        backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA',
        borderRadius: 6,
        overflow: 'hidden',
        marginBottom: 8,
    },
    progressBar: {
        height: '100%',
        borderRadius: 6,
    },
    progressText: {
        fontSize: 12,
        color: '#8E8E93',
        textAlign: 'right',
    },
    actionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 30,
    },
    actionButton: {
        flex: 0.48,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 54,
        borderRadius: 16,
        gap: 8,
    },
    actionButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: isDark ? '#FFFFFF' : '#000000',
        marginBottom: 15,
    },
    transactionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
        padding: 15,
        borderRadius: 16,
        marginBottom: 10,
    },
    iconContainer: {
        width: 44,
        height: 44,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 15,
    },
    transactionInfo: {
        flex: 1,
    },
    transactionDesc: {
        fontSize: 16,
        fontWeight: '600',
        color: isDark ? '#FFFFFF' : '#000000',
    },
    transactionMeta: {
        fontSize: 13,
        color: '#8E8E93',
        marginTop: 2,
    },
    transactionAmount: {
        fontSize: 16,
        fontWeight: '700',
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 50,
    },
    emptyText: {
        marginTop: 10,
        color: '#8E8E93',
        fontSize: 16,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        padding: 20,
        paddingBottom: 40,
        minHeight: height * 0.7,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 25,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: isDark ? '#FFFFFF' : '#000000',
    },
    typeSwitcher: {
        flexDirection: 'row',
        backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA',
        borderRadius: 12,
        padding: 4,
        marginBottom: 20,
    },
    typeButton: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 8,
    },
    typeButtonActive: {
        backgroundColor: isDark ? '#3A3A3C' : '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    typeButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#8E8E93',
    },
    typeButtonTextActive: {
        color: isDark ? '#FFFFFF' : '#000000',
    },
    input: {
        backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7',
        borderRadius: 12,
        padding: 15,
        fontSize: 16,
        color: isDark ? '#FFFFFF' : '#000000',
        marginBottom: 15,
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        color: isDark ? '#FFFFFF' : '#000000',
        marginBottom: 12,
        marginTop: 5,
    },
    categoryGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 30,
    },
    categoryItem: {
        width: (width - 60) / 3,
        backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7',
        padding: 12,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        borderColor: 'transparent',
        borderWidth: 2,
    },
    categoryLabel: {
        fontSize: 12,
        color: isDark ? '#FFFFFF' : '#000000',
        textAlign: 'center',
    },
    saveButton: {
        backgroundColor: '#007AFF',
        paddingVertical: 18,
        borderRadius: 16,
        alignItems: 'center',
        shadowColor: '#007AFF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    saveButtonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: '700',
    },
});
