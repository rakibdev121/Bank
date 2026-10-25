// Nirapod Bank — Demo Mock Data (Virtual Money Only)

export const DEMO_USER = {
  id: 'usr_demo_001',
  name: 'Rahim Ahmed',
  email: 'rahim.ahmed@example.com',
  phone: '+880 1712-345678',
  accountNumber: 'NIR-4829-XXXX-7291',
  avatar: null, // initials fallback
  memberSince: '2025-03-12',
  kycStatus: 'Verified (Demo)',
};

export const INITIAL_BALANCE = 128450.75; // BDT

export const SAMPLE_CONTACTS = [
  { id: 'c1', name: 'Fatima Khan', phone: '+880 1811-223344', account: 'NIR-1192-XXXX-3381', avatar: null },
  { id: 'c2', name: 'Karim Hossain', phone: '+880 1912-556677', account: 'NIR-7743-XXXX-9012', avatar: null },
  { id: 'c3', name: 'Nusrat Jahan', phone: '+880 1613-889900', account: 'NIR-2256-XXXX-4455', avatar: null },
  { id: 'c4', name: 'Imran Chowdhury', phone: '+880 1514-112233', account: 'NIR-9981-XXXX-6677', avatar: null },
  { id: 'c5', name: 'Sadia Rahman', phone: '+880 1715-445566', account: 'NIR-3344-XXXX-8899', avatar: null },
];

export const INITIAL_TRANSACTIONS = [
  {
    id: 'txn_001',
    type: 'received',
    title: 'Salary Credit',
    counterparty: 'TechSoft BD Ltd',
    amount: 45000,
    fee: 0,
    date: '2026-10-22T09:15:00',
    status: 'completed',
    category: 'income',
    reference: 'NIR-TXN-20261022-8841',
    note: 'October salary',
  },
  {
    id: 'txn_002',
    type: 'sent',
    title: 'Send Money',
    counterparty: 'Fatima Khan',
    amount: 2500,
    fee: 10,
    date: '2026-10-21T18:42:00',
    status: 'completed',
    category: 'transfer',
    reference: 'NIR-TXN-20261021-3392',
    note: 'Dinner share',
  },
  {
    id: 'txn_003',
    type: 'sent',
    title: 'bKash Top-up',
    counterparty: 'bKash Wallet',
    amount: 1000,
    fee: 0,
    date: '2026-10-20T14:20:00',
    status: 'completed',
    category: 'topup',
    reference: 'NIR-TXN-20261020-5510',
    note: '',
  },
  {
    id: 'txn_004',
    type: 'received',
    title: 'Received from Karim',
    counterparty: 'Karim Hossain',
    amount: 5000,
    fee: 0,
    date: '2026-10-19T11:05:00',
    status: 'completed',
    category: 'transfer',
    reference: 'NIR-TXN-20261019-7723',
    note: 'Project payment',
  },
  {
    id: 'txn_005',
    type: 'sent',
    title: 'Electricity Bill',
    counterparty: 'DESCO',
    amount: 1850.5,
    fee: 0,
    date: '2026-10-18T08:30:00',
    status: 'completed',
    category: 'bill',
    reference: 'NIR-TXN-20261018-1190',
    note: 'October bill',
  },
  {
    id: 'txn_006',
    type: 'sent',
    title: 'Grocery',
    counterparty: 'Shwapno Super Shop',
    amount: 3240,
    fee: 0,
    date: '2026-10-17T19:55:00',
    status: 'completed',
    category: 'shopping',
    reference: 'NIR-TXN-20261017-6634',
    note: '',
  },
  {
    id: 'txn_007',
    type: 'sent',
    title: 'Send Money',
    counterparty: 'Nusrat Jahan',
    amount: 750,
    fee: 5,
    date: '2026-10-16T16:10:00',
    status: 'pending',
    category: 'transfer',
    reference: 'NIR-TXN-20261016-2281',
    note: 'Gift',
  },
  {
    id: 'txn_008',
    type: 'received',
    title: 'Refund',
    counterparty: 'Daraz Bangladesh',
    amount: 1299,
    fee: 0,
    date: '2026-10-15T12:00:00',
    status: 'completed',
    category: 'refund',
    reference: 'NIR-TXN-20261015-9901',
    note: 'Order cancelled',
  },
];

export const INITIAL_SAVINGS = [
  {
    id: 'sav_001',
    name: 'Emergency Fund',
    target: 100000,
    saved: 42500,
    deadline: '2026-12-31',
    color: 'emerald',
  },
  {
    id: 'sav_002',
    name: 'New Laptop',
    target: 85000,
    saved: 31200,
    deadline: '2027-03-15',
    color: 'navy',
  },
  {
    id: 'sav_003',
    name: 'Eid Shopping',
    target: 25000,
    saved: 18500,
    deadline: '2027-04-01',
    color: 'amber',
  },
];

export const INITIAL_NOTIFICATIONS = [
  {
    id: 'n1',
    type: 'transaction',
    title: 'Money Received',
    body: 'You received ৳5,000 from Karim Hossain',
    time: '2026-10-19T11:06:00',
    read: false,
  },
  {
    id: 'n2',
    type: 'security',
    title: 'New Login Detected',
    body: 'A login from Dhaka, Bangladesh on Chrome',
    time: '2026-10-22T08:00:00',
    read: false,
  },
  {
    id: 'n3',
    type: 'transaction',
    title: 'Transfer Successful',
    body: '৳2,500 sent to Fatima Khan',
    time: '2026-10-21T18:43:00',
    read: true,
  },
  {
    id: 'n4',
    type: 'system',
    title: 'Demo Mode Active',
    body: 'You are using Nirapod Bank with virtual money only.',
    time: '2026-10-22T00:00:00',
    read: true,
  },
];

export const SPENDING_DATA = [
  { name: 'Food', amount: 8500 },
  { name: 'Transport', amount: 3200 },
  { name: 'Bills', amount: 4100 },
  { name: 'Shopping', amount: 5600 },
  { name: 'Transfer', amount: 7250 },
  { name: 'Other', amount: 1800 },
];

export const ADMIN_USERS = [
  { id: 'usr_demo_001', name: 'Rahim Ahmed', phone: '+880 1712-345678', balance: 128450.75, status: 'active', txCount: 8 },
  { id: 'usr_demo_002', name: 'Ayesha Siddiqua', phone: '+880 1819-998877', balance: 45230.00, status: 'active', txCount: 12 },
  { id: 'usr_demo_003', name: 'Tanvir Islam', phone: '+880 1910-112233', balance: 8750.50, status: 'active', txCount: 5 },
  { id: 'usr_demo_004', name: 'Maliha Noor', phone: '+880 1611-445566', balance: 210000.00, status: 'active', txCount: 21 },
  { id: 'usr_demo_005', name: 'Farhan Kabir', phone: '+880 1512-778899', balance: 0, status: 'inactive', txCount: 0 },
];

export function formatBDT(amount, showSign = false) {
  const formatted = new Intl.NumberFormat('en-BD', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount));
  const prefix = showSign ? (amount >= 0 ? '+৳' : '-৳') : '৳';
  return `${prefix}${formatted}`;
}

export function formatDate(iso) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';

  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export function generateRef() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `NIR-TXN-${date}-${rand}`;
}
