import React, { useState, useEffect, useMemo, useRef } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, History, Search } from 'lucide-react';
import api from '../api';
import FeeReceipt from './FeeReceipt';
import { Page } from '../App';
import { notify } from './ui/feedback';
import { ActionBar, Alert, EmptyState, Field, Steps } from './ui';
import { groupInstallments } from './fee-collection/groupInstallments';
import StudentCard from './fee-collection/StudentCard';
import FeeCard, { rupees, formatDay } from './fee-collection/FeeCard';
import PaymentModePicker, { paymentModeLabel } from './fee-collection/PaymentModePicker';
import PaymentHistoryDialog from './fee-collection/PaymentHistoryDialog';

interface FeeStudent {
    student_id: number;
    name: string;
    admNo: string;
    enrollment_no?: string;
    class: string;
    section: string;
    total_fee: number;
    paid_amount: number;
    due_amount: number;
    concession: number;
    balance: number;
    status: string;
    fatherName: string;
    fatherPhone: string | number;
    branch: string;
}

interface FeeInstallment {
    sr: number;
    title: string;
    payable: number;
    paid: boolean;
    paidAmount?: number;
    dueAmount?: number;
    paymentDate?: string;
    student_fee_id?: number;
    fee_type_id?: number;
    month?: string;
    concession?: number;
    due_date?: string;
}

interface ConcessionItem {
    fee_type_id: number;
    fee_type_name: string;
    percentage: number;
}

interface Concession {
    title: string;
    description: string;
    academic_year: string;
    is_percentage: boolean;
    show_in_payment?: boolean;
    items: ConcessionItem[];
}

const STEP_LABELS = ['Find the student', 'Choose fees', 'Payment', 'Done'];
const STUDENT_PAGE = 30;

const TakeFee: React.FC<{ navigateTo?: (page: Page) => void }> = ({ navigateTo }) => {
    // UI-only state for the step-by-step flow
    const [step, setStep] = useState(0);
    const [saving, setSaving] = useState(false);
    const [doneReceipt, setDoneReceipt] = useState<any>(null);
    const [studentLimit, setStudentLimit] = useState(STUDENT_PAGE);
    const [showPaidFees, setShowPaidFees] = useState(false);
    const [showConcession, setShowConcession] = useState(false);
    const topRef = useRef<HTMLDivElement>(null);
    const [students, setStudents] = useState<FeeStudent[]>([]);
    const [classes, setClasses] = useState<string[]>([]);
    const [sectionOptions, setSectionOptions] = useState<string[]>([]);
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedSection, setSelectedSection] = useState('');
    const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
    const [searchTerm, setSearchTerm] = useState('');


    const selectedStudent = useMemo(
        () => students.find(s => s.student_id === selectedStudentId),
        [students, selectedStudentId]
    );

    const [installments, setInstallments] = useState<FeeInstallment[]>([]);
    const [summary, setSummary] = useState({ totalPaids: 0, totalDue: 0, currentDue: 0 });

    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [selectedConcession, setSelectedConcession] = useState('0');
    const [appliedConcession, setAppliedConcession] = useState(0);
    const [itemConcessions, setItemConcessions] = useState<Record<number, number>>({});
    const [itemPayingAmounts, setItemPayingAmounts] = useState<Record<number, number | string>>({});
    const [, setPaidInput] = useState('0');

    const [concessions, setConcessions] = useState<Concession[]>([]);
    const [feeTypes, setFeeTypes] = useState<{ id: number; fee_type: string }[]>([]);
    const [selectedFeeType, setSelectedFeeType] = useState('all');

    const [showHistory, setShowHistory] = useState(false);
    const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
    const [showCancelled, setShowCancelled] = useState(false);

    const fetchPaymentHistory = async () => {
        if (!selectedStudent) return;
        try {
            const response = await api.get(
                `/fees/payments/${selectedStudent.student_id}?show_cancelled=${showCancelled}`
            );
            setPaymentHistory(response.data);
            setShowHistory(true);
        } catch (error) {
            console.error("Error fetching payment history:", error);
            notify("Failed to fetch payment history.");
        }
    };

    useEffect(() => {
        if (showHistory) {
            fetchPaymentHistory();
        }
    }, [showCancelled]);


    const handlePrintHistoryReceipt = (receiptNo: string) => {
        const payments = paymentHistory.filter(p => p.receipt_no === receiptNo);
        if (payments.length === 0) return;

        const totalPaid = payments.reduce((sum, p) => sum + parseFloat(p.amount_paid || 0), 0);
        const totalConcession = payments.reduce((sum, p) => sum + parseFloat(p.concession_amount || 0), 0);
        const totalDue = payments.reduce((sum, p) => sum + parseFloat(p.due_amount || 0), 0);
        const totalGross = payments.reduce(
            (sum, p) =>
                sum +
                (parseFloat(p.previous_due || 0) ||
                    parseFloat(p.amount_paid || 0) +
                        parseFloat(p.due_amount || 0) +
                        parseFloat(p.concession_amount || 0) ||
                    parseFloat(p.gross_amount || 0)),
            0
        );
        const netPayable = totalGross - totalConcession;

        const enrichedPayments = payments.map(p => {
            const match = installments.find(
                i => i.title === p.installment || i.title === `${p.installment} Fee`
            );
            const paid = parseFloat(p.amount_paid || 0);
            const due = parseFloat(p.due_amount || 0);
            const concession = parseFloat(p.concession_amount || 0);
            const amount =
                parseFloat(p.previous_due || 0) ||
                paid + due + concession ||
                parseFloat(p.gross_amount || 0);
            return {
                ...p,
                sr: match ? match.sr : 0,
                amount,
                gross_amount: amount,
                amount_paid: paid,
                paid: paid,
                due_amount: due,
                due: due,
                concession_amount: concession,
                concession: concession
            };
        });

        const groupedItems = groupInstallments(enrichedPayments);

        const items = groupedItems.map((g, index) => ({
            sr: index + 1,
            title: g.title,
            amount: g.amount,
            payable: g.amount,
            amount_paid: g.amount_paid !== undefined ? g.amount_paid : g.paid || 0,
            paid: g.amount_paid !== undefined ? g.amount_paid : g.paid || 0,
            due_amount: g.due_amount !== undefined ? g.due_amount : g.due || 0,
            due: g.due_amount !== undefined ? g.due_amount : g.due || 0,
            concession: g.concession || 0
        }));

        const data = {
            studentName: selectedStudent?.name,
            fatherName: selectedStudent?.fatherName,
            fatherPhone: selectedStudent?.fatherPhone,
            admissionNo: selectedStudent?.admNo,
            branch: selectedStudent?.branch,
            className: selectedStudent?.class,
            receiptNo: receiptNo,
            paymentDate: payments[0].payment_date,
            paymentMode: payments[0].mode,
            paymentNote: "",
            items,
            amount: totalGross,
            concession: totalConcession,
            payable: netPayable,
            paid: totalPaid,
            due: totalDue
        };

        setReceiptData(data);
        setShowReceipt(true);
    };

    const filteredInstallments = useMemo(() => {
        if (!selectedFeeType || selectedFeeType === 'all') return installments;
        return installments.filter(i => i.fee_type_id === Number(selectedFeeType));
    }, [installments, selectedFeeType]);

    useEffect(() => {
        const fetchFeeTypes = async () => {
            try {
                const response = await api.get('/fee-types');
                const data = response.data.fee_types || response.data;
                setFeeTypes(Array.isArray(data) ? data : []);
            } catch (error) {
                console.error("Error fetching fee types:", error);
            }
        };
        fetchFeeTypes();
    }, []);

    const handleFeeTypeChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const feeTypeIdStr = e.target.value;
        setSelectedFeeType(feeTypeIdStr);

        if (!feeTypeIdStr || feeTypeIdStr === 'all' || !selectedStudent) return;

        const feeTypeId = Number(feeTypeIdStr);
        const exists = installments.some(i => i.fee_type_id === feeTypeId);
        if (exists) return;

        notify("This fee type is not assigned to the student.");
    };
    useEffect(() => {
        const fetchConcessions = async () => {
            try {
                const response = await api.get('/concessions');
                setConcessions(response.data.concessions);
            } catch (error) {
                console.error('Error fetching concessions:', error);
            }
        };
        fetchConcessions();
    }, []);

    const [showReceipt, setShowReceipt] = useState(false);
    const [receiptData, setReceiptData] = useState<any>(null);
    const [schoolReceiptNo, setSchoolReceiptNo] = useState('');
    const [paymentNote, setPaymentNote] = useState('');
    const [paymentMode, setPaymentMode] = useState('Cash');
    const [paymentDate, setPaymentDate] = useState(new Date().toLocaleDateString('en-CA') /* local YYYY-MM-DD, not UTC */);
    const [transactionId, setTransactionId] = useState('');
    const [transactionIdDescription, setTransactionIdDescription] = useState('');
    const [chequeNo, setChequeNo] = useState('');
    const [bankName, setBankName] = useState('');
    const [chequeDate, setChequeDate] = useState('');
    // When ticked, mode/date/bank carry over to the next payment (cheque no. and txn ID never do)
    const [keepPaymentDetails, setKeepPaymentDetails] = useState(false);

    useEffect(() => {
        const fetchClasses = async () => {
            try {
                const response = await api.get('/classes');
                const classNames: string[] = response.data.classes.map((c: any) => String(c.class_name));
                setClasses([...new Set(classNames)]);
            } catch (error) {
                console.error('Error fetching classes:', error);
            }
        };
        fetchClasses();
    }, []);

    useEffect(() => {
        const fetchSections = async () => {
            if (!selectedClass) {
                setSectionOptions([]);
                setSelectedSection('');
                return;
            }
            try {
                const branch = localStorage.getItem('currentBranch') || 'All';
                const academicYear = localStorage.getItem('academicYear') || '';
                const response = await api.get('/sections', {
                    params: { class: selectedClass, branch, academic_year: academicYear }
                });
                setSectionOptions(response.data.sections || []);
            } catch (error) {
                console.error('Error fetching sections:', error);
                setSectionOptions([]);
            }
        };
        fetchSections();
    }, [selectedClass]);

    useEffect(() => {
        const fetchStudents = async () => {
            try {
                const params = new URLSearchParams();
                if (selectedClass) params.append('class', selectedClass);
                if (selectedSection) params.append('section', selectedSection);
                if (searchTerm) params.append('search', searchTerm);

                const globalBranch = localStorage.getItem('currentBranch') || 'All';
                params.append(
                    "branch",
                    globalBranch === "All Branches" || globalBranch === "All" ? "All" : globalBranch
                );
                const response = await api.get(`/fees/students?${params.toString()}`);
                const { data } = response;
                setStudents(Array.isArray(data) ? data : data.students || []);
            } catch (error) {
                console.error('Error fetching students:', error);
                setStudents([]);
            }
        };
        fetchStudents();
    }, [selectedClass, selectedSection, searchTerm]);

    useEffect(() => {
        const fetchInstallments = async () => {
            if (selectedStudent) {
                try {
                    const globalBranch = localStorage.getItem('currentBranch') || 'All';
                    const branchParam =
                        globalBranch === "All Branches" || globalBranch === "All" ? "All" : globalBranch;
                    const response = await api.get(
                        `/fees/student-details/${selectedStudent.student_id}?branch=${branchParam}`
                    );
                    setInstallments(response.data.installments || []);
                } catch (error) {
                    console.error('Error fetching installments:', error);
                    setInstallments([]);
                }
            } else {
                setInstallments([]);
            }
            handleReset({ keepPaymentDetails });
            setSelectedConcession('0');
            setAppliedConcession(0);
            setItemConcessions({});
            setShowCancelled(false);
        };
        fetchInstallments();
    }, [selectedStudent]);

    useEffect(() => {
        if (!installments || installments.length === 0) {
            setSummary({ totalPaids: 0, totalDue: 0, currentDue: 0 });
            return;
        }
        const paids = installments.reduce(
            (sum, i) => sum + (i.paidAmount || (i.paid ? i.payable : 0)),
            0
        );
        const dues = installments.filter(
            i => !i.paid && (i.dueAmount === undefined || i.dueAmount > 0)
        );
        const totalDue = dues.reduce((sum, i) => {
            const dueAmt =
                i.dueAmount !== undefined ? i.dueAmount : i.payable - (i.paidAmount || 0);
            return sum + dueAmt;
        }, 0);
        const currentDue =
            dues.length > 0
                ? dues[0].dueAmount !== undefined
                    ? dues[0].dueAmount
                    : dues[0].payable - (dues[0].paidAmount || 0)
                : 0;
        setSummary({ totalPaids: paids, totalDue, currentDue });
    }, [installments]);

    const handleSelect = (sr: number) => {
        const item = installments.find(i => i.sr === sr);
        if (!item) return;

        setSelectedIds(prev => {
            const isCurrentlySelected = prev.includes(sr);
            if (isCurrentlySelected) {
                // Deselect this item and any subsequent items OF THE SAME fee_type_id
                const sameTypeLaterSrs = installments
                    .filter(i => i.fee_type_id === item.fee_type_id && i.sr >= sr)
                    .map(i => i.sr);
                return prev.filter(id => !sameTypeLaterSrs.includes(id));
            } else {
                return [...prev, sr].sort((a, b) => a - b);
            }
        });
    };

    const handleApplyConcession = () => {
        if (selectedConcession === '0') {
            setAppliedConcession(0);
            setItemConcessions({});
            return;
        }

        const concession = concessions.find(c => c.title === selectedConcession);
        if (!concession) {
            setAppliedConcession(0);
            setItemConcessions({});
            return;
        }

        let totalDiscount = 0;
        const newItemConcessions: Record<number, number> = {};
        const selectedItemsList = installments.filter(i => selectedIds.includes(i.sr));
        const skippedItems: string[] = [];

        for (const item of selectedItemsList) {
            const rule = concession.items.find(i => i.fee_type_id === item.fee_type_id);
            if (rule) {
                if ((item.concession || 0) > 0) continue;
                if (item.due_date && paymentDate > item.due_date) {
                    skippedItems.push(`${item.title} (Due: ${item.due_date})`);
                    continue;
                }
                const amountToPay =
                    item.dueAmount !== undefined && item.dueAmount > 0 ? item.dueAmount : item.payable;
                let discount = 0;
                if (concession.is_percentage) {
                    discount = amountToPay * (rule.percentage / 100);
                } else {
                    discount = Math.min(amountToPay, rule.percentage);
                }
                discount = Math.round(discount);
                newItemConcessions[item.sr] = discount;
                totalDiscount += discount;
            }
        }

        setItemConcessions(newItemConcessions);
        setAppliedConcession(totalDiscount);

        if (skippedItems.length > 0) {
            notify(
                `Concession was NOT applied to the following installments because the Payment Date (${paymentDate}) is after the Due Date:\n\n- ${skippedItems.join('\n- ')}`
            );
        }
    };

    const selectedItems = useMemo(
        () => installments.filter(i => selectedIds.includes(i.sr)),
        [installments, selectedIds]
    );

    const amount = selectedItems.reduce((sum, item) => {
        const grossNeeded =
            item.dueAmount !== undefined && item.dueAmount > 0
                ? item.dueAmount
                : item.payable - (item.paidAmount || 0);
        return sum + grossNeeded;
    }, 0);

    const payable = Math.max(0, amount - appliedConcession);

    // Initialize or update paying amounts for selected items
    useEffect(() => {
        setItemPayingAmounts(prev => {
            const next: Record<number, number | string> = {};
            for (const item of selectedItems) {
                const itemConcession = itemConcessions[item.sr] || 0;
                const grossNeeded =
                    item.dueAmount !== undefined && item.dueAmount > 0
                        ? item.dueAmount
                        : item.payable - (item.paidAmount || 0);
                const netNeeded = Math.max(0, grossNeeded - itemConcession);

                if (prev[item.sr] !== undefined && prev[item.sr] !== '') {
                    next[item.sr] = Math.min(Number(prev[item.sr]), netNeeded);
                } else if (prev[item.sr] === '') {
                    next[item.sr] = '';
                } else {
                    next[item.sr] = netNeeded;
                }
            }
            return next;
        });
    }, [selectedIds, itemConcessions]);

    const handleItemPayingChange = (sr: number, valStr: string) => {
        if (valStr === '') {
            setItemPayingAmounts(prev => ({ ...prev, [sr]: '' }));
            return;
        }
        const num = parseFloat(valStr);
        if (isNaN(num)) return;

        const item = installments.find(i => i.sr === sr);
        if (!item) return;
        const itemConcession = itemConcessions[item.sr] || 0;
        const grossNeeded =
            item.dueAmount !== undefined && item.dueAmount > 0
                ? item.dueAmount
                : item.payable - (item.paidAmount || 0);
        const netNeeded = Math.max(0, grossNeeded - itemConcession);

        const capped = Math.max(0, Math.min(num, netNeeded));
        setItemPayingAmounts(prev => ({ ...prev, [sr]: capped }));
    };

    const handleItemPayingBlur = (sr: number) => {
        setItemPayingAmounts(prev => {
            const current = prev[sr];
            if (current === '' || current === undefined || isNaN(Number(current))) {
                return { ...prev, [sr]: 0 };
            }
            return prev;
        });
    };

    const totalPaying = useMemo(() => {
        return selectedItems.reduce((sum, item) => {
            const val = itemPayingAmounts[item.sr];
            const num = val === '' || val === undefined ? 0 : Number(val);
            return sum + (isNaN(num) ? 0 : num);
        }, 0);
    }, [selectedItems, itemPayingAmounts]);

    const due = Math.max(0, payable - totalPaying);

    useEffect(() => {
        setPaidInput(String(totalPaying));
    }, [totalPaying]);

    const handleReset = (options: { keepPaymentDetails?: boolean } = {}) => {
        setSelectedIds([]);
        setSelectedConcession('0');
        setAppliedConcession(0);
        setItemConcessions({});
        setItemPayingAmounts({});
        setPaidInput('0');
        setSelectedFeeType('all');
        setSchoolReceiptNo('');
        setPaymentNote('');
        setTransactionId('');
        setChequeNo('');
        if (!options.keepPaymentDetails) {
            setPaymentMode('Cash');
            setPaymentDate(new Date().toLocaleDateString('en-CA') /* local YYYY-MM-DD, not UTC */);
            setTransactionIdDescription('');
            setBankName('');
            setChequeDate('');
        }
    };

    const handleTakeFee = async () => {
        if (!selectedStudent || selectedItems.length === 0) {
            notify('Please select a student and at least one installment to pay.');
            return;
        }

        const totalToPay = totalPaying;
        if (totalToPay <= 0 && appliedConcession <= 0) {
            notify('Please enter a paying amount greater than 0.');
            return;
        }

        try {
            const feeAllocations = selectedItems.map((item: FeeInstallment) => {
                const currentConcession = itemConcessions[item.sr] || 0;
                const val = itemPayingAmounts[item.sr];
                const payingAmount = val === '' || val === undefined ? 0 : Number(val) || 0;
                return {
                    student_fee_id: item.student_fee_id,
                    amount: payingAmount,
                    concession_amount: currentConcession
                };
            });

            const activeAllocations = feeAllocations.filter(
                a => a.amount > 0 || a.concession_amount > 0
            );

            if (activeAllocations.length === 0) {
                notify('Please enter a paying amount greater than 0.');
                return;
            }

            const globalBranch = localStorage.getItem('currentBranch') || 'All';
            const branchParam =
                globalBranch === "All Branches" || globalBranch === "All" ? "All" : globalBranch;
            const response = await api.post(`/fees/payment?branch=${branchParam}`, {
                student_id: selectedStudent.student_id,
                amount_paid: totalToPay,
                payment_mode: paymentMode,
                payment_date: paymentDate,
                note: paymentNote,
                receipt_no: schoolReceiptNo,
                transaction_id: transactionId,
                transaction_id_description: transactionIdDescription,
                cheque_no: chequeNo,
                bank_name: bankName,
                cheque_date: chequeDate,
                fee_allocations: activeAllocations
            });

            const realReceiptNo = response.data.receipt_no;

            // Send fee receipt SMS
            try {
                const phone = selectedStudent.fatherPhone;
                if (phone) {
                    await api.post('/sms/send-fee-receipt', {
                        phone: String(phone).replace('+91', '').trim(),
                        paid_amount: totalToPay,
                        total_amount: selectedStudent.total_fee,
                        admission_no: selectedStudent.admNo,
                        balance: selectedStudent.due_amount - totalToPay,
                        branch_name: selectedStudent.branch || 'School',
                        student_id: selectedStudent.student_id
                    });
                }
            } catch (smsErr) {
                console.warn('Fee SMS failed (non-blocking):', smsErr);
            }

            const receiptLineItemsRaw = selectedItems
                .filter(item => {
                    const alloc = activeAllocations.find(a => a.student_fee_id === item.student_fee_id);
                    return alloc && (alloc.amount > 0 || alloc.concession_amount > 0);
                })
                .map((item: FeeInstallment) => {
                    const alloc = activeAllocations.find(a => a.student_fee_id === item.student_fee_id);
                    const feeTypeMatch = feeTypes.find(ft => ft.id === item.fee_type_id);
                    const grossNeeded =
                        item.dueAmount !== undefined && item.dueAmount > 0 ? item.dueAmount : item.payable;
                    const paidNow = alloc ? alloc.amount : 0;
                    const concessionNow = alloc ? alloc.concession_amount : 0;
                    const dueRemaining = Math.max(0, grossNeeded - paidNow - concessionNow);
                    return {
                        installment: item.title,
                        fee_type: feeTypeMatch?.fee_type || "Tuition Fee",
                        sr: item.sr,
                        amount_paid: paidNow,
                        paid: paidNow,
                        concession_amount: concessionNow,
                        concession: concessionNow,
                        gross_amount: grossNeeded,
                        amount: grossNeeded,
                        due_amount: dueRemaining,
                        due: dueRemaining
                    };
                });

            const groupedReceiptItems = groupInstallments(receiptLineItemsRaw);

            const data = {
                studentName: selectedStudent.name,
                fatherName: selectedStudent.fatherName,
                fatherPhone: selectedStudent.fatherPhone,
                admissionNo: selectedStudent.admNo,
                branch: selectedStudent.branch,
                className: selectedStudent.class,
                receiptNo: realReceiptNo,
                paymentDate,
                paymentMode,
                paymentNote,
                chequeNo,
                bankName,
                chequeDate,
                items: groupedReceiptItems,
                amount,
                concession: appliedConcession,
                payable,
                paid: totalToPay,
                due
            };
            setReceiptData(data);
            // The receipt is no longer popped up here: the "Done" step shows it on "Print receipt".
            setDoneReceipt(data);
            setStep(3);

            const params = new URLSearchParams();
            if (selectedClass) params.append('class', selectedClass);
            if (selectedSection) params.append('section', selectedSection);
            params.append("branch", branchParam);

            const stResponse = await api.get(`/fees/students?${params}`);
            const stData = stResponse.data;
            setStudents(Array.isArray(stData) ? stData : stData.students || []);

            const instResponse = await api.get(
                `/fees/student-details/${selectedStudent.student_id}?branch=${branchParam}`
            );
            setInstallments(instResponse.data.installments || []);
        } catch (error: any) {
            console.error('Error recording payment:', error);
            notify(error.response?.data?.error || "Failed to record payment");
        }
    };

    const handleCloseReceipt = () => {
        setShowReceipt(false);
        setReceiptData(null);
        handleReset({ keepPaymentDetails });
    };


    /* ------------------------------------------------------------------ step flow (UI only) */

    // If the chosen student disappears (e.g. the list changed), go back to finding one.
    useEffect(() => {
        if (!selectedStudent && (step === 1 || step === 2)) setStep(0);
    }, [selectedStudent, step]);

    const firstStepRender = useRef(true);
    useEffect(() => {
        if (firstStepRender.current) {
            firstStepRender.current = false;
            return;
        }
        topRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }, [step]);

    useEffect(() => {
        setStudentLimit(STUDENT_PAGE);
    }, [selectedClass, selectedSection, searchTerm]);

    const pickStudent = (id: number) => {
        setSelectedStudentId(id);
        setShowPaidFees(false);
        setShowConcession(false);
        setStep(1);
    };

    const changeStudent = () => {
        setSelectedStudentId(null);
        setStep(0);
    };

    const handleCollect = async () => {
        if (saving) return;
        setSaving(true);
        try {
            await handleTakeFee();
        } finally {
            setSaving(false);
        }
    };

    const collectFromAnother = () => {
        handleReset({ keepPaymentDetails });
        setSelectedStudentId(null);
        setSearchTerm('');
        setDoneReceipt(null);
        setStep(0);
    };

    const collectMoreFromSame = () => {
        handleReset({ keepPaymentDetails });
        setDoneReceipt(null);
        setStep(1);
    };

    const printDoneReceipt = () => {
        if (!doneReceipt) return;
        setReceiptData(doneReceipt);
        setShowReceipt(true);
    };

    const classSectionOf = (s: { class: string; section: string }) =>
        [s.class, s.section].filter(Boolean).join('-');

    // Same "must pay earlier installment first" rule as before, worked out per row.
    const feeRows = filteredInstallments.map((inst, index) => {
        let isDisabled = false;
        if (!inst.paid) {
            const previousInSameFeeType = filteredInstallments
                .slice(0, index)
                .filter(p => p.fee_type_id === inst.fee_type_id);
            const allPreviousCleared = previousInSameFeeType.every(p => p.paid || selectedIds.includes(p.sr));
            if (!allPreviousCleared) isDisabled = true;
        }
        const rowDue = inst.dueAmount !== undefined ? inst.dueAmount : inst.payable - (inst.paidAmount || 0);
        return { inst, isDisabled, isFullyPaid: inst.paid || rowDue <= 0 };
    });
    const openFeeRows = feeRows.filter(r => !r.isFullyPaid);
    const paidFeeRows = feeRows.filter(r => r.isFullyPaid);

    const feesStepReady = selectedItems.length > 0 && (totalPaying > 0 || appliedConcession > 0);
    const feesStepNote =
        selectedItems.length === 0
            ? 'Tap a fee to choose it.'
            : !feesStepReady
            ? 'Enter an amount more than ₹0 in "Paying now".'
            : `${selectedItems.length} ${selectedItems.length === 1 ? 'fee' : 'fees'} chosen · Paying ${rupees(totalPaying)}`;

    const renderFindStudent = () => (
        <div className="space-y-4">
            {selectedStudent && (
                <StudentCard
                    student={selectedStudent}
                    actions={
                        <button type="button" className="btn-secondary btn-sm" onClick={changeStudent}>
                            Change student
                        </button>
                    }
                />
            )}

            <Field
                label="Search student"
                htmlFor="fee-student-search"
                hint="Type a name, admission number or enrollment number."
            >
                <div className="relative">
                    <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                        id="fee-student-search"
                        type="search"
                        autoComplete="off"
                        placeholder="Name or admission number"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter' && students.length === 1) pickStudent(students[0].student_id);
                        }}
                        className="input pl-10 min-h-[44px]"
                    />
                </div>
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Class" htmlFor="fee-class">
                    <select
                        id="fee-class"
                        value={selectedClass}
                        onChange={e => {
                            setSelectedClass(e.target.value);
                            setSelectedSection('');
                        }}
                        className="input min-h-[44px]"
                    >
                        <option value="">All classes</option>
                        {classes.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </Field>
                <Field label="Section" htmlFor="fee-section">
                    <select
                        id="fee-section"
                        value={selectedSection}
                        onChange={e => setSelectedSection(e.target.value)}
                        disabled={!selectedClass}
                        className="input min-h-[44px]"
                    >
                        <option value="">{selectedClass ? 'All sections' : 'Choose a class first'}</option>
                        {sectionOptions.map(section => (
                            <option key={section} value={section}>{section}</option>
                        ))}
                    </select>
                </Field>
            </div>

            <div>
                <p className="text-sm text-slate-500 mb-2">
                    {students.length === 0
                        ? 'No student found.'
                        : `${students.length} ${students.length === 1 ? 'student' : 'students'} found. Tap one to continue.`}
                </p>
                {students.length === 0 ? (
                    <EmptyState
                        compact
                        title="No student found"
                        description="Check the spelling, or choose a different class."
                    />
                ) : (
                    <ul className="space-y-2">
                        {students.slice(0, studentLimit).map(s => {
                            const active = s.student_id === selectedStudentId;
                            return (
                                <li key={s.student_id}>
                                    <button
                                        type="button"
                                        onClick={() => pickStudent(s.student_id)}
                                        className={`w-full text-left rounded-xl border-2 px-4 py-3 min-h-[56px] transition-colors ${
                                            active ? 'border-brand-500 bg-brand-50' : 'border-slate-200 bg-white hover:border-slate-300'
                                        }`}
                                    >
                                        <span className="block font-medium text-slate-900 break-words">{s.name}</span>
                                        <span className="block text-sm text-slate-500 break-words">
                                            {classSectionOf(s) ? `Class ${classSectionOf(s)} · ` : ''}
                                            Admission number {s.admNo}
                                            {s.fatherName ? ` · Father: ${s.fatherName}` : ''}
                                        </span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
                {students.length > studentLimit && (
                    <button
                        type="button"
                        className="btn-ghost w-full mt-2"
                        onClick={() => setStudentLimit(l => l + STUDENT_PAGE)}
                    >
                        Show more students ({students.length - studentLimit} more)
                    </button>
                )}
            </div>

            <ActionBar note={!selectedStudent ? 'Choose a student first.' : undefined}>
                <button type="button" className="btn-primary btn-lg" disabled={!selectedStudent} onClick={() => setStep(1)}>
                    Next: choose fees
                </button>
            </ActionBar>
        </div>
    );

    const renderChooseFees = () => (
        <div className="space-y-4">
            {selectedStudent && (
                <StudentCard
                    student={selectedStudent}
                    actions={
                        <>
                            <button type="button" className="btn-secondary btn-sm" onClick={fetchPaymentHistory}>
                                <History className="w-4 h-4" /> Past payments
                            </button>
                            <button type="button" className="btn-ghost btn-sm" onClick={changeStudent}>
                                Change student
                            </button>
                        </>
                    }
                />
            )}

            <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-emerald-50 px-2 py-2 text-center">
                    <p className="text-xs text-emerald-800">Paid so far</p>
                    <p className="font-semibold text-emerald-900">{rupees(summary.totalPaids)}</p>
                </div>
                <div className="rounded-xl bg-brand-50 px-2 py-2 text-center">
                    <p className="text-xs text-brand-800">Due now</p>
                    <p className="font-semibold text-brand-900">{rupees(summary.currentDue)}</p>
                </div>
                <div className="rounded-xl bg-amber-50 px-2 py-2 text-center">
                    <p className="text-xs text-amber-800">Total due</p>
                    <p className="font-semibold text-amber-900">{rupees(summary.totalDue)}</p>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-end gap-3 justify-between">
                <h3 className="text-base font-semibold text-slate-900">Which fees are being paid?</h3>
                <div className="sm:w-56">
                    <label htmlFor="fee-type-filter" className="sr-only">Show fee type</label>
                    <select
                        id="fee-type-filter"
                        value={selectedFeeType}
                        onChange={handleFeeTypeChange}
                        disabled={!selectedStudent}
                        className="input min-h-[44px]"
                    >
                        <option value="all">All fee types</option>
                        {feeTypes.map(ft => (
                            <option key={ft.id} value={String(ft.id)}>{ft.fee_type}</option>
                        ))}
                    </select>
                </div>
            </div>

            {filteredInstallments.length === 0 ? (
                <EmptyState compact title="No fees found" description="This student has no fees of this type." />
            ) : (
                <div className="space-y-2">
                    {openFeeRows.length === 0 && (
                        <Alert tone="success">All fees shown here are fully paid.</Alert>
                    )}
                    {openFeeRows.map(({ inst, isDisabled }) => {
                        const itemConcession = itemConcessions[inst.sr] || 0;
                        const grossNeeded =
                            inst.dueAmount !== undefined && inst.dueAmount > 0
                                ? inst.dueAmount
                                : inst.payable - (inst.paidAmount || 0);
                        const netNeeded = Math.max(0, grossNeeded - itemConcession);
                        const payingVal = itemPayingAmounts[inst.sr];
                        const payingNum =
                            payingVal === '' || payingVal === undefined ? 0 : Number(payingVal) || 0;
                        const rowDue = Math.max(0, netNeeded - payingNum);
                        return (
                            <FeeCard
                                key={inst.sr}
                                installment={inst}
                                isSelected={selectedIds.includes(inst.sr)}
                                isDisabled={isDisabled}
                                onSelect={handleSelect}
                            >
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                                    <Field
                                        label="Paying now (₹)"
                                        htmlFor={`paying-${inst.sr}`}
                                        hint={
                                            rowDue > 0
                                                ? `${rupees(rowDue)} will stay due.`
                                                : `Full amount${itemConcession > 0 ? ` after ${rupees(itemConcession)} concession` : ''}.`
                                        }
                                    >
                                        <input
                                            id={`paying-${inst.sr}`}
                                            type="number"
                                            inputMode="decimal"
                                            min="0"
                                            max={netNeeded}
                                            value={payingVal ?? ''}
                                            onChange={e => handleItemPayingChange(inst.sr, e.target.value)}
                                            onBlur={() => handleItemPayingBlur(inst.sr)}
                                            className="input min-h-[44px] text-right font-semibold"
                                        />
                                    </Field>
                                    <p className="text-sm text-slate-600 sm:pb-7">
                                        Most you can pay: <span className="font-semibold">{rupees(netNeeded)}</span>
                                    </p>
                                </div>
                            </FeeCard>
                        );
                    })}

                    {paidFeeRows.length > 0 && (
                        <>
                            <button
                                type="button"
                                className="btn-ghost w-full justify-center"
                                onClick={() => setShowPaidFees(v => !v)}
                                aria-expanded={showPaidFees}
                            >
                                {showPaidFees ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                {showPaidFees ? 'Hide paid fees' : `Show paid fees (${paidFeeRows.length})`}
                            </button>
                            {showPaidFees &&
                                paidFeeRows.map(({ inst, isDisabled }) => (
                                    <FeeCard
                                        key={inst.sr}
                                        installment={inst}
                                        isSelected={selectedIds.includes(inst.sr)}
                                        isDisabled={isDisabled}
                                        onSelect={handleSelect}
                                    />
                                ))}
                        </>
                    )}
                </div>
            )}

            {/* Concession: kept, but tucked away */}
            <div className="rounded-xl border border-slate-200 bg-white">
                <button
                    type="button"
                    className="w-full flex items-center justify-between gap-2 px-4 py-3 min-h-[48px] text-sm font-medium text-slate-700"
                    onClick={() => setShowConcession(v => !v)}
                    aria-expanded={showConcession}
                >
                    <span>
                        Concession / discount
                        {appliedConcession > 0 && (
                            <span className="ml-2 text-emerald-700">({rupees(appliedConcession)} applied)</span>
                        )}
                    </span>
                    {showConcession ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {showConcession && (
                    <div className="border-t border-slate-100 px-4 py-3 space-y-3">
                        <p className="text-sm text-slate-500">
                            Choose the fees first, then apply. Fees past their due date on the payment date do not get the concession.
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Field label="Concession" htmlFor="fee-concession">
                                <select
                                    id="fee-concession"
                                    value={selectedConcession}
                                    onChange={e => setSelectedConcession(e.target.value)}
                                    className="input min-h-[44px]"
                                    disabled={!selectedStudent}
                                >
                                    <option value="0">No concession</option>
                                    {concessions
                                        .filter(c => c.show_in_payment)
                                        .map((c, idx) => (
                                            <option key={idx} value={c.title}>{c.title}</option>
                                        ))}
                                </select>
                            </Field>
                            <Field label="Payment date" htmlFor="fee-concession-date">
                                <input
                                    id="fee-concession-date"
                                    type="date"
                                    value={paymentDate}
                                    onChange={e => setPaymentDate(e.target.value)}
                                    className="input min-h-[44px]"
                                />
                            </Field>
                        </div>
                        <button
                            type="button"
                            onClick={handleApplyConcession}
                            className="btn-secondary w-full sm:w-auto"
                            disabled={!selectedStudent}
                        >
                            Apply concession
                        </button>
                    </div>
                )}
            </div>

            {/* Running total */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 space-y-1.5 text-sm">
                <div className="flex justify-between">
                    <span className="text-slate-600">Total of chosen fees</span>
                    <span className="font-medium text-slate-800">{rupees(amount)}</span>
                </div>
                {appliedConcession > 0 && (
                    <div className="flex justify-between">
                        <span className="text-slate-600">Concession</span>
                        <span className="font-medium text-emerald-700">− {rupees(appliedConcession)}</span>
                    </div>
                )}
                <div className="flex justify-between border-t border-slate-200 pt-1.5">
                    <span className="text-slate-600">To pay</span>
                    <span className="font-medium text-slate-800">{rupees(payable)}</span>
                </div>
                <div className="flex justify-between text-base">
                    <span className="font-semibold text-slate-900">Paying now</span>
                    <span className="font-semibold text-slate-900">{rupees(totalPaying)}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-slate-600">Still due after this</span>
                    <span className={`font-medium ${due > 0 ? 'text-red-600' : 'text-slate-800'}`}>{rupees(due)}</span>
                </div>
                {selectedItems.length > 0 && (
                    <div className="pt-1 text-right">
                        <button type="button" className="text-sm text-slate-500 underline-offset-2 hover:underline" onClick={() => handleReset()}>
                            Clear choices
                        </button>
                    </div>
                )}
            </div>

            <ActionBar note={feesStepNote}>
                <button type="button" className="btn-secondary btn-lg" onClick={() => setStep(0)}>
                    Back
                </button>
                <button type="button" className="btn-primary btn-lg" disabled={!feesStepReady} onClick={() => setStep(2)}>
                    Next: payment
                </button>
            </ActionBar>
        </div>
    );

    const collectLine = selectedStudent
        ? `Collect ${rupees(totalPaying)} from ${selectedStudent.name}${
              classSectionOf(selectedStudent) ? ` (Class ${classSectionOf(selectedStudent)})` : ''
          } by ${paymentModeLabel(paymentMode)}`
        : '';

    const renderPayment = () => (
        <div className="space-y-4">
            {selectedStudent && (
                <Alert tone="info" title={collectLine}>
                    {selectedItems.length} {selectedItems.length === 1 ? 'fee' : 'fees'}
                    {appliedConcession > 0 ? ` · Concession ${rupees(appliedConcession)}` : ''}
                    {due > 0 ? ` · ${rupees(due)} will stay due` : ''}
                </Alert>
            )}

            <Field label="How is the money paid?">
                <PaymentModePicker value={paymentMode} onChange={setPaymentMode} />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(paymentMode === 'CardSwap' || paymentMode === 'UPI') && (
                    <>
                        <Field
                            label="Transaction ID"
                            htmlFor="fee-txn-id"
                            hint={paymentMode === 'UPI' ? 'From the UPI app.' : 'From the card machine slip.'}
                        >
                            <input
                                id="fee-txn-id"
                                type="text"
                                value={transactionId}
                                onChange={e => setTransactionId(e.target.value)}
                                className="input min-h-[44px]"
                            />
                        </Field>
                        <Field label="Payment details" htmlFor="fee-txn-desc" hint="For example: Google Pay, or the card's bank.">
                            <input
                                id="fee-txn-desc"
                                type="text"
                                value={transactionIdDescription}
                                onChange={e => setTransactionIdDescription(e.target.value)}
                                className="input min-h-[44px]"
                            />
                        </Field>
                    </>
                )}
                {paymentMode === 'Cheque' && (
                    <>
                        <Field label="Cheque number" htmlFor="fee-cheque-no">
                            <input
                                id="fee-cheque-no"
                                type="text"
                                inputMode="numeric"
                                value={chequeNo}
                                onChange={e => setChequeNo(e.target.value)}
                                className="input min-h-[44px]"
                            />
                        </Field>
                        <Field label="Bank name" htmlFor="fee-bank">
                            <input
                                id="fee-bank"
                                type="text"
                                value={bankName}
                                onChange={e => setBankName(e.target.value)}
                                className="input min-h-[44px]"
                            />
                        </Field>
                        <Field label="Cheque date" htmlFor="fee-cheque-date">
                            <input
                                id="fee-cheque-date"
                                type="date"
                                value={chequeDate}
                                onChange={e => setChequeDate(e.target.value)}
                                className="input min-h-[44px]"
                            />
                        </Field>
                    </>
                )}
                <Field label="Payment date" htmlFor="fee-pay-date">
                    <input
                        id="fee-pay-date"
                        type="date"
                        value={paymentDate}
                        onChange={e => setPaymentDate(e.target.value)}
                        className="input min-h-[44px]"
                    />
                </Field>
                <Field label="Note (optional)" htmlFor="fee-note" hint="Up to 25 letters. Printed on the receipt.">
                    <input
                        id="fee-note"
                        type="text"
                        value={paymentNote}
                        maxLength={25}
                        onChange={e => setPaymentNote(e.target.value)}
                        className="input min-h-[44px]"
                    />
                </Field>
            </div>

            <label htmlFor="keep-details" className="flex items-start gap-3 min-h-[44px] text-sm text-slate-700">
                <input
                    id="keep-details"
                    type="checkbox"
                    checked={keepPaymentDetails}
                    onChange={e => setKeepPaymentDetails(e.target.checked)}
                    className="mt-0.5 h-5 w-5 text-brand-600 border-slate-300 rounded focus:ring-brand-500"
                />
                <span>
                    Keep the same payment way and date for the next payment
                    <span className="block text-slate-500">Cheque number and transaction ID are always cleared.</span>
                </span>
            </label>

            <ActionBar note={collectLine}>
                <button type="button" className="btn-secondary btn-lg" onClick={() => setStep(1)} disabled={saving}>
                    Back
                </button>
                <button
                    type="button"
                    className="btn-primary btn-lg"
                    onClick={handleCollect}
                    disabled={!selectedStudent || saving}
                    aria-busy={saving || undefined}
                >
                    {saving ? 'Saving…' : `Collect ${rupees(totalPaying)}`}
                </button>
            </ActionBar>
        </div>
    );

    const renderDone = () => (
        <div className="space-y-4">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-6 text-center">
                <CheckCircle2 className="w-14 h-14 text-emerald-600 mx-auto" />
                <p className="mt-3 text-xl font-semibold text-slate-900">
                    {rupees(doneReceipt?.paid ?? 0)} collected
                </p>
                {doneReceipt && (
                    <div className="mt-2 space-y-0.5 text-sm text-slate-700">
                        <p>
                            From {doneReceipt.studentName}
                            {doneReceipt.className ? ` (Class ${doneReceipt.className})` : ''}
                        </p>
                        <p>
                            Receipt number <span className="font-semibold">{doneReceipt.receiptNo}</span>
                        </p>
                        <p>
                            {paymentModeLabel(doneReceipt.paymentMode)} · {formatDay(doneReceipt.paymentDate)}
                        </p>
                        {Number(doneReceipt.due) > 0 && (
                            <p className="text-red-700">Still due on these fees: {rupees(doneReceipt.due)}</p>
                        )}
                    </div>
                )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button type="button" className="btn-primary btn-lg sm:col-span-2" onClick={printDoneReceipt} disabled={!doneReceipt}>
                    Print receipt
                </button>
                <button type="button" className="btn-secondary btn-lg" onClick={collectFromAnother}>
                    Collect from another student
                </button>
                {selectedStudent ? (
                    <button type="button" className="btn-secondary btn-lg" onClick={collectMoreFromSame}>
                        Collect more from {selectedStudent.name}
                    </button>
                ) : null}
                <button
                    type="button"
                    className={`btn-ghost btn-lg ${selectedStudent ? 'sm:col-span-2' : ''}`}
                    onClick={() => navigateTo?.('dashboard')}
                >
                    Back to home
                </button>
            </div>
        </div>
    );

    return (
        <div className="container-fluid mx-auto">
            <div ref={topRef} className="p-4 scroll-mt-4">
                <div className="card p-4 sm:p-5 max-w-3xl mx-auto">
                    <Steps
                        steps={STEP_LABELS}
                        current={step}
                        onJump={step < 3 ? setStep : undefined}
                        className="mb-5"
                    />
                    {step === 0 && renderFindStudent()}
                    {step === 1 && renderChooseFees()}
                    {step === 2 && renderPayment()}
                    {step === 3 && renderDone()}
                </div>
            </div>

            {showReceipt && receiptData && (
                <FeeReceipt onClose={handleCloseReceipt} receiptData={receiptData} />
            )}

            {showHistory && (
                <PaymentHistoryDialog
                    studentName={selectedStudent?.name}
                    academicYear={localStorage.getItem('academicYear')}
                    paymentHistory={paymentHistory}
                    installments={installments}
                    showCancelled={showCancelled}
                    onShowCancelledChange={setShowCancelled}
                    onPrint={handlePrintHistoryReceipt}
                    onClose={() => setShowHistory(false)}
                />
            )}
        </div>
    );
};

export default TakeFee;
